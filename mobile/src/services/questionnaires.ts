import { api } from "./api";
import { OfflineQueue } from "./offlineQueue";

export interface QuestionnaireQuestion {
  questionNumber: number;
  questionText: string;
  responseType: "scale" | "choice" | "number" | "text" | "boolean";
  required?: boolean;
  min?: number;
  max?: number;
  options?: string[];
}

export interface Questionnaire {
  id: string;
  title: string;
  description?: string;
  questions: QuestionnaireQuestion[];
  estimatedMinutes?: number;
}

export interface QuestionnaireAssignment {
  id: string;
  questionnaireId: string;
  title: string;
  description?: string;
  dueDate?: string;
  status: "pending" | "completed" | "overdue";
  estimatedMinutes?: number;
}

export interface QuestionnaireHistoryEntry {
  id: string;
  questionnaireId: string;
  title: string;
  completedAt: string;
  totalScore?: number;
  scoreLabel?: string;
}

export interface QuestionnaireSchedule {
  id: string;
  questionnaireTitle: string;
  frequency: string;
  nextDueDate?: string;
}

export interface SubmitResponse {
  id: string;
  totalScore?: number;
  scoreLabel?: string;
  message?: string;
}

export interface SubmitResponseBody {
  responses: {
    questionNumber: number;
    questionText: string;
    responseValue: string | number | boolean;
    responseType: string;
  }[];
}

function isNetworkError(err: unknown): boolean {
  const e = err as any;
  return !e?.response && (
    e?.code === "ERR_NETWORK" ||
    e?.code === "ECONNABORTED" ||
    e?.message === "Network Error"
  );
}

export const QuestionnairesService = {
  getPending: () =>
    api.get<QuestionnaireAssignment[]>("/patient-portal/questionnaires/pending").then(r => r.data),

  getAvailable: () =>
    api.get<QuestionnaireAssignment[]>("/patient-portal/questionnaires/available").then(r => r.data),

  getHistory: () =>
    api.get<QuestionnaireHistoryEntry[]>("/patient-portal/questionnaires/history").then(r => r.data),

  getSchedules: () =>
    api.get<QuestionnaireSchedule[]>("/patient-portal/questionnaires/schedules").then(r => r.data),

  getQuestionnaire: (questionnaireId: string) =>
    api.get<Questionnaire>(`/patient-portal/questionnaires/${questionnaireId}`).then(r => r.data),

  submit: async (
    questionnaireId: string,
    body: SubmitResponseBody,
  ): Promise<{ result: SubmitResponse | null; queued?: boolean }> => {
    try {
      const res = await api.post<SubmitResponse>(
        `/patient-portal/questionnaires/${questionnaireId}/submit`,
        body,
      );
      return { result: res.data };
    } catch (err) {
      if (isNetworkError(err)) {
        await OfflineQueue.enqueue({
          endpoint: `/patient-portal/questionnaires/${questionnaireId}/submit`,
          method: "POST",
          body,
          label: `Questionnaire submit (${questionnaireId.slice(0, 8)})`,
        });
        return { result: null, queued: true };
      }
      throw err;
    }
  },
};