export type CarClass = "L" | "XL" | "XL+";

export type CarEntry = {
  code: string;
  brand: string;
  model: string;
  class: CarClass;
};

// Публичный список: только то, что безопасно показывать в браузере.
// Расход плёнки и дни работы здесь НЕ хранятся.
export const CARS_LIST: CarEntry[] = [
  { code: "GEELY_MONJARO", brand: "Geely", model: "Monjaro", class: "L" },
  { code: "HAVAL_JOLION", brand: "Haval", model: "Jolion", class: "L" },
  { code: "BELGEE_X50", brand: "Belgee", model: "X50", class: "L" },
  { code: "BELGEE_X70", brand: "Belgee", model: "X70", class: "XL" },
  { code: "CHERY_TIGGO_4_PRO", brand: "Chery", model: "Tiggo 4 Pro", class: "L" },
  { code: "GEELY_ATLAS", brand: "Geely", model: "Atlas", class: "XL" },
  { code: "HYUNDAI_CRETA", brand: "Hyundai", model: "Creta", class: "L" },
  { code: "BMW_X5_G05", brand: "BMW", model: "X5 G05", class: "XL" },
  { code: "BMW_X7_G07", brand: "BMW", model: "X7 G07", class: "XL+" },
  { code: "MB_GLE_V167", brand: "Mercedes-Benz", model: "GLE V167", class: "XL" },
  { code: "PORSCHE_CAYENNE_E3", brand: "Porsche", model: "Cayenne E3", class: "XL" },
  { code: "TOYOTA_LC300", brand: "Toyota", model: "Land Cruiser 300", class: "XL+" },
];

export function carLabel(code: string): string {
  const c = CARS_LIST.find((x) => x.code === code);
  return c ? `${c.brand} ${c.model}` : code;
}