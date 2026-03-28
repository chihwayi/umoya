import { api } from './api';

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

  record: (dto: RecordVitalsDto) =>
    api.post<{ success: boolean; vitals: ApiVital; cdssInsights: any }>(
      '/vitals', dto,
    ).then(r => r.data),
};
