import Link from "next/link";
import { CONTACTS, telegramUrl } from "@/content/site";
import MobileMenu, { type MenuItem } from "@/components/site/MobileMenu";

/**
 * Шапка для «/» и «/calculator» по макету. Общий SiteHeader не меняем: он остаётся на остальных страницах.
 * Пункты — те же адреса, что в NAV; на главной они ведут к якорям этой же страницы.
 * «Вход для мастеров» есть в мобильном меню и в футере.
 */
export default function TopHeader({ onHome = false }: { onHome?: boolean }) {
  const items: MenuItem[] = [
    { label: "Калькулятор", href: onHome ? "#calculator" : "/calculator" },
    { label: "Цены", href: "/ceny" },
    { label: "Марки", href: "/ppf" },
    { label: "Гарантия", href: onHome ? "#warranty" : "/#warranty" },
    { label: "Вопросы", href: onHome ? "#faq" : "/#faq" },
    { label: "Партнёрам", href: "/partners" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-white/8 bg-black/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
        <Link href="/" className="shrink-0 text-lg font-extrabold tracking-[0.12em]">
          PPF <span className="accent">PROFI</span>
        </Link>

        <nav
          aria-label="Основное меню"
          className="hidden items-center gap-7 whitespace-nowrap text-sm font-semibold text-white/75 xl:flex"
        >
          {items.map((item) => (
            <Link key={item.label} href={item.href} className="transition hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-4">
          <a
            href={CONTACTS.phoneHref}
            className="hidden whitespace-nowrap text-sm font-bold text-white/85 hover:text-white xl:inline"
          >
            {CONTACTS.phone}
          </a>
          {/* Не .btn-accent: его стили стоят вне слоёв Tailwind и перебивают утилиты отступов. */}
          <a
            href={CONTACTS.phoneHref}
            className="inline-flex items-center whitespace-nowrap rounded-lg bg-[#a3e635] px-4 py-2 text-sm font-extrabold text-[#0a0a0a] transition hover:bg-[#84cc16]"
          >
            Позвонить
          </a>
          <MobileMenu items={items} telegramHref={telegramUrl()} />
        </div>
      </div>
    </header>
  );
}
