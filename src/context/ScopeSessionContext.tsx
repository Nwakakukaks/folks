"use client";

import { createContext, useContext } from "react";
import { useScopeServer } from "@/hooks/useScopeServer";

type ScopeSessionValue = ReturnType<typeof useScopeServer>;

const ScopeSessionContext = createContext<ScopeSessionValue | null>(null);

export function ScopeSessionProvider({ children }: { children: React.ReactNode }) {
  const scopeSession = useScopeServer();
  return <ScopeSessionContext.Provider value={scopeSession}>{children}</ScopeSessionContext.Provider>;
}

export function useScopeSession() {
  const context = useContext(ScopeSessionContext);
  if (!context) {
    throw new Error("useScopeSession must be used inside ScopeSessionProvider");
  }
  return context;
}
