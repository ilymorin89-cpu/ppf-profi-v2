import Link from "next/link";
import { CONTACTS, NAV, telegramUrl } from "@/content/site";

/** Шапка публичных страниц. onHome — ссылки на якоря без перехода на «/». */
export default function SiteHeader({ onHome = false }: { onHome?: boolean }) {
  const items = NAV.map((n) => ({ ...n, href: onHome && n.anchor ? `#${n.anchor}` : n.href }));

  return (
    <header className="sticky top-0 z-50 border-b border-white/8 bg-black/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:h-20">
        <Link href="/" className="shrink-0 text-lg font-extrabold tracking-[0.12em] sm:text-xl">
          PPF <span className="accent">PROFI</span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-semibold text-white/70 lg:flex">
          {items.map((item) => (
            <a key={item.label} href={item.href} className="transition hover:text-white">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {/* .btn-accent задаёт display вне слоёв Tailwind, поэтому скрываем обёрткой */}
          <span className="hidden sm:inline-flex">
            <a
              href={telegramUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-accent text-sm"
            >
              Telegram
            </a>
          </span>
          <a href={CONTACTS.phoneHref} className="text-sm font-bold accent lg:hidden">
            Позвонить
          </a>
          <a
            href={CONTACTS.phoneHref}
            className="hidden text-sm font-bold text-white/80 hover:text-white lg:inline"
          >
            {CONTACTS.phone}
          </a>
        </div>
      </div>

      {/* Мобильное меню: пункты переносятся, горизонтального скролла нет */}
      <nav className="flex flex-wrap gap-x-5 gap-y-1 border-t border-white/5 px-4 py-2 text-xs font-semibold text-white/60 sm:px-6 lg:hidden">
        {items.map((item) => (
          <a key={item.label} href={item.href} className="hover:text-white">
            {item.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
