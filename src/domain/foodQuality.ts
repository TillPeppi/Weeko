/**
 * Food quality analytics: protein source categorization, vegetable ratio,
 * fiber quality. Framework-free.
 */

export type ProteinSource = 'meat' | 'fish' | 'plant' | 'dairy' | 'egg' | 'other';

export interface FoodQualityMetrics {
  proteinSources: Record<ProteinSource, { gramsCounted: number; percent: number }>;
  vegetablePercent: number;
  fiberGrams: number;
  fiberPerCalorie: number; // fiber per 100 kcal (quality metric)
}

/**
 * Basic food categorization by name pattern.
 * Returns the protein source for a given food name.
 */
function identifyProteinSource(name: string): ProteinSource {
  const lower = name.toLowerCase();

  if (
    lower.includes('fleisch') ||
    lower.includes('beef') ||
    lower.includes('rindfleisch') ||
    lower.includes('schweinefleisch') ||
    lower.includes('hähnchen') ||
    lower.includes('chicken') ||
    lower.includes('pork') ||
    lower.includes('rind') ||
    lower.includes('steak') ||
    lower.includes('wurst') ||
    lower.includes('schinken') ||
    lower.includes('bacon')
  ) {
    return 'meat';
  }

  if (
    lower.includes('fisch') ||
    lower.includes('fish') ||
    lower.includes('lachs') ||
    lower.includes('salmon') ||
    lower.includes('thunfisch') ||
    lower.includes('tuna') ||
    lower.includes('forelle') ||
    lower.includes('seabass') ||
    lower.includes('kabeljau')
  ) {
    return 'fish';
  }

  if (
    lower.includes('linse') ||
    lower.includes('lentil') ||
    lower.includes('bohne') ||
    lower.includes('bean') ||
    lower.includes('kichererbse') ||
    lower.includes('chickpea') ||
    lower.includes('tofu') ||
    lower.includes('tempeh') ||
    lower.includes('seitan') ||
    lower.includes('nuss') ||
    lower.includes('nut') ||
    lower.includes('samen') ||
    lower.includes('seed')
  ) {
    return 'plant';
  }

  if (
    lower.includes('käse') ||
    lower.includes('cheese') ||
    lower.includes('quark') ||
    lower.includes('joghurt') ||
    lower.includes('yogurt') ||
    lower.includes('milch') ||
    lower.includes('milk') ||
    lower.includes('skyr') ||
    lower.includes('käseaufstrich')
  ) {
    return 'dairy';
  }

  if (lower.includes('ei') || lower.includes('egg')) {
    return 'egg';
  }

  return 'other';
}

/**
 * Simple vegetable detection by name.
 */
function isVegetable(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes('gemüse') ||
    lower.includes('vegetable') ||
    lower.includes('brokkoli') ||
    lower.includes('broccoli') ||
    lower.includes('salat') ||
    lower.includes('salad') ||
    lower.includes('spinat') ||
    lower.includes('spinach') ||
    lower.includes('carrot') ||
    lower.includes('karotte') ||
    lower.includes('paprika') ||
    lower.includes('pepper') ||
    lower.includes('tomate') ||
    lower.includes('tomato') ||
    lower.includes('zucchini') ||
    lower.includes('aubergine') ||
    lower.includes('gurke') ||
    lower.includes('cucumber') ||
    lower.includes('kohl') ||
    lower.includes('cabbage') ||
    lower.includes('blätter') ||
    lower.includes('leaf') ||
    lower.includes('grün')
  );
}

export interface FoodEntryForQuality {
  name: string;
  amountG: number;
  nutrients: {
    kcal?: number;
    protein?: number;
    fiber?: number;
  };
}

/**
 * Calculate food quality metrics for a set of entries (e.g., one day or one week).
 */
