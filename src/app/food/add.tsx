/**
 * Add-food modal: barcode scan (camera), manual barcode, OFF text search or a
 * fully custom entry. A found product shows its per-100 g values, amount +
 * meal pickers, then saves a snapshot entry via the food store.
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Star, X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { Screen } from '@/components/Screen';
import { BarcodeScanner } from '@/components/food/BarcodeScanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Body, Label, Muted, SectionTitle, TABULAR, Title } from '@/components/ui/Text';
import { fetchProductByBarcode, OffNetworkError, searchProducts } from '@/api/openFoodFacts';
import {
  getProduct,
  listFavorites,
  recentProducts,
  setFavorite,
  upsertProduct,
  type MealType,
} from '@/db/repos/foodRepo';
import { uiColor } from '@/constants/uiColors';
import {
  BASIC_FOOD_BARCODE_PREFIX,
  searchBasicFoods,
  type BasicFood,
} from '@/domain/basicFoods';
import type { FoodProduct } from '@/db/schema';
import { MACRO_KEYS, type FoodProductData, type Nutrients } from '@/domain/nutrition';
import { useFoodStore } from '@/stores/foodStore';

type Mode = 'scan' | 'search' | 'custom';
type LookupError = 'notFound' | 'network' | null;

const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function suggestedMeal(): MealType {
  const hour = new Date().getHours();
  if (hour < 10) return 'breakfast';
  if (hour < 14) return 'lunch';
  if (hour < 17) return 'snack';
  if (hour < 21) return 'dinner';
  return 'snack';
}

/** Back to the food tab — deep links (web) have no back stack. */
function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/food');
}

/** "Skyr (Milbona)" — but no suffix when the name already carries the brand. */
function displayName(product: FoodProductData): string {
  if (!product.brand || product.name.toLowerCase().includes(product.brand.toLowerCase())) {
    return product.name;
  }
  return `${product.name} (${product.brand})`;
}

function toProductData(product: FoodProduct): FoodProductData {
  return {
    barcode: product.barcode,
    name: product.name,
    brand: product.brand,
    quantity: product.quantity,
    packageG: product.packageG,
    servingG: product.servingG,
    nutrients: product.nutrients,
    nutriScore: product.nutriScore,
  };
}

const NUTRI_SCORE_COLORS: Record<string, string> = {
  a: '#16a34a',
  b: '#84cc16',
  c: '#f59e0b',
  d: '#f97316',
  e: '#dc2626',
};

function basicToProductData(food: BasicFood, lang: string): FoodProductData {
  return {
    barcode: `${BASIC_FOOD_BARCODE_PREFIX}${food.key}`,
    name: lang === 'en' ? food.en : food.de,
    brand: null,
    quantity: null,
    packageG: null,
    servingG: food.servingG,
    nutrients: food.nutrients,
    nutriScore: null,
  };
}

function isBasicBarcode(barcode: string): boolean {
  return barcode.startsWith(BASIC_FOOD_BARCODE_PREFIX);
}

