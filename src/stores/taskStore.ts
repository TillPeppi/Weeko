import { create } from 'zustand';
import type { Task } from '@/db/schema';
import {
  completeTask,
  createTask,
  deleteTask,
  listOpenTasksForDate,
  listTasks,
  reopenTask,
  updateTask,
} from '@/db/repos/taskRepo';
import { cancelTaskNotifications, scheduleTaskNotifications } from '@/notifications/scheduler';
import { todayIso } from './weekStore';

interface TaskState {
  tasks: Task[];
  todayOpen: Task[];
  loading: boolean;
  refresh: () => Promise<void>;
  add: (values: Parameters<typeof createTask>[0]) => Promise<void>;
  update: (id: number, values: Parameters<typeof updateTask>[1]) => Promise<void>;
  complete: (id: number) => Promise<void>;
  reopen: (id: number) => Promise<void>;
  remove: (id: number) => Promise<void>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  todayOpen: [],
  loading: false,

  refresh: async () => {
    set({ loading: true });
    try {
      const [tasks, todayOpen] = await Promise.all([
        listTasks(),
        listOpenTasksForDate(todayIso()),
      ]);
      set({ tasks, todayOpen });
    } finally {
      set({ loading: false });
    }
  },

  add: async (values) => {
    const id = await createTask(values);
    await get().refresh();
    const created = get().tasks.find((t) => t.id === id);
    if (created) await scheduleTaskNotifications(created);
  },

  update: async (id, values) => {
    await updateTask(id, values);
    await cancelTaskNotifications(id);
    await get().refresh();
    const updated = get().tasks.find((t) => t.id === id);
    if (updated && updated.status === 'open') await scheduleTaskNotifications(updated);
  },

  complete: async (id) => {
    await completeTask(id);
    await cancelTaskNotifications(id);
    await get().refresh();
  },

  reopen: async (id) => {
    await reopenTask(id);
    await get().refresh();
    const reopened = get().tasks.find((t) => t.id === id);
    if (reopened) await scheduleTaskNotifications(reopened);
  },

  remove: async (id) => {
    await deleteTask(id);
    await cancelTaskNotifications(id);
    await get().refresh();
  },
}));
