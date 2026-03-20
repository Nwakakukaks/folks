"use client";

import { useState } from "react";
import { X, Mail, Lock } from "lucide-react";
import { showInfo } from "@/lib/toast";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (isGuest?: boolean) => void;
}

export default function AuthModal({ isOpen, onClose, onAuthSuccess }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        showInfo("Check your email", "We sent you a confirmation link to complete signup");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onAuthSuccess();
      }
    } catch (error) {
      showInfo("Error", error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setEmail("");
    setPassword("");
  };

  const handleGuestMode = () => {
    localStorage.setItem("aifolks_guest", "true");
    onAuthSuccess(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[380px] bg-[#1a1a1a] rounded-xl shadow-2xl border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {isSignUp ? "Create Account" : "Sign In"}
            </h2>
            <p className="text-xs text-white/50">Access the AI Agents</p>
          </div>
          
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-4 h-4 text-white/50" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50"
                required
                minLength={6}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-yellow-500 text-black font-medium rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50"
          >
            {loading ? "Please wait..." : isSignUp ? "Create Account" : "Sign In"}
          </button>

          <p className="text-center text-sm text-white/50">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              type="button"
              onClick={toggleMode}
              className="text-yellow-500 hover:text-yellow-400 transition-colors"
            >
              {isSignUp ? "Sign In" : "Sign Up"}
            </button>
          </p>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#1a1a1a] px-2 text-white/40">Or</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGuestMode}
            className="w-full py-2.5 border border-yellow-500/50 text-yellow-500 font-medium rounded-lg hover:bg-yellow-500/10 transition-colors"
          >
            Continue as Guest
          </button>
        </form>
      </div>
    </div>
  );
}
