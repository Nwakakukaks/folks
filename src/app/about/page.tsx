import Link from "next/link";
import { Anton, Space_Grotesk } from "next/font/google";
import { Radio, Calendar, Info, ShoppingBag } from "lucide-react";

const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-anton",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-space",
  display: "swap",
});

const highlightPoints = [
  "24/7 AI VJ show with rotating agent performances",
  "Powered by Daydream Scope, the open-source creative playground",
  "Built for late-night streams, pop-ups, and venue installs",
  "Book the agents for an event by contributing to the Scope open-source project",
];

export default function AboutPage() {
  return (
    <div className={`${spaceGrotesk.className} min-h-screen bg-[#0f0f10] text-white`}>
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-lg font-semibold tracking-[0.3em] text-white/70 hover:text-white">THE AI FOLKS</Link>
          <nav className="flex items-center gap-6 text-[11px] uppercase tracking-[0.3em] text-white/70">
            <Link href="/" className="flex items-center gap-2 hover:text-white">
              <Radio className="w-3 h-3" />
              Live
            </Link>
            <Link href="/events" className="flex items-center gap-2 hover:text-white">
              <Calendar className="w-3 h-3" />
              Events
            </Link>
            <Link href="/about" className="flex items-center gap-2 hover:text-white">
              <Info className="w-3 h-3" />
              About
            </Link>
            <Link href="/shop" className="flex items-center gap-2 hover:text-white">
              <ShoppingBag className="w-3 h-3" />
              Shop
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-5xl px-6 py-20 text-center">
          <div className="text-xs uppercase tracking-[0.35em] text-white/50">About The AI Folks</div>
          <h1 className={`${anton.className} mt-6 text-6xl uppercase leading-none md:text-7xl`}>
             24/7 Agent VJ  live stream
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-sm uppercase tracking-[0.2em] text-white/60">
            The AI Folks is a 24/7 AI VJ show powered by Daydream Scope, the open-source creative playground for
            real-time video. You can tune in anytime, extend the stream to your own setup, or book the agents for live
            sets and events.
          </p>
        </section>

        <section className="mx-auto max-w-5xl px-6 pb-16">
          <div className="grid gap-4 text-sm uppercase tracking-[0.2em] text-white/70">
            {highlightPoints.map((point) => (
              <div key={point} className="flex items-start gap-4 border-b border-white/10 pb-4">
                <span className="mt-2 h-2 w-2 rounded-full bg-yellow-400" />
                <span>{point}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[#171717]">
          <div className="mx-auto max-w-5xl px-6 py-16 text-center">
            <h2 className={`${anton.className} text-4xl uppercase`}>How To Tune In?</h2>
            <p className="mt-4 text-xs uppercase tracking-[0.25em] text-white/60">
              Stream live 24/7 on web, mobile, and your favorite casting device.
            </p>

            <div className="mt-16 flex justify-between items-center">
              <div>
                <h3 className={`${anton.className} text-3xl uppercase`}>How To Support?</h3>
                <p className="mt-3 text-xs uppercase tracking-[0.25em] text-white/60">
                  Become a supporter or grab a merch
                </p>
              </div>
              <div>
                <h3 className={`${anton.className} text-3xl uppercase`}>Contact</h3>
                <p className="mt-3 text-xs uppercase tracking-[0.25em] text-white/60">
                 Send us an email hello@theaifolks.com
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#0f0f10]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-6 text-xs uppercase tracking-[0.3em] text-white/50 md:flex-row">
          <div>The AI Folks</div>
          <div>All Rights Reserved 2026</div>
        </div>
      </footer>
    </div>
  );
}
