import Image from "next/image";
import { CASE_FILM, FILMS, HOME, SCENARIOS, daysLabel, type Case } from "@/content/site";

export default function CaseCard({ item }: { item: Case }) {
  const meta = [
    SCENARIOS[item.scope].label,
    FILMS[CASE_FILM[item.film]].name,
    item.city,
    item.year ? String(item.year) : null,
    item.days ? daysLabel(item.days) : null,
  ].filter(Boolean);

  return (
    <div className="dark-card overflow-hidden">
      <div className="grid grid-cols-2 gap-px bg-white/10">
        {[
          { src: item.photoBefore, label: HOME.worksBefore },
          { src: item.photoAfter, label: HOME.worksAfter },
        ].map((p) => (
          <div key={p.label} className="relative bg-black">
            <Image
              src={p.src}
              alt={`${item.model} — ${p.label.toLowerCase()}`}
              width={1200}
              height={800}
              sizes="(max-width: 768px) 50vw, 400px"
              className="aspect-[4/3] w-full object-cover"
            />
            <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]">
              {p.label}
            </span>
          </div>
        ))}
      </div>
      {item.video && (
        <video
          src={item.video}
          controls
          playsInline
          preload="none"
          className="mx-auto aspect-[9/16] max-h-[480px] w-full bg-black object-contain"
        />
      )}
      <div className="p-5">
        <div className="font-extrabold">{item.model}</div>
        <div className="mt-1 text-xs text-white/55">{meta.join(" · ")}</div>
      </div>
    </div>
  );
}
