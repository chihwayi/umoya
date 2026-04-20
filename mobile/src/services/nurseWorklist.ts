import { api } from './api';
import { OfflineQueue } from './offlineQueue';

export interface NurseWorklistTask {
  id: string;
  patientId?: string;
  patientName?: string;
  bed?: string;
  ward?: string;
  priority: 'URGENT' | 'HIGH' | 'MED' | 'LOW';
  taskDescription: string;
  dueTime?: string;
  completed: boolean;
  escalated?: boolean;
  taskType?: string;
}

export interface TriageEntry {
  id: string;
  patientName?: string;
  age?: number;
  chiefComplaint?: string;
  esiLevel?: 1 | 2 | 3 | 4 | 5;
  waitMinutes?: number;
  arrivedAt?: string;
}

export interface NurseWorklistState {
  tasks: NurseWorklistTask[];
  triage: TriageEntry[];
  pendingVitals: { patientId: string; patientName: string; bed: string }[];
  alerts: { id: string; message: string; severity: string }[];
}

function isNetworkError(err: unknown): boolean {
  const e = err as any;
  return !e?.response && (
    e?.code === 'ERR_NETWORK' ||
    e?.code === 'ECONNABORTED' ||
    e?.message === 'Network Error'
  );
}

export const NurseWorklistService = {
  state: () =>
    api.get<NurseWorklistState>('/nurse-worklist/state').then(r => r.data),

  crossModuleFeed: () =>
    api.get<any>('/nurse-worklist/cross-module-feed').then(r => r.data),

  completeTask: async (id: string): Promise<{ success: boolean; queued?: boolean }> => {
    try {
      const res = await api.patch<{ success: boolean }>(`/nurse-worklist/tasks/${id}/complete`, {});
      return res.data;
    } catch (err) {
      if (isNetworkError(err)) {
        await OfflineQueue.enqueue({
          endpoint: `/nurse-worklist/tasks/${id}/complete`,
          method: 'PATCH',
          body: {},
          label: `Task complete (${id.slice(0, 8)})`,
        });
        return { success: true, queued: true };
      }
      throw err;
    }
  },
};
