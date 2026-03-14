import { ehrClient } from './http';

export type NurseWorklistState = {
  completedTaskIds: string[];
  acknowledgedAlertIds: string[];
};

export type WorkflowRouteHint = {
  section?: string;
  tab?: string;
  taskId?: string;
  enrollmentId?: string;
  patientId?: string;
};

export type WorkflowDestination = {
  destination_role?: string | null;
  destination_service?: string | null;
  destination_specialty?: string | null;
  destination_user_id?: string | null;
  destination_user_name?: string | null;
  destination_facility_id?: string | null;
  destination_facility_name?: string | null;
};

export type NurseCrossModuleFeedItem = WorkflowDestination & {
  id: string;
  module: string;
  item_type: string;
  source_record_id?: string | null;
  patient_id?: string | null;
  patient_name?: string | null;
  patient_number?: string | null;
  enrollment_id?: string | null;
  enrollment_number?: string | null;
  severity: 'critical' | 'high' | 'medium' | 'low';
  workflow_status: string;
  module_status?: string | null;
  doctor_sync_status?: string | null;
  title: string;
  summary: string;
  recommended_action?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  age_hours?: number | null;
  sla_status?: string | null;
  metadata?: Record<string, unknown> | null;
  next_route?: WorkflowRouteHint | null;
};

export type NurseCrossModuleFeedResponse = {
  items: NurseCrossModuleFeedItem[];
  summary?: Record<string, number>;
  filters?: {
    focus?: string;
    includeAcknowledged?: boolean;
  };
  generatedAt?: string;
};

export type UpdateWorkflowPayload = {
  itemId: string;
  module: string;
  itemType: string;
  sourceRecordId?: string | null;
  patientId?: string | null;
  enrollmentId?: string | null;
  status: 'acknowledged' | 'completed';
  note?: string;
  context?: Record<string, unknown>;
  destinationRole?: string | null;
  destinationService?: string | null;
  destinationSpecialty?: string | null;
  destinationUserId?: string | null;
  destinationFacilityId?: string | null;
  destinationFacilityName?: string | null;
};

export type ProviderInboxMessage = {
  id: string;
  thread_id?: string | null;
  sender_id?: string | null;
  sender_name?: string | null;
  sender_email?: string | null;
  recipient_id?: string | null;
  recipient_role?: string | null;
  recipient_team?: string | null;
  subject: string;
  message_text: string;
  message_type?: string | null;
  priority?: string | null;
  status?: string | null;
  patient_id?: string | null;
  patient_name?: string | null;
  sent_at?: string | null;
  read_at?: string | null;
  attachment_count?: number;
};

export type ProviderInboxResponse = {
  messages: ProviderInboxMessage[];
  total: number;
  limit: number;
  offset: number;
};

export type ProviderThreadSummary = {
  id: string;
  subject: string;
  patient_id?: string | null;
  participants?: string[];
  unread_count?: number;
  message_count?: number;
  last_message_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ProviderThreadDetail = {
  thread: ProviderThreadSummary;
  messages: ProviderInboxMessage[];
};

export type SendProviderMessagePayload = {
  recipient_id?: string;
  recipient_role?: string;
  recipient_team?: string;
  subject: string;
  message_text: string;
  message_type?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  patient_id?: string;
  appointment_id?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  requires_response?: boolean;
  response_required_by?: string;
  is_urgent?: boolean;
  thread_id?: string;
};

export type PostVisitSession = {
  id: string;
  status: 'captured' | 'processing' | 'draft_ready' | 'doctor_reviewed' | 'published' | 'closed';
  patient_id: string;
  doctor_id?: string | null;
  appointment_id?: string | null;
  consultation_id?: string | null;
  source_type?: 'in_person' | 'telemedicine' | 'hybrid';
  language?: string | null;
  started_at?: string | null;
  reviewed_at?: string | null;
  published_at?: string | null;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  patient?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    patientNumber?: string | null;
  };
  doctor?: {
    id?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  };
  artifacts?: {
    visitSummaryStatus?: string | null;
    recommendationBundleStatus?: string | null;
  };
  telemetry?: {
    transcriptSegmentCount?: number;
    companionMessageCount?: number;
  };
};

export type PostVisitSessionsResponse = {
  sessions: PostVisitSession[];
  paging: {
    limit: number;
    offset: number;
    total: number;
  };
};

