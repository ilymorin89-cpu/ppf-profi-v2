import "server-only";
import { BRANDS } from "@/content/site";
import type { PickerBrand, PickerModel } from "@/components/site/BrandModelPicker";
import { brandCars } from "./schema";

/** «G05 · 2018–н.в.»; для моделей без кузова — только годы. */
export function genLabel(c: { gen: string; years: string }): string {
  const parts = [c.gen, c.years].filter(Boolean);
  return parts.join(" · ");
}

/** Данные для выбора «марка → модель → поколение»: только публичные поля, без цен партнёра. */
export function pickerBrands(): PickerBrand[] {
  return BRANDS.map((b) => {
    const models: PickerModel[] = [];
    for (const c of brandCars(b)) {
      let m = models.find((x) => x.base === c.base);
      if (!m) {
        m = { base: c.base, gens: [] };
        models.push(m);
      }
      m.gens.push({ code: c.code, label: genLabel(c) });
    }
    return { slug: b.slug, name: b.name, models };
  });
}
