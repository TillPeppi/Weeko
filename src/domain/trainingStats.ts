/**
 * Training dashboard stats: how many distinct days were trained this ISO
 * week / calendar month / calendar year, plus weekly volume/session trends,
 * streaks and average session duration. Framework-free.
 */
import { addDaysIso, isoWeekOf, mondayOfWeek, recentIsoWeeks } from './time';

export interface TrainingCounts {
  week: number;
  month: number;
  year: number;
}

/** `dates` = distinct YYYY-MM-DD training days (any year). */
export function trainingCounts(dates: string[], today: string): TrainingCounts {
  const distinct = [...new Set(dates)];
  const thisWeek = isoWeekOf(today);
  const month = today.slice(0, 7);
  const year = today.slice(0, 4);
  return {
    week: distinct.filter((date) => {
      const w = isoWeekOf(date);
      return w.year === thisWeek.year && w.isoWeek === thisWeek.isoWeek;
    }).length,
    month: distinct.filter((date) => date.startsWith(month)).length,
    year: distinct.filter((date) => date.startsWith(year)).length,
  };
}

export interface WeeklyTrainingPoint {
  year: number;
  isoWeek: number;
  /** Monday of that week, YYYY-MM-DD */
  monday: string;
  /** distinct training days */
  days: number;
  /** finished sessions */
  sessions: number;
  /** Σ reps × kg of done sets that week */
  volumeKg: number;
}

/**
 * Volume/session trend of the last `weeks` ISO weeks (incl. the current one).
 * `sessionDates` = one YYYY-MM-DD per finished session (not distinct).
 */
export function weeklyTraining(
  sessionDates: string[],
  sets: { date: string; reps: number | null; weightKg: number | null; done: boolean }[],
  today: string,
  weeks = 8
): WeeklyTrainingPoint[] {
  return recentIsoWeeks(today, weeks).map((ref) => {
    const end = addDaysIso(ref.monday, 6);
    const inWeek = (date: string) => date >= ref.monday && date <= end;
    const dates = sessionDates.filter(inWeek);
    const volumeKg = sets
      .filter((s) => s.done && inWeek(s.date))
      .reduce((sum, s) => sum + (s.reps ?? 0) * (s.weightKg ?? 0), 0);
    return {
      ...ref,
      days: new Set(dates).size,
      sessions: dates.length,
      volumeKg: Math.round(volumeKg * 10) / 10,
    };
  });
}

export interface TrainingStreaks {
  /** consecutive ISO weeks with ≥1 training day, ending at the current (or last) week */
  currentWeeks: number;
  longestWeeks: number;
}

/**
 * Week streaks. A still-empty current week does not break the streak —
 * it simply doesn't count yet.
 */
export function trainingStreaks(dates: string[], today: string): TrainingStreaks {
  const mondays = [...new Set(dates.map((date) => mondayOfWeek(date)))].sort();
  if (mondays.length === 0) return { currentWeeks: 0, longestWeeks: 0 };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < mondays.length; i += 1) {
    run = mondays[i] === addDaysIso(mondays[i - 1], 7) ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  const trained = new Set(mondays);
  const thisMonday = mondayOfWeek(today);
  // start at the current week if trained, otherwise at the previous week
  let cursor = trained.has(thisMonday) ? thisMonday : addDaysIso(thisMonday, -7);
  let current = 0;
  while (trained.has(cursor)) {
    current += 1;
    cursor = addDaysIso(cursor, -7);
  }
  return { currentWeeks: current, longestWeeks: longest };
}

/** Ø duration of finished sessions in minutes (sessions without end are skipped). */
export function avgSessionMinutes(
  sessions: { startedAt: string; endedAt: string | null }[]
): number | null {
  const durations = sessions
    .filter((s) => s.endedAt !== null)
    .map((s) => (Date.parse(s.endedAt as string) - Date.parse(s.startedAt)) / 60000)
    .filter((minutes) => minutes > 0);
  if (durations.length === 0) return null;
  return Math.round(durations.reduce((sum, m) => sum + m, 0) / durations.length);
}

export interface MonthlyTrainingPoint {
  year: number;
  month: number; // 1–12
  monthLabel: string; // YYYY-MM
  days: number;
  sessions: number;
  volumeKg: number;
}

/**
 * Monthly volume/session trend. Returns last `months` calendar months (incl. current).
 */
