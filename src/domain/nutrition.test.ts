import { describe, expect, it } from 'vitest';
import {
  dailyTargets,
  formatMicroAmount,
  kcalByDate,
  microPercent,
  parseOffProduct,
  scaleNutrients,
  sumNutrients,
} from './nutrition';

/** Shaped like a real OFF product (Lidl "Milbona Skyr" style). */
const offSkyr = {
  code: '20143148',
  product_name: 'Skyr',
  product_name_de: 'Skyr Natur',
  brands: 'Milbona,Lidl',
  quantity: '450 g',
  product_quantity: '450',
  serving_quantity: '150',
  nutriscore_grade: 'a',
  nutriments: {
    'energy-kcal_100g': 63,
    energy_100g: 268,
    fat_100g: 0.2,
    'saturated-fat_100g': 0.1,
    carbohydrates_100g: 3.9,
    sugars_100g: 3.9,
    proteins_100g: 11,
    salt_100g: 0.1,
    'vitamin-b12_100g': 0.00000075, // 0.75 µg
    calcium_100g: 0.15, // 150 mg
  },
};

describe('parseOffProduct', () => {
  it('normalizes an OFF product (German name, first brand, per-100g values)', () => {
    const product = parseOffProduct(offSkyr);
    expect(product).not.toBeNull();
    expect(product!.name).toBe('Skyr Natur');
    expect(product!.brand).toBe('Milbona');
    expect(product!.packageG).toBe(450);
    expect(product!.servingG).toBe(150);
    expect(product!.nutriScore).toBe('a');
    expect(product!.nutrients.kcal).toBe(63);
    expect(product!.nutrients.protein).toBe(11);
    expect(product!.nutrients.salt).toBe(0.1);
    // grams → mg
    expect(product!.nutrients.micros?.calcium).toBe(150);
    expect(product!.nutrients.micros?.vitaminB12).toBeCloseTo(0.00075, 5);
  });

  it('falls back from kJ to kcal and from sodium to salt', () => {
    const product = parseOffProduct({
      code: '4061458000001',
      product_name: 'Haferflocken',
      nutriments: { energy_100g: 1550, sodium_100g: 0.004 },
    });
    expect(product!.nutrients.kcal).toBe(370); // 1550 kJ / 4.184
    expect(product!.nutrients.salt).toBe(0.01); // sodium × 2.5
  });

  it('rejects products without name or without any nutriments', () => {
    expect(parseOffProduct({ code: '123', nutriments: { fat_100g: 1 } })).toBeNull();
    expect(parseOffProduct({ code: '123', product_name: 'Leer', nutriments: {} })).toBeNull();
    expect(parseOffProduct(null)).toBeNull();
  });
});

describe('scaleNutrients / sumNutrients', () => {
  const per100 = parseOffProduct(offSkyr)!.nutrients;

  it('scales per-100g values to an amount', () => {
    const portion = scaleNutrients(per100, 150);
    expect(portion.kcal).toBe(95); // 63 × 1.5, kcal rounded to integer
    expect(portion.protein).toBeCloseTo(16.5, 2);
    expect(portion.micros?.calcium).toBe(225);
  });

  it('sums entries and treats missing values as 0', () => {
    const total = sumNutrients([
      scaleNutrients(per100, 150),
      { kcal: 500, fat: 20 }, // entry without protein/micros
    ]);
    expect(total.kcal).toBe(595);
    expect(total.protein).toBeCloseTo(16.5, 2);
    expect(total.fat).toBeCloseTo(20.3, 2);
    expect(total.micros?.calcium).toBe(225);
  });
});

describe('micros', () => {
  it('computes % of the EU reference value', () => {
    expect(microPercent('calcium', 400)).toBe(50); // NRV 800 mg
    expect(microPercent('vitaminC', 80)).toBe(100);
  });

  it('formats µg micros in µg', () => {
    expect(formatMicroAmount('vitaminB12', 0.0025)).toBe('2.5 µg');
    expect(formatMicroAmount('calcium', 150)).toBe('150 mg');
  });
});

describe('dailyTargets', () => {
  it('uses defaults without profile data', () => {
    const targets = dailyTargets(null);
    expect(targets.kcal).toBe(2200);
    expect(targets.proteinMin).toBe(110);
    expect(targets.fiberMin).toBe(30);
    expect(targets.saltMax).toBe(6);
  });

  it('derives kcal from Mifflin-St Jeor × 1.5 plus goal rate', () => {
    const targets = dailyTargets({
      weightKg: 80,
      heightCm: 183,
      age: 30,
      sex: 'male',
      goalRateKgPerWeek: 0.25,
    });
    // BMR = 800 + 1143.75 - 150 + 5 = 1798.75 → ×1.5 = 2698 + 275 = 2973 → rounded to 10
    expect(targets.kcal).toBe(2970);
    expect(targets.proteinMin).toBe(128); // 80 × 1.6
    expect(targets.saturatedFatMax).toBe(Math.round((2970 * 0.1) / 9));
  });

  it('lets manual overrides win and re-derives the fat/carb guides', () => {
    const targets = dailyTargets(null, { kcal: 3000, proteinMin: 150, saltMax: 5 });
    expect(targets.kcal).toBe(3000);
    expect(targets.proteinMin).toBe(150);
    expect(targets.saltMax).toBe(5);
    expect(targets.fiberMin).toBe(30); // untouched default
    expect(targets.fatRef).toBe(100); // 3000 × 0.3 / 9
  });
});

describe('kcalByDate', () => {
  it('sums kcal per day from per-100g values and amounts', () => {
    const result = kcalByDate([
      { date: '2026-07-01', amountG: 150, nutrients: { kcal: 63 } },
      { date: '2026-07-01', amountG: 100, nutrients: { kcal: 500 } },
      { date: '2026-07-02', amountG: 50, nutrients: { kcal: 370 } },
      { date: '2026-07-02', amountG: 30, nutrients: {} }, // no kcal data
    ]);
    expect(result['2026-07-01']).toBe(595); // 94.5 + 500 rounded
    expect(result['2026-07-02']).toBe(185);
  });
});
