/**
 * Training session state. `activeSession` doubles as the Phase-1 context
 * signal: while set, task notifications are suppressed (§6.5).
 */
import { create } from 'zustand';
import type { SessionTemplate, WorkoutSession } from '@/db/schema';
import {
  finishSession,
  getActiveSession,
  listSessionTemplates,
  sessionSetProgress,
  startSession,
} from '@/db/repos/trainingRepo';

interface TrainingState {
  activeSession: WorkoutSession | null;
  /** logged-set progress of the active session (null when none active) */
  activeProgress: { done: number; total: number } | null;
  templates: SessionTemplate[];
  hydrate: () => Promise<void>;
  /** re-read set progress only (cheap, called while logging sets) */
  refreshProgress: () => Promise<void>;
  start: (values: {
    title: string;
    blockId?: string | null;
    templateId?: string | null;
  }) => Promise<string>;
  finish: (id: string, aborted?: boolean) => Promise<void>;
}

export const useTrainingStore = create<TrainingState>((set, get) => ({
  activeSession: null,
  activeProgress: null,
  templates: [],

  hydrate: async () => {
    const [activeSession, templates] = await Promise.all([
      getActiveSession(),
      listSessionTemplates(),
    ]);
    const activeProgress = activeSession ? await sessionSetProgress(activeSession.id) : null;
    set({ activeSession: activeSession ?? null, activeProgress, templates });
  },

  refreshProgress: async () => {
    const active = get().activeSession;
    set({ activeProgress: active ? await sessionSetProgress(active.id) : null });
  },

  start: async (values) => {
    const id = await startSession(values);
    await get().hydrate();
    return id;
  },

  finish: async (id, aborted = false) => {
    await finishSession(id, aborted);
    set({ activeSession: null, activeProgress: null });
    await get().hydrate();
  },
}));

/** Phase-1 context rule: notifications are suppressed while training. */
export function isTrainingActive(): boolean {
  return useTrainingStore.getState().activeSession !== null;
}
