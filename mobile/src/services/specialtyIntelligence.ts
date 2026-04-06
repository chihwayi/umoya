import { api } from './api';

export interface ApiSepsisOperationalBrief {
  generatedAt?: string;
  summary?: {
    totalAlerts24h?: number;
    criticalRisk?: number;
    highRisk?: number;
    overdueThreeHour?: number;
    repeatLactateOverdue?: number;
    antibioticsDelayOver60?: number;
    cdssCoveragePercent?: number;
  };
  highPriorityQueue?: Array<{
    id: string;
    patientId?: string;
    patientName?: string;
    riskLevel?: string;
    severeSignal?: boolean;
    lactateValue?: number;
    threeHourRemainingMinutes?: number | null;
    recommendedActions?: string[];
  }>;
  recommendations?: string[];
}

export interface ApiDoctorImagingResult {
  order: {
    id: string;
    priority?: string;
    study_name?: string;
    modality_name?: string;
    body_part?: string;
  };
  patient: {
    id: string;
    full_name?: string;
    patient_number?: string;
  };
  report?: {
    id: string;
    is_critical?: boolean;
    severity?: string;
    follow_up_recommended?: boolean;
  } | null;
  acknowledgement?: {
    id: string;
    acknowledged_at?: string;
    notes?: string;
  } | null;
  workflow_status?: string;
  is_action_required?: boolean;
}

export interface ApiOncologyProtocolSnapshot {
  generatedAt?: string;
  summary?: string;
  activeCase?: {
    id: string;
    patientId?: string | null;
    patientName?: string | null;
    diagnosis?: string | null;
    status?: string | null;
    overallStage?: string | null;
    oncologistName?: string | null;
  } | null;
  protocol?: {
    bundleKey?: string | null;
    actionableCount?: number;
    pendingCount?: number;
    nextAction?: {
      id: string;
      title?: string;
      priority?: string;
      rationale?: string | null;
    } | null;
    pendingItems?: Array<{
      id: string;
      title?: string;
      priority?: string;
      rationale?: string | null;
    }>;
  } | null;
  treatmentRecommendation?: {
    title?: string;
    rationale?: string;
    severity?: string;
  } | null;
  surveillance?: {
    overdueCount?: number;
    nextOverdueDate?: string | null;
  } | null;
  aiMetadata?: {
    surface?: string;
    useCase?: string;
    governed?: boolean;
    source?: string;
    generatedAt?: string;
  };
}

export interface ApiBloodBankOperationalBrief {
  generatedAt?: string;
  inventorySummary?: {
    totalAvailable?: number;
    usableUnits?: number;
    nearExpiryUnits?: number;
    expiredUnits?: number;
    criticalShortages?: Array<{
      key: string;
      componentType?: string;
      bloodType?: string | null;
      availableUnits?: number;
      threshold?: number;
      recommendation?: string;
    }>;
  };
  worklistSummary?: {
    total?: number;
    critical?: number;
    high?: number;
    overdue?: number;
    delayedStarts?: number;
    monitoringGaps?: number;
    compatibilityAlerts?: number;
    missingConsent?: number;
    documentationGaps?: number;
    cdssCoveragePercent?: number;
  } | null;
  safetySummary?: {
    compatibilityAlerts?: number;
    compatibilityUnknown?: number;
    criticalRiskItems?: number;
    overdueItems?: number;
    monitoringGaps?: number;
    delayedStarts?: number;
    missingConsent?: number;
    documentationGaps?: number;
    cdssCoveragePercent?: number;
  } | null;
  highPriorityQueue?: Array<{
    id: string;
    patientId?: string;
    patientName?: string;
    status?: string;
    riskLevel?: string;
    riskScore?: number;
    compatibilityStatus?: string;
    unitNumber?: string | null;
    componentType?: string | null;
    cdssFlags?: string[];
    recommendedActions?: string[];
  }>;
  recommendations?: string[];
}

export interface ApiPacuPatient {
  id: string;
  arrivalTime?: string;
  aldreteScoreAdmission?: number | null;
  aldreteScoreDischarge?: number | null;
  painScoreAdmission?: number | null;
  painScoreDischarge?: number | null;
  ponvScore?: number | null;
  dischargeCriteriaMet?: boolean;
  complications?: string | null;
  patient?: {
    id?: string;
    firstName?: string;
    lastName?: string;
  } | null;
  pacuNurse?: {
    id?: string;
    firstName?: string;
    lastName?: string;
  } | null;
}

export const SpecialtyIntelligenceService = {
  getSepsisOperationalBrief: (): Promise<ApiSepsisOperationalBrief | null> =>
    api.get<ApiSepsisOperationalBrief>('/sepsis/operational-brief')
      .then((response) => response.data ?? null)
      .catch(() => null),

  getOncologyProtocolSnapshot: (): Promise<ApiOncologyProtocolSnapshot | null> =>
    api.get<ApiOncologyProtocolSnapshot>('/oncology/mobile/protocol-snapshot')
      .then((response) => response.data ?? null)
      .catch(() => null),

  getBloodBankOperationalBrief: (): Promise<ApiBloodBankOperationalBrief | null> =>
    api.get<ApiBloodBankOperationalBrief>('/blood-bank/operational-brief')
      .then((response) => response.data ?? null)
      .catch(() => null),

  getActivePacuPatients: (): Promise<ApiPacuPatient[]> =>
    api.get<ApiPacuPatient[]>('/anesthesia/pacu/active')
      .then((response) => response.data ?? [])
      .catch(() => []),

  getCriticalImagingResults: (): Promise<ApiDoctorImagingResult[]> =>
    api.get<{ results?: ApiDoctorImagingResult[] }>('/imaging/doctor/results?status=critical')
      .then((response) => response.data?.results ?? [])
      .catch(() => []),

  acknowledgeImagingReport: (reportId: string, notes?: string) =>
    api.post(`/imaging/reports/${reportId}/acknowledge`, { acknowledgment_notes: notes }).then((response) => response.data),
};
