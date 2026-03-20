"""Logs router for fetching logs from Scope server."""

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ..config import settings

router = APIRouter()


class LogLine(BaseModel):
    """A single log line."""

    timestamp: str | None = None
    level: str | None = None
    message: str


class LogResponse(BaseModel):
    """Response containing log lines."""

    lines: list[str]
    offset: int


class LogEntriesResponse(BaseModel):
    """Response containing parsed log entries."""

    logs: list[LogLine]
    offset: int


@router.get("/logs", response_model=LogResponse)
async def get_logs(
    lines: int = Query(default=200, ge=1, le=1000),
    since_offset: int = Query(default=0, ge=0),
):
    """Get recent log lines from Scope server.

    Args:
        lines: Number of lines to return
        since_offset: Byte offset for incremental polling

    Returns:
        JSON with "lines" (list of strings) and "offset" (byte offset for next poll)
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(
                f"{settings.scope_api_url}/api/v1/logs/tail",
                params={"lines": lines, "since_offset": since_offset},
            )
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code, detail="Failed to fetch logs"
                )
            data = response.json()
            return LogResponse(
                lines=data.get("lines", []),
                offset=data.get("offset", 0),
            )
        except httpx.ConnectError:
            raise HTTPException(status_code=503, detail="Scope server not available")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs/current")
async def get_current_log():
    """Get the full current log file from Scope server.

    Returns the entire log file as plain text for download.
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(f"{settings.scope_api_url}/api/v1/logs/current")
            if response.status_code == 404:
                return {"message": "No log file found", "content": ""}
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code, detail="Failed to fetch logs"
                )
            return {"content": response.text}
        except httpx.ConnectError:
            raise HTTPException(status_code=503, detail="Scope server not available")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
