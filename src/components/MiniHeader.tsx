"use client";

import Link from "next/link";
import { CircleUser } from "lucide-react";

interface MiniHeaderProps {
  user?: { email?: string; avatar_url?: string } | null;
  mode?: "show" | "output";
  onModeChange?: (mode: "show" | "output") => void;
  onAuthClick?: () => void;
}

export default function MiniHeader({ user, mode = "show", onModeChange, onAuthClick }: MiniHeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 px-4 flex items-center justify-between backdrop-blur-md bg-black/30 border-b border-white/10">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="text-sm font-semibold tracking-[0.2em] text-white/70 hover:text-white transition-colors"
        >
          THE AI FOLKS
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-0.5 px-0.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10">
          <button
            onClick={() => onModeChange?.("show")}
            className={`px-2 py-1 rounded-full text-[10px] font-medium uppercase tracking-[0.3em] transition-all ${
              mode === "show"
                ? "bg-yellow-500 text-black"
                : "text-white/60 hover:text-white"
            }`}
          >
            Set Mode
          </button>
          <button
            onClick={() => onModeChange?.("output")}
            className={`px-2 py-1 rounded-full text-[10px] font-medium uppercase tracking-[0.3em] transition-all ${
              mode === "output"
                ? "bg-yellow-500 text-black"
                : "text-white/60 hover:text-white"
            }`}
          >
            Livestream
          </button>
        </div>
        <button
          onClick={onAuthClick}
          className="flex items-center gap-2 px-2 py-1 rounded-full hover:bg-white/10 transition-colors"
        >
          {user ? (
            <div className="flex items-center gap-2">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt="Avatar"
                  className="w-6 h-6 rounded-full"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center">
                  <CircleUser className="w-4 h-4 text-black" />
                </div>
              )}
              <span className="text-sm text-white/70 hidden sm:block">
                {user.email?.split("@")[0]}
              </span>
            </div>
          ) : (
            <CircleUser className="w-5 h-5 text-white/50" />
          )}
        </button>
      </div>
    </header>
  );
}