export type PostVisitMobileContract = {
  contractVersion: 'post-visit-mobile.v1';
  generatedAt: string;
  session: {
    id: string;
    status: string;
    language: string;
    sourceType: string;
    publishedAt: string | null;
    reviewedAt: string | null;
    updatedAt: string;
  };
  cards: Array<{
    id: string;
    type: string;
    status: string;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
  }>;
  checklist: Array<{
    id: string;
    title: string;
    description: string;
    urgency: string;
    actionType: string;
    status: 'pending' | 'in_progress' | 'completed' | 'blocked';
    executedAt: string | null;
  }>;
  actions: {
    canPublish: boolean;
    canExecuteRecommendations: boolean;
    canAccessCompanion: boolean;
  };
};

export type PostVisitMobileEventsResponse = {
  contractVersion: 'post-visit-mobile-events.v1';
  sessionId: string;
  events: Array<{
    id: string;
    eventType: string;
    occurredAt: string;
    actorType: 'patient' | 'clinician' | 'system';
    actorId: string | null;
    severity: 'low' | 'moderate' | 'high' | 'critical' | null;
    payload?: Record<string, unknown>;
  }>;
  paging: {
    limit: number;
    offset: number;
    total: number;
  };
};

export type TelemedicineConsultation = {
  id: string;
  patient_id: string;
  patient_name?: string | null;
  doctor_id?: string | null;
  doctor_name?: string | null;
  consultation_type?: string | null;
  status: string;
  scheduled_start_time?: string | null;
  scheduled_end_time?: string | null;
  actual_start_time?: string | null;
  actual_end_time?: string | null;
  appointment_id?: string | null;
  connection_quality?: string | null;
  doctor_connection_quality?: string | null;
  updated_at?: string | null;
};

export type TelemedicineListResponse = {
  consultations: TelemedicineConsultation[];
  total: number;
  page: number;
  limit: number;
};

export async function getNurseWorklistState(): Promise<NurseWorklistState> {
  try {
    const { data } = await ehrClient.get<NurseWorklistState>('/nurse-worklist/state');
    return {
      completedTaskIds: Array.isArray(data?.completedTaskIds) ? data.completedTaskIds : [],
      acknowledgedAlertIds: Array.isArray(data?.acknowledgedAlertIds) ? data.acknowledgedAlertIds : []
    };
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) return { completedTaskIds: [], acknowledgedAlertIds: [] };
    throw err;
  }
}

export async function getNurseCrossModuleFeed(): Promise<NurseCrossModuleFeedResponse> {
  try {
    const { data } = await ehrClient.get<NurseCrossModuleFeedResponse>('/nurse-worklist/cross-module-feed');
    return {
      items: Array.isArray(data?.items) ? data.items : [],
      summary: data?.summary,
      generatedAt: data?.generatedAt
    };
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) return { items: [], summary: undefined, generatedAt: undefined };
    throw err;
  }
}

export async function getDoctorSyncFeed(params?: {
  focus?: string;
  includeAcknowledged?: boolean;
}): Promise<NurseCrossModuleFeedResponse> {
  try {
    const { data } = await ehrClient.get<NurseCrossModuleFeedResponse>('/nurse-worklist/doctor-sync-feed', {
      params
    });
    return {
      items: Array.isArray(data?.items) ? data.items : [],
      summary: data?.summary,
      filters: data?.filters,
      generatedAt: data?.generatedAt
    };
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) return { items: [], summary: undefined, filters: undefined, generatedAt: undefined };
    throw err;
  }
}

export async function updateNurseCrossModuleWorkflow(payload: UpdateWorkflowPayload): Promise<{
  ok: boolean;
  itemId: string;
  status: string;
}> {
  const { data } = await ehrClient.post('/nurse-worklist/cross-module/workflow', payload);
  return {
    ok: Boolean(data?.ok),
    itemId: String(data?.itemId || payload.itemId),
    status: String(data?.status || payload.status)
  };
}

export async function completeNurseTask(
  taskId: string,
  payload?: {
    action?: 'accept' | 'override';
    reason?: string;
    patientId?: string;
    context?: Record<string, unknown>;
  }
): Promise<{ ok: boolean; taskId: string }> {
  const { data } = await ehrClient.post(`/nurse-worklist/tasks/${encodeURIComponent(taskId)}/complete`, payload || {});
  return {
    ok: Boolean(data?.ok),
    taskId: String(data?.taskId || taskId)
  };
}

