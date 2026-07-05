/**
 * Coach store — assembles the framework-free CoachContext from repos + the
 * HealthKit adapter and runs the insight engine (domain/coach). The rules stay
 * pure; only this store touches the database and platform APIs.
 */
import { create } from 'zustand';
import {
  dismissInsight,
  listDismissals,
  pruneDismissals,
} from '@/db/repos/coachDismissalRepo';
import { getNotificationPref } from '@/db/repos/notificationRepo';
import { COACH_CATEGORY } from '@/db/seeds';
import { listExercises } from '@/db/repos/exerciseRepo';
import { listEntriesBetween } from '@/db/repos/foodRepo';
import { getProfile } from '@/db/repos/profileRepo';
import { listStatsSetRows, trainingDayDates } from '@/db/repos/trainingRepo';
import { getBlocksForDate } from '@/db/repos/weekRepo';
import { loadDailyHealth, loadHealthRange } from '@/health/healthData';
import { rescheduleCoachNotifications } from '@/notifications/scheduler';
import { BASELINE_WINDOW_DAYS, readinessBaselineFrom } from '@/domain/coach/baseline';
import type { CoachContext } from '@/domain/coach/context';
import { dismissUntil, filterActiveInsights } from '@/domain/coach/dismiss';
import { runCoach, type Insight } from '@/domain/coach/insights';
import type { ReadinessBaseline } from '@/domain/coach/readiness';
import { addDaysIso } from '@/domain/time';
import { todayIso } from './weekStore';

/** Days of food history the protein trend looks back over. */
const NUTRITION_WINDOW_DAYS = 14;
/** Drop dismissals older than this — their ids never recur. */
const DISMISSAL_TTL_DAYS = 30;

interface CoachState {
  insights: Insight[];
  loading: boolean;
  /** cached personal readiness baseline + the day it was computed */
  baseline: ReadinessBaseline | undefined;
  baselineDate: string | null;
  refresh: () => Promise<void>;
  dismiss: (insight: Insight) => Promise<void>;
}

export const useCoachStore = create<CoachState>((set, get) => ({
  insights: [],
  loading: false,
  baseline: undefined,
  baselineDate: null,

  refresh: async () => {
    set({ loading: true });
    try {
      const today = todayIso();
      const windowStart = addDaysIso(today, -(NUTRITION_WINDOW_DAYS - 1));
      const nowIso = new Date().toISOString();
      await pruneDismissals(new Date(Date.now() - DISMISSAL_TTL_DAYS * 86_400_000).toISOString());

      // Personal readiness baseline: recompute at most once per day — a 30-day
      // HealthKit range is expensive (one query batch per day).
      let { baseline, baselineDate } = get();
      if (baselineDate !== today) {
        const rangeDates = Array.from({ length: BASELINE_WINDOW_DAYS }, (_, i) =>
          addDaysIso(today, -(BASELINE_WINDOW_DAYS - 1 - i))
        );
        baseline = readinessBaselineFrom(await loadHealthRange(rangeDates));
        baselineDate = today;
        set({ baseline, baselineDate });
      }

      const [profile, blocks, entries, dates, health, dismissals, trainingSets, exercises] =
        await Promise.all([
          getProfile(),
          getBlocksForDate(today),
          listEntriesBetween(windowStart, today),
          trainingDayDates(),
          loadDailyHealth(today),
          listDismissals(),
          listStatsSetRows(),
          listExercises(),
        ]);
      const exerciseNames = Object.fromEntries(exercises.map((e) => [e.id, e.name]));

      const ctx: CoachContext = {
        now: new Date(),
        today,
        profile: profile ?? null,
        todayBlocks: blocks.map((b) => ({
          type: b.type,
          start: b.start,
          end: b.end,
          title: b.title,
          status: b.status,
          details: b.details,
        })),
        nutritionEntries: entries.map((e) => ({
          date: e.date,
          meal: e.meal,
          name: e.name,
          amountG: e.amountG,
          nutrients: e.nutrients,
        })),
        trainingDates: dates,
        trainingSets,
        exerciseNames,
        health: {
          hrvMs: health.hrvMs,
          restingHr: health.restingHr,
          asleepMinutes: health.sleep?.asleepMinutes ?? null,
        },
        readinessBaseline: baseline,
      };

      const insights = filterActiveInsights(runCoach(ctx), dismissals, nowIso);
      set({ insights });
      // Schedule the morning digest from the active (non-dismissed) set;
      // native only, web no-ops.
      await rescheduleCoachNotifications(insights);
    } finally {
      set({ loading: false });
    }
  },

  dismiss: async (insight) => {
    const pref = await getNotificationPref(COACH_CATEGORY);
    const until = dismissUntil(insight, Date.now(), pref?.snoozeMinutes);
    await dismissInsight(insight.id, until, new Date().toISOString());
    await get().refresh();
  },
}));
