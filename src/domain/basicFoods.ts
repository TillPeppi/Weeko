/**
 * Built-in basic foods (unprocessed staples without barcodes) so vitamin/
 * mineral tracking works for fruit, vegetables & co. — Open Food Facts rarely
 * carries micros, and an apple has no barcode anyway.
 *
 * Values are per 100 g (cooked where noted), approximated from USDA/BLS
 * reference data: macros in g, kcal as-is, micros in mg (µg ÷ 1000).
 * Entries get the pseudo-barcode `basic:<key>` so favorites/recents work.
 */
import type { Nutrients } from './nutrition';

export interface BasicFood {
  key: string;
  de: string;
  en: string;
  /** typical portion in g */
  servingG: number;
  /** per 100 g */
  nutrients: Nutrients;
}

export const BASIC_FOOD_BARCODE_PREFIX = 'basic:';

const F = (
  key: string,
  de: string,
  en: string,
  servingG: number,
  nutrients: Nutrients
): BasicFood => ({ key, de, en, servingG, nutrients });

export const BASIC_FOODS: BasicFood[] = [
  // fruit
  F('apple', 'Apfel', 'Apple', 150, {
    kcal: 52, protein: 0.3, carbs: 13.8, sugars: 10.4, fat: 0.2, fiber: 2.4,
    micros: { vitaminC: 4.6, potassium: 107 },
  }),
  F('banana', 'Banane', 'Banana', 120, {
    kcal: 89, protein: 1.1, carbs: 22.8, sugars: 12.2, fat: 0.3, fiber: 2.6,
    micros: { vitaminC: 8.7, potassium: 358, magnesium: 27 },
  }),
  F('orange', 'Orange', 'Orange', 130, {
    kcal: 47, protein: 0.9, carbs: 11.8, sugars: 9.4, fat: 0.1, fiber: 2.4,
    micros: { vitaminC: 53, folate: 0.03, potassium: 181, calcium: 40 },
  }),
  F('strawberries', 'Erdbeeren', 'Strawberries', 150, {
    kcal: 32, protein: 0.7, carbs: 7.7, sugars: 4.9, fat: 0.3, fiber: 2,
    micros: { vitaminC: 59, folate: 0.024, potassium: 153 },
  }),
  F('blueberries', 'Blaubeeren', 'Blueberries', 100, {
    kcal: 57, protein: 0.7, carbs: 14.5, sugars: 10, fat: 0.3, fiber: 2.4,
    micros: { vitaminC: 9.7, potassium: 77 },
  }),
  F('grapes', 'Weintrauben', 'Grapes', 120, {
    kcal: 69, protein: 0.7, carbs: 18.1, sugars: 15.5, fat: 0.2, fiber: 0.9,
    micros: { vitaminC: 3.2, potassium: 191 },
  }),
  F('kiwi', 'Kiwi', 'Kiwi', 75, {
    kcal: 61, protein: 1.1, carbs: 14.7, sugars: 9, fat: 0.5, fiber: 3,
    micros: { vitaminC: 92.7, vitaminE: 1.5, potassium: 312 },
  }),
  // vegetables
  F('broccoli', 'Brokkoli', 'Broccoli', 200, {
    kcal: 34, protein: 2.8, carbs: 6.6, sugars: 1.7, fat: 0.4, fiber: 2.6,
    micros: { vitaminC: 89, folate: 0.063, potassium: 316, calcium: 47, magnesium: 21 },
  }),
  F('bell-pepper', 'Paprika (rot)', 'Bell pepper (red)', 150, {
    kcal: 31, protein: 1, carbs: 6, sugars: 4.2, fat: 0.3, fiber: 2.1,
    micros: { vitaminC: 128, vitaminA: 0.157, vitaminE: 1.6, potassium: 211 },
  }),
  F('carrot', 'Karotte', 'Carrot', 100, {
    kcal: 41, protein: 0.9, carbs: 9.6, sugars: 4.7, fat: 0.2, fiber: 2.8,
    micros: { vitaminA: 0.835, vitaminC: 5.9, potassium: 320 },
  }),
  F('spinach', 'Spinat', 'Spinach', 150, {
    kcal: 23, protein: 2.9, carbs: 3.6, sugars: 0.4, fat: 0.4, fiber: 2.2,
    micros: {
      vitaminA: 0.469, vitaminC: 28, folate: 0.194, iron: 2.7, magnesium: 79,
      potassium: 558, calcium: 99,
    },
  }),
  F('tomato', 'Tomate', 'Tomato', 120, {
    kcal: 18, protein: 0.9, carbs: 3.9, sugars: 2.6, fat: 0.2, fiber: 1.2,
    micros: { vitaminC: 13.7, vitaminA: 0.042, potassium: 237 },
  }),
  F('cucumber', 'Gurke', 'Cucumber', 150, {
    kcal: 15, protein: 0.7, carbs: 3.6, sugars: 1.7, fat: 0.1, fiber: 0.5,
    micros: { potassium: 147 },
  }),
  F('zucchini', 'Zucchini', 'Zucchini', 200, {
    kcal: 17, protein: 1.2, carbs: 3.1, sugars: 2.5, fat: 0.3, fiber: 1,
    micros: { vitaminC: 17.9, potassium: 261 },
  }),
  F('sweet-potato', 'Süßkartoffel', 'Sweet potato', 150, {
    kcal: 86, protein: 1.6, carbs: 20.1, sugars: 4.2, fat: 0.1, fiber: 3,
    micros: { vitaminA: 0.709, vitaminC: 2.4, potassium: 337, magnesium: 25 },
  }),
  F('potato-cooked', 'Kartoffel (gekocht)', 'Potato (boiled)', 200, {
    kcal: 87, protein: 1.9, carbs: 20.1, sugars: 0.9, fat: 0.1, fiber: 1.8,
    micros: { vitaminC: 13, potassium: 379, magnesium: 22 },
  }),
  F('avocado', 'Avocado', 'Avocado', 100, {
    kcal: 160, protein: 2, carbs: 8.5, sugars: 0.7, fat: 14.7, saturatedFat: 2.1, fiber: 6.7,
    micros: { potassium: 485, folate: 0.081, vitaminE: 2.1, magnesium: 29 },
  }),
  F('mushrooms', 'Champignons', 'Mushrooms', 125, {
    kcal: 22, protein: 3.1, carbs: 3.3, sugars: 2, fat: 0.3, fiber: 1,
    micros: { potassium: 318, zinc: 0.5 },
  }),
  F('onion', 'Zwiebel', 'Onion', 80, {
    kcal: 40, protein: 1.1, carbs: 9.3, sugars: 4.2, fat: 0.1, fiber: 1.7,
    micros: { vitaminC: 7.4, potassium: 146 },
  }),
  // grains & sides
  F('oats', 'Haferflocken', 'Oats', 50, {
    kcal: 372, protein: 13.5, carbs: 58.7, sugars: 1.1, fat: 7, saturatedFat: 1.2, fiber: 10,
    micros: { iron: 4.3, magnesium: 130, zinc: 3.6, potassium: 358 },
  }),
  F('rice-cooked', 'Reis (gekocht)', 'Rice (cooked)', 180, {
    kcal: 130, protein: 2.7, carbs: 28.2, sugars: 0.1, fat: 0.3, fiber: 0.4,
    micros: { magnesium: 12 },
  }),
  F('pasta-cooked', 'Nudeln (gekocht)', 'Pasta (cooked)', 200, {
    kcal: 158, protein: 5.8, carbs: 30.9, sugars: 0.6, fat: 0.9, fiber: 1.8,
    micros: { iron: 0.5, magnesium: 18 },
  }),
  F('wholegrain-bread', 'Vollkornbrot', 'Wholegrain bread', 50, {
    kcal: 247, protein: 8.5, carbs: 41, sugars: 4, fat: 3.5, saturatedFat: 0.6, fiber: 7, salt: 1.2,
    micros: { iron: 2.5, magnesium: 75, zinc: 1.8 },
  }),
  F('quinoa-cooked', 'Quinoa (gekocht)', 'Quinoa (cooked)', 180, {
    kcal: 120, protein: 4.4, carbs: 21.3, sugars: 0.9, fat: 1.9, fiber: 2.8,
    micros: { magnesium: 64, iron: 1.5, folate: 0.042, zinc: 1.1 },
  }),
  // protein
  F('chicken-breast', 'Hähnchenbrust (gegart)', 'Chicken breast (cooked)', 150, {
    kcal: 165, protein: 31, carbs: 0, fat: 3.6, saturatedFat: 1,
    micros: { potassium: 256, zinc: 1, magnesium: 29 },
  }),
  F('ground-beef', 'Rinderhack (gegart)', 'Ground beef (cooked)', 125, {
    kcal: 250, protein: 26, carbs: 0, fat: 17, saturatedFat: 6.7,
    micros: { iron: 2.6, zinc: 6.2, vitaminB12: 0.0026 },
  }),
  F('salmon', 'Lachs (gegart)', 'Salmon (cooked)', 125, {
    kcal: 208, protein: 20, carbs: 0, fat: 13, saturatedFat: 3.1,
    micros: { vitaminD: 0.011, vitaminB12: 0.0032, potassium: 363, magnesium: 27, iodine: 0.015 },
  }),
  F('tuna-canned', 'Thunfisch (Dose, Wasser)', 'Tuna (canned, water)', 100, {
    kcal: 116, protein: 26, carbs: 0, fat: 0.8, salt: 0.9,
    micros: { vitaminB12: 0.003, iron: 1.3, potassium: 237, iodine: 0.015, vitaminD: 0.002 },
  }),
  F('egg', 'Ei (gekocht)', 'Egg (boiled)', 60, {
    kcal: 155, protein: 13, carbs: 1.1, sugars: 1.1, fat: 11, saturatedFat: 3.3,
    micros: {
      vitaminD: 0.0022, vitaminB12: 0.0011, vitaminA: 0.16, iron: 1.2, zinc: 1.1,
      folate: 0.044, iodine: 0.025,
    },
  }),
  F('tofu', 'Tofu', 'Tofu', 150, {
    kcal: 76, protein: 8, carbs: 1.9, sugars: 0.6, fat: 4.8, saturatedFat: 0.7, fiber: 0.3,
    micros: { calcium: 200, iron: 2.7, magnesium: 37, zinc: 0.8 },
  }),
  F('lentils-cooked', 'Linsen (gekocht)', 'Lentils (cooked)', 180, {
    kcal: 116, protein: 9, carbs: 20.1, sugars: 1.8, fat: 0.4, fiber: 7.9,
    micros: { iron: 3.3, folate: 0.181, potassium: 369, zinc: 1.3, magnesium: 36 },
  }),
  F('chickpeas-cooked', 'Kichererbsen (gekocht)', 'Chickpeas (cooked)', 180, {
    kcal: 164, protein: 8.9, carbs: 27.4, sugars: 4.8, fat: 2.6, fiber: 7.6,
    micros: { iron: 2.9, folate: 0.172, magnesium: 48, zinc: 1.5, potassium: 291 },
  }),
  F('black-beans-cooked', 'Schwarze Bohnen (gekocht)', 'Black beans (cooked)', 180, {
    kcal: 132, protein: 8.9, carbs: 23.7, sugars: 0.3, fat: 0.5, fiber: 8.7,
    micros: { iron: 2.1, folate: 0.149, magnesium: 70, potassium: 355 },
  }),
  // dairy
  F('quark-lowfat', 'Magerquark', 'Low-fat quark', 250, {
    kcal: 67, protein: 12, carbs: 4, sugars: 4, fat: 0.3,
    micros: { calcium: 100, vitaminB12: 0.0008 },
  }),
  F('skyr', 'Skyr', 'Skyr', 150, {
    kcal: 63, protein: 11, carbs: 3.9, sugars: 3.9, fat: 0.2,
    micros: { calcium: 150, vitaminB12: 0.0007 },
  }),
  F('greek-yogurt', 'Griechischer Joghurt', 'Greek yogurt', 150, {
    kcal: 97, protein: 9, carbs: 3.6, sugars: 3.6, fat: 5, saturatedFat: 3.5,
    micros: { calcium: 110, vitaminB12: 0.0005 },
  }),
  F('milk-1.5', 'Milch (1,5 %)', 'Milk (1.5%)', 200, {
    kcal: 47, protein: 3.4, carbs: 4.9, sugars: 4.9, fat: 1.5, saturatedFat: 0.9,
    micros: { calcium: 120, vitaminB12: 0.0004, iodine: 0.013, potassium: 150 },
  }),
  F('gouda', 'Käse (Gouda)', 'Cheese (Gouda)', 30, {
    kcal: 356, protein: 25, carbs: 2.2, sugars: 2.2, fat: 27, saturatedFat: 17, salt: 2,
    micros: { calcium: 700, zinc: 3.9, vitaminB12: 0.0015, vitaminA: 0.165 },
  }),
  F('cottage-cheese', 'Hüttenkäse', 'Cottage cheese', 100, {
    kcal: 98, protein: 11, carbs: 3.4, sugars: 2.7, fat: 4.3, saturatedFat: 1.7, salt: 0.9,
    micros: { calcium: 83, vitaminB12: 0.0004 },
  }),
  // nuts, seeds & fats
  F('almonds', 'Mandeln', 'Almonds', 30, {
    kcal: 579, protein: 21, carbs: 21.6, sugars: 4.4, fat: 49.9, saturatedFat: 3.8, fiber: 12.5,
    micros: { vitaminE: 25.6, magnesium: 270, calcium: 269, iron: 3.7, zinc: 3.1, potassium: 733 },
  }),
  F('walnuts', 'Walnüsse', 'Walnuts', 30, {
    kcal: 654, protein: 15, carbs: 13.7, sugars: 2.6, fat: 65, saturatedFat: 6.1, fiber: 6.7,
    micros: { magnesium: 158, iron: 2.9, zinc: 3.1, folate: 0.098 },
  }),
  F('peanut-butter', 'Erdnussbutter', 'Peanut butter', 20, {
    kcal: 588, protein: 25, carbs: 20, sugars: 9, fat: 50, saturatedFat: 10, fiber: 6, salt: 0.5,
    micros: { magnesium: 168, zinc: 2.7, vitaminE: 9, potassium: 649 },
  }),
  F('olive-oil', 'Olivenöl', 'Olive oil', 10, {
    kcal: 884, fat: 100, saturatedFat: 14,
    micros: { vitaminE: 14.4 },
  }),
  F('flaxseed', 'Leinsamen', 'Flaxseed', 15, {
    kcal: 534, protein: 18.3, carbs: 28.9, sugars: 1.5, fat: 42.2, saturatedFat: 3.7, fiber: 27.3,
    micros: { magnesium: 392, iron: 5.7, zinc: 4.3, potassium: 813 },
  }),
  // misc
  F('honey', 'Honig', 'Honey', 20, { kcal: 304, carbs: 82.4, sugars: 82.1 }),
  F('dark-chocolate', 'Dunkle Schokolade (85 %)', 'Dark chocolate (85%)', 20, {
    kcal: 590, protein: 8, carbs: 25, sugars: 15, fat: 45, saturatedFat: 27, fiber: 12,
    micros: { iron: 11, magnesium: 230, zinc: 3.3, potassium: 715 },
  }),
];

/** Local search: prefix matches first, then substring; current language first. */
export function searchBasicFoods(query: string, lang: 'de' | 'en', limit = 8): BasicFood[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const name = (food: BasicFood) => (lang === 'de' ? food.de : food.en).toLowerCase();
  const other = (food: BasicFood) => (lang === 'de' ? food.en : food.de).toLowerCase();
  const scored = BASIC_FOODS.map((food) => {
    const primary = name(food);
    const secondary = other(food);
    let score = -1;
    if (primary.startsWith(q)) score = 0;
    else if (primary.includes(q)) score = 1;
    else if (secondary.startsWith(q)) score = 2;
    else if (secondary.includes(q)) score = 3;
    return { food, score };
  }).filter((entry) => entry.score >= 0);
  scored.sort((a, b) => a.score - b.score || name(a.food).localeCompare(name(b.food)));
  return scored.slice(0, limit).map((entry) => entry.food);
}
