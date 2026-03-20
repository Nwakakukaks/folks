"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface PipelineStatus {
  status: "not_loaded" | "loading" | "loaded" | "error";
  pipeline_id?: string;
  load_params?: Record<string, unknown>;
  error?: string;
}

export interface PipelineInfo {
  pipeline_id: string;
  pipeline_name: string;
  pipeline_description?: string;
  supported_modes: string[];
  default_mode?: string;
  plugin_name?: string;
  config_schema?: Record<string, unknown>;
}

export interface PluginInfo {
  name: string;
  version: string;
  source: string;
  pipelines: string[];
}

export interface OutputStatus {
  ndi: {
    available: boolean;
    enabled: boolean;
    name: string;
    connected: boolean;
  };
}

export interface LogEntry {
  timestamp: string;
  source: string;
  message: string;
}

export interface IceServer {
  urls: string;
  username?: string;
  credential?: string;
}

export interface IceServersResponse {
  iceServers: IceServer[];
}

export interface WebRTCOfferResponse {
  sdp: string;
  type: string;
  sessionId: string;
}

export interface CloudStatus {
  connected: boolean;
  connecting: boolean;
  webrtc_connected: boolean;
  app_id?: string;
  credentials_configured: boolean;
}

const SCOPE_API_URL = "/api/scope";

export const getBackendUrl = () => {
  if (typeof window === "undefined") return "";

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (apiUrl) {
    return apiUrl;
  }
  return "";
};

