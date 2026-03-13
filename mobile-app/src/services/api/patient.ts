import { ehrClient } from './http';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function firstArrayMatch<T>(value: unknown, keys: string[]): T[] {
  if (Array.isArray(value)) return value as T[];
  if (!isRecord(value)) return [];

  for (const key of keys) {
    const item = value[key];
    if (Array.isArray(item)) return item as T[];
  }

  return [];
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toStringOrNull(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) return value;
  return null;
}

export type PatientAppointment = {
  id: string;
  doctor_name?: string | null;
  reason?: string | null;
  appointment_date?: string | null;
  appointment_time?: string | null;
  status?: string | null;
  [key: string]: unknown;
};

export type PatientNotification = {
  id: string;
  title?: string | null;
  message?: string | null;
  notification_type?: string | null;
  is_read?: boolean;
  created_at?: string | null;
  [key: string]: unknown;
};

export type PatientNotificationsResponse = {
  notifications: PatientNotification[];
  unreadCount: number;
};

export type PatientPostVisitSession = {
  id: string;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  patient_id?: string | null;
  [key: string]: unknown;
};

export type PatientPostVisitSessionsResponse = {
  sessions: PatientPostVisitSession[];
  paging: {
    limit: number;
    offset: number;
    total: number;
  };
};

export type PatientPostVisitMessage = {
  id: string;
  message?: string | null;
  role?: string | null;
  message_type?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
};

export type PatientPostVisitMessagesResponse = {
  messages: PatientPostVisitMessage[];
  paging: {
    limit: number;
    offset: number;
    total: number;
  };
};

export type PatientPrescription = {
  id: string;
  medication_name?: string | null;
  dosage?: string | null;
  frequency?: string | null;
  route?: string | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  [key: string]: unknown;
};

export type MedicationReminder = {
  id: string;
  prescription_id?: string | null;
  reminder_time?: string | null;
  reminder_days?: number[];
  is_active?: boolean;
  [key: string]: unknown;
};

export type RefillRequest = {
  id: string;
  prescription_id?: string | null;
  status?: string | null;
  requested_quantity?: number | null;
  created_at?: string | null;
  [key: string]: unknown;
};

