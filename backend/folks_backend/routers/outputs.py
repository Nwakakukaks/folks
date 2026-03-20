"""Output management router - handles NDI and other output sink configuration."""

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..config import settings

router = APIRouter()


class NDIOutputConfig(BaseModel):
    """NDI output configuration."""

    enabled: bool = False
    name: str = "Scope-Output"


class NDIOutputStatus(BaseModel):
    """NDI output status."""

    available: bool = False
    configured: bool = False
    enabled: bool = False
    name: str = "Scope-Output"
    resolution: str | None = None
    frame_rate: float | None = None


class NDIOutputResponse(BaseModel):
    """Response for NDI output configuration."""

    success: bool
    message: str
    configured: NDIOutputStatus


@router.get("/outputs/ndi", response_model=NDIOutputStatus)
async def get_ndi_status():
    """Get current NDI output status."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(f"{settings.scope_api_url}/api/v1/status")
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code, detail="Failed to get status"
                )
            data = response.json()

            return NDIOutputStatus(
                available=data.get("ndi_available", False),
                configured=False,
                enabled=False,
                name="Scope-Output",
                resolution=None,
                frame_rate=None,
            )
        except httpx.ConnectError:
            raise HTTPException(status_code=503, detail="Scope server not available")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


@router.post("/outputs/ndi", response_model=NDIOutputResponse)
async def configure_ndi(config: NDIOutputConfig):
    """Configure NDI output settings."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.post(
                f"{settings.scope_api_url}/api/v1/outputs/ndi",
                json={"enabled": config.enabled, "name": config.name},
            )
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to configure NDI: {response.text}",
                )
            return NDIOutputResponse(
                success=True,
                message="NDI output configured",
                configured=NDIOutputStatus(
                    available=True,
                    configured=True,
                    enabled=config.enabled,
                    name=config.name,
                    resolution=None,
                    frame_rate=None,
                ),
            )
        except httpx.ConnectError:
            raise HTTPException(status_code=503, detail="Scope server not available")
        except httpx.HTTPStatusError:
            return NDIOutputResponse(
                success=False,
                message="NDI output not yet supported in Scope server",
                configured=NDIOutputStatus(
                    available=False,
                    configured=False,
                    enabled=False,
                    name=config.name,
                    resolution=None,
                    frame_rate=None,
                ),
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
