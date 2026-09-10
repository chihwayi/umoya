import { api } from './api';

export interface CreateNurseTaskInput {
  patientId: string;
  taskType: string;
  title: string;
  assignedTo?: string;
  priority?: string;
  description?: string;
  dueDate?: string;
  sourceType?: string;
  sourceId?: string;
}

export interface ApiNurseTask {
  id: string;
  patientId: string;
  taskType: string;
  title: string;
  assignedTo?: string;
  priority?: string;
  description?: string;
  dueDate?: string;
  status?: string;
  createdAt?: string;
}

export const NurseTasksService = {
  create: (input: CreateNurseTaskInput) =>
    api.post<ApiNurseTask>('/nurse-tasks', input).then(r => r.data),

  forPatient: (patientId: string) =>
    api.get<ApiNurseTask[]>(`/nurse-tasks/patient/${patientId}`).then(r => r.data),
};
