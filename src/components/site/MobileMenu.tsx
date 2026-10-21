"use client";

import Link from "next/link";
import type { MouseEvent } from "react";

export type MenuItem = { label: string; href: string };

/**
 * Мобильное меню шапки. Закрывается после нажатия на пункт: якоря ведут на ту же страницу,
 * и открытое меню иначе осталось бы поверх контента.
 */
export default function MobileMenu({ items, telegramHref }: { items: MenuItem[]; telegramHref: string }) {
  function closeOnLink(e: MouseEvent<HTMLDetailsElement>) {
    if ((e.target as HTMLElement).closest("a")) e.currentTarget.removeAttribute("open");
  }

  return (
    <details className="xl:hidden" onClick={closeOnLink}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-lg border border-white/15 px-3 py-2 text-sm font-bold transition hover:bg-white/5">
        Меню
      </summary>
      <nav
        aria-label="Мобильное меню"
        className="absolute inset-x-0 top-full border-b border-white/10 bg-black/95 px-4 py-3 backdrop-blur-xl sm:px-6"
      >
        <ul className="grid gap-0.5 text-base font-semibold text-white/85">
          {items.map((item) => (
            <li key={item.label}>
              <Link href={item.href} className="block py-2.5 hover:text-white">
                {item.label}
              </Link>
            </li>
          ))}
          <li className="mt-2 border-t border-white/10 pt-2">
            <Link href="/master" className="block py-2.5 text-white/65 hover:text-white">
              Вход для мастеров
            </Link>
          </li>
          <li>
            <a
              href={telegramHref}
              target="_blank"
              rel="noopener noreferrer"
              className="block py-2.5 text-white/65 hover:text-white"
            >
              Telegram
            </a>
          </li>
        </ul>
      </nav>
    </details>
  );
}
