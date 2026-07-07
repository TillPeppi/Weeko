import { and, asc, desc, eq, gte, lte } from 'drizzle-orm';
import { db, nowIso } from '../client';
import { newId } from '../id';
import { auditInsert } from '../audit';
import { foodEntry, foodProduct, type FoodEntry, type FoodProduct } from '../schema';
import type { FoodProductData, Nutrients } from '@/domain/nutrition';

export type MealType = FoodEntry['meal'];

export async function getProduct(barcode: string): Promise<FoodProduct | undefined> {
  const rows = await db.select().from(foodProduct).where(eq(foodProduct.barcode, barcode));
  return rows[0];
}

/** Caches a fetched/normalized product (insert or refresh). Manual upsert keyed by
 *  barcode — PowerSync's local tables don't enforce the unique constraint that
 *  onConflictDoUpdate needs. `food_product` is a local-only table (not synced). */
export async function upsertProduct(
  data: FoodProductData,
  source: 'off' | 'custom' = 'off'
): Promise<void> {
  const values = {
    barcode: data.barcode,
    name: data.name,
    brand: data.brand,
    quantity: data.quantity,
    packageG: data.packageG,
    servingG: data.servingG,
    nutrients: data.nutrients,
    nutriScore: data.nutriScore,
    source,
    fetchedAt: nowIso(),
  };
  const existing = await getProduct(data.barcode);
  if (existing) {
    await db.update(foodProduct).set(values).where(eq(foodProduct.barcode, data.barcode));
  } else {
    await db.insert(foodProduct).values({ id: newId(), ...values });
  }
}

export async function setFavorite(barcode: string, favorite: boolean): Promise<void> {
  await db.update(foodProduct).set({ favorite }).where(eq(foodProduct.barcode, barcode));
}

export async function listFavorites(): Promise<FoodProduct[]> {
  return db
    .select()
    .from(foodProduct)
    .where(eq(foodProduct.favorite, true))
    .orderBy(asc(foodProduct.name));
}

/** Most recently logged distinct products — quick re-add without scanning. */
export async function recentProducts(limit = 8): Promise<FoodProduct[]> {
  const entries = await db
    .select()
    .from(foodEntry)
    .orderBy(desc(foodEntry.createdAt))
    .limit(100);
  const barcodes: string[] = [];
  for (const entry of entries) {
    if (entry.barcode && !barcodes.includes(entry.barcode)) barcodes.push(entry.barcode);
    if (barcodes.length >= limit) break;
  }
  const products: FoodProduct[] = [];
  for (const barcode of barcodes) {
    const product = await getProduct(barcode);
    if (product) products.push(product);
  }
  return products;
}

export async function listEntriesByDate(date: string): Promise<FoodEntry[]> {
  return db
    .select()
    .from(foodEntry)
    .where(eq(foodEntry.date, date))
    .orderBy(asc(foodEntry.createdAt));
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
  await db
    .insert(foodEntry)
    .values({ ...values, id, barcode: values.barcode ?? null, createdAt: nowIso(), ...auditInsert() });
  return id;
}

export async function updateEntry(
  id: string,
  values: { amountG: number; meal: MealType }
): Promise<void> {
  await db.update(foodEntry).set(values).where(eq(foodEntry.id, id));
}

export async function deleteEntry(id: string): Promise<void> {
  await db.delete(foodEntry).where(eq(foodEntry.id, id));
}

/** Entries of a date range (inclusive) — feeds the week trend. */
export async function listEntriesBetween(start: string, end: string): Promise<FoodEntry[]> {
  return db
    .select()
    .from(foodEntry)
    .where(and(gte(foodEntry.date, start), lte(foodEntry.date, end)))
    .orderBy(asc(foodEntry.date));
}
