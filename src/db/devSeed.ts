/**
 * Demo/test data seeder — fills every data-driven screen with realistic history
 * (weight trend, months of progressive training, recent nutrition, weeks with
 * blocks, tasks). Triggered from Settings (§ "Demo-Daten"). Writes through the
 * repos, so rows get the current user_id and sync once signed in + connected.
 *
 * Not idempotent — re-running appends. Clear via Settings → "Alle Daten löschen".
 */
import type { TrainingImportParsed, TrainingImportSession } from '@/schemas/trainingImport';
import type { WeekImportParsed } from '@/schemas/week';
import type { Nutrients } from '@/domain/nutrition';
import { isoWeekOf } from '@/domain/time';
import { addMeasurement } from './repos/bodyRepo';
import { addEntry } from './repos/foodRepo';
import { importTrainingSessions } from './repos/trainingRepo';
import { listExercises } from './repos/exerciseRepo';
import { applyWeekImport, getWeekWithBlocks, setBlockStatus } from './repos/weekRepo';
import { createTask, completeTask } from './repos/taskRepo';

const round = (n: number, d = 1): number => Math.round(n * 10 ** d) / 10 ** d;

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Monday (ISO) of the week `weeksAgo` before the current week, as YYYY-MM-DD. */
function mondayIso(weeksAgo: number): string {
  const d = new Date();
  const iso = d.getDay() === 0 ? 7 : d.getDay(); // 1..7
  d.setDate(d.getDate() - (iso - 1) - weeksAgo * 7);
  return d.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// --- Body: weekly weigh-ins over ~26 weeks, gentle lean-gain trend ------------
async function seedBody(): Promise<void> {
  for (let w = 26; w >= 0; w--) {
    const progress = 26 - w;
    const weight = 72 + progress * 0.11 + Math.sin(progress) * 0.25; // slow gain + wobble
    const fat = 16 - progress * 0.05;
    const muscle = 33 + progress * 0.06; // slow muscle gain
    await addMeasurement(daysAgoIso(w * 7), {
      weightKg: round(weight),
      fatPercent: round(Math.max(10, fat)),
      muscleMassKg: round(muscle),
      boneMassKg: 3.2,
      bmrKcal: Math.round(1550 + progress * 2),
    });
  }
}

// --- Training: ~48 sessions over 16 weeks, 3/week, progressive overload -------
async function seedTraining(): Promise<void> {
  const all = await listExercises();
  const byslug = (slug: string): string | undefined => all.find((e) => e.slug === slug)?.name;
  // reuse seeded exercises so the catalog isn't polluted; skip any that are missing
  const weighted = ['pullup', 'dip', 'gobletSquat', 'kbSwing', 'kbPress', 'bulgarianSplitSquat']
    .map((s) => ({ name: byslug(s), base: baseWeight(s) }))
    .filter((e): e is { name: string; base: number } => Boolean(e.name));
  const bodyweight = ['pushup', 'plank'].map(byslug).filter((n): n is string => Boolean(n));

  const sessions: TrainingImportSession[] = [];
  // 16 weeks × 3 sessions, oldest first
  for (let w = 15; w >= 0; w--) {
    const done = 15 - w; // 0..15, later = stronger
    for (const [i, offset] of [1, 3, 5].entries()) {
      const date = addDays(mondayIso(w), offset); // Tue/Thu/Sat
      const exs: TrainingImportSession['exercises'] = weighted
        .filter((_, idx) => (idx + i) % 2 === 0) // rotate ~half the lifts per session
        .map((e) => ({
          name: e.name,
          sets: Array.from({ length: 4 }, (_, s) => ({
            reps: 6 + ((s + done) % 4),
            weightKg: round(e.base + done * 0.6 + s * 0.5), // grows week over week
          })),
        }));
      if (bodyweight[0]) {
        exs.push({
          name: bodyweight[0],
          sets: Array.from({ length: 3 }, () => ({ reps: 12 + done })),
        });
      }
      sessions.push({
        date,
        start: '18:30',
        durationMinutes: 45 + (done % 3) * 10,
        title: i === 2 ? 'Hyrox-Style' : 'Weighted Calisthenics',
        exercises: exs,
      });
    }
  }
  const data: TrainingImportParsed = { schemaVersion: 1, sessions };
  await importTrainingSessions(data);
}

function baseWeight(slug: string): number {
  switch (slug) {
    case 'pullup':
    case 'dip':
      return 10;
    case 'gobletSquat':
    case 'kbPress':
      return 20;
    case 'kbSwing':
      return 24;
    case 'bulgarianSplitSquat':
      return 8;
    default:
      return 12;
  }
}

// --- Nutrition: last 21 days, ~4 entries/day, ~2500 kcal ----------------------
interface DemoFood {
  name: string;
  per100: Nutrients;
  grams: number;
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}
const FOODS: DemoFood[] = [
  { name: 'Haferflocken', meal: 'breakfast', grams: 80, per100: { kcal: 370, protein: 13, carbs: 60, fat: 7, fiber: 10, sugars: 1 } },
  { name: 'Magerquark', meal: 'breakfast', grams: 250, per100: { kcal: 67, protein: 12, carbs: 4, fat: 0.3, sugars: 4 } },
  { name: 'Hähnchenbrust', meal: 'lunch', grams: 200, per100: { kcal: 165, protein: 31, carbs: 0, fat: 3.6 } },
  { name: 'Reis (gekocht)', meal: 'lunch', grams: 250, per100: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4 } },
  { name: 'Brokkoli', meal: 'dinner', grams: 200, per100: { kcal: 34, protein: 2.8, carbs: 7, fat: 0.4, fiber: 2.6, salt: 0.03 } },
  { name: 'Lachs', meal: 'dinner', grams: 180, per100: { kcal: 208, protein: 20, carbs: 0, fat: 13 } },
  { name: 'Banane', meal: 'snack', grams: 120, per100: { kcal: 89, protein: 1.1, carbs: 23, fat: 0.3, sugars: 12, fiber: 2.6 } },
  { name: 'Proteinriegel', meal: 'snack', grams: 60, per100: { kcal: 350, protein: 33, carbs: 30, fat: 10, sugars: 3, salt: 0.5 } },
];
async function seedNutrition(): Promise<void> {
  for (let d = 20; d >= 0; d--) {
    const date = daysAgoIso(d);
    for (const f of FOODS) {
      await addEntry({ date, meal: f.meal, name: f.name, amountG: f.grams, nutrients: f.per100 });
    }
  }
}

