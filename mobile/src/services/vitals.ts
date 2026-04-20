import { api } from './api';
import { OfflineQueue } from './offlineQueue';

export interface ApiVital {
  id: string;
  patientId: string;
  recordedAt: string;
  sbp?: number;
  dbp?: number;
  hr?: number;
  temp?: number;
  spo2?: number;
  rr?: number;
  pain?: number;
  bgl?: number;
  weight?: number;
  height?: number;
  recordedBy?: string;
  cdssInsights?: { message: string; severity: string }[];
}

export interface VitalTrend {
  vital: string;
  label: string;
  unit: string;
  readings: { value: number; recordedAt: string }[];
  latest: number;
  status: 'normal' | 'warning' | 'critical';
  normalLow?: number;
  normalHigh?: number;
  warnLow?: number;
  warnHigh?: number;
}

export interface RecordVitalsDto {
  patientId: string;
  encounterId?: string;
  sbp?: number;
  dbp?: number;
  hr?: number;
  temp?: number;
  spo2?: number;
  rr?: number;
  pain?: number;
  bgl?: number;
  weight?: number;
  height?: number;
}

function isNetworkError(err: unknown): boolean {
  const e = err as any;
  return !e?.response && (
    e?.code === 'ERR_NETWORK' ||
    e?.code === 'ECONNABORTED' ||
    e?.message === 'Network Error'
  );
}

export const VitalsService = {
  /** Latest N readings for a patient */
  list: (patientId: string, limit = 20) =>
    api.get<{ vitals: ApiVital[]; total: number }>(
      `/vitals/patient/${patientId}?limit=${limit}`,
    ).then(r => r.data.vitals),

  /** 7-day trend view */
  trends: (patientId: string) =>
    api.get<VitalTrend[]>(
      `/vitals/patient/${patientId}?trend=true`,
    ).then(r => r.data),

  forCurrentPatient: (limit = 30) =>
    api.get<any[]>(`/patient-portal/vitals?limit=${limit}`).then(r => r.data),

  record: async (
    dto: RecordVitalsDto,
  ): Promise<{ success: boolean; vitals: ApiVital | null; cdssInsights: any; queued?: boolean }> => {
    try {
      const res = await api.post<{ success: boolean; vitals: ApiVital; cdssInsights: any }>('/vitals', dto);
      return res.data;
    } catch (err) {
      if (isNetworkError(err)) {
        const firstName = (dto as any).patientFirstName ?? '';
        await OfflineQueue.enqueue({
          endpoint: '/vitals',
          method: 'POST',
          body: dto,
          label: `Vitals${firstName ? ' – ' + firstName : ''} (patient ${dto.patientId.slice(0, 8)})`,
        });
        return { success: true, vitals: null, cdssInsights: null, queued: true };
      }
      throw err;
    }
  },
};