export function monthlyTraining(
  sessionDates: string[],
  sets: { date: string; reps: number | null; weightKg: number | null; done: boolean }[],
  today: string,
  months = 12
): MonthlyTrainingPoint[] {
  const result: MonthlyTrainingPoint[] = [];

  // Generate month references going back
  const todayDate = new Date(today);
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(todayDate.getFullYear(), todayDate.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const monthLabel = `${year}-${String(month).padStart(2, '0')}`;
    const monthStart = `${monthLabel}-01`;
    const nextMonth = new Date(year, d.getMonth() + 1, 1);
    const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

    const inMonth = (date: string) => date >= monthStart && date < monthEnd;
    const dates = sessionDates.filter(inMonth);
    const volumeKg = sets
      .filter((s) => s.done && inMonth(s.date))
      .reduce((sum, s) => sum + (s.reps ?? 0) * (s.weightKg ?? 0), 0);

    result.push({
      year,
      month,
      monthLabel,
      days: new Set(dates).size,
      sessions: dates.length,
      volumeKg: Math.round(volumeKg * 10) / 10,
    });
  }

  return result;
}

export interface ExerciseWeightGain {
  exerciseId: string;
  exerciseName: string;
  sessionCount: number; // total sessions with this exercise
  sessionCountForGain: number; // sessions from 2nd onwards
  maxWeightKg: number; // max weight in any session
  avgWeightFirstSession?: number;
  avgWeightLatestSession?: number;
  gainKg: number; // diff from 1st to latest
  gainPercent: number;
}

/**
 * Weight progression per exercise. Only counts from the 2nd session onwards
 * (so new exercises don't show artificial gains on first logging).
 * `exerciseSets` = [{exerciseId, sessionIndex, sessionDate, reps, weightKg, done}]
 * Sessions are indexed per exercise (1st, 2nd, 3rd, ...).
 */
export function exerciseWeightGains(
  exerciseSets: {
    exerciseId: string;
    exerciseName: string;
    sessionIndex: number; // 1st, 2nd, 3rd session with this exercise
    reps: number | null;
    weightKg: number | null;
    done: boolean;
  }[]
): ExerciseWeightGain[] {
  const grouped = new Map<string, typeof exerciseSets>();

  for (const set of exerciseSets) {
    if (!grouped.has(set.exerciseId)) {
      grouped.set(set.exerciseId, []);
    }
    grouped.get(set.exerciseId)!.push(set);
  }

  const result: ExerciseWeightGain[] = [];

  for (const [exerciseId, sets] of grouped) {
    const sessionIndices = [...new Set(sets.map((s) => s.sessionIndex))].sort((a, b) => a - b);
    if (sessionIndices.length === 0) continue;

    const exerciseName = sets[0].exerciseName;
    const allDone = sets.filter((s) => s.done);

    // All weights (including bodyweight = null)
    const allWeights = allDone.map((s) => s.weightKg ?? 0);
    const maxWeight = allWeights.length > 0 ? Math.max(...allWeights) : 0;

    // From 2nd session onwards
    const fromSecondSession = allDone.filter((s) => s.sessionIndex >= 2);
    if (fromSecondSession.length === 0) {
      result.push({
        exerciseId,
        exerciseName,
        sessionCount: sessionIndices.length,
        sessionCountForGain: 0,
        maxWeightKg: maxWeight,
        gainKg: 0,
        gainPercent: 0,
      });
      continue;
    }

    // Average weight by session (from 2nd session)
    const sessionWeights = new Map<number, number[]>();
    for (const set of fromSecondSession) {
      if (!sessionWeights.has(set.sessionIndex)) {
        sessionWeights.set(set.sessionIndex, []);
      }
      sessionWeights.get(set.sessionIndex)!.push(set.weightKg ?? 0);
    }

    const sessionAvgs = Array.from(sessionWeights.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([_, weights]) => (weights.length > 0 ? weights.reduce((sum, w) => sum + w, 0) / weights.length : 0));

    if (sessionAvgs.length === 0) {
      result.push({
        exerciseId,
        exerciseName,
        sessionCount: sessionIndices.length,
        sessionCountForGain: 0,
        maxWeightKg: maxWeight,
        gainKg: 0,
        gainPercent: 0,
      });
      continue;
    }

    const avgFirst = sessionAvgs[0];
    const avgLatest = sessionAvgs[sessionAvgs.length - 1];
    const gain = avgLatest - avgFirst;
    const gainPercent = avgFirst > 0 ? (gain / avgFirst) * 100 : 0;

    result.push({
      exerciseId,
      exerciseName,
      sessionCount: sessionIndices.length,
      sessionCountForGain: sessionAvgs.length,
      maxWeightKg: maxWeight,
      avgWeightFirstSession: avgFirst,
      avgWeightLatestSession: avgLatest,
      gainKg: Math.round(gain * 10) / 10,
      gainPercent: Math.round(gainPercent * 10) / 10,
    });
  }

  return result;
}
