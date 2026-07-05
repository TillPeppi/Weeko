/**
 * Nutrition domain logic (food tracker): nutrient math, Open Food Facts
 * response parsing and daily targets. Framework-free (no React/Expo imports).
 *
 * Conventions: macro values are grams per 100 g (kcal per 100 g), micros are
 * milligrams per 100 g (µg sources are converted). Open Food Facts stores all
 * `_100g` nutriment values in grams (SI) — parsing converts accordingly.
 */

export const MACRO_KEYS = [
  'kcal',
  'fat',
  'saturatedFat',
  'carbs',
  'sugars',
  'fiber',
  'protein',
  'salt',
] as const;
export type MacroKey = (typeof MACRO_KEYS)[number];

/**
 * Tracked micronutrients with EU NRV (daily reference value, Regulation
 * 1169/2011 Annex XIII) — used for "% of daily need" display.
 */
export const MICROS = {
  vitaminA: { nrvMg: 0.8, unit: 'µg' },
  vitaminC: { nrvMg: 80, unit: 'mg' },
  vitaminD: { nrvMg: 0.005, unit: 'µg' },
  vitaminE: { nrvMg: 12, unit: 'mg' },
  vitaminB12: { nrvMg: 0.0025, unit: 'µg' },
  folate: { nrvMg: 0.2, unit: 'µg' },
  calcium: { nrvMg: 800, unit: 'mg' },
  iron: { nrvMg: 14, unit: 'mg' },
  magnesium: { nrvMg: 375, unit: 'mg' },
  potassium: { nrvMg: 2000, unit: 'mg' },
  zinc: { nrvMg: 10, unit: 'mg' },
  iodine: { nrvMg: 0.15, unit: 'µg' },
} as const;
export type MicroKey = keyof typeof MICROS;
export const MICRO_KEYS = Object.keys(MICROS) as MicroKey[];

export interface Nutrients {
  kcal?: number;
  fat?: number;
  saturatedFat?: number;
  carbs?: number;
  sugars?: number;
  fiber?: number;
  protein?: number;
  salt?: number;
  /** mg per 100 g (or mg absolute after scaling) */
  micros?: Partial<Record<MicroKey, number>>;
}

/** Normalized product data (from Open Food Facts or user-created). */
export interface FoodProductData {
  barcode: string;
  name: string;
  brand: string | null;
  /** package size as text, e.g. "500 g" */
  quantity: string | null;
  /** package content in g/ml when known */
  packageG: number | null;
  /** one serving in g/ml when known */
  servingG: number | null;
  /** per 100 g */
  nutrients: Nutrients;
  /** 'a'…'e' when rated */
  nutriScore: string | null;
}

