import Link from "next/link";
import Image from "next/image";
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

const featuredEvents = [
  { title: "10 Years Celebration Kick-Off", date: "02.07.2026", image: "/event1.jpeg" },
  { title: "AI Folks Block Party", date: "09.08.2026", image: "/event2.jpeg" },
  { title: "Juneteenth Block Party", date: "06.15.2026", image: "/event3.jpeg" },
  { title: "Colored Lessons", date: "05.18.2026", image: "/event4.jpeg" },
];

export default function EventsPage() {
  return (
    <div className={`${spaceGrotesk.className} min-h-screen bg-white text-[#111]`}>
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-lg font-semibold tracking-[0.3em] text-black/60 hover:text-black">THE AI FOLKS</Link>
          <nav className="flex items-center gap-6 text-[11px] uppercase tracking-[0.3em] text-black/60">
            <Link href="/" className="flex items-center gap-2 hover:text-black">
              <Radio className="w-3 h-3" />
              Live
            </Link>
            <Link href="/events" className="flex items-center gap-2 hover:text-black">
              <Calendar className="w-3 h-3" />
              Events
            </Link>
            {/* <Link href="/calendar" className="flex items-center gap-2 hover:text-black">
              <CalendarDays className="w-3 h-3" />
              Calendar
            </Link> */}
            <Link href="/about" className="flex items-center gap-2 hover:text-black">
              <Info className="w-3 h-3" />
              About
            </Link>
            <Link href="/shop" className="flex items-center gap-2 hover:text-black">
              <ShoppingBag className="w-3 h-3" />
              Shop
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 py-16">
          <h1 className={`${anton.className} text-6xl uppercase leading-none md:text-7xl`}>Events</h1>
          <p className="mt-4 max-w-lg text-sm uppercase tracking-[0.2em] text-black/50">
            Featured moments from the archive. Four spotlight events only.
          </p>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {featuredEvents.map((event) => (
              <div key={`${event.title}-${event.date}`} className="border border-black/10 bg-white">
                <div className="relative aspect-[3/4] w-full overflow-hidden">
                  <Image
                    src={event.image}
                    alt={event.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                  />
                </div>
                <div className="flex items-center justify-between border-t border-black/10 px-4 py-3 text-[11px] uppercase tracking-[0.2em]">
                  <span>{event.title}</span>
                  <span className="text-black/40">{event.date}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>

      <footer className="border-t border-black/10 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-6 text-xs uppercase tracking-[0.3em] text-black/50 md:flex-row">
          <div>The AI Folks</div>
          <div>All Rights Reserved 2026</div>
        </div>
      </footer>
    </div>
  );
}
