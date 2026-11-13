import { CONTACTS } from "@/content/site";

export default function MobileActionBar() {
  return (
    <nav aria-label="Быстрые действия" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 gap-2 border-t border-white/10 bg-black/90 px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur-xl md:hidden">
      <a href="#calculator" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-lime-400 px-3 text-sm font-extrabold text-black">Рассчитать цену</a>
      <a href={CONTACTS.phoneHref} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 bg-white/5 px-3 text-sm font-extrabold text-white">Позвонить</a>
    </nav>
  );
}
