"use client";

import { useEffect, useState } from "react";
import { X, BookOpen } from "lucide-react";

interface SkillDialogProps {
  agent: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function SkillDialog({ agent, isOpen, onClose }: SkillDialogProps) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && agent) {
      setLoading(true);
      setError(null);
      fetch(`/agents/skills/${agent.toLowerCase()}/SKILL.md`)
        .then((res) => {
          if (!res.ok) throw new Error("Skill file not found");
          return res.text();
        })
        .then((text) => {
          setContent(text);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    }
  }, [isOpen, agent]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-4xl max-h-[85vh] mx-4 bg-[#0f0f10] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{agent}</h2>
              <p className="text-xs text-white/50 uppercase tracking-wider">Skill</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-white/70" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-white/20 border-t-yellow-500 rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <div className="text-center py-20">
              <p className="text-white/50">Failed to load agent skill.md </p>
              <p className="text-xs text-white/30 mt-2">{error}</p>
            </div>
          )}

          {!loading && !error && (
            <pre className="whitespace-pre-wrap font-mono text-sm text-white/80 leading-relaxed">
              {content}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