export async function acknowledgeNurseAlert(
  alertId: string,
  payload?: {
    action?: 'accept' | 'override';
    reason?: string;
    patientId?: string;
    context?: Record<string, unknown>;
  }
): Promise<{ ok: boolean; alertId: string }> {
  const { data } = await ehrClient.post(
    `/nurse-worklist/alerts/${encodeURIComponent(alertId)}/acknowledge`,
    payload || {}
  );

  return {
    ok: Boolean(data?.ok),
    alertId: String(data?.alertId || alertId)
  };
}

export async function getProviderMessageInbox(params?: {
  status?: string;
  priority?: string;
  message_type?: string;
  limit?: number;
  offset?: number;
}): Promise<ProviderInboxResponse> {
  try {
    const { data } = await ehrClient.get<ProviderInboxResponse>('/messages/inbox', { params });
    return {
      messages: Array.isArray(data?.messages) ? data.messages : [],
      total: Number(data?.total || 0),
      limit: Number(data?.limit || params?.limit || 50),
      offset: Number(data?.offset || params?.offset || 0)
    };
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) {
      return { messages: [], total: 0, limit: params?.limit ?? 50, offset: params?.offset ?? 0 };
    }
    throw err;
  }
}

export async function getProviderUnreadCount(): Promise<{ count: number }> {
  try {
    const { data } = await ehrClient.get<{ count: number }>('/messages/unread-count');
    return { count: Number(data?.count || 0) };
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) return { count: 0 };
    throw err;
  }
}

export async function getProviderThreads(): Promise<ProviderThreadSummary[]> {
  try {
    const { data } = await ehrClient.get<ProviderThreadSummary[]>('/messages/threads');
    return Array.isArray(data) ? data : [];
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) return [];
    throw err;
  }
}

export async function getProviderThread(threadId: string): Promise<ProviderThreadDetail> {
  const { data } = await ehrClient.get<ProviderThreadDetail>(`/messages/threads/${encodeURIComponent(threadId)}`);
  return {
    thread: data?.thread || ({ id: threadId, subject: '' } as ProviderThreadSummary),
    messages: Array.isArray(data?.messages) ? data.messages : []
  };
}

export async function sendProviderMessage(payload: SendProviderMessagePayload): Promise<ProviderInboxMessage> {
  const { data } = await ehrClient.post<ProviderInboxMessage>('/messages', payload);
  return data;
}

export async function replyToProviderMessage(
  messageId: string,
  payload: { message_text: string }
): Promise<ProviderInboxMessage> {
  const { data } = await ehrClient.post<ProviderInboxMessage>(
    `/messages/${encodeURIComponent(messageId)}/reply`,
    payload
  );
  return data;
}

export async function markProviderMessageRead(messageId: string): Promise<void> {
  await ehrClient.put(`/messages/${encodeURIComponent(messageId)}/read`);
}

export async function listPostVisitSessions(filters?: {
  status?: 'captured' | 'processing' | 'draft_ready' | 'doctor_reviewed' | 'published' | 'closed';
  patientId?: string;
  doctorId?: string;
  sourceType?: 'in_person' | 'telemedicine' | 'hybrid';
  publishedOnly?: boolean;
  limit?: number;
  offset?: number;
}): Promise<PostVisitSessionsResponse> {
  try {
    const { data } = await ehrClient.get<PostVisitSessionsResponse>('/post-visit/sessions', { params: filters || {} });
    return {
      sessions: Array.isArray(data?.sessions) ? data.sessions : [],
      paging: {
        limit: Number(data?.paging?.limit || filters?.limit || 25),
        offset: Number(data?.paging?.offset || filters?.offset || 0),
        total: Number(data?.paging?.total || 0)
      }
    };
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) {
      return {
        sessions: [],
        paging: { limit: filters?.limit ?? 25, offset: filters?.offset ?? 0, total: 0 }
      };
    }
    throw err;
  }
}

export async function getPostVisitMobileContract(sessionId: string, version = 'v1'): Promise<PostVisitMobileContract> {
  try {
    const { data } = await ehrClient.get<PostVisitMobileContract>(
      `/post-visit/sessions/${encodeURIComponent(sessionId)}/mobile-contract`,
      { params: { version } }
    );
    return data as PostVisitMobileContract;
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) {
      return {
        contractVersion: 'post-visit-mobile.v1',
        generatedAt: new Date().toISOString(),
        session: {
          id: sessionId,
          status: 'unknown',
          language: 'en',
          sourceType: 'in_person',
          publishedAt: null,
          reviewedAt: null,
          updatedAt: new Date().toISOString()
        },
        cards: [],
        checklist: [],
        actions: { canPublish: false, canExecuteRecommendations: false, canAccessCompanion: false }
      } as PostVisitMobileContract;
    }
    throw err;
  }
}