export type PatientBill = {
  id: string;
  bill_number?: string | null;
  status?: string | null;
  total_amount?: number | string | null;
  amount_due?: number | string | null;
  due_date?: string | null;
  created_at?: string | null;
  line_items?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

export type PatientGoal = {
  id: string;
  title?: string | null;
  status?: string | null;
  target_value?: number | null;
  current_value?: number | null;
  [key: string]: unknown;
};

export type PatientCarePlan = {
  id: string;
  title?: string | null;
  status?: string | null;
  [key: string]: unknown;
};

export async function getPatientDashboardSummary(): Promise<UnknownRecord> {
  const { data } = await ehrClient.get('/patient-portal/dashboard/summary');
  return toRecord(data);
}

export async function getPatientAppointments(params?: {
  startDate?: string;
  endDate?: string;
  status?: string;
}): Promise<PatientAppointment[]> {
  const { data } = await ehrClient.get('/patient-portal/appointments', { params: params || {} });
  return firstArrayMatch<PatientAppointment>(data, ['appointments', 'items', 'data']);
}

export async function getPatientNotifications(params?: {
  read?: boolean;
  notificationType?: string;
  limit?: number;
  offset?: number;
}): Promise<PatientNotificationsResponse> {
  const { data } = await ehrClient.get('/patient-portal/notifications', { params: params || {} });
  const notifications = firstArrayMatch<PatientNotification>(data, ['notifications', 'items', 'data']);
  const source = toRecord(data);

  return {
    notifications,
    unreadCount: toNumber(source.unreadCount ?? source.unread_count)
  };
}

export async function markPatientNotificationRead(notificationId: string): Promise<void> {
  await ehrClient.put(`/patient-portal/notifications/${encodeURIComponent(notificationId)}/read`);
}

export async function markAllPatientNotificationsRead(): Promise<void> {
  await ehrClient.put('/patient-portal/notifications/read-all');
}

export async function getPatientMessages(params?: {
  read?: boolean;
  messageType?: string;
  limit?: number;
  offset?: number;
}): Promise<PatientPostVisitMessagesResponse> {
  const { data } = await ehrClient.get('/patient-portal/messages', { params: params || {} });
  const messages = firstArrayMatch<PatientPostVisitMessage>(data, ['messages', 'items', 'data']);
  const source = toRecord(data);

  return {
    messages,
    paging: {
      limit: toNumber(source.limit || params?.limit || 50),
      offset: toNumber(source.offset || params?.offset || 0),
      total: toNumber(source.total || messages.length)
    }
  };
}

export async function sendPatientMessage(payload: {
  subject: string;
  message: string;
  messageType?: string;
  priority?: string;
}): Promise<UnknownRecord> {
  const { data } = await ehrClient.post('/patient-portal/messages', payload);
  return toRecord(data);
}

export async function markPatientMessageRead(messageId: string): Promise<void> {
  await ehrClient.put(`/patient-portal/messages/${encodeURIComponent(messageId)}/read`);
}

export async function listPatientPostVisitSessions(params?: {
  limit?: number;
  offset?: number;
}): Promise<PatientPostVisitSessionsResponse> {
  const { data } = await ehrClient.get('/patient-portal/post-visit/sessions', { params: params || {} });
  const sessions = firstArrayMatch<PatientPostVisitSession>(data, ['sessions', 'items', 'data']);
  const source = toRecord(data);
  const paging = toRecord(source.paging);

  return {
    sessions,
    paging: {
      limit: toNumber(paging.limit || params?.limit || 25),
      offset: toNumber(paging.offset || params?.offset || 0),
      total: toNumber(paging.total || source.total || sessions.length)
    }
  };
}

export async function getPatientPostVisitSummary(sessionId: string): Promise<UnknownRecord> {
  const { data } = await ehrClient.get(`/patient-portal/post-visit/sessions/${encodeURIComponent(sessionId)}/summary`);
  return toRecord(data);
}

export async function getPatientPostVisitLabTrends(sessionId: string): Promise<UnknownRecord> {
  const { data } = await ehrClient.get(`/patient-portal/post-visit/sessions/${encodeURIComponent(sessionId)}/lab-trends`);
  return toRecord(data);
}

export async function getPatientPostVisitRecordingUrl(sessionId: string): Promise<UnknownRecord> {
  const { data } = await ehrClient.get(`/patient-portal/post-visit/sessions/${encodeURIComponent(sessionId)}/recording-url`);
  return toRecord(data);
}

export async function getPatientPostVisitAnnotatedSummary(sessionId: string): Promise<UnknownRecord> {
  const { data } = await ehrClient.get(
    `/patient-portal/post-visit/sessions/${encodeURIComponent(sessionId)}/summary/annotated`
  );
  return toRecord(data);
}

export async function askPatientPostVisitSection(
  sessionId: string,
  payload: { question: string; sectionType: string }
): Promise<UnknownRecord> {
  const { data } = await ehrClient.post(
    `/patient-portal/post-visit/sessions/${encodeURIComponent(sessionId)}/ask-section`,
    payload
  );
  return toRecord(data);
}

export async function getPatientPostVisitMessages(
  sessionId: string,
  params?: { limit?: number; offset?: number }
): Promise<PatientPostVisitMessagesResponse> {
  const { data } = await ehrClient.get(`/patient-portal/post-visit/sessions/${encodeURIComponent(sessionId)}/messages`, {
    params: params || {}
  });

  const messages = firstArrayMatch<PatientPostVisitMessage>(data, ['messages', 'items', 'data']);
  const source = toRecord(data);
  const paging = toRecord(source.paging);

  return {
    messages,
    paging: {
      limit: toNumber(paging.limit || params?.limit || 30),
      offset: toNumber(paging.offset || params?.offset || 0),
      total: toNumber(paging.total || source.total || messages.length)
    }
  };
}

export async function sendPatientPostVisitMessage(
  sessionId: string,
  payload: {
    message: string;
    language?: string;
    messageType?: 'question' | 'answer' | 'summary' | 'checklist' | 'alert' | 'system';
  }
): Promise<UnknownRecord> {
  const { data } = await ehrClient.post(
    `/patient-portal/post-visit/sessions/${encodeURIComponent(sessionId)}/messages`,
    payload
  );
  return toRecord(data);
}

export async function acknowledgePatientPostVisit(
  sessionId: string,
  payload: {
    acknowledgementType:
      | 'teach_back'
      | 'medication_adherence'
      | 'follow_up_commitment'
      | 'warning_sign_understanding';
    acknowledged?: boolean;
    details?: Record<string, unknown>;
  }
): Promise<UnknownRecord> {
  const { data } = await ehrClient.post(
    `/patient-portal/post-visit/sessions/${encodeURIComponent(sessionId)}/acknowledgements`,
    payload
  );
  return toRecord(data);
}

export async function getPatientPrescriptions(): Promise<PatientPrescription[]> {
  const { data } = await ehrClient.get('/patient-portal/prescriptions');
  return firstArrayMatch<PatientPrescription>(data, ['prescriptions', 'items', 'data']);
}

export async function requestPrescriptionRefill(
  prescriptionId: string,
  payload?: { requestedQuantity?: number; reason?: string; urgency?: string }
): Promise<UnknownRecord> {
  const { data } = await ehrClient.post(
    `/patient-portal/prescriptions/${encodeURIComponent(prescriptionId)}/refill-request`,
    payload || {}
  );
  return toRecord(data);
}

export async function getPrescriptionRefillRequests(params?: { status?: string }): Promise<RefillRequest[]> {
  const { data } = await ehrClient.get('/patient-portal/prescriptions/refill-requests', {
    params: params || {}
  });
  return firstArrayMatch<RefillRequest>(data, ['requests', 'refillRequests', 'items', 'data']);
}

export async function createMedicationReminder(
  prescriptionId: string,
  payload: { reminderTime: string; reminderDays: number[]; reminderType?: string; timezone?: string }
): Promise<MedicationReminder> {
  const { data } = await ehrClient.post(
    `/patient-portal/prescriptions/${encodeURIComponent(prescriptionId)}/reminders`,
    payload
  );
  return toRecord(data) as MedicationReminder;
}

export async function getMedicationReminders(params?: { activeOnly?: boolean }): Promise<MedicationReminder[]> {
  const { data } = await ehrClient.get('/patient-portal/prescriptions/reminders', {
    params: params || {}
  });
  return firstArrayMatch<MedicationReminder>(data, ['reminders', 'items', 'data']);
}

export async function updateMedicationReminder(
  reminderId: string,
  payload: { reminderTime?: string; reminderDays?: number[]; reminderType?: string; isActive?: boolean }
): Promise<MedicationReminder> {
  const { data } = await ehrClient.put(
    `/patient-portal/prescriptions/reminders/${encodeURIComponent(reminderId)}`,
    payload
  );
  return toRecord(data) as MedicationReminder;
}

export async function deleteMedicationReminder(reminderId: string): Promise<void> {
  await ehrClient.delete(`/patient-portal/prescriptions/reminders/${encodeURIComponent(reminderId)}`);
}

export async function logMedicationAdherence(
  prescriptionId: string,
  payload: {
    scheduledTime: string;
    taken: boolean;
    takenTime?: string;
    missedReason?: string;
    notes?: string;
  }
): Promise<UnknownRecord> {
  const { data } = await ehrClient.post(
    `/patient-portal/prescriptions/${encodeURIComponent(prescriptionId)}/adherence`,
    payload
  );
  return toRecord(data);
}

export async function getMedicationAdherenceSummary(params?: {
  prescriptionId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<UnknownRecord> {
  const { data } = await ehrClient.get('/patient-portal/prescriptions/adherence/summary', {
    params: params || {}
  });
  return toRecord(data);
}

export async function getMedicationAdherenceLogs(params?: {
  prescriptionId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<UnknownRecord[]> {
  const { data } = await ehrClient.get('/patient-portal/prescriptions/adherence/logs', {
    params: params || {}
  });
  return firstArrayMatch<UnknownRecord>(data, ['logs', 'items', 'data']);
}

export async function getPatientBills(params?: {
  startDate?: string;
  endDate?: string;
  status?: string;
}): Promise<PatientBill[]> {
  const { data } = await ehrClient.get('/patient-portal/bills', { params: params || {} });
  return firstArrayMatch<PatientBill>(data, ['bills', 'items', 'data']);
}

export async function createPatientPayment(payload: {
  billId?: string;
  amount: number;
  paymentMethod: 'ecocash' | 'onemoney' | 'card' | 'bank_transfer';
  paymentReference?: string;
}): Promise<UnknownRecord> {
  const { data } = await ehrClient.post('/patient-portal/payments', payload);
  return toRecord(data);
}

export async function requestAppointmentWithPayment(payload: {
  appointment: {
    doctorId: string;
    appointmentDate: string;
    reason: string;
    durationMinutes?: number;
    appointmentType?: string;
    notes?: string;
    isTelehealth?: boolean;
  };
  payment: {
    method: 'ecocash' | 'onemoney' | 'cash' | 'card';
    phoneNumber?: string;
    amount: number;
    currency?: string;
  };
}): Promise<UnknownRecord> {
  const { data } = await ehrClient.post('/patient-portal/appointments/request-with-payment', payload);
  return toRecord(data);
}

export async function getPatientLabResults(): Promise<UnknownRecord[]> {
  const { data } = await ehrClient.get('/patient-portal/lab-results');
  return firstArrayMatch<UnknownRecord>(data, ['labResults', 'results', 'items', 'data']);
}

export async function getPatientVitals(): Promise<UnknownRecord[]> {
  const { data } = await ehrClient.get('/patient-portal/vitals');
  return firstArrayMatch<UnknownRecord>(data, ['vitals', 'items', 'data']);
}

export async function submitPatientVitals(payload: {
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRate?: number;
  temperature?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  bloodGlucose?: number;
  weight?: number;
  height?: number;
  notes?: string;
}): Promise<UnknownRecord> {
  const { data } = await ehrClient.post('/patient-portal/vitals/submit', payload);
  return toRecord(data);
}

export async function getDiabetesRegistry(): Promise<UnknownRecord[]> {
  const { data } = await ehrClient.get('/patient-portal/diabetes/registry');
  return firstArrayMatch<UnknownRecord>(data, ['registry', 'items', 'data']);
}

export async function getDiabetesGlucoseHistory(params?: {
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<UnknownRecord[]> {
  const { data } = await ehrClient.get('/patient-portal/diabetes/glucose-history', { params: params || {} });
  return firstArrayMatch<UnknownRecord>(data, ['history', 'readings', 'items', 'data']);
}

export async function getDiabetesCarePlan(): Promise<UnknownRecord> {
  const { data } = await ehrClient.get('/patient-portal/diabetes/care-plan');
  return toRecord(data);
}

export async function getDiabetesMedications(): Promise<UnknownRecord[]> {
  const { data } = await ehrClient.get('/patient-portal/diabetes/medications');
  return firstArrayMatch<UnknownRecord>(data, ['medications', 'items', 'data']);
}

export async function getCardiologyEncounters(params?: {
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<UnknownRecord[]> {
  const { data } = await ehrClient.get('/patient-portal/cardiology/encounters', { params: params || {} });
  return firstArrayMatch<UnknownRecord>(data, ['encounters', 'items', 'data']);
}

export async function getCardiologyBloodPressureTrends(params?: {
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<UnknownRecord[]> {
  const { data } = await ehrClient.get('/patient-portal/cardiology/blood-pressure-trends', {
    params: params || {}
  });
  return firstArrayMatch<UnknownRecord>(data, ['trends', 'items', 'data']);
}

export async function listPatientGoals(): Promise<PatientGoal[]> {
  const { data } = await ehrClient.get('/patient-portal/goals');
  return firstArrayMatch<PatientGoal>(data, ['goals', 'items', 'data']);
}

export async function createPatientGoal(payload: {
  title: string;
  description?: string;
  category?: string;
  targetValue?: number;
  unit?: string;
  targetDate?: string;
}): Promise<PatientGoal> {
  const { data } = await ehrClient.post('/patient-portal/goals', payload);
  return toRecord(data) as PatientGoal;
}

export async function listPatientCarePlans(): Promise<PatientCarePlan[]> {
  const { data } = await ehrClient.get('/patient-portal/care-plans');
  return firstArrayMatch<PatientCarePlan>(data, ['carePlans', 'plans', 'items', 'data']);
}

export async function getPendingQuestionnaires(): Promise<UnknownRecord[]> {
  const { data } = await ehrClient.get('/patient-portal/questionnaires/pending');
  return firstArrayMatch<UnknownRecord>(data, ['questionnaires', 'items', 'data']);
}

export async function getPatientConsents(): Promise<UnknownRecord[]> {
  const { data } = await ehrClient.get('/patient-portal/consents');
  return firstArrayMatch<UnknownRecord>(data, ['consents', 'items', 'data']);
}

export async function signPatientConsent(
  consentId: string,
  payload?: {
    signerRole?: 'patient' | 'guardian' | 'proxy';
    signatureType?: 'electronic' | 'drawn' | 'typed';
    signedName?: string;
    signatureData?: string;
  }
): Promise<UnknownRecord> {
  const { data } = await ehrClient.post(`/patient-portal/consents/${encodeURIComponent(consentId)}/sign`, payload || {});
  return toRecord(data);
}

export async function declinePatientConsent(
  consentId: string,
  payload?: { reason?: string; declinedBy?: string }
): Promise<UnknownRecord> {
  const { data } = await ehrClient.post(
    `/patient-portal/consents/${encodeURIComponent(consentId)}/decline`,
    payload || {}
  );
  return toRecord(data);
}

export async function getPatientPathways(): Promise<UnknownRecord[]> {
  const { data } = await ehrClient.get('/patient-portal/pathways');
  return firstArrayMatch<UnknownRecord>(data, ['pathways', 'items', 'data']);
}

export async function getPatientImmunizations(): Promise<UnknownRecord[]> {
  const { data } = await ehrClient.get('/patient-portal/immunizations');
  return firstArrayMatch<UnknownRecord>(data, ['immunizations', 'items', 'data']);
}

export async function getPatientImmunizationForecast(): Promise<UnknownRecord[]> {
  const { data } = await ehrClient.get('/patient-portal/immunizations/forecast');
  return firstArrayMatch<UnknownRecord>(data, ['forecast', 'items', 'data']);
}

export async function getCurrentAdmission(): Promise<UnknownRecord> {
  const { data } = await ehrClient.get('/patient-portal/admission/current');
  return toRecord(data);
}

export async function getAdmissionHistory(): Promise<UnknownRecord[]> {
  const { data } = await ehrClient.get('/patient-portal/admission/history');
  return firstArrayMatch<UnknownRecord>(data, ['history', 'admissions', 'items', 'data']);
}

export async function getPatientEdVisits(): Promise<UnknownRecord[]> {
  const { data } = await ehrClient.get('/patient-portal/ed-visits');
  return firstArrayMatch<UnknownRecord>(data, ['visits', 'edVisits', 'items', 'data']);
}

export async function getFamilyAccessGrants(): Promise<UnknownRecord[]> {
  const { data } = await ehrClient.get('/patient-portal/family-access');
  return firstArrayMatch<UnknownRecord>(data, ['accessGrants', 'familyAccess', 'items', 'data']);
}

export async function createFamilyAccessGrant(payload: {
  proxyName: string;
  proxyEmail: string;
  proxyPhone?: string;
  relationship?: string;
  accessLevel?: 'view_only' | 'full' | 'emergency_only';
  expiresAt?: string;
}): Promise<UnknownRecord> {
  const { data } = await ehrClient.post('/patient-portal/family-access', payload);
  return toRecord(data);
}

export async function revokeFamilyAccessGrant(id: string): Promise<void> {
  await ehrClient.delete(`/patient-portal/family-access/${encodeURIComponent(id)}`);
}

export async function exportPatientRecordsPdf(payload?: {
  startDate?: string;
  endDate?: string;
  includeSensitive?: boolean;
}): Promise<UnknownRecord> {
  const { data } = await ehrClient.post('/patient-portal/export/pdf', payload || {});
  return toRecord(data);
}

export async function exportPatientRecordsFhir(): Promise<UnknownRecord> {
  const { data } = await ehrClient.get('/patient-portal/export/fhir');
  return toRecord(data);
}

export async function exportPatientRecordsJson(): Promise<UnknownRecord> {
  const { data } = await ehrClient.get('/patient-portal/export/json');
  return toRecord(data);
}

export async function exportPatientRecordsCsv(): Promise<string | null> {
  const { data } = await ehrClient.get('/patient-portal/export/csv', {
    responseType: 'text'
  });
  return toStringOrNull(data);
}

export const patientApiUtils = {
  toArray,
  toRecord,
  toNumber,
  toStringOrNull
};