// --- Weeks: current + 3 past weeks with blocks (past weeks marked done/skipped)
function buildWeek(weeksAgo: number): WeekImportParsed {
  const monday = mondayIso(weeksAgo);
  const { year, isoWeek } = isoWeekOf(monday);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const blocks: WeekImportParsed['days'][number]['blocks'] = [];
    if (i < 5) blocks.push({ type: 'work', start: '07:30', end: '17:00', title: 'Arbeit' });
    if (i === 0 || i === 3) blocks.push({ type: 'handball', start: '19:30', end: '22:00', title: 'Handball' });
    if (i === 1 || i === 5) blocks.push({ type: 'training', start: '18:30', end: '19:30', title: 'Training' });
    blocks.push({ type: 'meal', start: '12:30', end: '13:00', title: 'Mittag' });
    blocks.push({ type: 'dog', start: '20:45', end: '21:00', title: 'Hunderunde' });
    return { date, blocks };
  });
  return { schemaVersion: 1, week: { year, isoWeek }, days, tasks: [] };
}
async function seedWeeks(): Promise<void> {
  for (let w = 3; w >= 0; w--) {
    const data = buildWeek(w);
    await applyWeekImport(data);
    if (w > 0) {
      // mark past weeks mostly done, a few skipped → adherence stats
      const wk = await getWeekWithBlocks(data.week.year, data.week.isoWeek);
      for (const [i, b] of (wk?.blocks ?? []).entries()) {
        await setBlockStatus(b.id, i % 7 === 0 ? 'skipped' : 'done');
      }
    }
  }
}

// --- Tasks: a few, some completed --------------------------------------------
async function seedTasks(): Promise<void> {
  const specs: { title: string; category: string; done: boolean }[] = [
    { title: 'Meal Prep', category: 'mealprep', done: true },
    { title: 'Wocheneinkauf', category: 'errands', done: true },
    { title: 'Gitarre üben', category: 'guitar', done: false },
    { title: 'Wäsche', category: 'household', done: false },
  ];
  for (const s of specs) {
    const id = await createTask({ title: s.title, category: s.category, estimatedMinutes: 30 });
    if (s.done) await completeTask(id);
  }
}

/** Seeds a full demo history across all features. */
export async function seedDemoData(): Promise<void> {
  await seedBody();
  await seedTraining();
  await seedNutrition();
  await seedWeeks();
  await seedTasks();
}