export function foodQualityMetrics(entries: FoodEntryForQuality[]): FoodQualityMetrics {
  const sources: Record<ProteinSource, number> = {
    meat: 0,
    fish: 0,
    plant: 0,
    dairy: 0,
    egg: 0,
    other: 0,
  };

  let totalCalories = 0;
  let totalFiber = 0;
  let totalProtein = 0;
  let vegetableGrams = 0;

  for (const entry of entries) {
    const calories = (entry.nutrients.kcal ?? 0) * (entry.amountG / 100);
    const protein = (entry.nutrients.protein ?? 0) * (entry.amountG / 100);
    const fiber = (entry.nutrients.fiber ?? 0) * (entry.amountG / 100);

    totalCalories += calories;
    totalProtein += protein;
    totalFiber += fiber;

    // Protein source categorization
    if (protein > 0.5) {
      const source = identifyProteinSource(entry.name);
      sources[source] += protein;
    }

    // Vegetable tracking
    if (isVegetable(entry.name)) {
      vegetableGrams += entry.amountG;
    }
  }

  // Calculate percentages
  const proteinSources: Record<ProteinSource, { gramsCounted: number; percent: number }> = {
    meat: { gramsCounted: sources.meat, percent: totalProtein > 0 ? (sources.meat / totalProtein) * 100 : 0 },
    fish: { gramsCounted: sources.fish, percent: totalProtein > 0 ? (sources.fish / totalProtein) * 100 : 0 },
    plant: { gramsCounted: sources.plant, percent: totalProtein > 0 ? (sources.plant / totalProtein) * 100 : 0 },
    dairy: { gramsCounted: sources.dairy, percent: totalProtein > 0 ? (sources.dairy / totalProtein) * 100 : 0 },
    egg: { gramsCounted: sources.egg, percent: totalProtein > 0 ? (sources.egg / totalProtein) * 100 : 0 },
    other: { gramsCounted: sources.other, percent: totalProtein > 0 ? (sources.other / totalProtein) * 100 : 0 },
  };

  // Fiber quality (per 100 kcal)
  const fiberPerCalorie = totalCalories > 0 ? (totalFiber / totalCalories) * 100 : 0;

  return {
    proteinSources,
    vegetablePercent: totalFiber > 0 ? (vegetableGrams / entries.reduce((sum, e) => sum + e.amountG, 0)) * 100 : 0,
    fiberGrams: Math.round(totalFiber * 10) / 10,
    fiberPerCalorie: Math.round(fiberPerCalorie * 100) / 100,
  };
}

/**
 * Weekly food quality (one metric per day, then averaged).
 */
export interface WeeklyFoodQuality {
  avgFiberGrams: number;
  avgFiberPerCalorie: number;
  meatPercent: number;
  fishPercent: number;
  plantPercent: number;
  dairyPercent: number;
}

export function weeklyFoodQuality(
  dailyMetrics: FoodQualityMetrics[]
): WeeklyFoodQuality {
  if (dailyMetrics.length === 0) {
    return {
      avgFiberGrams: 0,
      avgFiberPerCalorie: 0,
      meatPercent: 0,
      fishPercent: 0,
      plantPercent: 0,
      dairyPercent: 0,
    };
  }

  const avgFiber = dailyMetrics.reduce((sum, m) => sum + m.fiberGrams, 0) / dailyMetrics.length;
  const avgFiberPerCalorie = dailyMetrics.reduce((sum, m) => sum + m.fiberPerCalorie, 0) / dailyMetrics.length;

  // Average protein source distribution
  const avgProteinSources = {
    meat: dailyMetrics.reduce((sum, m) => sum + m.proteinSources.meat.percent, 0) / dailyMetrics.length,
    fish: dailyMetrics.reduce((sum, m) => sum + m.proteinSources.fish.percent, 0) / dailyMetrics.length,
    plant: dailyMetrics.reduce((sum, m) => sum + m.proteinSources.plant.percent, 0) / dailyMetrics.length,
    dairy: dailyMetrics.reduce((sum, m) => sum + m.proteinSources.dairy.percent, 0) / dailyMetrics.length,
  };

  return {
    avgFiberGrams: Math.round(avgFiber * 10) / 10,
    avgFiberPerCalorie: Math.round(avgFiberPerCalorie * 100) / 100,
    meatPercent: Math.round(avgProteinSources.meat * 10) / 10,
    fishPercent: Math.round(avgProteinSources.fish * 10) / 10,
    plantPercent: Math.round(avgProteinSources.plant * 10) / 10,
    dairyPercent: Math.round(avgProteinSources.dairy * 10) / 10,
  };
}
