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
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);

  const checkConnection = useCallback(async () => {
    console.log("[ScopeServer] Checking connection...");
    try {
      const backendUrl = getBackendUrl();
      const fullUrl = `${backendUrl}${SCOPE_API_URL}/health`;

      const response = await fetch(fullUrl);

      if (response.ok) {
        console.log("[ScopeServer] Health check passed");
        setIsConnected(true);
        setError(null);
        return true;
      }
      console.warn("[ScopeServer] Health check failed:", response.status);
      setIsConnected(false);
      const errorText = await response.text();
      setError(`Server returned ${response.status}: ${errorText}`);
      return false;
    } catch (err) {
      console.error("[ScopeServer] Health check error:", err);
      setIsConnected(false);
      setError(`Cannot connect to Scope server: ${err}`);
      return false;
    }
  }, []);

  const fetchPipelines = useCallback(async () => {
    console.log("[ScopeServer] Fetching pipelines...");
    try {
      const response = await fetch(
        `${getBackendUrl()}${SCOPE_API_URL}/pipelines`,
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[ScopeServer] Failed to fetch pipelines:", errorText.substring(0, 200));
        return null;
      }
      
      const data = await response.json();
      const pipelinesData = data.pipelines || {};
      console.log("[ScopeServer] Pipelines fetched:", Object.keys(pipelinesData));
      setPipelines(pipelinesData);
      
      fetchPlugins();
      
      return pipelinesData;
    } catch (err) {
      console.error("[ScopeServer] Failed to fetch pipelines:", err);
      return null;
    }
  }, []);

  const fetchPlugins = useCallback(async () => {
    try {
      const response = await fetch(
        `${getBackendUrl()}${SCOPE_API_URL}/plugins`,
      );
      if (response.ok) {
        const data = await response.json();
        setPlugins(data.plugins || []);
      }
    } catch (err) {
      console.error("Failed to fetch plugins:", err);
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
      console.log("[ScopeServer] loadPipeline called:", pipelineIds, "params:", loadParams);
      try {
        setIsLoadingPipeline(true);
        setPipelineStatus({ status: "loading" });
        
        const mainPipeline = pipelineIds[pipelineIds.length - 1];
        console.log("[ScopeServer] Loading main pipeline:", mainPipeline);
        setActivePipeline(mainPipeline);
        
        if (pipelines[mainPipeline]?.config_schema) {
          setConfigSchema(pipelines[mainPipeline].config_schema as Record<string, any>);
        }

        console.log("[ScopeServer] Sending pipeline load request to server...");
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
          console.error("[ScopeServer] Pipeline load request failed:", errorMessage);
          throw new Error(errorMessage);
        }

        console.log("[ScopeServer] Pipeline load request accepted, waiting for load...");

        if (waitForLoad) {
          const maxTimeout = 30000;
          const pollInterval = 1000;
          const startTime = Date.now();

          while (Date.now() - startTime < maxTimeout) {
            await new Promise((resolve) => setTimeout(resolve, pollInterval));
            
            try {
              const statusResponse = await fetch(
                `${getBackendUrl()}${SCOPE_API_URL}/pipeline/status`,
              );
              const statusData = await statusResponse.json();
              console.log("[ScopeServer] Pipeline status:", statusData.status);
              setPipelineStatus(statusData);

              if (statusData.status === "loaded") {
                console.log("[ScopeServer] Pipeline loaded successfully!");
                setIsLoadingPipeline(false);
                return statusData;
              } else if (statusData.status === "error") {
                console.error("[ScopeServer] Pipeline load error:", statusData.error);
                setIsLoadingPipeline(false);
                throw new Error(statusData.error || "Pipeline load failed");
              }
            } catch (pollErr) {
              console.error("[ScopeServer] Error polling pipeline status:", pollErr);
            }
          }
          console.error("[ScopeServer] Pipeline load timeout after 30 seconds");
          setIsLoadingPipeline(false);
          throw new Error("Pipeline load timeout after 30 seconds");
        }

        const data = await response.json();
        setIsLoadingPipeline(false);
        return data;
      } catch (err) {
        setIsLoadingPipeline(false);
        console.error("[ScopeServer] Failed to load pipeline:", err);
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
      console.log("[ScopeServer] startWebRTC called, localStream:", !!localStream);
      try {
        console.log("[ScopeServer] Fetching ICE servers...");
        const iceResponse = await fetch(
          `${getBackendUrl()}${SCOPE_API_URL}/webrtc/ice-servers`,
        );
        
        if (!iceResponse.ok) {
          const errorText = await iceResponse.text();
          throw new Error(`Failed to get ICE servers: ${errorText.substring(0, 200)}`);
        }
        
        const iceData: IceServersResponse = await iceResponse.json();
        console.log("[ScopeServer] ICE servers received:", iceData.iceServers?.length || 0);

        const normalizeUrls = (urls: string | string[]): string[] => {
          if (typeof urls === "string") return [urls];
          return urls;
        };

        const config: RTCConfiguration = {
          iceServers: [
            ...(iceData.iceServers || []).map((server) => ({
              urls: normalizeUrls(server.urls),
              ...(server.username && { username: server.username }),
              ...(server.credential && { credential: server.credential }),
            })),
            { urls: "stun:stun.l.google.com:19302" },
          ],
        };

        console.log("[ScopeServer] Creating RTCPeerConnection...");
        const pc = new RTCPeerConnection(config);
        peerConnectionRef.current = pc;
        console.log("[ScopeServer] PeerConnection created");

        console.log("[ScopeServer] Creating data channel...");
        const dataChannel = pc.createDataChannel("parameters", {
          ordered: true,
        });
        dataChannelRef.current = dataChannel;

        let dataChannelReady = new Promise<void>((resolve) => {
          dataChannel.onopen = () => {
            console.log("[ScopeServer] Data channel opened");
            resolve();
          };
        });

        let transceiver: RTCRtpTransceiver | undefined;
        if (localStream) {
          console.log("[ScopeServer] Adding local stream tracks, video:", localStream.getVideoTracks().length, "audio:", localStream.getAudioTracks().length);
          localStream.getVideoTracks().forEach((track) => {
            const sender = pc.addTrack(track, localStream);
            transceiver = pc.getTransceivers().find((t) => t.sender === sender);
          });
          localStream.getAudioTracks().forEach((track) => {
            pc.addTrack(track, localStream);
          });
        } else {
          console.log("[ScopeServer] No local stream, adding video transceiver");
          transceiver = pc.addTransceiver("video");
        }

        if (transceiver) {
          const codecs = RTCRtpReceiver.getCapabilities("video")?.codecs || [];
          const vp8Codecs = codecs.filter(
            (c) => c.mimeType.toLowerCase() === "video/vp8",
          );
          if (vp8Codecs.length > 0) {
            transceiver.setCodecPreferences(vp8Codecs);
          }
        }

        pc.ontrack = (event) => {
          console.log("[ScopeServer] Remote track received");
          const stream = event.streams[0];
          if (stream) {
            console.log("[ScopeServer] Remote stream tracks:", stream.getVideoTracks().length, "video,", stream.getAudioTracks().length, "audio");
            remoteStreamRef.current = stream;
            setRemoteStream(stream);
            onRemoteStream(stream);
          }
        };

        pc.oniceconnectionstatechange = () => {
          console.log("[ScopeServer] ICE connection state:", pc.iceConnectionState);
        };

        pc.onicecandidate = (event) => {
          if (event.candidate && sessionIdRef.current) {
            fetch(`${getBackendUrl()}${SCOPE_API_URL}/webrtc/ice?session_id=${sessionIdRef.current}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(event.candidate.toJSON()),
            }).catch((err) =>
              console.error("[ScopeServer] ICE candidate send failed:", err),
            );
          }
        };

        console.log("[ScopeServer] Creating WebRTC offer...");
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log("[ScopeServer] Offer created, sending to server...");

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

        if (!response.ok) {
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
          throw new Error(errorMessage);
        }

        const answer: WebRTCOfferResponse = await response.json();
        console.log("[ScopeServer] WebRTC answer received, sessionId:", answer.sessionId);
        sessionIdRef.current = answer.sessionId;

        console.log("[ScopeServer] Setting remote description...");
        await pc.setRemoteDescription({
          sdp: answer.sdp,
          type: answer.type as RTCSdpType,
        });

        console.log("[ScopeServer] Waiting for data channel...");
        await dataChannelReady;
        console.log("[ScopeServer] Sending initial parameters...");
        dataChannel.send(JSON.stringify(initialParameters));
        console.log("[ScopeServer] WebRTC setup complete!");

        return pc;
      } catch (err) {
        console.error("[ScopeServer] Failed to start WebRTC:", err);
        throw err;
      }
    },
    [],
  );

  const stopWebRTC = useCallback(() => {
    console.log("[ScopeServer] stopWebRTC called");
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
      console.log("[ScopeServer] PeerConnection closed");
    }
    sessionIdRef.current = null;
    remoteStreamRef.current = null;
    setRemoteStream(null);
    dataChannelRef.current = null;
    console.log("[ScopeServer] WebRTC stopped");
  }, []);

  // Send parameter update via WebRTC data channel
  const sendParameterUpdate = useCallback((params: Record<string, unknown>) => {
    console.log("[ScopeServer] sendParameterUpdate called:", JSON.stringify(params, null, 2));
    if (
      dataChannelRef.current &&
      dataChannelRef.current.readyState === "open"
    ) {
      const message = JSON.stringify({
        type: "parameters",
        ...params,
      });
      console.log("[ScopeServer] Sending to data channel:", message.substring(0, 100) + "...");
      dataChannelRef.current.send(message);
      console.log("[ScopeServer] Parameters sent successfully");
    } else {
      console.warn("[ScopeServer] Data channel not ready, state:", dataChannelRef.current?.readyState);
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
    remoteStream,
  };
}