function round(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** Scales per-100 g values to an absolute amount in grams. */
export function scaleNutrients(per100: Nutrients, grams: number): Nutrients {
  const factor = grams / 100;
  const out: Nutrients = {};
  for (const key of MACRO_KEYS) {
    const value = per100[key];
    if (value !== undefined) out[key] = round(value * factor, key === 'kcal' ? 0 : 2);
  }
  if (per100.micros) {
    const micros: Partial<Record<MicroKey, number>> = {};
    for (const key of MICRO_KEYS) {
      const value = per100.micros[key];
      if (value !== undefined) micros[key] = round(value * factor, 6);
    }
    if (Object.keys(micros).length > 0) out.micros = micros;
  }
  return out;
}

/** Sums a list of absolute nutrient values (missing values count as 0). */
export function sumNutrients(list: Nutrients[]): Nutrients {
  const out: Nutrients = {};
  for (const item of list) {
    for (const key of MACRO_KEYS) {
      const value = item[key];
      if (value !== undefined) out[key] = round((out[key] ?? 0) + value, 2);
    }
    if (item.micros) {
      out.micros ??= {};
      for (const key of MICRO_KEYS) {
        const value = item.micros[key];
        if (value !== undefined) out.micros[key] = round((out.micros[key] ?? 0) + value, 6);
      }
    }
  }
  return out;
}

/** % of the EU daily reference value covered by an absolute micro amount (mg). */
export function microPercent(key: MicroKey, amountMg: number): number {
  return Math.round((amountMg / MICROS[key].nrvMg) * 100);
}

/** Formats a micro amount (mg) in its display unit, e.g. 0.08 → "80 µg". */
export function formatMicroAmount(key: MicroKey, amountMg: number): string {
  if (MICROS[key].unit === 'µg') return `${round(amountMg * 1000, 1)} µg`;
  return `${round(amountMg, 1)} mg`;
}

// --- Open Food Facts parsing ------------------------------------------------

/** OFF nutriment key → our micro key (values are grams per 100 g in OFF). */
const OFF_MICRO_KEYS: Record<string, MicroKey> = {
  'vitamin-a': 'vitaminA',
  'vitamin-c': 'vitaminC',
  'vitamin-d': 'vitaminD',
  'vitamin-e': 'vitaminE',
  'vitamin-b12': 'vitaminB12',
  folates: 'folate',
  calcium: 'calcium',
  iron: 'iron',
  magnesium: 'magnesium',
  potassium: 'potassium',
  zinc: 'zinc',
  iodine: 'iodine',
};

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function get100g(nutriments: Record<string, unknown>, key: string): number | null {
  return toNumber(nutriments[`${key}_100g`]);
}

/**
 * Normalizes a raw OFF `product` object. Returns null when it carries no
 * usable name or no nutriment data at all (common for barely-filled entries).
 */
export function parseOffProduct(raw: unknown): FoodProductData | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const p = raw as Record<string, unknown>;
  const barcode = typeof p.code === 'string' ? p.code : String(p.code ?? '');
  const name =
    (typeof p.product_name_de === 'string' && p.product_name_de.trim()) ||
    (typeof p.product_name === 'string' && p.product_name.trim()) ||
    (typeof p.generic_name === 'string' && p.generic_name.trim()) ||
    '';
  if (!barcode || !name) return null;

  const nutriments =
    typeof p.nutriments === 'object' && p.nutriments !== null
      ? (p.nutriments as Record<string, unknown>)
      : {};

  const nutrients: Nutrients = {};
  const kcal = get100g(nutriments, 'energy-kcal');
  const kj = get100g(nutriments, 'energy');
  if (kcal !== null) nutrients.kcal = round(kcal, 0);
  else if (kj !== null) nutrients.kcal = round(kj / 4.184, 0);
  const macroMap: [MacroKey, string][] = [
    ['fat', 'fat'],
    ['saturatedFat', 'saturated-fat'],
    ['carbs', 'carbohydrates'],
    ['sugars', 'sugars'],
    ['fiber', 'fiber'],
    ['protein', 'proteins'],
  ];
  for (const [ours, theirs] of macroMap) {
    const value = get100g(nutriments, theirs);
    if (value !== null) nutrients[ours] = round(value, 2);
  }
  const salt = get100g(nutriments, 'salt');
  const sodium = get100g(nutriments, 'sodium');
  if (salt !== null) nutrients.salt = round(salt, 2);
  else if (sodium !== null) nutrients.salt = round(sodium * 2.5, 2);

  const micros: Partial<Record<MicroKey, number>> = {};
  for (const [offKey, ourKey] of Object.entries(OFF_MICRO_KEYS)) {
    const grams = get100g(nutriments, offKey);
    if (grams !== null && grams > 0) micros[ourKey] = round(grams * 1000, 6); // g → mg
  }
  if (Object.keys(micros).length > 0) nutrients.micros = micros;

  if (Object.keys(nutrients).length === 0) return null;

  const brands = typeof p.brands === 'string' ? p.brands.split(',')[0].trim() : '';
  const nutriScore =
    typeof p.nutriscore_grade === 'string' && /^[a-e]$/.test(p.nutriscore_grade)
      ? p.nutriscore_grade
      : null;

  return {
    barcode,
    name,
    brand: brands || null,
    quantity: typeof p.quantity === 'string' && p.quantity.trim() ? p.quantity.trim() : null,
    packageG: toNumber(p.product_quantity),
    servingG: toNumber(p.serving_quantity),
    nutrients,
    nutriScore,
  };
}

// --- Daily targets -----------------------------------------------------------

export interface NutrientTargets {
  kcal: number;
  proteinMin: number;
  fatRef: number;
  carbsRef: number;
  fiberMin: number;
  sugarsMax: number;
  saltMax: number;
  saturatedFatMax: number;
}

