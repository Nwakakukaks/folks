"use client";

import { useEffect, useRef } from "react";
import { Volume2 } from "lucide-react";

interface AudioInitDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
}

export default function AudioInitDialog({ isOpen, onConfirm }: AudioInitDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hasConfirmedRef = useRef(false);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      buttonRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      hasConfirmedRef.current = false;
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (hasConfirmedRef.current) return;
    hasConfirmedRef.current = true;
    onConfirm();
  };

  if (!isOpen) return null;

  return (
    <div 
      ref={dialogRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center" 
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <div className="relative w-full max-w-md mx-4 bg-[#0f0f10] rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
        <div className="p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full border-2 border-yellow-500/50 flex items-center justify-center bg-yellow-500/10 animate-pulse">
            <Volume2 className="w-8 h-8 text-yellow-500" />
          </div>
          
          <h2 className="text-lg font-semibold text-white mb-1">
            Audio Experience
          </h2>
          
          <p className="text-sm text-white/60 mb-3 leading-relaxed">
            Click below to unmute and enjoy the experience.
          </p>

          <button
            ref={buttonRef}
            onClick={handleConfirm}
            className="w-full py-2 px-6 bg-yellow-500 hover:bg-yellow-400 text-black font-medium rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Unmute & Enter
          </button>
        </div>
      </div>
    </div>
  );
}
