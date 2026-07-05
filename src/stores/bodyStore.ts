/**
 * Body store — the live "Körper-Level" gauge (Bevel/Garmin style). Assembles
 * today's readiness (from last night's sleep), the day's strain (from HR
 * samples) and tonight's sleep need. iOS-only in practice; on web the adapter
 * returns nulls and everything stays null (the card hides).
 *
 * Recomputed on Today focus + a light interval while the app is open — a local
 * app can't stream continuously in the background (Phase 1).
 */
import { create } from 'zustand';
import { getProfile } from '@/db/repos/profileRepo';
import { loadDailyHealth, loadHealthRange, loadHeartRateSamples } from '@/health/healthData';
import { bodyLevel, type BodyLevel } from '@/domain/coach/energy';
import { readinessScore } from '@/domain/coach/readiness';
import { sleepDebt, sleepNeed } from '@/domain/coach/sleepNeed';
import { estimateMaxHr, strainFromSamples, type StrainResult } from '@/domain/coach/strain';
import { addDaysIso } from '@/domain/time';
import { useCoachStore } from './coachStore';
import { todayIso } from './weekStore';

/** Nights of sleep history used for the debt calculation. */
const SLEEP_DEBT_DAYS = 3;

interface BodyState {
  strain: StrainResult | null;
  level: BodyLevel | null;
  sleepNeedMin: number | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export const useBodyStore = create<BodyState>((set) => ({
  strain: null,
  level: null,
  sleepNeedMin: null,
  loading: false,

  refresh: async () => {
    set({ loading: true });
    try {
      const today = todayIso();
      const sleepDates = Array.from({ length: SLEEP_DEBT_DAYS }, (_, i) =>
        addDaysIso(today, i - (SLEEP_DEBT_DAYS - 1))
      );
      const [profile, daily, samples, recent] = await Promise.all([
        getProfile(),
        loadDailyHealth(today),
        loadHeartRateSamples(today),
        loadHealthRange(sleepDates),
      ]);

      const baseline = useCoachStore.getState().baseline;
      const readiness = readinessScore(
        {
          hrvMs: daily.hrvMs,
          restingHr: daily.restingHr,
          asleepMinutes: daily.sleep?.asleepMinutes ?? null,
        },
        baseline
      );
      const strain = strainFromSamples(samples, estimateMaxHr(profile?.age));
      const level = bodyLevel(readiness?.score ?? null, strain?.score ?? null);
      const debt = sleepDebt(recent.map((d) => d.sleepMinutes));
      const sleepNeedMin = daily.sleep ? sleepNeed({ debtMin: debt, strain: strain?.score ?? null }) : null;

      set({ strain, level, sleepNeedMin });
    } finally {
      set({ loading: false });
    }
  },
}));
