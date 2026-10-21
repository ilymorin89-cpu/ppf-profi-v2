type IconName = "shield" | "badge" | "tool" | "pin";

const ITEMS: { title: string; icon: IconName }[] = [
  { title: "Премиальные плёнки Spectroll", icon: "shield" },
  { title: "Гарантия 24 месяца", icon: "badge" },
  { title: "Опытные мастера", icon: "tool" },
  { title: "Москва", icon: "pin" },
];

const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "h-6 w-6",
  "aria-hidden": true,
};

function Icon({ name }: { name: IconName }) {
  switch (name) {
    case "shield":
      return (
        <svg {...svgProps}>
          <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z" />
        </svg>
      );
    case "badge":
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M8.5 12.2l2.4 2.4 4.6-4.8" />
        </svg>
      );
    case "tool":
      return (
        <svg {...svgProps}>
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      );
    case "pin":
      return (
        <svg {...svgProps}>
          <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
          <circle cx="12" cy="10" r="2.4" />
        </svg>
      );
  }
}

/** Четыре преимущества под карточками. Только подтверждённые факты (гарантия 24 месяца, плёнки Spectroll, Москва). */
export default function BenefitsRow() {
  return (
    <section className="border-b border-white/8 bg-black/40">
      <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-8 px-4 py-10 sm:px-6 lg:grid-cols-4">
        {ITEMS.map((item) => (
          <li key={item.title} className="flex items-center gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-lime-400/30 accent">
              <Icon name={item.icon} />
            </span>
            <span className="text-sm font-bold leading-snug sm:text-base">{item.title}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
