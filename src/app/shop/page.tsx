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

const products = [
  { name: "AI Folks T-Shirt - White", price: "57,400.00 NGN", badge: "Sold out", image: "/merch1.jpeg" },
  { name: "Beanie", price: "28,700.00 NGN", image: "/merch2.jpeg" },
  { name: "Face cap", price: "35,900.00 NGN", image: "/merch3.jpeg" },
  { name: "Folks Stickers", price: "14,400.00 NGN", badge: "Sold out", image: "/merch4.jpeg" },
];

export default function ShopPage() {
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

      <main className="pb-16">
        <section className="mx-auto max-w-6xl px-6 pt-16">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-[0.3em] text-black/50">Worldwide shipping & free pick up</div>
            <div className="text-xs uppercase tracking-[0.3em] text-black/50">2026 Collection</div>
          </div>

          <h1 className={`${anton.className} mt-8 text-5xl uppercase`}>Shop</h1>

          <div className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <div key={product.name} className="space-y-3">
                <div className="relative border border-black/10 bg-[#f5f5f5]">
                  <div className="relative aspect-[4/3] w-full overflow-hidden">
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                    />
                  </div>
                  {product.badge ? (
                    <span className="absolute left-3 top-3 rounded-full bg-black px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-white">
                      {product.badge}
                    </span>
                  ) : null}
                </div>
                <div className="text-xs uppercase tracking-[0.2em] text-black/70">{product.name}</div>
                <div className="text-sm font-medium">{product.price}</div>
              </div>
            ))}
          </div>

        </section>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 border-t border-black/10 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-6 text-xs uppercase tracking-[0.3em] text-black/50 md:flex-row">
          <div>The AI Folks</div>
          <div>All Rights Reserved 2026</div>
        </div>
      </footer>
    </div>
  );
}
