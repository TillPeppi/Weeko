/**
 * Purely time-based local notifications (Phase 1, §6.4). No push server.
 *
 * - Block-start notifications at the planned start time.
 * - Task reminders at the preferred window start, escalating in the
 *   category's configured interval until completed (bounded series of
 *   scheduled locals, cancelled on completion).
 * - Per-category prefs: enabled, quiet hours ("never before/after"), interval.
 * - While a training session is active, task notifications are suppressed
 *   (simplest form of context, §6.5).
 * - Web: expo-notifications does not support scheduling — everything no-ops.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import i18n from '@/i18n';
import type { Block, NotificationPref, Task } from '@/db/schema';
import { getNotificationPref } from '@/db/repos/notificationRepo';
import { BLOCK_START_CATEGORY, COACH_CATEGORY } from '@/db/seeds';
import type { Insight } from '@/domain/coach/insights';
import { toMinutes } from '@/domain/time';
import { isTrainingActive } from '@/stores/trainingStore';

const isWeb = Platform.OS === 'web';

/** Max escalation repeats per task — bounded because locals can't loop. */
const MAX_ESCALATIONS = 5;

export function initNotifications(): void {
  if (isWeb) return;
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      // Phase-1 context rule: suppress task reminders during training
      const isTaskNotification =
        (notification.request.content.data as { kind?: string } | null)?.kind === 'task';
      const suppress = isTaskNotification && isTrainingActive();
      return {
        shouldShowAlert: !suppress,
        shouldShowBanner: !suppress,
        shouldShowList: !suppress,
        shouldPlaySound: !suppress,
        shouldSetBadge: false,
      };
    },
  });
}

export async function ensurePermissions(): Promise<boolean> {
  if (isWeb) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

function isInQuietHours(time: string, pref: NotificationPref): boolean {
  if (!pref.quietStart || !pref.quietEnd) return false;
  const t = toMinutes(time);
  const start = toMinutes(pref.quietStart);
  const end = toMinutes(pref.quietEnd);
  // overnight window, e.g. 22:00–08:00
  if (start > end) return t >= start || t < end;
  return t >= start && t < end;
}

function toLocalDate(day: string, time: string): Date {
  return new Date(`${day}T${time}:00`);
}

function timeOfDate(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

async function scheduleAt(
  identifier: string,
  content: Notifications.NotificationContentInput,
  date: Date
): Promise<void> {
  if (date.getTime() <= Date.now()) return;
  await Notifications.scheduleNotificationAsync({
    identifier,
    content,
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
  });
}

// --- Block-start notifications ---------------------------------------------

export async function rescheduleBlockNotifications(blocks: Block[]): Promise<void> {
  if (isWeb) return;
  await cancelByPrefix('block-');
  const pref = await getNotificationPref(BLOCK_START_CATEGORY);
  if (!pref || !pref.enabled) return;

  for (const b of blocks) {
    if (b.status !== 'planned') continue;
    if (isInQuietHours(b.start, pref)) continue;
    await scheduleAt(
      `block-${b.id}`,
      {
        title: i18n.t('notifications.blockStart.title', { title: b.title }),
        body: i18n.t('notifications.blockStart.body', { start: b.start, end: b.end }),
        data: { kind: 'block', blockId: b.id },
      },
      toLocalDate(b.date, b.start)
    );
  }
}

// --- Task reminders with escalation -----------------------------------------

export async function scheduleTaskNotifications(task: Task): Promise<void> {
  if (isWeb) return;
  if (task.status !== 'open' || !task.windowDay || !task.windowStart) return;
  const pref = await getNotificationPref(task.category);
  if (pref && !pref.enabled) return;

  const escalationMinutes = pref?.escalationMinutes ?? 30;
  const first = toLocalDate(task.windowDay, task.windowStart);

  if (!pref || !isInQuietHours(task.windowStart, pref)) {
    await scheduleAt(
      `task-${task.id}-0`,
      {
        title: i18n.t('notifications.taskReminder.title', { title: task.title }),
        body: i18n.t('notifications.taskReminder.body', { time: task.windowStart }),
        data: { kind: 'task', taskId: task.id },
      },
      first
    );
  }

  for (let n = 1; n <= MAX_ESCALATIONS; n++) {
    const at = new Date(first.getTime() + n * escalationMinutes * 60_000);
    if (pref && isInQuietHours(timeOfDate(at), pref)) continue;
    await scheduleAt(
      `task-${task.id}-${n}`,
      {
        title: i18n.t('notifications.taskEscalation.title', { title: task.title }),
        body: i18n.t('notifications.taskEscalation.body'),
        data: { kind: 'task', taskId: task.id },
      },
      at
    );
  }
}

export async function cancelTaskNotifications(taskId: string): Promise<void> {
  if (isWeb) return;
  await cancelByPrefix(`task-${taskId}-`);
}

// --- Coach digest (one morning insight push) --------------------------------

/** Time of day the coach digest fires (local). */
export const COACH_MORNING_TIME = '08:00';
/** Only insights at least this urgent are worth a push. */
export const COACH_PUSH_MIN_SCORE = 50;

/** Next local Date for "HH:mm" — today if still ahead, otherwise tomorrow. */
function nextOccurrence(time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d;
}

/**
 * Schedules a single morning push for the most urgent insight above the
 * threshold. A local notification can't recompute at fire time, so the content
 * is the snapshot from the last coach run — opening the app re-runs the coach
 * and reschedules with fresh content (cancel + reschedule, like tasks).
 * `insights` is expected pre-sorted by score (runCoach does this).
 */
export async function rescheduleCoachNotifications(insights: Insight[]): Promise<void> {
  if (isWeb) return;
  await cancelByPrefix('coach-');
  const pref = await getNotificationPref(COACH_CATEGORY);
  if (pref && !pref.enabled) return;
  const top = insights.find((i) => i.score >= COACH_PUSH_MIN_SCORE);
  if (!top) return;
  await scheduleAt(
    `coach-${top.id}`,
    {
      title: i18n.t('notifications.coach.title'),
      body: i18n.t(top.key, top.params),
      data: { kind: 'coach', insightId: top.id },
    },
    nextOccurrence(pref?.digestTime ?? COACH_MORNING_TIME)
  );
}

async function cancelByPrefix(prefix: string): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(prefix))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
}

/** Re-schedules everything (called after imports and on app start). */
export async function rescheduleAll(blocks: Block[], tasks: Task[]): Promise<void> {
  if (isWeb) return;
  await rescheduleBlockNotifications(blocks);
  for (const t of tasks) {
    await cancelTaskNotifications(t.id);
    if (t.status === 'open') await scheduleTaskNotifications(t);
  }
}
