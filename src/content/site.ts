// Единый источник текстов, чисел и контактов публичного сайта.
// Ключи PPF_STANDARD / SPECTROLL_PREMIUM / FULL / RISK_ZONES не переименовывать —
// они хранятся в БД. Меняются только отображаемые названия.
// Пустое значение (null, "", []) = блок или строка на сайте не рендерится.

export type FilmCode = "PPF_STANDARD" | "SPECTROLL_PREMIUM";
export type ScenarioCode = "FULL" | "RISK_ZONES";

// ---------- Плёнки ----------

export const THICKNESS_UNIT = "микрон";

export const FILMS: Record<FilmCode, { name: string; thickness: number }> = {
  PPF_STANDARD: { name: "Spectroll Standard", thickness: 170 },
  SPECTROLL_PREMIUM: { name: "Spectroll Premium", thickness: 210 },
};

export const FILM_CODES = Object.keys(FILMS) as FilmCode[];

/** «Spectroll Standard · 170 микрон»; неизвестный код возвращается как есть. */
export function filmLabel(code: string): string {
  const f = FILMS[code as FilmCode];
  return f ? `${f.name} · ${f.thickness} ${THICKNESS_UNIT}` : code;
}
