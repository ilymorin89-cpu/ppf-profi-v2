export type CarClass = "L" | "XL" | "XL+";

export type CarEntry = {
  code: string;
  brand: string;
  model: string;
  class: CarClass;
};

// Публичный список: только то, что безопасно показывать в браузере.
// Расход плёнки и дни работы здесь НЕ хранятся.
// Синхронизирован с data/pricing-cars.csv (code, brand, model, class).
export const CARS_LIST: CarEntry[] = [
  { code: "GEELY_MONJARO", brand: "Geely", model: "Monjaro", class: "L" },
  { code: "BMW_X5_G05", brand: "BMW", model: "X5 G05", class: "XL" },
  { code: "BMW_X7_G07", brand: "BMW", model: "X7 G07", class: "XL+" },
  { code: "MB_GLE_V167", brand: "Mercedes-Benz", model: "GLE V167", class: "XL" },
  { code: "PORSCHE_CAYENNE_E3", brand: "Porsche", model: "Cayenne E3", class: "XL" },
  { code: "TOYOTA_LC300", brand: "Toyota", model: "Land Cruiser 300", class: "XL+" },
  { code: "HAVAL_JOLION", brand: "Haval", model: "Jolion", class: "L" },
  { code: "BELGEE_X50", brand: "Belgee", model: "X50", class: "L" },
  { code: "BELGEE_X70", brand: "Belgee", model: "X70", class: "XL" },
  { code: "CHERY_TIGGO_4_PRO", brand: "Chery", model: "Tiggo 4 Pro", class: "L" },
  { code: "GEELY_ATLAS", brand: "Geely", model: "Atlas", class: "XL" },
  { code: "HYUNDAI_CRETA", brand: "Hyundai", model: "Creta", class: "L" },
  { code: "BMW_X3_G01", brand: "BMW", model: "X3 G01", class: "L" },
  { code: "BMW_X3_G45", brand: "BMW", model: "X3 G45", class: "L" },
  { code: "BMW_X4_G02", brand: "BMW", model: "X4 G02", class: "L" },
  { code: "BMW_X5_F15", brand: "BMW", model: "X5 F15", class: "XL" },
  { code: "BMW_X6_G06", brand: "BMW", model: "X6 G06", class: "XL" },
  { code: "BMW_XM_G09", brand: "BMW", model: "XM G09", class: "XL" },
  { code: "BMW_5_G30", brand: "BMW", model: "5 серия G30", class: "L" },
  { code: "BMW_5_G60", brand: "BMW", model: "5 серия G60", class: "L" },
  { code: "BMW_7_G70", brand: "BMW", model: "7 серия G70", class: "XL" },
  { code: "MB_GLE_C167", brand: "Mercedes-Benz", model: "GLE Coupe C167", class: "XL" },
  { code: "MB_GLS_X167", brand: "Mercedes-Benz", model: "GLS X167", class: "XL+" },
  { code: "MB_G_W463", brand: "Mercedes-Benz", model: "G-класс W463", class: "XL" },
  { code: "MB_GLC_X253", brand: "Mercedes-Benz", model: "GLC X253", class: "L" },
  { code: "MB_GLC_X254", brand: "Mercedes-Benz", model: "GLC X254", class: "L" },
  { code: "MB_E_W214", brand: "Mercedes-Benz", model: "E-класс W214", class: "L" },
  { code: "MB_S_W223", brand: "Mercedes-Benz", model: "S-класс W223", class: "XL" },
  { code: "PORSCHE_CAYENNE_COUPE_E3", brand: "Porsche", model: "Cayenne Coupe E3", class: "XL" },
  { code: "PORSCHE_MACAN_95B", brand: "Porsche", model: "Macan 95B", class: "L" },
  { code: "PORSCHE_MACAN_EV", brand: "Porsche", model: "Macan Electric", class: "L" },
  { code: "PORSCHE_PANAMERA_971", brand: "Porsche", model: "Panamera 971", class: "XL" },
  { code: "PORSCHE_PANAMERA_976", brand: "Porsche", model: "Panamera 976", class: "XL" },
  { code: "PORSCHE_TAYCAN", brand: "Porsche", model: "Taycan J1", class: "L" },
  { code: "PORSCHE_911_992", brand: "Porsche", model: "911 992", class: "L" },
  { code: "LR_RR_L405", brand: "Land Rover", model: "Range Rover L405", class: "XL+" },
  { code: "LR_RR_L460", brand: "Land Rover", model: "Range Rover L460", class: "XL+" },
  { code: "LR_RRS_L494", brand: "Land Rover", model: "Range Rover Sport L494", class: "XL" },
  { code: "LR_RRS_L461", brand: "Land Rover", model: "Range Rover Sport L461", class: "XL" },
  { code: "LR_VELAR_L560", brand: "Land Rover", model: "Range Rover Velar L560", class: "L" },
  { code: "LR_DEFENDER_L663", brand: "Land Rover", model: "Defender L663", class: "XL" },
  { code: "LR_DISCOVERY_L462", brand: "Land Rover", model: "Discovery L462", class: "XL" },
  { code: "LYNK_01", brand: "Lynk & Co", model: "01", class: "L" },
  { code: "LYNK_05", brand: "Lynk & Co", model: "05", class: "L" },
  { code: "LYNK_08", brand: "Lynk & Co", model: "08", class: "XL" },
  { code: "LYNK_09", brand: "Lynk & Co", model: "09", class: "XL" },
  { code: "LYNK_900", brand: "Lynk & Co", model: "900", class: "XL+" },
  { code: "TOYOTA_LC_PRADO_150", brand: "Toyota", model: "Land Cruiser Prado 150", class: "XL" },
  { code: "TOYOTA_LC_PRADO_250", brand: "Toyota", model: "Land Cruiser Prado 250", class: "XL" },
  { code: "TOYOTA_HIGHLANDER_XU70", brand: "Toyota", model: "Highlander XU70", class: "XL" },
  { code: "TOYOTA_CAMRY_XV70", brand: "Toyota", model: "Camry XV70", class: "L" },
  { code: "TOYOTA_RAV4_XA50", brand: "Toyota", model: "RAV4 XA50", class: "L" },
  { code: "LEXUS_LX_J310", brand: "Lexus", model: "LX 600 (J310)", class: "XL+" },
  { code: "LEXUS_GX_J250", brand: "Lexus", model: "GX 550 (J250)", class: "XL" },
  { code: "LEXUS_RX_AL30", brand: "Lexus", model: "RX AL30", class: "XL" },
  { code: "LEXUS_NX_AZ20", brand: "Lexus", model: "NX AZ20", class: "L" },
  { code: "LEXUS_ES_XZ10", brand: "Lexus", model: "ES XZ10", class: "L" },
  { code: "LEXUS_LM", brand: "Lexus", model: "LM", class: "XL+" },
  { code: "GEELY_COOLRAY", brand: "Geely", model: "Coolray SX11", class: "L" },
  { code: "GEELY_TUGELLA", brand: "Geely", model: "Tugella FY11", class: "L" },
  { code: "GEELY_OKAVANGO", brand: "Geely", model: "Okavango", class: "L" },
  { code: "GEELY_PREFACE", brand: "Geely", model: "Preface", class: "L" },
  { code: "LIXIANG_L6", brand: "LiXiang", model: "L6", class: "XL" },
  { code: "LIXIANG_L7", brand: "LiXiang", model: "L7", class: "XL" },
  { code: "LIXIANG_L8", brand: "LiXiang", model: "L8", class: "XL+" },
  { code: "LIXIANG_L9", brand: "LiXiang", model: "L9", class: "XL+" },
  { code: "LIXIANG_MEGA", brand: "LiXiang", model: "Mega", class: "XL+" },
  { code: "ZEEKR_001", brand: "Zeekr", model: "001", class: "XL" },
  { code: "ZEEKR_7X", brand: "Zeekr", model: "7X", class: "L" },
  { code: "ZEEKR_009", brand: "Zeekr", model: "009", class: "XL+" },
  { code: "ZEEKR_9X", brand: "Zeekr", model: "9X", class: "XL+" },
  { code: "ZEEKR_X", brand: "Zeekr", model: "X", class: "L" },
];

export function carLabel(code: string): string {
  const c = CARS_LIST.find((x) => x.code === code);
  return c ? `${c.brand} ${c.model}` : code;
}