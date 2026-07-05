/**
 * Open Food Facts client (free, ODbL-licensed, CORS-enabled — no API key).
 * Everything goes against the world instance — the country subdomains
 * (de.openfoodfacts.org) don't send CORS headers, so they fail on web under
 * the app's COEP setup. Text search filters on countries=germany instead so
 * Lidl/Aldi own brands (Milbona, Crownfield, …) rank first.
 */
import { Platform } from 'react-native';
import { parseOffProduct, type FoodProductData } from '@/domain/nutrition';

const FIELDS =
  'code,product_name,product_name_de,generic_name,brands,quantity,product_quantity,serving_quantity,nutriments,nutriscore_grade';

/** OFF asks API users to identify themselves; browsers forbid the header. */
function headers(): Record<string, string> {
  return Platform.OS === 'web' ? {} : { 'User-Agent': 'Weeko/1.0 (personal weekly planner)' };
}

export class OffNetworkError extends Error {
  constructor() {
    super('Open Food Facts request failed');
    this.name = 'OffNetworkError';
  }
}

/** Returns null when the barcode is unknown (or the entry has no usable data). */
export async function fetchProductByBarcode(barcode: string): Promise<FoodProductData | null> {
  let response: Response;
  try {
    response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}?fields=${FIELDS}`,
      { headers: headers() }
    );
  } catch {
    throw new OffNetworkError();
  }
  if (response.status === 404) return null;
  if (!response.ok) throw new OffNetworkError();
  const payload = (await response.json()) as { status?: number; product?: unknown };
  if (payload.status !== 1 || !payload.product) return null;
  return parseOffProduct(payload.product);
}

export async function searchProducts(query: string): Promise<FoodProductData[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '20',
    sort_by: 'unique_scans_n',
    tagtype_0: 'countries',
    tag_contains_0: 'contains',
    tag_0: 'germany',
    fields: FIELDS,
  });
  let response: Response;
  try {
    response = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`, {
      headers: headers(),
    });
  } catch {
    throw new OffNetworkError();
  }
  if (!response.ok) throw new OffNetworkError();
  const payload = (await response.json()) as { products?: unknown[] };
  const products = Array.isArray(payload.products) ? payload.products : [];
  return products
    .map(parseOffProduct)
    .filter((product): product is FoodProductData => product !== null);
}