export async function getPostVisitMobileEvents(
  sessionId: string,
  filters?: { version?: string; limit?: number; offset?: number }
): Promise<PostVisitMobileEventsResponse> {
  try {
    const { data } = await ehrClient.get<PostVisitMobileEventsResponse>(
      `/post-visit/sessions/${encodeURIComponent(sessionId)}/mobile-events`,
      { params: filters || { version: 'v1' } }
    );
    return data as PostVisitMobileEventsResponse;
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) {
      return {
        contractVersion: 'post-visit-mobile-events.v1',
        sessionId,
        events: [],
        paging: { total: 0, limit: filters?.limit ?? 30, offset: filters?.offset ?? 0 }
      } as PostVisitMobileEventsResponse;
    }
    throw err;
  }
}

export async function reviewPostVisitArtifact(
  sessionId: string,
  payload: {
    artifactType: 'soap_note' | 'visit_summary' | 'recommendation_bundle';
    action: 'accept' | 'edit' | 'reject';
    editedContent?: Record<string, unknown>;
    reason?: string;
    reviewMetadata?: Record<string, unknown>;
  }
): Promise<Record<string, unknown>> {
  try {
    const { data } = await ehrClient.post(`/post-visit/sessions/${encodeURIComponent(sessionId)}/review`, payload);
    return data ?? {};
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) {
      return { ok: false, _notImplemented: true, message: 'Post-visit review endpoint is not available.' };
    }
    throw err;
  }
}

export async function publishPostVisitSession(
  sessionId: string,
  payload?: {
    note?: string;
    publishMetadata?: Record<string, unknown>;
    acknowledgedSupersededCitationIds?: string[];
    acknowledgedMedicationHighRisk?: boolean;
  }
): Promise<Record<string, unknown>> {
  try {
    const { data } = await ehrClient.post(`/post-visit/sessions/${encodeURIComponent(sessionId)}/publish`, payload || {});
    return data ?? {};
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) {
      return { ok: false, _notImplemented: true, message: 'Post-visit publish endpoint is not available.' };
    }
    throw err;
  }
}

export async function listTelemedicineConsultations(filters?: {
  patientId?: string;
  doctorId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  appointmentId?: string;
  page?: number;
  limit?: number;
}): Promise<TelemedicineListResponse> {
  try {
    const { data } = await ehrClient.get<TelemedicineListResponse>('/telemedicine/consultations', {
      params: filters || {}
    });
    return {
      consultations: Array.isArray(data?.consultations) ? data.consultations : [],
      total: Number(data?.total || 0),
      page: Number(data?.page || filters?.page || 1),
      limit: Number(data?.limit || filters?.limit || 20)
    };
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) {
      return {
        consultations: [],
        total: 0,
        page: filters?.page ?? 1,
        limit: filters?.limit ?? 20
      };
    }
    throw err;
  }
}

export async function joinTelemedicineConsultation(
  consultationId: string,
  payload?: {
    joinMethod?: 'audio' | 'video';
    userAgent?: string;
    networkQuality?: string;
  }
): Promise<Record<string, unknown>> {
  const { data } = await ehrClient.post(
    `/telemedicine/consultations/${encodeURIComponent(consultationId)}/join`,
    payload || {}
  );
  return data;
}

export async function endTelemedicineConsultation(consultationId: string): Promise<Record<string, unknown>> {
  const { data } = await ehrClient.post(`/telemedicine/consultations/${encodeURIComponent(consultationId)}/end`, {});
  return data;
}

export async function getTelemedicineMeetingUrl(
  consultationId: string
): Promise<{ meetingUrl?: string; url?: string; [key: string]: unknown }> {
  const { data } = await ehrClient.get(`/telemedicine/consultations/${encodeURIComponent(consultationId)}/meeting-url`);
  return data || {};
}

export async function getHivCohortWorklist(filters?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<Record<string, unknown>> {
  try {
    const { data } = await ehrClient.get('/hiv/cohort-worklist', {
      params: filters || {}
    });
    return data || {};
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) return { items: [], total: 0 };
    throw err;
  }
}