export default function FoodAddScreen() {
  const { t, i18n } = useTranslation();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const params = useLocalSearchParams<{ meal?: string }>();
  const add = useFoodStore((s) => s.add);

  const [mode, setMode] = useState<Mode>('scan');
  const [scannerKey, setScannerKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [lookupError, setLookupError] = useState<LookupError>(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodProductData[] | null>(null);
  const [recent, setRecent] = useState<FoodProduct[]>([]);
  const [favorites, setFavorites] = useState<FoodProduct[]>([]);
  const [selectedIsFavorite, setSelectedIsFavorite] = useState(false);

  const [selected, setSelected] = useState<FoodProductData | null>(null);
  const [amount, setAmount] = useState('100');
  const [meal, setMeal] = useState<MealType>(
    MEALS.includes(params.meal as MealType) ? (params.meal as MealType) : suggestedMeal()
  );

  const [custom, setCustom] = useState({
    name: '',
    barcode: '',
    kcal: '',
    protein: '',
    carbs: '',
    fat: '',
    amount: '100',
  });

  const refreshLists = () => {
    void recentProducts().then(setRecent);
    void listFavorites().then(setFavorites);
  };

  useEffect(refreshLists, []);

  const select = (product: FoodProductData) => {
    setSelected(product);
    setAmount(String(product.servingG ?? 100));
    setLookupError(null);
    void getProduct(product.barcode).then((cached) =>
      setSelectedIsFavorite(cached?.favorite ?? false)
    );
  };

  const toggleFavorite = async () => {
    if (!selected) return;
    // make sure it exists before flagging
    await upsertProduct(selected, isBasicBarcode(selected.barcode) ? 'custom' : 'off');
    await setFavorite(selected.barcode, !selectedIsFavorite);
    setSelectedIsFavorite(!selectedIsFavorite);
    refreshLists();
  };

  const lookup = async (barcode: string) => {
    const code = barcode.trim();
    if (!code || busy) return;
    setBusy(true);
    setLookupError(null);
    try {
      const cached = await getProduct(code);
      if (cached) {
        select(toProductData(cached));
        return;
      }
      const product = await fetchProductByBarcode(code);
      if (!product) {
        setLookupError('notFound');
        return;
      }
      await upsertProduct(product);
      select(product);
    } catch (error) {
      setLookupError(error instanceof OffNetworkError ? 'network' : 'notFound');
    } finally {
      setBusy(false);
      setScannerKey((key) => key + 1); // re-arm the scanner for the next code
    }
  };

  const search = async () => {
    if (!query.trim() || busy) return;
    setBusy(true);
    setLookupError(null);
    try {
      setResults(await searchProducts(query.trim()));
    } catch {
      setLookupError('network');
      setResults(null);
    } finally {
      setBusy(false);
    }
  };

  const amountG = Number(amount.replace(',', '.'));
  const amountValid = Number.isFinite(amountG) && amountG > 0;

  const saveProduct = async () => {
    if (!selected || !amountValid) return;
    await upsertProduct(selected, isBasicBarcode(selected.barcode) ? 'custom' : 'off');
    await add({
      meal,
      barcode: selected.barcode,
      name: displayName(selected),
      amountG,
      nutrients: selected.nutrients,
    });
    close();
  };

  const customKcal = Number(custom.kcal.replace(',', '.'));
  const customAmount = Number(custom.amount.replace(',', '.'));
  const customBarcode = custom.barcode.trim();
  const customValid =
    custom.name.trim().length > 0 &&
    Number.isFinite(customKcal) &&
    customKcal >= 0 &&
    Number.isFinite(customAmount) &&
    customAmount > 0 &&
    (customBarcode === '' || /^\d{4,14}$/.test(customBarcode));

  const saveCustom = async () => {
    if (!customValid) return;
    // values are per 100 g; with a barcode the product becomes scannable later
    const nutrients: Nutrients = { kcal: Math.round(customKcal) };
    for (const [key, value] of [
      ['protein', custom.protein],
      ['carbs', custom.carbs],
      ['fat', custom.fat],
    ] as const) {
      const parsed = Number(value.replace(',', '.'));
      if (value.trim() && Number.isFinite(parsed)) nutrients[key] = parsed;
    }
    if (customBarcode) {
      await upsertProduct(
        {
          barcode: customBarcode,
          name: custom.name.trim(),
          brand: null,
          quantity: null,
          packageG: null,
          servingG: null,
          nutrients,
          nutriScore: null,
        },
        'custom'
      );
    }
    await add({
      meal,
      barcode: customBarcode || null,
      name: custom.name.trim(),
      amountG: customAmount,
      nutrients,
    });
    close();
  };

  // built-in staples are searched locally while typing (no button needed)
  const basicResults = useMemo(
    () => (mode === 'search' ? searchBasicFoods(query, i18n.language === 'en' ? 'en' : 'de') : []),
    [mode, query, i18n.language]
  );

  const per100Rows = useMemo(() => {
    if (!selected) return [];
    return MACRO_KEYS.filter((key) => selected.nutrients[key] !== undefined).map((key) => ({
      key,
      value: selected.nutrients[key]!,
    }));
  }, [selected]);

  const mealPicker = (
    <View>
      <Label>{t('food.add.meal')}</Label>
      <SegmentedControl<MealType>
        options={MEALS.map((value) => ({ value, label: t(`food.meals.${value}`) }))}
        value={meal}
        onChange={setMeal}
      />
    </View>
  );

  return (
    <Screen>
      <View className="flex-row items-center justify-between">
        <Title>{t('food.add.title')}</Title>
        <Pressable
          accessibilityRole="button"
          onPress={close}
          className="p-2 active:opacity-60"
        >
          <X size={22} color={uiColor('muted', dark)} />
        </Pressable>
      </View>

      {selected ? (
        <Card className="mt-4">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <SectionTitle>{selected.name}</SectionTitle>
              <Muted>
                {[
                  selected.name.toLowerCase().includes((selected.brand ?? '').toLowerCase())
                    ? null
                    : selected.brand,
                  selected.quantity,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Muted>
            </View>
            <View className="flex-row items-center gap-2">
              <Pressable
                accessibilityRole="button"
                onPress={() => void toggleFavorite()}
                className="p-1 active:opacity-60"
              >
                <Star
                  size={22}
                  color={uiColor('warning', dark)}
                  fill={selectedIsFavorite ? uiColor('warning', dark) : 'transparent'}
                />
              </Pressable>
              {selected.nutriScore ? (
                <View
                  className="h-8 w-8 items-center justify-center rounded-lg"
                  style={{ backgroundColor: NUTRI_SCORE_COLORS[selected.nutriScore] }}
                >
                  <Body className="font-bold text-white">{selected.nutriScore.toUpperCase()}</Body>
                </View>
              ) : null}
            </View>
          </View>

          <View className="mt-3 rounded-xl bg-surface dark:bg-surface-dark p-3">
            <Muted className="mb-1">{t('food.add.per100')}</Muted>
            {per100Rows.map((row) => (
              <View key={row.key} className="flex-row justify-between">
                <Muted>{t(`food.nutrients.${row.key}`)}</Muted>
                <Muted style={TABULAR}>
                  {row.value} {row.key === 'kcal' ? 'kcal' : 'g'}
                </Muted>
              </View>
            ))}
          </View>

          <View className="mt-3 gap-3">
            <Field
              label={t('food.add.amount')}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              maxLength={6}
              style={TABULAR}
            />
            <View className="flex-row gap-2">
              {[
                { label: '100 g', value: 100 },
                selected.servingG
                  ? { label: `${t('food.add.serving')} (${selected.servingG} g)`, value: selected.servingG }
                  : null,
                selected.packageG
                  ? { label: `${t('food.add.package')} (${selected.packageG} g)`, value: selected.packageG }
                  : null,
              ]
                .filter((chip): chip is { label: string; value: number } => chip !== null)
                .map((chip) => (
                  <Pressable
                    key={chip.label}
                    onPress={() => setAmount(String(chip.value))}
                    className="rounded-full border border-border dark:border-border-dark px-3 py-1 active:opacity-60"
                  >
                    <Muted style={TABULAR}>{chip.label}</Muted>
                  </Pressable>
                ))}
            </View>
            {mealPicker}
            <View className="flex-row justify-end gap-2">
              <Button
                title={t('common.cancel')}
                variant="secondary"
                onPress={() => setSelected(null)}
              />
              <Button title={t('food.add.save')} onPress={saveProduct} disabled={!amountValid} />
            </View>
          </View>
        </Card>
      ) : (
        <>
          <View className="mt-4">
            <SegmentedControl<Mode>
              options={[
                { value: 'scan', label: t('food.add.scan') },
                { value: 'search', label: t('food.add.searchTab') },
                { value: 'custom', label: t('food.add.custom') },
              ]}
              value={mode}
              onChange={setMode}
            />
          </View>

          {lookupError ? (
            <Card className="mt-3">
              <Muted className="text-danger dark:text-danger-dark">
                {t(lookupError === 'network' ? 'food.add.networkError' : 'food.add.notFound')}
              </Muted>
            </Card>
          ) : null}

          {mode === 'scan' && (
            <View className="mt-3 gap-3">
              <BarcodeScanner key={scannerKey} onScanned={(code) => void lookup(code)} />
              <View className="flex-row items-end gap-2">
                <Field
                  className="flex-1"
                  label={t('food.add.barcodeManual')}
                  value={barcodeInput}
                  onChangeText={setBarcodeInput}
                  keyboardType="numeric"
                  autoCapitalize="none"
                  placeholder="4056489…"
                  maxLength={14}
                  style={TABULAR}
                />
                <Button
                  title={t('food.add.lookup')}
                  variant="secondary"
                  loading={busy}
                  onPress={() => void lookup(barcodeInput)}
                  disabled={!barcodeInput.trim()}
                />
              </View>
              {favorites.length > 0 && (
                <View>
                  <Label>{t('food.add.favorites')}</Label>
                  <View className="gap-2">
                    {favorites.map((product) => (
                      <Card key={product.barcode} onPress={() => select(toProductData(product))}>
                        <View className="flex-row items-center gap-2">
                          <Star
                            size={14}
                            color={uiColor('warning', dark)}
                            fill={uiColor('warning', dark)}
                          />
                          <View className="flex-1">
                            <Body>{product.name}</Body>
                            <Muted style={TABULAR}>
                              {[
                                product.brand,
                                product.nutrients.kcal
                                  ? `${product.nutrients.kcal} kcal / 100 g`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </Muted>
                          </View>
                        </View>
                      </Card>
                    ))}
                  </View>
                </View>
              )}
              {recent.filter((product) => !product.favorite).length > 0 && (
                <View>
                  <Label>{t('food.add.recent')}</Label>
                  <View className="gap-2">
                    {recent
                      .filter((product) => !product.favorite)
                      .map((product) => (
                      <Card key={product.barcode} onPress={() => select(toProductData(product))}>
                        <Body>{product.name}</Body>
                        <Muted style={TABULAR}>
                          {[product.brand, product.nutrients.kcal ? `${product.nutrients.kcal} kcal / 100 g` : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </Muted>
                      </Card>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {mode === 'search' && (
            <View className="mt-3 gap-3">
              <View className="flex-row items-end gap-2">
                <Field
                  className="flex-1"
                  label={t('food.add.searchLabel')}
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t('food.add.searchPlaceholder')}
                  autoCapitalize="none"
                  onSubmitEditing={() => void search()}
                  returnKeyType="search"
                />
                <Button
                  title={t('food.add.searchButton')}
                  variant="secondary"
                  loading={busy}
                  onPress={() => void search()}
                  disabled={!query.trim()}
                />
              </View>
              {basicResults.length > 0 && (
                <View>
                  <Label>{t('food.add.basicFoods')}</Label>
                  <View className="gap-2">
                    {basicResults.map((food) => {
                      const product = basicToProductData(food, i18n.language);
                      return (
                        <Card key={food.key} onPress={() => select(product)}>
                          <Body>{product.name}</Body>
                          <Muted style={TABULAR}>
                            {product.nutrients.kcal} kcal / 100 g
                            {product.nutrients.micros
                              ? ` · ${t('food.add.withMicros')}`
                              : ''}
                          </Muted>
                        </Card>
                      );
                    })}
                  </View>
                </View>
              )}
              {results !== null && results.length === 0 && basicResults.length === 0 && (
                <Muted>{t('food.add.noResults')}</Muted>
              )}
              <View className="gap-2">
                {(results ?? []).map((product) => (
                  <Card key={product.barcode} onPress={() => select(product)}>
                    <Body>{product.name}</Body>
                    <Muted style={TABULAR}>
                      {[
                        product.brand,
                        product.quantity,
                        product.nutrients.kcal ? `${product.nutrients.kcal} kcal / 100 g` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Muted>
                  </Card>
                ))}
              </View>
            </View>
          )}

          {mode === 'custom' && (
            <Card className="mt-3">
              <View className="gap-3">
                <Field
                  label={t('food.add.customName')}
                  value={custom.name}
                  onChangeText={(name) => setCustom({ ...custom, name })}
                />
                <Field
                  label={t('food.add.barcodeOptional')}
                  value={custom.barcode}
                  onChangeText={(barcode) => setCustom({ ...custom, barcode })}
                  keyboardType="numeric"
                  autoCapitalize="none"
                  placeholder="4056489…"
                  maxLength={14}
                  style={TABULAR}
                />
                <Label className="mb-0">{t('food.add.per100')}</Label>
                <View className="flex-row gap-3">
                  <Field
                    className="flex-1"
                    label="kcal"
                    value={custom.kcal}
                    onChangeText={(kcal) => setCustom({ ...custom, kcal })}
                    keyboardType="numeric"
                    style={TABULAR}
                  />
                  <Field
                    className="flex-1"
                    label={`${t('food.nutrients.protein')} (g)`}
                    value={custom.protein}
                    onChangeText={(protein) => setCustom({ ...custom, protein })}
                    keyboardType="numeric"
                    style={TABULAR}
                  />
                </View>
                <View className="flex-row gap-3">
                  <Field
                    className="flex-1"
                    label={`${t('food.nutrients.carbs')} (g)`}
                    value={custom.carbs}
                    onChangeText={(carbs) => setCustom({ ...custom, carbs })}
                    keyboardType="numeric"
                    style={TABULAR}
                  />
                  <Field
                    className="flex-1"
                    label={`${t('food.nutrients.fat')} (g)`}
                    value={custom.fat}
                    onChangeText={(fat) => setCustom({ ...custom, fat })}
                    keyboardType="numeric"
                    style={TABULAR}
                  />
                </View>
                <Field
                  label={t('food.add.amount')}
                  value={custom.amount}
                  onChangeText={(amount) => setCustom({ ...custom, amount })}
                  keyboardType="numeric"
                  maxLength={6}
                  style={TABULAR}
                />
                <Muted>{t('food.add.customHint')}</Muted>
                {mealPicker}
                <View className="flex-row justify-end">
                  <Button title={t('food.add.save')} onPress={saveCustom} disabled={!customValid} />
                </View>
              </View>
            </Card>
          )}

          <Muted className="mt-6 text-xs">{t('food.add.attribution')}</Muted>
        </>
      )}
    </Screen>
  );
}
