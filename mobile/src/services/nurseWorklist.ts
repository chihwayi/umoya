import { api } from './api';

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

export const NurseWorklistService = {
  state: () =>
    api.get<NurseWorklistState>('/nurse-worklist/state').then(r => r.data),

  crossModuleFeed: () =>
    api.get<any>('/nurse-worklist/cross-module-feed').then(r => r.data),
};
