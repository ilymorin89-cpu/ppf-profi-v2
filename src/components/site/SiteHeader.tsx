import Link from "next/link";
import { CONTACTS, NAV, telegramUrl } from "@/content/site";

/** Шапка публичных страниц. onHome — ссылки на якоря без перехода на «/». */
export default function SiteHeader({ onHome = false }: { onHome?: boolean }) {
  const items = NAV.map((n) => ({ ...n, href: onHome && n.anchor ? `#${n.anchor}` : n.href }));

  return (
    <header className="sticky top-0 z-50 border-b border-white/8 bg-black/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 xl:h-20">
        <Link href="/" className="shrink-0 text-lg font-extrabold tracking-[0.12em] sm:text-xl">
          PPF <span className="accent">PROFI</span>
        </Link>

        <nav className="hidden items-center gap-6 whitespace-nowrap text-sm font-semibold text-white/70 xl:flex">
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
          <a href={CONTACTS.phoneHref} className="text-sm font-bold accent xl:hidden">
            Позвонить
          </a>
          <a
            href={CONTACTS.phoneHref}
            className="hidden whitespace-nowrap text-sm font-bold text-white/80 hover:text-white xl:inline"
          >
            {CONTACTS.phone}
          </a>
        </div>
      </div>

      {/* Мобильное меню: пункты переносятся, горизонтального скролла нет */}
      {/* py-1.5 у ссылок: зона нажатия ≥ 24 px (замечание PageSpeed про размер целей) */}
      <nav className="flex flex-wrap gap-x-4 border-t border-white/5 px-4 py-1 text-xs font-semibold text-white/60 sm:px-6 xl:hidden">
        {items.map((item) => (
          <a key={item.label} href={item.href} className="inline-block py-1.5 hover:text-white">
            {item.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
