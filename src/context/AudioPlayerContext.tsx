"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface AudioPlayerContextType {
  activePlayerId: string | null;
  setActivePlayer: (id: string | null) => void;
  isPlayerActive: (id: string) => boolean;
  isAudioEnabled: boolean;
  setAudioEnabled: (enabled: boolean) => void;
  muteAll: () => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | null>(null);

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error("useAudioPlayer must be used within AudioPlayerProvider");
  }
  return context;
}

interface AudioPlayerProviderProps {
  children: ReactNode;
}

export function AudioPlayerProvider({ children }: AudioPlayerProviderProps) {
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);

  const setActivePlayer = useCallback((id: string | null) => {
    setActivePlayerId(id);
  }, []);

  const isPlayerActive = useCallback(
    (id: string) => {
      return activePlayerId === id;
    },
    [activePlayerId]
  );

  const muteAll = useCallback(() => {
    setActivePlayerId(null);
    setIsAudioEnabled(false);
  }, []);

  return (
    <AudioPlayerContext.Provider
      value={{
        activePlayerId,
        setActivePlayer,
        isPlayerActive,
        isAudioEnabled,
        setAudioEnabled: setIsAudioEnabled,
        muteAll,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
}
