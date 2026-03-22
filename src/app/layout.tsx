import type { Metadata } from "next";
import { Raleway } from "next/font/google";
import { Toaster } from "sonner";
import { PipelineSchemasProvider } from "@/context/PipelineSchemasContext";
import { ScopeSessionProvider } from "@/context/ScopeSessionContext";
import { AudioPlayerProvider } from "@/context/AudioPlayerContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "The AI Folks - 24/7 AI VJ Show",
  description: "A 24/7 AI VJ show powered by Daydream Scope.",
  icons: {
    icon: "/logo.png",
  },
};

const raleway = Raleway({
  subsets: ["latin"],
  variable: "--font-raleway",
  display: "swap",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={raleway.variable}>
      <body className="font-sans antialiased">
        <AudioPlayerProvider>
          <PipelineSchemasProvider>
            <ScopeSessionProvider>{children}</ScopeSessionProvider>
          </PipelineSchemasProvider>
        </AudioPlayerProvider>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
