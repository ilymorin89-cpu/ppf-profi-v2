import "server-only";
import { BRANDS } from "@/content/site";
import type { PickerBrand } from "@/components/site/BrandModelPicker";
import { brandCars } from "./schema";

/** Данные для выбора «марка → модель»: только публичные поля, без цен партнёра. */
export function pickerBrands(): PickerBrand[] {
  return BRANDS.map((b) => ({
    slug: b.slug,
    name: b.name,
    models: brandCars(b).map((c) => ({ code: c.code, model: c.model })),
  }));
}
