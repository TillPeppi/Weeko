/**
 * Food data: `food_entry` (the diary) is synced via Supabase; `food_product`
 * (the OFF barcode cache + custom products + favorites) stays device-local in
 * AsyncStorage — it was local-only before too, and is just a cache.
 */
import { newId } from '../id';
import { insertRow, nowIso, sb, selectRows, toRow } from '../sb';
import { loadLocal, saveLocal } from '../local';
import { type FoodEntry, type FoodProduct } from '../schema';
import type { FoodProductData, Nutrients } from '@/domain/nutrition';

export type MealType = FoodEntry['meal'];

// ---- food_product: device-local cache (barcode → product) --------------------

const PRODUCTS_KEY = 'weeko.food_products';

async function loadProducts(): Promise<Record<string, FoodProduct>> {
  return loadLocal<Record<string, FoodProduct>>(PRODUCTS_KEY, {});
}

export async function getProduct(barcode: string): Promise<FoodProduct | undefined> {
  return (await loadProducts())[barcode];
}

/** Caches a fetched/normalized product (insert or refresh), keyed by barcode. */
export async function upsertProduct(
  data: FoodProductData,
  source: 'off' | 'custom' = 'off'
): Promise<void> {
  const products = await loadProducts();
  const existing = products[data.barcode];
  products[data.barcode] = {
    id: existing?.id ?? newId(),
    barcode: data.barcode,
    name: data.name,
    brand: data.brand,
    quantity: data.quantity,
    packageG: data.packageG,
    servingG: data.servingG,
    nutrients: data.nutrients,
    nutriScore: data.nutriScore,
    source,
    favorite: existing?.favorite ?? false,
    fetchedAt: nowIso(),
  };
  await saveLocal(PRODUCTS_KEY, products);
}

export async function setFavorite(barcode: string, favorite: boolean): Promise<void> {
  const products = await loadProducts();
  const product = products[barcode];
  if (!product) return;
  product.favorite = favorite;
  await saveLocal(PRODUCTS_KEY, products);
}

export async function listFavorites(): Promise<FoodProduct[]> {
  const products = await loadProducts();
  return Object.values(products)
    .filter((p) => p.favorite)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** All cached products (for the full-data export). */
export async function allProducts(): Promise<FoodProduct[]> {
  return Object.values(await loadProducts());
}

/** Clears the local product cache (full-data wipe). */
export async function clearProducts(): Promise<void> {
  await saveLocal(PRODUCTS_KEY, {});
}

/** Most recently logged distinct products — quick re-add without scanning. */
export async function recentProducts(limit = 8): Promise<FoodProduct[]> {
  const entries = await selectRows<FoodEntry>('food_entry', (q) =>
    q.order('created_at', { ascending: false }).limit(100)
  );
  const products = await loadProducts();
  const result: FoodProduct[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (!entry.barcode || seen.has(entry.barcode)) continue;
    seen.add(entry.barcode);
    const product = products[entry.barcode];
    if (product) result.push(product);
    if (result.length >= limit) break;
  }
  return result;
}

// ---- food_entry: synced via Supabase ----------------------------------------

export async function listEntriesByDate(date: string): Promise<FoodEntry[]> {
  return selectRows<FoodEntry>('food_entry', (q) =>
    q.eq('date', date).order('created_at', { ascending: true })
  );
}

export async function addEntry(values: {
  date: string;
  meal: MealType;
  barcode?: string | null;
  name: string;
  amountG: number;
  nutrients: Nutrients;
}): Promise<string> {
  const id = newId();
  await insertRow('food_entry', {
    ...values,
    id,
    barcode: values.barcode ?? null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  return id;
}

export async function updateEntry(
  id: string,
  values: { amountG: number; meal: MealType }
): Promise<void> {
  const { error } = await sb()
    .from('food_entry')
    .update(toRow({ ...values, updatedAt: nowIso() }))
    .eq('id', id);
  if (error) throw error;
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await sb().from('food_entry').delete().eq('id', id);
  if (error) throw error;
}

/** Entries of a date range (inclusive) — feeds the week trend. */
export async function listEntriesBetween(start: string, end: string): Promise<FoodEntry[]> {
  return selectRows<FoodEntry>('food_entry', (q) =>
    q.gte('date', start).lte('date', end).order('date', { ascending: true })
  );
}