export function useScopeServer() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pipelines, setPipelines] = useState<Record<string, PipelineInfo>>({});
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(
    null,
  );
  const [cloudStatus, setCloudStatus] = useState<CloudStatus | null>(null);
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [outputStatus, setOutputStatus] = useState<OutputStatus | null>(null);
  const [activePipeline, setActivePipeline] = useState<string | null>(null);
  const [configSchema, setConfigSchema] = useState<Record<string, any> | null>(null);
  const [isLoadingPipeline, setIsLoadingPipeline] = useState(false);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);

  const checkConnection = useCallback(async () => {
    try {
      const backendUrl = getBackendUrl();
      const fullUrl = `${backendUrl}${SCOPE_API_URL}/health`;
      
      console.log("[useScopeServer] checkConnection: Testing connection to:", fullUrl);

      const response = await fetch(fullUrl);

      if (response.ok) {
        console.log("[useScopeServer] checkConnection: ✓ Connected to Scope server");
        setIsConnected(true);
        setError(null);
        return true;
      }
      console.log("[useScopeServer] checkConnection: ✗ Server returned status:", response.status);
      setIsConnected(false);
      const errorText = await response.text();
      setError(`Server returned ${response.status}: ${errorText}`);
      return false;
    } catch (err) {
      console.log("[useScopeServer] checkConnection: ✗ Cannot connect:", err);
      setIsConnected(false);
      setError(`Cannot connect to Scope server: ${err}`);
      return false;
    }
  }, []);

  const fetchPipelines = useCallback(async () => {
    try {
      console.log("[useScopeServer] fetchPipelines: Fetching from /api/scope/pipelines...");
      const response = await fetch(
        `${getBackendUrl()}${SCOPE_API_URL}/pipelines`,
      );
      console.log("[useScopeServer] fetchPipelines: Response status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[useScopeServer] fetchPipelines: ✗ Failed:", errorText.substring(0, 200));
        return null;
      }
      
      const data = await response.json();
      const pipelinesData = data.pipelines || {};
      console.log("[useScopeServer] fetchPipelines: ✓ Got", Object.keys(pipelinesData).length, "pipelines");
      setPipelines(pipelinesData);
      
      // Also fetch plugins (no deps needed)
      fetchPlugins();
      
      return pipelinesData;
    } catch (err) {
      console.error("[useScopeServer] fetchPipelines: ✗ Error:", err);
      return null;
    }
  }, []);

  const fetchPlugins = useCallback(async () => {
    try {
      console.log("[useScopeServer] fetchPlugins: Fetching from /api/scope/plugins...");
      const response = await fetch(
        `${getBackendUrl()}${SCOPE_API_URL}/plugins`,
      );
      if (response.ok) {
        const data = await response.json();
        console.log("[useScopeServer] fetchPlugins: ✓ Got", (data.plugins || []).length, "plugins");
        setPlugins(data.plugins || []);
      } else {
        console.error("[useScopeServer] fetchPlugins: ✗ Status:", response.status);
      }
    } catch (err) {
      console.error("[useScopeServer] fetchPlugins: ✗ Error:", err);
    }
  }, []);

  const installPlugin = useCallback(async (spec: string) => {
    const response = await fetch(`${getBackendUrl()}${SCOPE_API_URL}/plugins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to install plugin");
    }
    await fetchPlugins();
    return response.json();
  }, [fetchPlugins]);

  const uninstallPlugin = useCallback(async (name: string) => {
    const response = await fetch(`${getBackendUrl()}${SCOPE_API_URL}/plugins/${name}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to uninstall plugin");
    }
    await fetchPlugins();
  }, [fetchPlugins]);

  const reloadPlugin = useCallback(async (name: string) => {
    const response = await fetch(`${getBackendUrl()}${SCOPE_API_URL}/plugins/${name}/reload`, {
      method: "POST",
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to reload plugin");
    }
    await fetchPlugins();
    await fetchPipelines();
  }, [fetchPlugins, fetchPipelines]);

  const configureNDI = useCallback(async (enabled: boolean, name: string) => {
    const response = await fetch(`${getBackendUrl()}${SCOPE_API_URL}/outputs/ndi`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, name }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to configure NDI");
    }
    return response.json();
  }, []);

  const getOutputStatus = useCallback(async () => {
    const response = await fetch(`${getBackendUrl()}${SCOPE_API_URL}/outputs/ndi`);
    if (response.ok) {
      const data = await response.json();
      setOutputStatus({ ndi: data });
      return data;
    }
    return null;
  }, []);

  const fetchLogs = useCallback(async (lines: number = 200, offset: number = 0) => {
    try {
      const response = await fetch(
        `${getBackendUrl()}${SCOPE_API_URL}/logs?lines=${lines}&since_offset=${offset}`,
      );
      if (response.ok) {
        const data = await response.json();
        return {
          lines: data.lines || [],
          offset: data.offset || 0,
        };
      }
      return { lines: [], offset: 0 };
    } catch (err) {
      console.error("Failed to fetch logs:", err);
      return { lines: [], offset: 0 };
    }
  }, []);

  const getPipelineStatus = useCallback(async () => {
    try {
      const response = await fetch(
        `${getBackendUrl()}${SCOPE_API_URL}/pipeline/status`,
      );
      const data = await response.json();
      setPipelineStatus(data);
      return data;
    } catch (err) {
      console.error("Failed to get pipeline status:", err);
      return null;
    }
  }, []);

  const loadPipeline = useCallback(
    async (
      pipelineIds: string[],
      loadParams?: Record<string, unknown>,
      waitForLoad: boolean = true,
    ) => {
      try {
        console.log("[useScopeServer] loadPipeline called with:", { pipelineIds, loadParams, waitForLoad });
        setIsLoadingPipeline(true);
        setPipelineStatus({ status: "loading" });
        
        // Set active pipeline and fetch its schema
        const mainPipeline = pipelineIds[pipelineIds.length - 1];
        setActivePipeline(mainPipeline);
        console.log("[useScopeServer] Active pipeline set to:", mainPipeline);
        
        // Fetch config schema for the main pipeline
        if (pipelines[mainPipeline]?.config_schema) {
          setConfigSchema(pipelines[mainPipeline].config_schema as Record<string, any>);
          console.log("[useScopeServer] Config schema loaded for:", mainPipeline);
        }

        console.log("[useScopeServer] Calling POST /api/scope/pipeline/load...");
        const response = await fetch(
          `${getBackendUrl()}${SCOPE_API_URL}/pipeline/load`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pipeline_ids: pipelineIds,
              load_params: loadParams || {},
            }),
          },
        );

        console.log("[useScopeServer] Pipeline load response status:", response.status);

        if (!response.ok) {
          const contentType = response.headers.get("content-type");
          let errorMessage = "Failed to load pipeline";
          if (contentType?.includes("application/json")) {
            try {
              const errorData = await response.json();
              errorMessage = errorData.detail || errorMessage;
            } catch {
              const errorText = await response.text();
              errorMessage = errorText.substring(0, 200);
            }
          } else {
            const errorText = await response.text();
            errorMessage = errorText.substring(0, 200);
          }
          console.error("[useScopeServer] Pipeline load failed:", errorMessage);
          throw new Error(errorMessage);
        }

        console.log("[useScopeServer] Pipeline load request succeeded");

        // If waitForLoad is true, poll until pipeline is loaded (with shorter timeout)
        if (waitForLoad) {
          const maxTimeout = 30000; // 30 seconds - reduced from 2 minutes
          const pollInterval = 1000;
          const startTime = Date.now();

          while (Date.now() - startTime < maxTimeout) {
            await new Promise((resolve) => setTimeout(resolve, pollInterval));
            
            try {
              const statusResponse = await fetch(
                `${getBackendUrl()}${SCOPE_API_URL}/pipeline/status`,
              );
              const statusData = await statusResponse.json();
              console.log("[useScopeServer] Pipeline status:", statusData);
              setPipelineStatus(statusData);

              if (statusData.status === "loaded") {
                setIsLoadingPipeline(false);
                console.log("[useScopeServer] ✓ Pipeline loaded successfully");
                return statusData;
              } else if (statusData.status === "error") {
                setIsLoadingPipeline(false);
                throw new Error(statusData.error || "Pipeline load failed");
              }
            } catch (pollErr) {
              console.error("[useScopeServer] Error polling pipeline status:", pollErr);
            }
          }
          setIsLoadingPipeline(false);
          throw new Error("Pipeline load timeout after 30 seconds");
        }

        const data = await response.json();
        setIsLoadingPipeline(false);
        return data;
      } catch (err) {
        setIsLoadingPipeline(false);
        console.error("[useScopeServer] ❌ loadPipeline failed:", err);
        setPipelineStatus({
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        });
        throw err;
      }
    },
    [pipelines],
  );

  const getCloudStatus = useCallback(async () => {
    try {
      const response = await fetch(
        `${getBackendUrl()}${SCOPE_API_URL}/cloud/status`,
      );
      const data = await response.json();
      setCloudStatus(data);
      return data;
    } catch (err) {
      console.error("Failed to get cloud status:", err);
      return null;
    }
  }, []);

  const connectToCloud = useCallback(
    async (appId?: string, apiKey?: string) => {
      try {
        setIsConnecting(true);
        const response = await fetch(
          `${getBackendUrl()}${SCOPE_API_URL}/cloud/connect`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              app_id: appId,
              api_key: apiKey,
            }),
          },
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || "Failed to connect to cloud");
        }

        const data = await response.json();
        return data;
      } catch (err) {
        console.error("Failed to connect to cloud:", err);
        throw err;
      } finally {
        setIsConnecting(false);
      }
    },
    [],
  );

  const disconnectFromCloud = useCallback(async () => {
    try {
      const response = await fetch(
        `${getBackendUrl()}${SCOPE_API_URL}/cloud/disconnect`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to disconnect from cloud");
      }

      return await response.json();
    } catch (err) {
      console.error("Failed to disconnect from cloud:", err);
      throw err;
    }
  }, []);

  const startWebRTC = useCallback(
    async (
      onRemoteStream: (stream: MediaStream) => void,
      initialParameters?: Record<string, unknown>,
      localStream?: MediaStream | null,
    ) => {
      try {
        console.log("[useScopeServer] startWebRTC called");
        console.log("[useScopeServer] Backend URL:", getBackendUrl());
        console.log("[useScopeServer] Initial parameters:", JSON.stringify(initialParameters, null, 2));
        console.log("[useScopeServer] Local stream present:", !!localStream);
        if (localStream) {
          console.log("[useScopeServer] Local stream tracks:", localStream.getTracks().map(t => t.kind));
        }

        console.log("[useScopeServer] Fetching ICE servers from /api/scope/webrtc/ice-servers...");
        const iceResponse = await fetch(
          `${getBackendUrl()}${SCOPE_API_URL}/webrtc/ice-servers`,
        );
        console.log("[useScopeServer] ICE servers response status:", iceResponse.status);
        
        if (!iceResponse.ok) {
          const errorText = await iceResponse.text();
          throw new Error(`Failed to get ICE servers: ${errorText.substring(0, 200)}`);
        }
        
        const iceData: IceServersResponse = await iceResponse.json();
        console.log("[useScopeServer] ICE servers received:", iceData);

        // Helper to normalize urls (can be string or array)
        const normalizeUrls = (urls: string | string[]): string[] => {
          if (typeof urls === "string") return [urls];
          return urls;
        };

        // Build ICE server config - handle both string and array formats
        const config: RTCConfiguration = {
          iceServers: [
            ...(iceData.iceServers || []).map((server) => ({
              urls: normalizeUrls(server.urls),
              ...(server.username && { username: server.username }),
              ...(server.credential && { credential: server.credential }),
            })),
            { urls: "stun:stun.l.google.com:19302" }, // Google fallback
          ],
        };

        console.log("[useScopeServer] ICE servers config prepared, servers count:", config.iceServers?.length || 0);

        console.log("[useScopeServer] Creating RTCPeerConnection...");
        const pc = new RTCPeerConnection(config);
        peerConnectionRef.current = pc;

        // Create data channel for parameter updates (like Scope)
        const dataChannel = pc.createDataChannel("parameters", {
          ordered: true,
        });
        dataChannelRef.current = dataChannel;

        let dataChannelReady = new Promise<void>((resolve) => {
          dataChannel.onopen = () => resolve();
        });

        // Add local video track if provided
        let transceiver: RTCRtpTransceiver | undefined;
        if (localStream) {
          localStream.getVideoTracks().forEach((track) => {
            const sender = pc.addTrack(track, localStream);
            transceiver = pc.getTransceivers().find((t) => t.sender === sender);
          });
          localStream.getAudioTracks().forEach((track) => {
            pc.addTrack(track, localStream);
          });
        } else {
          console.log(
            "[OpenScope] No video stream - adding video transceiver for no-input pipelines",
          );
          transceiver = pc.addTransceiver("video");
        }

        // Force VP8 codec for aiortc compatibility (like Scope)
        if (transceiver) {
          const codecs = RTCRtpReceiver.getCapabilities("video")?.codecs || [];
          const vp8Codecs = codecs.filter(
            (c) => c.mimeType.toLowerCase() === "video/vp8",
          );
          if (vp8Codecs.length > 0) {
            transceiver.setCodecPreferences(vp8Codecs);
            console.log(
              "[OpenScope] Forced VP8-only codec for aiortc compatibility",
            );
          }
        }

        pc.ontrack = (event) => {
          const stream = event.streams[0];
          if (stream) {
            remoteStreamRef.current = stream;
            onRemoteStream(stream);
          }
        };

        // Log ICE connection state changes
        pc.oniceconnectionstatechange = () => {
          console.log(
            "[OpenScope] ICE connection state:",
            pc.iceConnectionState,
          );
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            console.log(
              "[OpenScope] Local ICE candidate:",
              event.candidate.toJSON(),
            );
          }
          if (event.candidate && sessionIdRef.current) {
            const iceUrl = `${getBackendUrl()}${SCOPE_API_URL}/webrtc/ice?session_id=${sessionIdRef.current}`;
            console.log("[OpenScope] Sending ICE candidate to:", iceUrl);
            fetch(iceUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(event.candidate.toJSON()),
            }).catch((err) =>
              console.error("[OpenScope] ICE candidate send failed:", err),
            );
          }
        };

        // Log when remote ICE candidates are received
        const originalAddIceCandidate = pc.addIceCandidate.bind(pc);
        pc.addIceCandidate = async (candidate) => {
          console.log("[OpenScope] Adding remote ICE candidate:", candidate);
          return originalAddIceCandidate(candidate);
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const requestBody = {
          sdp: pc.localDescription?.sdp,
          type: pc.localDescription?.type,
          initialParameters: initialParameters,
        };
        console.log(
          "[OpenScope] Full request body:",
          JSON.stringify(requestBody, null, 2),
        );

        console.log("[useScopeServer] Sending WebRTC offer to /api/scope/webrtc/offer...");
        const response = await fetch(
          `${getBackendUrl()}${SCOPE_API_URL}/webrtc/offer`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sdp: pc.localDescription?.sdp,
              type: pc.localDescription?.type,
              initialParameters: initialParameters,
            }),
          },
        );

        console.log("[useScopeServer] WebRTC offer response status:", response.status);

        if (!response.ok) {
          // Try to parse JSON error, fall back to text
          const contentType = response.headers.get("content-type");
          let errorMessage = "Failed to create WebRTC offer";
          if (contentType?.includes("application/json")) {
            try {
              const errorData = await response.json();
              errorMessage = errorData.detail || errorMessage;
            } catch {
              const errorText = await response.text();
              errorMessage = errorText.substring(0, 200);
            }
          } else {
            const errorText = await response.text();
            errorMessage = errorText.substring(0, 200);
          }
          console.error("[useScopeServer] ❌ WebRTC offer failed:", errorMessage);
          throw new Error(errorMessage);
        }

        console.log("[useScopeServer] Parsing WebRTC answer...");
        const answer: WebRTCOfferResponse = await response.json();
        console.log("[useScopeServer] WebRTC answer sessionId:", answer.sessionId);
        sessionIdRef.current = answer.sessionId;

        console.log("[useScopeServer] Setting remote description...");
        await pc.setRemoteDescription({
          sdp: answer.sdp,
          type: answer.type as RTCSdpType,
        });
        console.log("[useScopeServer] Remote description set");

        // Wait for data channel to be ready, then send parameters
        console.log("[useScopeServer] Waiting for data channel to open...");
        await dataChannelReady;
        console.log("[useScopeServer] Data channel open, sending parameters...");
        dataChannel.send(JSON.stringify(initialParameters));
        console.log("[useScopeServer] ✓ WebRTC connection established successfully!");

        return pc;
      } catch (err) {
        console.error("[useScopeServer] ❌ startWebRTC failed:", err);
        throw err;
      }
    },
    [],
  );

  const stopWebRTC = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    sessionIdRef.current = null;
    remoteStreamRef.current = null;
    dataChannelRef.current = null;
  }, []);

  // Send parameter update via WebRTC data channel
  const sendParameterUpdate = useCallback((params: Record<string, unknown>) => {
    console.log("[useScopeServer] sendParameterUpdate called with:", JSON.stringify(params, null, 2));
    if (
      dataChannelRef.current &&
      dataChannelRef.current.readyState === "open"
    ) {
      const message = JSON.stringify({
        type: "parameters",
        ...params,
      });
      dataChannelRef.current.send(message);
      console.log("[useScopeServer] Parameter update sent via data channel:", params);
    } else {
      console.warn("[useScopeServer] Data channel not ready for parameter update! readyState:", dataChannelRef.current?.readyState);
    }
  }, []);

  useEffect(() => {
    checkConnection();

    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, [checkConnection]);

  return {
    isConnected,
    isConnecting,
    error,
    pipelines,
    pipelineStatus,
    cloudStatus,
    plugins,
    outputStatus,
    activePipeline,
    configSchema,
    isLoadingPipeline,
    checkConnection,
    fetchPipelines,
    fetchPlugins,
    getPipelineStatus,
    loadPipeline,
    getCloudStatus,
    connectToCloud,
    disconnectFromCloud,
    startWebRTC,
    stopWebRTC,
    sendParameterUpdate,
    installPlugin,
    uninstallPlugin,
    reloadPlugin,
    configureNDI,
    getOutputStatus,
    fetchLogs,
    remoteStream: remoteStreamRef.current,
  };
}
