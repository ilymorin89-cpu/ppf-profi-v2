import Link from "next/link";
import { CONTACTS, FOOTER_LINKS, LEGAL, WORKPLACE, telegramHandle, telegramUrl } from "@/content/site";

export default function SiteFooter() {
  return (
    <footer id="contacts" className="border-t border-white/8 bg-black/60">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <div className="text-lg font-extrabold tracking-[0.12em]">
            PPF <span className="accent">PROFI</span>
          </div>
          <div className="mt-2 text-sm text-white/60">{CONTACTS.city}</div>
          <nav className="mt-5 flex flex-col gap-2 text-sm text-white/60">
            {FOOTER_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-white">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="text-sm">
          <div className="text-white/50">Телефон</div>
          <a href={CONTACTS.phoneHref} className="mt-1 inline-block font-bold hover:underline">
            {CONTACTS.phone}
          </a>
          <div className="mt-3 text-white/50">Telegram</div>
          <a
            href={telegramUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block font-bold accent hover:underline"
          >
            {telegramHandle}
          </a>
          {CONTACTS.email && (
            <>
              <div className="mt-3 text-white/50">Email</div>
              <a href={`mailto:${CONTACTS.email}`} className="mt-1 inline-block break-all font-bold">
                {CONTACTS.email}
              </a>
            </>
          )}
          <div className="mt-3 text-white/50">Адрес</div>
          <div className="mt-1 leading-snug">{WORKPLACE.address}</div>
        </div>

        <div className="text-sm text-white/60">
          <div>{LEGAL.owner}</div>
          <div className="mt-1">{LEGAL.inn}</div>
          <div className="mt-1">{LEGAL.ogrnip}</div>
          <div className="mt-6 text-xs text-white/40">
            © {new Date().getFullYear()} PPF PROFI
          </div>
        </div>
      </div>
    </footer>
  );
}
