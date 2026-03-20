"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

interface SheetContentProps {
  children: React.ReactNode;
  className?: string;
  onClose: () => void;
}

export function Sheet({ open, onOpenChange, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120]">
      <button
        type="button"
        aria-label="Close drawer"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      {children}
    </div>
  );
}

export function SheetContent({ children, className = "", onClose }: SheetContentProps) {
  return (
    <aside
      className={`absolute right-0 top-0 h-screen w-full max-w-[420px] border-l border-white/10 bg-[#0f0f10] p-5 text-white shadow-[0_20px_60px_rgba(0,0,0,0.45)] ${className}`}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Close drawer"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
      {children}
    </aside>
  );
}

export function SheetHeader({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-white/10 pb-4 pr-10">{children}</div>;
}

export function SheetTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold uppercase tracking-[0.2em]">{children}</h3>;
}