export interface TargetProfile {
  weightKg?: number | null;
  heightCm?: number | null;
  age?: number | null;
  sex?: 'male' | 'female' | 'other' | null;
  goalRateKgPerWeek?: number | null;
}

/** Manual target overrides (Settings); unset fields fall back to derived values. */
export interface NutritionGoalOverrides {
  kcal?: number;
  proteinMin?: number;
  fiberMin?: number;
  sugarsMax?: number;
  saltMax?: number;
}

/**
 * Daily targets from the profile: Mifflin-St Jeor BMR × 1.5 activity
 * (the app's audience trains regularly), adjusted by the goal rate
 * (7700 kcal ≈ 1 kg). Falls back to sensible defaults when data is missing.
 * Fiber/salt/sugar bounds follow DGE/WHO guidance. Manual overrides
 * (Settings) win over derived values; fat/carbs guides re-derive from the
 * effective kcal/protein.
 */
export function dailyTargets(
  profile?: TargetProfile | null,
  overrides?: NutritionGoalOverrides | null
): NutrientTargets {
  let kcal = 2200;
  const { weightKg, heightCm, age, sex } = profile ?? {};
  if (weightKg && heightCm && age) {
    const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'female' ? -161 : 5);
    kcal = bmr * 1.5 + ((profile?.goalRateKgPerWeek ?? 0) * 7700) / 7;
  }
  kcal = overrides?.kcal ?? Math.round(kcal / 10) * 10;
  const proteinMin = overrides?.proteinMin ?? Math.round(weightKg ? weightKg * 1.6 : 110);
  const fatRef = Math.round((kcal * 0.3) / 9);
  const carbsRef = Math.max(0, Math.round((kcal - proteinMin * 4 - fatRef * 9) / 4));
  return {
    kcal,
    proteinMin,
    fatRef,
    carbsRef,
    fiberMin: overrides?.fiberMin ?? 30,
    sugarsMax: overrides?.sugarsMax ?? 50,
    saltMax: overrides?.saltMax ?? 6,
    saturatedFatMax: Math.round((kcal * 0.1) / 9),
  };
}

/**
 * Average micro intake per tracked day (days that have at least one entry).
 * Feeds the supplement-hint card.
 */
export function dailyMicroAverages(
  entries: { date: string; amountG: number; nutrients: Nutrients }[]
): { avg: Partial<Record<MicroKey, number>>; daysTracked: number } {
  const days = new Set(entries.map((entry) => entry.date));
  const daysTracked = days.size;
  if (daysTracked === 0) return { avg: {}, daysTracked: 0 };
  const total = sumNutrients(
    entries.map((entry) => scaleNutrients(entry.nutrients, entry.amountG))
  );
  const avg: Partial<Record<MicroKey, number>> = {};
  for (const key of MICRO_KEYS) {
    const value = total.micros?.[key];
    if (value !== undefined) avg[key] = value / daysTracked;
  }
  return { avg, daysTracked };
}

export interface NutrientGap {
  key: MicroKey;
  /** Ø % of the EU reference value per tracked day */
  percent: number;
}

/**
 * Micros that ARE tracked (some data exists) but stay below the threshold.
 * Micros with zero data are excluded on purpose: products without micro
 * labels would otherwise flag everything as "low".
 */
export function nutrientGaps(
  avg: Partial<Record<MicroKey, number>>,
  thresholdPercent = 50
): NutrientGap[] {
  const gaps: NutrientGap[] = [];
  for (const key of MICRO_KEYS) {
    const value = avg[key];
    if (value === undefined || value <= 0) continue;
    const percent = microPercent(key, value);
    if (percent < thresholdPercent) gaps.push({ key, percent });
  }
  return gaps.sort((a, b) => a.percent - b.percent);
}

/**
 * kcal per day for a set of entries (each with per-100 g nutrients and an
 * amount) — feeds the week-trend bars.
 */
export function kcalByDate(
  entries: { date: string; amountG: number; nutrients: Nutrients }[]
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const entry of entries) {
    const kcal = (entry.nutrients.kcal ?? 0) * (entry.amountG / 100);
    out[entry.date] = Math.round((out[entry.date] ?? 0) + kcal);
  }
  return out;
}
