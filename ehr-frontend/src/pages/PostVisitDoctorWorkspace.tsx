import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  FileCog,
  FileJson,
  Mic,
  Pause,
  Play,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Square,
  Upload,
} from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';

type SessionStatus = 'captured' | 'processing' | 'draft_ready' | 'doctor_reviewed' | 'published' | 'closed';

interface SessionListItem {
  id: string;
  status: SessionStatus;
  sourceType?: string;
  language?: string;
  startedAt?: string | null;
  updatedAt?: string | null;
  publishedAt?: string | null;
  patient?: {
    id?: string;
    firstName?: string | null;
    lastName?: string | null;
    patientNumber?: string | null;
  };
  doctor?: {
    id?: string;
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
}

interface DraftArtifact {
  id: string;
  type: 'soap_note' | 'visit_summary' | 'recommendation_bundle' | 'letter';
  status: string;
  content: Record<string, any>;
  citations?: any[];
}

interface DraftPayload {
  sessionId: string;
  artifacts: DraftArtifact[];
  extractedEntities: Array<{
    id: string;
    type: string;
    value: string;
  }>;
  transcript?: {
    segmentCount?: number;
  };
  reviewActions?: Array<{
    id: string;
    artifactType: string;
    action: string;
    createdAt: string;
  }>;
  ruleCitations?: Array<{
    id: string;
    recommendationId?: string | null;
    ruleId?: string | null;
    guidelineId?: string | null;
    label?: string | null;
    source?: string | null;
    relevanceScore?: number | null;
    citationYear?: number | null;
    isSuperseded?: boolean;
    supersededByGuidelineId?: string | null;
    acknowledgedSuperseded?: boolean;
  }>;
  documentIntelligence?: DocumentIntelligenceItem[];
}

interface DiarizationSegment {
  id: string;
  order: number;
  start: number;
  end: number;
  text: string;
  speakerRole: 'doctor' | 'patient' | 'unknown';
  diarizationConfidence?: number | null;
  needsReview: boolean;
}

interface DiarizationPayload {
  sessionId: string;
  reviewEnabled: boolean;
  confidenceThreshold: number;
  summary: {
    totalSegments: number;
    unresolvedSegments: number;
    doctorSegments: number;
    patientSegments: number;
    unknownSegments: number;
    averageConfidence?: number | null;
  };
  segments: DiarizationSegment[];
}

interface DocumentIntelligenceItem {
  id: string;
  documentType: 'lab_report' | 'prescription' | 'imaging_report' | 'discharge_summary' | 'other';
  documentName: string;
  extractionStatus: 'processed' | 'failed' | 'duplicate';
  duplicateOfDocumentId?: string | null;
  duplicateSimilarity?: number | null;
  ocrEngine?: string | null;
  ocrConfidence?: number | null;
  structured?: {
    observations?: Array<{ name: string; value: number; unit?: string | null }>;
    medications?: Array<{ medicationName: string; dose?: string | null; frequency?: string | null }>;
    findings?: string[];
  };
  criticalDetected?: boolean;
  criticalRouted?: boolean;
  escalationEventId?: string | null;
  createdAt?: string;
}

interface IntraVisitAlertItem {
  id: string;
  status: 'open' | 'confirmed' | 'dismissed';
  alertType: string;
  severity: 'moderate' | 'high' | 'critical';
  source?: string | null;
  transcriptOffsetSeconds?: number | null;
  signalText?: string | null;
  alertMessage: string;
  suggestedAction?: string | null;
  confidence?: number | null;
  triggerTerms?: string[];
  detectedAt?: string;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
}

const STATUS_OPTIONS: Array<'all' | SessionStatus> = [
  'all',
  'captured',
  'processing',
  'draft_ready',
  'doctor_reviewed',
  'published',
  'closed',
];

const DOCUMENT_TYPE_OPTIONS: Array<{
  value: 'lab_report' | 'prescription' | 'imaging_report' | 'discharge_summary' | 'other';
  label: string;
}> = [
  { value: 'lab_report', label: 'Lab report' },
  { value: 'prescription', label: 'Prescription' },
  { value: 'imaging_report', label: 'Imaging report' },
  { value: 'discharge_summary', label: 'Discharge summary' },
  { value: 'other', label: 'Other document' },
];

const formatDate = (value?: string | null) => {
  if (!value) return 'n/a';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'n/a';
  return parsed.toLocaleString();
};

const formatDuration = (durationMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const formatSecondMark = (value: number) => {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const whole = Math.floor(value);
  const minutes = Math.floor(whole / 60);
  const seconds = whole % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const PostVisitDoctorWorkspace: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();

  const token = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('ehr_token') || '';
  }, []);

  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | SessionStatus>('all');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const [draftLoading, setDraftLoading] = useState(false);
  const [draftData, setDraftData] = useState<DraftPayload | null>(null);
  const [diarizationLoading, setDiarizationLoading] = useState(false);
  const [diarizationData, setDiarizationData] = useState<DiarizationPayload | null>(null);
  const [workingActionKey, setWorkingActionKey] = useState<string | null>(null);
  const [fhirPreview, setFhirPreview] = useState<Record<string, any> | null>(null);
  const [mobilePreview, setMobilePreview] = useState<Record<string, any> | null>(null);

  const [newPatientId, setNewPatientId] = useState('');
  const [newAppointmentId, setNewAppointmentId] = useState('');
  const [newConsultationId, setNewConsultationId] = useState('');
  const [newSourceType, setNewSourceType] = useState<'in_person' | 'telemedicine' | 'hybrid'>('in_person');
  const [newSessionAudioFile, setNewSessionAudioFile] = useState<File | null>(null);
  const [sessionTranscribeFile, setSessionTranscribeFile] = useState<File | null>(null);
  const [transcribeLanguage, setTranscribeLanguage] = useState<'en' | 'sn' | 'nd' | 'auto'>('auto');
  const [transcribeTemperature, setTranscribeTemperature] = useState('0');
  const [transcribePrompt, setTranscribePrompt] = useState(
    'This is a medical consultation between a doctor and patient. Medical terminology should be transcribed accurately.',
  );
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);
  const [pendingSpeakerRole, setPendingSpeakerRole] = useState<Record<string, 'doctor' | 'patient' | 'unknown'>>({});
  const [supersededCitationAcknowledgements, setSupersededCitationAcknowledgements] = useState<Record<string, boolean>>({});
  const [documentIntelligence, setDocumentIntelligence] = useState<DocumentIntelligenceItem[]>([]);
  const [documentIntelligenceLoading, setDocumentIntelligenceLoading] = useState(false);
  const [documentIntelligenceLoadedSessionId, setDocumentIntelligenceLoadedSessionId] = useState<string | null>(null);
  const [documentIntelligenceFile, setDocumentIntelligenceFile] = useState<File | null>(null);
  const [documentIntelligenceType, setDocumentIntelligenceType] = useState<
    'lab_report' | 'prescription' | 'imaging_report' | 'discharge_summary' | 'other'
  >('other');
  const [documentIntelligenceLanguage, setDocumentIntelligenceLanguage] = useState('en');
  const [documentIntelligenceNote, setDocumentIntelligenceNote] = useState('');
  const [intraVisitAlerts, setIntraVisitAlerts] = useState<IntraVisitAlertItem[]>([]);
  const [intraVisitAlertsLoading, setIntraVisitAlertsLoading] = useState(false);
  const [intraVisitFeatureEnabled, setIntraVisitFeatureEnabled] = useState(true);
  const [intraVisitSummary, setIntraVisitSummary] = useState<{
    total: number;
    openCount: number;
    criticalOpenCount: number;
    highOpenCount: number;
    moderateOpenCount: number;
  }>({
    total: 0,
    openCount: 0,
    criticalOpenCount: 0,
    highOpenCount: 0,
    moderateOpenCount: 0,
  });
  const [liveTranscriptChunk, setLiveTranscriptChunk] = useState('');
  const [liveStreamTranscript, setLiveStreamTranscript] = useState('');
  const [streamingAnalysisEnabled, setStreamingAnalysisEnabled] = useState(true);
  const [streamingAnalysisStatus, setStreamingAnalysisStatus] = useState<'idle' | 'running' | 'paused'>('idle');
  const [lastStreamingAnalyzedAt, setLastStreamingAnalyzedAt] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<number | null>(null);
  const recordingStartRef = useRef<number>(0);
  const recordingCancelledRef = useRef<boolean>(false);
  const lastAutoAnalyzedSegmentRef = useRef<string>('');
  const streamingChunkBufferRef = useRef<Blob[]>([]);
  const streamingAnalyzeInFlightRef = useRef<boolean>(false);
  const streamingChunkSequenceRef = useRef<number>(0);

  const selectedSession = useMemo(
    () => sessions.find((item) => item.id === selectedSessionId) || null,
    [selectedSessionId, sessions],
  );

  const recommendationArtifact = useMemo(
    () => draftData?.artifacts?.find((artifact) => artifact.type === 'recommendation_bundle') || null,
    [draftData],
  );
  const visitSummaryArtifact = useMemo(
    () => draftData?.artifacts?.find((artifact) => artifact.type === 'visit_summary') || null,
    [draftData],
  );

  const recommendationItems = useMemo(() => {
    const raw = recommendationArtifact?.content?.items;
    return Array.isArray(raw) ? raw : [];
  }, [recommendationArtifact]);

  const specialtySoapValidation = useMemo(() => {
    const summaryValue = visitSummaryArtifact?.content?.specialty_soap;
    if (summaryValue && typeof summaryValue === 'object') return summaryValue as Record<string, any>;
    const recommendationValue = recommendationArtifact?.content?.specialty_soap;
    if (recommendationValue && typeof recommendationValue === 'object') return recommendationValue as Record<string, any>;
    return null;
  }, [recommendationArtifact, visitSummaryArtifact]);

  const supersededCitations = useMemo(() => {
    const draftRuleCitations = draftData?.ruleCitations;
    const rows = Array.isArray(draftRuleCitations) ? draftRuleCitations : [];
    return rows.filter((row) => row?.isSuperseded === true);
  }, [draftData]);

  const unresolvedSupersededCitationCount = useMemo(
    () =>
      supersededCitations.filter(
        (citation) => !(citation.acknowledgedSuperseded === true || supersededCitationAcknowledgements[citation.id] === true),
      ).length,
    [supersededCitationAcknowledgements, supersededCitations],
  );

  const effectiveDocumentIntelligence = useMemo(() => {
    if (documentIntelligenceLoadedSessionId && documentIntelligenceLoadedSessionId === selectedSessionId) {
      return documentIntelligence;
    }
    const draftRows = Array.isArray(draftData?.documentIntelligence)
      ? (draftData?.documentIntelligence as DocumentIntelligenceItem[])
      : [];
    return draftRows;
  }, [documentIntelligence, documentIntelligenceLoadedSessionId, draftData?.documentIntelligence, selectedSessionId]);

  const labObservationTrends = useMemo(() => {
    const trendMap = new Map<string, Array<{ value: number; unit: string; createdAt: string }>>();
    for (const item of effectiveDocumentIntelligence) {
      if (item.documentType !== 'lab_report') continue;
      const createdAt = item.createdAt || new Date(0).toISOString();
      const observations = Array.isArray(item.structured?.observations) ? item.structured?.observations : [];
      for (const observation of observations) {
        const numericValue = Number(observation?.value);
        if (!Number.isFinite(numericValue)) continue;
        const name = String(observation?.name || '').trim();
        if (!name) continue;
        const unit = String(observation?.unit || '').trim();
        const key = `${name}__${unit}`;
        if (!trendMap.has(key)) {
          trendMap.set(key, []);
        }
        trendMap.get(key)?.push({ value: numericValue, unit, createdAt });
      }
    }

    return Array.from(trendMap.entries())
      .map(([key, points]) => {
        const [name, unit] = key.split('__');
        const sortedPoints = [...points]
          .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
          .slice(-8);
        const values = sortedPoints.map((point) => point.value);
        const max = Math.max(...values);
        const min = Math.min(...values);
        return {
          key,
          name,
          unit,
          points: sortedPoints,
          latest: sortedPoints[sortedPoints.length - 1]?.value ?? null,
          previous: sortedPoints.length > 1 ? sortedPoints[sortedPoints.length - 2]?.value ?? null : null,
          min,
          max,
        };
      })
      .sort((left, right) => right.points.length - left.points.length)
      .slice(0, 6);
  }, [effectiveDocumentIntelligence]);

  const loadSessions = useCallback(async () => {
    if (!tenantSlug || !token) return;
    try {
      setSessionsLoading(true);
      const response = await ehrApi.listPostVisitSessions(token, tenantSlug, {
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: 40,
        offset: 0,
      });
      const rows = Array.isArray(response.data?.sessions) ? (response.data.sessions as SessionListItem[]) : [];
      setSessions(rows);

      if (!rows.length) {
        setSelectedSessionId(null);
        setDraftData(null);
        setDiarizationData(null);
        setDocumentIntelligence([]);
        setDocumentIntelligenceLoadedSessionId(null);
        return;
      }
      const selectedExists = selectedSessionId && rows.some((session) => session.id === selectedSessionId);
      if (!selectedExists) {
        setSelectedSessionId(rows[0].id);
      }
    } catch {
      showError('Post-visit workspace', 'Unable to load post-visit sessions.');
    } finally {
      setSessionsLoading(false);
    }
  }, [selectedSessionId, showError, statusFilter, tenantSlug, token]);

  const loadDraft = useCallback(
    async (sessionId: string) => {
      if (!tenantSlug || !token || !sessionId) return;
      try {
        setDraftLoading(true);
        const response = await ehrApi.getPostVisitSessionDraft(sessionId, token, tenantSlug);
        setDraftData((response.data || null) as DraftPayload | null);
      } catch {
        showError('Post-visit workspace', 'Unable to load draft artifacts for the selected session.');
        setDraftData(null);
      } finally {
        setDraftLoading(false);
      }
    },
    [showError, tenantSlug, token],
  );

  const loadDiarization = useCallback(
    async (sessionId: string) => {
      if (!tenantSlug || !token || !sessionId) return;
      try {
        setDiarizationLoading(true);
        const response = await ehrApi.getPostVisitSessionDiarization(sessionId, token, tenantSlug, {
          limit: 250,
          unresolvedOnly: false,
        });
        setDiarizationData((response.data || null) as DiarizationPayload | null);
      } catch {
        setDiarizationData(null);
      } finally {
        setDiarizationLoading(false);
      }
    },
    [tenantSlug, token],
  );

  const loadDocumentIntelligence = useCallback(
    async (sessionId: string) => {
      if (!tenantSlug || !token || !sessionId) return;
      try {
        setDocumentIntelligenceLoading(true);
        const response = await ehrApi.listPostVisitDocumentIntelligence(sessionId, token, tenantSlug, {
          limit: 80,
        });
        const rows = Array.isArray(response.data?.items) ? (response.data.items as DocumentIntelligenceItem[]) : [];
        setDocumentIntelligence(rows);
        setDocumentIntelligenceLoadedSessionId(sessionId);
      } catch {
        setDocumentIntelligence([]);
        setDocumentIntelligenceLoadedSessionId(sessionId);
      } finally {
        setDocumentIntelligenceLoading(false);
      }
    },
    [tenantSlug, token],
  );

  const loadIntraVisitAlerts = useCallback(
    async (sessionId: string) => {
      if (!tenantSlug || !token || !sessionId) return;
      try {
        setIntraVisitAlertsLoading(true);
        const response = await ehrApi.listPostVisitIntraVisitAlerts(sessionId, token, tenantSlug, {
          limit: 40,
          offset: 0,
        });
        const items = Array.isArray(response.data?.items) ? (response.data.items as IntraVisitAlertItem[]) : [];
        setIntraVisitAlerts(items);
        setIntraVisitFeatureEnabled(response.data?.featureEnabled !== false);
        setIntraVisitSummary({
          total: Number(response.data?.summary?.total || 0),
          openCount: Number(response.data?.summary?.openCount || 0),
          criticalOpenCount: Number(response.data?.summary?.criticalOpenCount || 0),
          highOpenCount: Number(response.data?.summary?.highOpenCount || 0),
          moderateOpenCount: Number(response.data?.summary?.moderateOpenCount || 0),
        });
      } catch {
        setIntraVisitAlerts([]);
        setIntraVisitSummary({
          total: 0,
          openCount: 0,
          criticalOpenCount: 0,
          highOpenCount: 0,
          moderateOpenCount: 0,
        });
      } finally {
        setIntraVisitAlertsLoading(false);
      }
    },
    [tenantSlug, token],
  );

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (!selectedSessionId) return;
    loadDraft(selectedSessionId);
    loadDiarization(selectedSessionId);
    loadDocumentIntelligence(selectedSessionId);
    loadIntraVisitAlerts(selectedSessionId);
    setSessionTranscribeFile(null);
    setDocumentIntelligenceFile(null);
    setDocumentIntelligenceNote('');
    setLiveTranscriptChunk('');
    setLiveStreamTranscript('');
    setLastStreamingAnalyzedAt(null);
    setStreamingAnalysisStatus('idle');
    streamingChunkBufferRef.current = [];
    streamingChunkSequenceRef.current = 0;
    lastAutoAnalyzedSegmentRef.current = '';
  }, [loadDiarization, loadDocumentIntelligence, loadDraft, loadIntraVisitAlerts, selectedSessionId]);

  useEffect(() => {
    const rows = Array.isArray(draftData?.ruleCitations) ? draftData.ruleCitations : [];
    const next: Record<string, boolean> = {};
    for (const row of rows) {
      if (row?.isSuperseded === true && row?.acknowledgedSuperseded === true && row?.id) {
        next[row.id] = true;
      }
    }
    setSupersededCitationAcknowledgements(next);
  }, [draftData]);

  useEffect(() => {
    if (!tenantSlug || !token || !selectedSessionId || !intraVisitFeatureEnabled) return;
    const segments = Array.isArray(diarizationData?.segments) ? diarizationData?.segments : [];
    const latestSegment = segments[segments.length - 1];
    if (!latestSegment?.id || !latestSegment?.text) return;
    const segmentText = String(latestSegment.text || '').trim();
    if (!segmentText) return;

    const dedupeKey = `${selectedSessionId}:${latestSegment.id}:${segmentText}`;
    if (lastAutoAnalyzedSegmentRef.current === dedupeKey) return;
    lastAutoAnalyzedSegmentRef.current = dedupeKey;

    void ehrApi
      .analyzePostVisitIntraVisitAlerts(
        selectedSessionId,
        {
          text: segmentText,
          source: 'streamed_transcript_auto',
          transcriptOffsetSeconds: Number.isFinite(Number(latestSegment.end))
            ? Math.max(0, Math.floor(Number(latestSegment.end)))
            : undefined,
        },
        token,
        tenantSlug,
      )
      .then((response) => {
        const generatedAlerts = Array.isArray(response.data?.alerts) ? response.data.alerts : [];
        if (generatedAlerts.length > 0) {
          void loadIntraVisitAlerts(selectedSessionId);
        }
      })
      .catch(() => undefined);
  }, [diarizationData?.segments, intraVisitFeatureEnabled, loadIntraVisitAlerts, selectedSessionId, tenantSlug, token]);

  const flushStreamingAudioAnalysis = useCallback(
    async (force = false) => {
      if (!tenantSlug || !token || !selectedSessionId || !streamingAnalysisEnabled) return;
      if (streamingAnalyzeInFlightRef.current) return;
      const minBatchSize = 3;
      if (!force && streamingChunkBufferRef.current.length < minBatchSize) return;

      const chunks = streamingChunkBufferRef.current;
      streamingChunkBufferRef.current = [];
      if (!chunks.length) return;

      const mimeType = chunks[0]?.type || 'audio/webm';
      const audioBlob = new Blob(chunks, { type: mimeType });
      if (audioBlob.size <= 0) return;

      const extension = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mpeg') ? 'mp3' : 'webm';
      const file = new File([audioBlob], `post-visit-live-stream-${Date.now()}.${extension}`, { type: mimeType });

      streamingAnalyzeInFlightRef.current = true;
      setStreamingAnalysisStatus('running');
      try {
        const response = await ehrApi.analyzePostVisitIntraVisitAudioChunk(
          selectedSessionId,
          {
            audioFile: file,
            language: transcribeLanguage,
            temperature: Number.isFinite(Number(transcribeTemperature)) ? Number(transcribeTemperature) : 0,
            prompt: transcribePrompt.trim() || undefined,
            source: 'browser_live_stream',
            transcriptOffsetSeconds: Math.max(0, Math.floor(recordingDurationMs / 1000)),
          },
          token,
          tenantSlug,
        );

        const transcriptText = String(response.data?.transcript?.text || '').trim();
        if (transcriptText) {
          setLiveStreamTranscript((previous) => {
            const combined = previous ? `${previous}\n${transcriptText}` : transcriptText;
            return combined.slice(-6000);
          });
          setLastStreamingAnalyzedAt(new Date().toISOString());
        }
        setIntraVisitFeatureEnabled(response.data?.featureEnabled !== false);
        if (response.data?.summary) {
          setIntraVisitSummary({
            total: Number(response.data.summary.total || 0),
            openCount: Number(response.data.summary.openCount || 0),
            criticalOpenCount: Number(response.data.summary.criticalOpenCount || 0),
            highOpenCount: Number(response.data.summary.highOpenCount || 0),
            moderateOpenCount: Number(response.data.summary.moderateOpenCount || 0),
          });
        }

        const alerts = Array.isArray(response.data?.alerts) ? response.data.alerts : [];
        if (alerts.length > 0) {
          showSuccess('Live safety alerts detected', `${alerts.length} intra-visit alert(s) triggered from live audio stream.`);
          await loadIntraVisitAlerts(selectedSessionId);
        }
      } catch {
        setStreamingAnalysisStatus('paused');
      } finally {
        streamingAnalyzeInFlightRef.current = false;
        if (isRecordingAudio && streamingAnalysisEnabled) {
          setStreamingAnalysisStatus('running');
        } else {
          setStreamingAnalysisStatus('idle');
        }
        if (streamingChunkBufferRef.current.length >= minBatchSize) {
          window.setTimeout(() => {
            void flushStreamingAudioAnalysis(false);
          }, 0);
        }
      }
    },
    [
      isRecordingAudio,
      loadIntraVisitAlerts,
      recordingDurationMs,
      selectedSessionId,
      showSuccess,
      streamingAnalysisEnabled,
      tenantSlug,
      token,
      transcribeLanguage,
      transcribePrompt,
      transcribeTemperature,
    ],
  );

  const clearRecordingInterval = useCallback(() => {
    if (recordingIntervalRef.current !== null) {
      window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  }, []);

  const stopAudioStream = useCallback(() => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
  }, []);

  const startInBrowserRecording = useCallback(async () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      showError('Audio recording unavailable', 'Browser recording is not available in this environment.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      showError('Audio recording unavailable', 'This browser does not support microphone capture.');
      return;
    }
    if (!('MediaRecorder' in window)) {
      showError('Audio recording unavailable', 'MediaRecorder is not supported in this browser.');
      return;
    }

    try {
      recordingCancelledRef.current = false;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      audioChunksRef.current = [];
      streamingChunkBufferRef.current = [];
      streamingChunkSequenceRef.current = 0;
      setLiveStreamTranscript('');
      setLastStreamingAnalyzedAt(null);

      const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg'];
      const selectedMimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = selectedMimeType ? new MediaRecorder(stream, { mimeType: selectedMimeType }) : new MediaRecorder(stream);

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          if (streamingAnalysisEnabled) {
            streamingChunkBufferRef.current.push(event.data);
            streamingChunkSequenceRef.current += 1;
            if (streamingChunkSequenceRef.current % 3 === 0) {
              void flushStreamingAudioAnalysis(false);
            }
          }
        }
      };

      recorder.onstop = () => {
        clearRecordingInterval();
        stopAudioStream();
        setIsRecordingAudio(false);
        setIsRecordingPaused(false);

        if (recordingCancelledRef.current) {
          recordingCancelledRef.current = false;
          audioChunksRef.current = [];
          streamingChunkBufferRef.current = [];
          streamingChunkSequenceRef.current = 0;
          setRecordingDurationMs(0);
          setStreamingAnalysisStatus('idle');
          return;
        }

        if (streamingAnalysisEnabled && streamingChunkBufferRef.current.length > 0) {
          void flushStreamingAudioAnalysis(true);
        }

        if (!audioChunksRef.current.length) {
          showError('Recording failed', 'No audio was captured. Please try again.');
          return;
        }

        const mimeType = recorder.mimeType || 'audio/webm';
        const extension = mimeType.includes('ogg') ? 'ogg' : 'webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const fileName = `post-visit-${selectedSessionId || 'session'}-${Date.now()}.${extension}`;
        const file = new File([audioBlob], fileName, { type: mimeType });
        setSessionTranscribeFile(file);
        showSuccess('Recording captured', 'Recorded audio is ready for transcription.');
      };

      mediaRecorderRef.current = recorder;
      setRecordingDurationMs(0);
      setIsRecordingAudio(true);
      setIsRecordingPaused(false);
      setStreamingAnalysisStatus(streamingAnalysisEnabled ? 'running' : 'idle');
      recordingStartRef.current = Date.now();
      recorder.start(1000);
      recordingIntervalRef.current = window.setInterval(() => {
        setRecordingDurationMs(Date.now() - recordingStartRef.current);
      }, 1000);
    } catch {
      stopAudioStream();
      showError('Microphone access failed', 'Could not access microphone. Check browser permission settings.');
    }
  }, [clearRecordingInterval, flushStreamingAudioAnalysis, selectedSessionId, showError, showSuccess, stopAudioStream, streamingAnalysisEnabled]);

  const pauseInBrowserRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    recorder.pause();
    setIsRecordingPaused(true);
    setStreamingAnalysisStatus('paused');
  }, []);

  const resumeInBrowserRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'paused') return;
    recorder.resume();
    setIsRecordingPaused(false);
    setStreamingAnalysisStatus(streamingAnalysisEnabled ? 'running' : 'idle');
    recordingStartRef.current = Date.now() - recordingDurationMs;
  }, [recordingDurationMs, streamingAnalysisEnabled]);

  const stopInBrowserRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    recorder.stop();
  }, []);

  const cancelInBrowserRecording = useCallback(() => {
    recordingCancelledRef.current = true;
    setSessionTranscribeFile(null);
    streamingChunkBufferRef.current = [];
    streamingChunkSequenceRef.current = 0;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      return;
    }
    clearRecordingInterval();
    stopAudioStream();
    setIsRecordingAudio(false);
    setIsRecordingPaused(false);
    setRecordingDurationMs(0);
    setStreamingAnalysisStatus('idle');
  }, [clearRecordingInterval, stopAudioStream]);

  useEffect(() => {
    return () => {
      clearRecordingInterval();
      stopAudioStream();
    };
  }, [clearRecordingInterval, stopAudioStream]);

  useEffect(() => {
    if (!selectedSessionId) return;
    if (isRecordingAudio) {
      cancelInBrowserRecording();
    } else {
      setRecordingDurationMs(0);
    }
  }, [cancelInBrowserRecording, isRecordingAudio, selectedSessionId]);

  useEffect(() => {
    if (!isRecordingAudio) {
      setStreamingAnalysisStatus('idle');
      return;
    }
    if (!streamingAnalysisEnabled) {
      streamingChunkBufferRef.current = [];
      streamingChunkSequenceRef.current = 0;
      setStreamingAnalysisStatus('idle');
      return;
    }
    setStreamingAnalysisStatus(isRecordingPaused ? 'paused' : 'running');
  }, [isRecordingAudio, isRecordingPaused, streamingAnalysisEnabled]);

  const handleCreateSession = useCallback(async () => {
    if (!tenantSlug || !token) return;
    const patientId = newPatientId.trim();
    if (!patientId) {
      showError('Create session', 'Patient ID is required to create a post-visit session.');
      return;
    }
    try {
      setWorkingActionKey('create-session');
      const response = await ehrApi.createPostVisitSession(
        {
          patientId,
          appointmentId: newAppointmentId.trim() || undefined,
          consultationId: newConsultationId.trim() || undefined,
          sourceType: newSourceType,
          language: 'en',
        },
        token,
        tenantSlug,
      );
      const createdId = String(response.data?.id || '').trim();
      if (!createdId) {
        throw new Error('Session creation returned empty ID');
      }
      showSuccess('Post-visit session created', `Session ${createdId} is ready.`);

      if (newSessionAudioFile) {
        try {
          const parsedTemperature = Number(transcribeTemperature);
          await ehrApi.transcribePostVisitSession(
            createdId,
            {
              audioFile: newSessionAudioFile,
              language: transcribeLanguage,
              temperature: Number.isFinite(parsedTemperature) ? parsedTemperature : 0,
              prompt: transcribePrompt.trim() || undefined,
            },
            token,
            tenantSlug,
          );
          showSuccess(
            'Session transcription completed',
            'Audio was transcribed and draft artifacts were generated automatically.',
          );
        } catch {
          showError(
            'Session created, transcription failed',
            'The session was created but audio transcription did not complete. Re-run transcription from the session panel.',
          );
        }
      }

      setNewPatientId('');
      setNewAppointmentId('');
      setNewConsultationId('');
      setNewSessionAudioFile(null);
      await loadSessions();
      setSelectedSessionId(createdId);
      await Promise.all([loadDraft(createdId), loadDiarization(createdId), loadIntraVisitAlerts(createdId)]);
    } catch {
      showError('Create session failed', 'Unable to create post-visit session. Check patient ID and context.');
    } finally {
      setWorkingActionKey(null);
    }
  }, [
    loadSessions,
    newAppointmentId,
    newConsultationId,
    newPatientId,
    newSessionAudioFile,
    newSourceType,
    loadDiarization,
    loadDraft,
    loadIntraVisitAlerts,
    showError,
    showSuccess,
    transcribeLanguage,
    transcribePrompt,
    transcribeTemperature,
    tenantSlug,
    token,
  ]);

  const handleRegenerateDraft = useCallback(async () => {
    if (!tenantSlug || !token || !selectedSessionId) return;
    try {
      setWorkingActionKey('regenerate-draft');
      await ehrApi.regeneratePostVisitDraft(
        selectedSessionId,
        { reason: 'doctor_workspace_refresh' },
        token,
        tenantSlug,
      );
      showSuccess('Draft refreshed', 'Recommendation bundle and summary were regenerated.');
      await Promise.all([
        loadSessions(),
        loadDraft(selectedSessionId),
        loadDiarization(selectedSessionId),
        loadIntraVisitAlerts(selectedSessionId),
      ]);
    } catch {
      showError('Draft regeneration failed', 'Could not regenerate post-visit artifacts.');
    } finally {
      setWorkingActionKey(null);
    }
  }, [loadDiarization, loadDraft, loadIntraVisitAlerts, loadSessions, selectedSessionId, showError, showSuccess, tenantSlug, token]);

  const handleTranscribeSelectedSession = useCallback(async () => {
    if (!tenantSlug || !token || !selectedSessionId) return;
    if (!sessionTranscribeFile) {
      showError('Session transcription', 'Select an audio file before running transcription.');
      return;
    }
    try {
      setWorkingActionKey('transcribe-session');
      const parsedTemperature = Number(transcribeTemperature);
      await ehrApi.transcribePostVisitSession(
        selectedSessionId,
        {
          audioFile: sessionTranscribeFile,
          language: transcribeLanguage,
          temperature: Number.isFinite(parsedTemperature) ? parsedTemperature : 0,
          prompt: transcribePrompt.trim() || undefined,
        },
        token,
        tenantSlug,
      );
      showSuccess('Session transcription completed', 'Transcript, entities, and draft artifacts were refreshed.');
      setSessionTranscribeFile(null);
      setRecordingDurationMs(0);
      await Promise.all([
        loadSessions(),
        loadDraft(selectedSessionId),
        loadDiarization(selectedSessionId),
        loadIntraVisitAlerts(selectedSessionId),
      ]);
    } catch {
      showError('Session transcription failed', 'Unable to transcribe selected audio for this session.');
    } finally {
      setWorkingActionKey(null);
    }
  }, [
    loadDraft,
    loadDiarization,
    loadSessions,
    loadIntraVisitAlerts,
    selectedSessionId,
    sessionTranscribeFile,
    showError,
    showSuccess,
    tenantSlug,
    token,
    transcribeLanguage,
    transcribePrompt,
    transcribeTemperature,
  ]);

  const handleAnalyzeIntraVisitChunk = useCallback(async () => {
    if (!tenantSlug || !token || !selectedSessionId) return;
    const text = liveTranscriptChunk.trim();
    if (!text) {
      showError('Intra-visit alert engine', 'Enter transcript text before running safety analysis.');
      return;
    }
    try {
      setWorkingActionKey('intravisit-analyze');
      const response = await ehrApi.analyzePostVisitIntraVisitAlerts(
        selectedSessionId,
        {
          text,
          source: 'doctor_workspace_manual',
        },
        token,
        tenantSlug,
      );
      const generatedCount = Array.isArray(response.data?.alerts) ? response.data.alerts.length : 0;
      if (generatedCount > 0) {
        showSuccess('Intra-visit alerts detected', `${generatedCount} alert(s) generated from this transcript chunk.`);
      } else {
        showSuccess('Intra-visit analysis complete', 'No new safety alerts were generated from this chunk.');
      }
      setLiveTranscriptChunk('');
      await loadIntraVisitAlerts(selectedSessionId);
    } catch {
      showError('Intra-visit analysis failed', 'Unable to analyze transcript chunk for safety alerts.');
    } finally {
      setWorkingActionKey(null);
    }
  }, [liveTranscriptChunk, loadIntraVisitAlerts, selectedSessionId, showError, showSuccess, tenantSlug, token]);

  const handleResolveIntraVisitAlert = useCallback(
    async (alertId: string, status: 'confirmed' | 'dismissed') => {
      if (!tenantSlug || !token || !selectedSessionId) return;
      try {
        setWorkingActionKey(`intravisit-resolve:${alertId}:${status}`);
        await ehrApi.resolvePostVisitIntraVisitAlert(
          selectedSessionId,
          alertId,
          {
            status,
            note:
              status === 'confirmed'
                ? 'Confirmed from doctor intra-visit alert bar.'
                : 'Dismissed from doctor intra-visit alert bar.',
          },
          token,
          tenantSlug,
        );
        await loadIntraVisitAlerts(selectedSessionId);
      } catch {
        showError('Intra-visit alert update failed', 'Unable to update intra-visit alert status.');
      } finally {
        setWorkingActionKey(null);
      }
    },
    [loadIntraVisitAlerts, selectedSessionId, showError, tenantSlug, token],
  );

  const handleUploadDocumentIntelligence = useCallback(async () => {
    if (!tenantSlug || !token || !selectedSessionId) return;
    if (!documentIntelligenceFile) {
      showError('Document intelligence', 'Select a document file before uploading.');
      return;
    }
    try {
      setWorkingActionKey('upload-document-intelligence');
      const response = await ehrApi.ingestPostVisitDocumentIntelligence(
        selectedSessionId,
        {
          file: documentIntelligenceFile,
          documentType: documentIntelligenceType,
          language: documentIntelligenceLanguage.trim() || 'en',
          note: documentIntelligenceNote.trim() || undefined,
        },
        token,
        tenantSlug,
      );
      const critical = response.data?.criticalDetected === true;
      showSuccess(
        'Document intelligence ingested',
        critical
          ? 'Critical values were detected and routed to clinician escalation workflow.'
          : 'Extraction, structuring, and FHIR mapping completed.',
      );
      setDocumentIntelligenceFile(null);
      setDocumentIntelligenceNote('');
      await Promise.all([
        loadSessions(),
        loadDraft(selectedSessionId),
        loadDocumentIntelligence(selectedSessionId),
      ]);
    } catch {
      showError(
        'Document intelligence failed',
        'Unable to ingest document intelligence. Verify file type and OCR configuration.',
      );
    } finally {
      setWorkingActionKey(null);
    }
  }, [
    documentIntelligenceFile,
    documentIntelligenceLanguage,
    documentIntelligenceNote,
    documentIntelligenceType,
    loadDocumentIntelligence,
    loadDraft,
    loadSessions,
    selectedSessionId,
    showError,
    showSuccess,
    tenantSlug,
    token,
  ]);

  const handleReviewArtifact = useCallback(
    async (artifactType: 'visit_summary' | 'recommendation_bundle') => {
      if (!tenantSlug || !token || !selectedSessionId) return;
      try {
        setWorkingActionKey(`review:${artifactType}`);
        await ehrApi.reviewPostVisitArtifact(
          selectedSessionId,
          {
            artifactType,
            action: 'accept',
            reason: `accepted_from_workspace_${artifactType}`,
            reviewMetadata: {
              workspace: 'doctor_post_visit',
              safetyLevel: 'standard',
            },
          },
          token,
          tenantSlug,
        );
        showSuccess('Artifact reviewed', `${artifactType.replace('_', ' ')} marked as doctor-reviewed.`);
        await Promise.all([
          loadSessions(),
          loadDraft(selectedSessionId),
          loadDiarization(selectedSessionId),
          loadIntraVisitAlerts(selectedSessionId),
        ]);
      } catch {
        showError('Review failed', `Unable to review ${artifactType.replace('_', ' ')}.`);
      } finally {
        setWorkingActionKey(null);
      }
    },
    [loadDiarization, loadDraft, loadIntraVisitAlerts, loadSessions, selectedSessionId, showError, showSuccess, tenantSlug, token],
  );

  const handleReassignDiarization = useCallback(
    async (segment: DiarizationSegment, speakerRole: 'doctor' | 'patient' | 'unknown') => {
      if (!tenantSlug || !token || !selectedSessionId) return;
      try {
        setWorkingActionKey(`diarization:${segment.id}`);
        await ehrApi.reassignPostVisitDiarizationSegment(
          selectedSessionId,
          segment.id,
          {
            speakerRole,
            note: 'Reassigned from doctor diarization review panel.',
          },
          token,
          tenantSlug,
        );
        showSuccess('Diarization updated', `Segment #${segment.order + 1} assigned to ${speakerRole}.`);
        setPendingSpeakerRole((prev) => {
          const next = { ...prev };
          delete next[segment.id];
          return next;
        });
        await Promise.all([loadDiarization(selectedSessionId), loadDraft(selectedSessionId)]);
      } catch {
        showError('Diarization update failed', 'Unable to update segment speaker attribution.');
      } finally {
        setWorkingActionKey(null);
      }
    },
    [loadDiarization, loadDraft, selectedSessionId, showError, showSuccess, tenantSlug, token],
  );

  const handleExecuteRecommendation = useCallback(
    async (actionId: string, title: string) => {
      if (!tenantSlug || !token || !selectedSessionId) return;
      try {
        setWorkingActionKey(`execute:${actionId}`);
        await ehrApi.executePostVisitRecommendation(
          selectedSessionId,
          actionId,
          { note: `Executed from doctor workspace: ${title}` },
          token,
          tenantSlug,
        );
        showSuccess('Recommendation executed', title);
        await Promise.all([
          loadSessions(),
          loadDraft(selectedSessionId),
          loadDiarization(selectedSessionId),
          loadIntraVisitAlerts(selectedSessionId),
        ]);
      } catch {
        showError('Execution failed', `Unable to execute recommendation: ${title}`);
      } finally {
        setWorkingActionKey(null);
      }
    },
    [loadDiarization, loadDraft, loadIntraVisitAlerts, loadSessions, selectedSessionId, showError, showSuccess, tenantSlug, token],
  );

  const handlePublish = useCallback(async () => {
    if (!tenantSlug || !token || !selectedSessionId) return;
    try {
      setWorkingActionKey('publish');
      const acknowledgedSupersededCitationIds = supersededCitations
        .filter(
          (citation) =>
            citation.acknowledgedSuperseded === true || supersededCitationAcknowledgements[citation.id] === true,
        )
        .map((citation) => citation.id);
      await ehrApi.publishPostVisitSession(
        selectedSessionId,
        {
          note: 'Published from doctor workspace',
          publishMetadata: { source: 'doctor_workspace' },
          acknowledgedSupersededCitationIds,
        },
        token,
        tenantSlug,
      );
      showSuccess('Published', 'Post-visit companion summary is now available to patient portal.');
      await Promise.all([
        loadSessions(),
        loadDraft(selectedSessionId),
        loadDiarization(selectedSessionId),
        loadIntraVisitAlerts(selectedSessionId),
      ]);
    } catch (error: any) {
      const details =
        String(error?.response?.data?.message || '').trim() ||
        'Review visit summary and recommendation bundle first, then publish again.';
      showError(
        'Publish blocked',
        details,
      );
    } finally {
      setWorkingActionKey(null);
    }
  }, [
    loadDiarization,
    loadDraft,
    loadSessions,
    loadIntraVisitAlerts,
    selectedSessionId,
    showError,
    showSuccess,
    supersededCitationAcknowledgements,
    supersededCitations,
    tenantSlug,
    token,
  ]);

  const handleLoadFhir = useCallback(async () => {
    if (!tenantSlug || !token || !selectedSessionId) return;
    try {
      setWorkingActionKey('fhir');
      const response = await ehrApi.getPostVisitSessionFhir(selectedSessionId, token, tenantSlug);
      setFhirPreview(response.data || {});
      showSuccess('FHIR projection loaded', 'FHIR export preview is ready.');
    } catch {
      showError('FHIR projection failed', 'Unable to generate FHIR projection for this session.');
    } finally {
      setWorkingActionKey(null);
    }
  }, [selectedSessionId, showError, showSuccess, tenantSlug, token]);

  const handleLoadMobile = useCallback(async () => {
    if (!tenantSlug || !token || !selectedSessionId) return;
    try {
      setWorkingActionKey('mobile');
      const [contractResponse, eventsResponse] = await Promise.all([
        ehrApi.getPostVisitMobileContract(selectedSessionId, token, tenantSlug, 'v1'),
        ehrApi.getPostVisitMobileEvents(selectedSessionId, token, tenantSlug, { version: 'v1', limit: 30, offset: 0 }),
      ]);
      setMobilePreview({
        contract: contractResponse.data || {},
        events: eventsResponse.data || {},
      });
      showSuccess('Mobile contract loaded', 'Mobile payload and event feed previews are ready.');
    } catch {
      showError('Mobile contract failed', 'Unable to fetch mobile contract/events for this session.');
    } finally {
      setWorkingActionKey(null);
    }
  }, [selectedSessionId, showError, showSuccess, tenantSlug, token]);

  if (!tenantSlug) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-600">Tenant context is missing.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/30 to-white p-4 sm:p-6">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <header className="rounded-2xl border border-cyan-100 bg-white/90 p-4 sm:p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-cyan-100 p-2">
                <Rocket className="h-5 w-5 text-cyan-700" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Post-Visit Doctor Workspace</h1>
                <p className="text-sm text-slate-600">
                  Review artifacts, execute recommendation bundles, publish patient companion output, and validate interop contracts.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/ehr/${tenantSlug}/doctor`)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="mr-1 inline h-4 w-4" />
              Back to Doctor Dashboard
            </button>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
                <FileCog className="h-4 w-4 text-cyan-700" />
                Create Session
              </h2>
              <div className="space-y-2">
                <input
                  value={newPatientId}
                  onChange={(event) => setNewPatientId(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Patient ID"
                />
                <input
                  value={newAppointmentId}
                  onChange={(event) => setNewAppointmentId(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Appointment ID (optional)"
                />
                <input
                  value={newConsultationId}
                  onChange={(event) => setNewConsultationId(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Consultation ID (optional)"
                />
                <select
                  value={newSourceType}
                  onChange={(event) => setNewSourceType(event.target.value as 'in_person' | 'telemedicine' | 'hybrid')}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="in_person">In person</option>
                  <option value="telemedicine">Telemedicine</option>
                  <option value="hybrid">Hybrid</option>
                </select>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    Optional Audio Ingestion
                  </p>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(event) => setNewSessionAudioFile(event.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-cyan-600 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-white"
                  />
                  {newSessionAudioFile && (
                    <p className="mt-1 text-[11px] text-slate-600">File: {newSessionAudioFile.name}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleCreateSession}
                  disabled={workingActionKey === 'create-session'}
                  className="w-full rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60"
                >
                  {workingActionKey === 'create-session'
                    ? (newSessionAudioFile ? 'Creating + transcribing…' : 'Creating…')
                    : (newSessionAudioFile ? 'Create Session + Auto Transcribe' : 'Create Session')}
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">Sessions</h2>
                <button
                  type="button"
                  onClick={loadSessions}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <RefreshCw className={`mr-1 inline h-3.5 w-3.5 ${sessionsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'all' | SessionStatus)}
                className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status === 'all' ? 'All statuses' : status.replace('_', ' ')}
                  </option>
                ))}
              </select>
              <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
                {sessionsLoading && <p className="text-xs text-slate-500">Loading sessions…</p>}
                {!sessionsLoading && sessions.length === 0 && (
                  <p className="text-xs text-slate-500">No post-visit sessions matched this filter.</p>
                )}
                {sessions.map((session) => {
                  const isSelected = session.id === selectedSessionId;
                  return (
                    <button
                      type="button"
                      key={session.id}
                      onClick={() => setSelectedSessionId(session.id)}
                      className={`w-full rounded-xl border px-3 py-2 text-left ${
                        isSelected
                          ? 'border-cyan-300 bg-cyan-50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <p className="text-xs font-semibold text-slate-800">
                        {(session.patient?.firstName || 'Unknown')} {(session.patient?.lastName || '')}{' '}
                        {session.patient?.patientNumber ? `(${session.patient.patientNumber})` : ''}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">Session: {session.id}</p>
                      <p className="text-[11px] text-slate-500">
                        {session.status.replace('_', ' ')} • {session.sourceType || 'n/a'} • updated {formatDate(session.updatedAt)}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Segments {session.telemetry?.transcriptSegmentCount || 0} • Companion msgs {session.telemetry?.companionMessageCount || 0}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>
          </aside>

          <main className="space-y-4">
            {!selectedSession && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
                Select a session to open doctor review, execution, and publish controls.
              </section>
            )}

            {selectedSession && (
              <>
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">
                        {(selectedSession.patient?.firstName || 'Unknown')} {(selectedSession.patient?.lastName || '')}
                      </h2>
                      <p className="text-xs text-slate-500">Session {selectedSession.id}</p>
                      <p className="text-xs text-slate-500">
                        Status {selectedSession.status.replace('_', ' ')} • Source {selectedSession.sourceType || 'n/a'} • Started {formatDate(selectedSession.startedAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleRegenerateDraft}
                        disabled={workingActionKey === 'regenerate-draft'}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        <RefreshCw className={`mr-1 inline h-3.5 w-3.5 ${workingActionKey === 'regenerate-draft' ? 'animate-spin' : ''}`} />
                        Regenerate
                      </button>
                      <button
                        type="button"
                        onClick={handleLoadFhir}
                        disabled={workingActionKey === 'fhir'}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        <FileJson className="mr-1 inline h-3.5 w-3.5" />
                        FHIR
                      </button>
                      <button
                        type="button"
                        onClick={handleLoadMobile}
                        disabled={workingActionKey === 'mobile'}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        <ClipboardList className="mr-1 inline h-3.5 w-3.5" />
                        Mobile
                      </button>
                      <button
                        type="button"
                        onClick={handlePublish}
                        disabled={workingActionKey === 'publish' || unresolvedSupersededCitationCount > 0}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
                        {unresolvedSupersededCitationCount > 0
                          ? `Publish (ack ${unresolvedSupersededCitationCount})`
                          : 'Publish'}
                      </button>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="mb-3 text-sm font-bold text-slate-900">Transcription Pipeline</h3>
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 sm:col-span-2">
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                          Session Audio (Upload Or Record Live)
                        </p>
                        {!isRecordingAudio && (
                          <button
                            type="button"
                            onClick={startInBrowserRecording}
                            className="mb-2 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-100"
                          >
                            <Mic className="mr-1 inline h-3.5 w-3.5" />
                            Start In-Browser Recording
                          </button>
                        )}
                        {isRecordingAudio && (
                          <div className="mb-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-2">
                            <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-rose-700">
                              <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-rose-600" />
                              Recording {formatDuration(recordingDurationMs)}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {isRecordingPaused ? (
                                <button
                                  type="button"
                                  onClick={resumeInBrowserRecording}
                                  className="rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                                >
                                  <Play className="mr-1 inline h-3 w-3" />
                                  Resume
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={pauseInBrowserRecording}
                                  className="rounded-md bg-amber-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-amber-700"
                                >
                                  <Pause className="mr-1 inline h-3 w-3" />
                                  Pause
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={stopInBrowserRecording}
                                className="rounded-md bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-700"
                              >
                                <Square className="mr-1 inline h-3 w-3" />
                                Stop
                              </button>
                              <button
                                type="button"
                                onClick={cancelInBrowserRecording}
                                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="audio/*"
                          onChange={(event) => setSessionTranscribeFile(event.target.files?.[0] || null)}
                          disabled={isRecordingAudio}
                          className="w-full text-xs text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-cyan-600 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-white"
                        />
                        {sessionTranscribeFile && (
                          <p className="mt-1 text-[11px] text-slate-600">File: {sessionTranscribeFile.name}</p>
                        )}
                        {!sessionTranscribeFile && !isRecordingAudio && (
                          <p className="mt-1 text-[11px] text-slate-500">
                            Record in browser or upload an audio file, then run transcription.
                          </p>
                        )}
                      </div>
                      <label className="text-xs text-slate-600">
                        Language
                        <select
                          value={transcribeLanguage}
                          onChange={(event) => setTranscribeLanguage(event.target.value as 'en' | 'sn' | 'nd' | 'auto')}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                        >
                          <option value="auto">Auto detect</option>
                          <option value="en">English</option>
                          <option value="sn">Shona</option>
                          <option value="nd">Ndebele</option>
                        </select>
                      </label>
                      <label className="text-xs text-slate-600">
                        Temperature
                        <input
                          value={transcribeTemperature}
                          onChange={(event) => setTranscribeTemperature(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                          placeholder="0"
                        />
                      </label>
                      <label className="text-xs text-slate-600 sm:col-span-2">
                        Prompt
                        <textarea
                          value={transcribePrompt}
                          onChange={(event) => setTranscribePrompt(event.target.value)}
                          className="mt-1 h-16 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={handleTranscribeSelectedSession}
                      disabled={workingActionKey === 'transcribe-session' || !sessionTranscribeFile || isRecordingAudio}
                      className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-700 disabled:opacity-60"
                    >
                      <Mic className="mr-1 inline h-3.5 w-3.5" />
                      {workingActionKey === 'transcribe-session' ? 'Transcribing…' : 'Transcribe + Generate Draft'}
                    </button>
                  </div>
                </section>

                <section className="rounded-2xl border border-rose-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900">Live Intra-Visit Safety Alert Bar</h3>
                    <button
                      type="button"
                      onClick={() => selectedSessionId && loadIntraVisitAlerts(selectedSessionId)}
                      disabled={!selectedSessionId || intraVisitAlertsLoading}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      <RefreshCw className={`mr-1 inline h-3.5 w-3.5 ${intraVisitAlertsLoading ? 'animate-spin' : ''}`} />
                      Refresh alerts
                    </button>
                  </div>

                  {!intraVisitFeatureEnabled && (
                    <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Feature disabled. Enable <code>FEATURE_POSTVISIT_INTRAVISIT_ALERTS</code> to activate streamed transcript safety checks.
                    </p>
                  )}

                  <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={streamingAnalysisEnabled}
                          onChange={(event) => setStreamingAnalysisEnabled(event.target.checked)}
                        />
                        Stream recorder chunks to live alert engine
                      </label>
                      <span className="text-[11px] text-slate-600">
                        Stream status: {streamingAnalysisStatus}
                        {lastStreamingAnalyzedAt ? ` • last analyzed ${formatDate(lastStreamingAnalyzedAt)}` : ''}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      While recording, audio chunks are transcribed and screened in near real time for critical safety signals.
                    </p>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                    <label className="text-xs text-slate-600">
                      Analyze live transcript chunk
                      <textarea
                        value={liveTranscriptChunk}
                        onChange={(event) => setLiveTranscriptChunk(event.target.value)}
                        className="mt-1 h-20 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                        placeholder="Paste or stream transcript text for immediate safety analysis."
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleAnalyzeIntraVisitChunk}
                      disabled={!intraVisitFeatureEnabled || workingActionKey === 'intravisit-analyze' || !liveTranscriptChunk.trim()}
                      className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                    >
                      <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
                      {workingActionKey === 'intravisit-analyze' ? 'Analyzing…' : 'Analyze Chunk'}
                    </button>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-5">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">Open: {intraVisitSummary.openCount}</div>
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
                      Critical: {intraVisitSummary.criticalOpenCount}
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
                      High: {intraVisitSummary.highOpenCount}
                    </div>
                    <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-cyan-700">
                      Moderate: {intraVisitSummary.moderateOpenCount}
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">Total: {intraVisitSummary.total}</div>
                  </div>

                  {liveStreamTranscript.trim().length > 0 && (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Live streamed transcript feed</p>
                        <button
                          type="button"
                          onClick={() => setLiveStreamTranscript('')}
                          className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Clear
                        </button>
                      </div>
                      <pre className="max-h-28 overflow-auto whitespace-pre-wrap rounded border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-700">
                        {liveStreamTranscript}
                      </pre>
                    </div>
                  )}

                  <div className="mt-3 space-y-2">
                    {intraVisitAlertsLoading && <p className="text-xs text-slate-500">Loading intra-visit alerts…</p>}
                    {!intraVisitAlertsLoading && intraVisitAlerts.length === 0 && (
                      <p className="text-xs text-slate-500">No intra-visit alerts recorded for this session yet.</p>
                    )}
                    {intraVisitAlerts.map((item) => {
                      const isOpen = item.status === 'open';
                      const confidenceLabel =
                        item.confidence === null || item.confidence === undefined
                          ? 'n/a'
                          : `${Math.round(Math.max(0, Math.min(1, Number(item.confidence))) * 100)}%`;
                      const severityClasses =
                        item.severity === 'critical'
                          ? 'border-rose-300 bg-rose-50/70'
                          : item.severity === 'high'
                            ? 'border-amber-300 bg-amber-50/70'
                            : 'border-cyan-300 bg-cyan-50/70';

                      return (
                        <article key={item.id} className={`rounded-xl border p-3 ${severityClasses}`}>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{item.alertMessage}</p>
                              <p className="text-[11px] text-slate-600">
                                {item.severity.toUpperCase()} • {item.status} • confidence {confidenceLabel} • detected {formatDate(item.detectedAt)}
                              </p>
                              {item.suggestedAction && (
                                <p className="mt-1 text-[11px] text-slate-700">Action: {item.suggestedAction}</p>
                              )}
                              {item.signalText && (
                                <p className="mt-1 line-clamp-2 text-[11px] text-slate-600">Signal: {item.signalText}</p>
                              )}
                              {Array.isArray(item.triggerTerms) && item.triggerTerms.length > 0 && (
                                <p className="mt-1 text-[11px] text-slate-600">Triggers: {item.triggerTerms.join(', ')}</p>
                              )}
                            </div>
                            {isOpen && (
                              <div className="flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleResolveIntraVisitAlert(item.id, 'confirmed')}
                                  disabled={workingActionKey === `intravisit-resolve:${item.id}:confirmed`}
                                  className="rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleResolveIntraVisitAlert(item.id, 'dismissed')}
                                  disabled={workingActionKey === `intravisit-resolve:${item.id}:dismissed`}
                                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                >
                                  Dismiss
                                </button>
                              </div>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900">Document Intelligence (OCR to FHIR)</h3>
                    <button
                      type="button"
                      onClick={() => selectedSessionId && loadDocumentIntelligence(selectedSessionId)}
                      disabled={!selectedSessionId || documentIntelligenceLoading}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      <RefreshCw className={`mr-1 inline h-3.5 w-3.5 ${documentIntelligenceLoading ? 'animate-spin' : ''}`} />
                      Refresh docs
                    </button>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="text-xs text-slate-600 sm:col-span-2">
                        Upload document
                        <input
                          type="file"
                          accept=".pdf,image/*,.txt,.csv,.json"
                          onChange={(event) => setDocumentIntelligenceFile(event.target.files?.[0] || null)}
                          className="mt-1 w-full text-xs text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-cyan-600 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-white"
                        />
                      </label>
                      <label className="text-xs text-slate-600">
                        Document type
                        <select
                          value={documentIntelligenceType}
                          onChange={(event) =>
                            setDocumentIntelligenceType(
                              event.target.value as 'lab_report' | 'prescription' | 'imaging_report' | 'discharge_summary' | 'other',
                            )
                          }
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                        >
                          {DOCUMENT_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs text-slate-600">
                        Language hint
                        <input
                          value={documentIntelligenceLanguage}
                          onChange={(event) => setDocumentIntelligenceLanguage(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                          placeholder="en"
                        />
                      </label>
                      <label className="text-xs text-slate-600 sm:col-span-2">
                        Ingestion note (optional)
                        <input
                          value={documentIntelligenceNote}
                          onChange={(event) => setDocumentIntelligenceNote(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                          placeholder="e.g. uploaded from lab desk handover"
                        />
                      </label>
                      {documentIntelligenceFile && (
                        <p className="text-[11px] text-slate-600 sm:col-span-2">Selected file: {documentIntelligenceFile.name}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleUploadDocumentIntelligence}
                      disabled={workingActionKey === 'upload-document-intelligence' || !documentIntelligenceFile}
                      className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-700 disabled:opacity-60"
                    >
                      <Upload className="mr-1 inline h-3.5 w-3.5" />
                      {workingActionKey === 'upload-document-intelligence' ? 'Ingesting…' : 'Ingest Document'}
                    </button>
                  </div>

                  {labObservationTrends.length > 0 && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Lab trend chart (recent)</h4>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {labObservationTrends.map((trend) => {
                          const spread = Math.max(0.000001, trend.max - trend.min);
                          return (
                            <article key={trend.key} className="rounded-lg border border-slate-200 bg-white p-2.5">
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold text-slate-800">{trend.name}</p>
                                <p className="text-[11px] text-slate-500">
                                  Latest: {trend.latest}
                                  {trend.unit ? ` ${trend.unit}` : ''}
                                </p>
                              </div>
                              <div className="mb-1 flex h-10 items-end gap-1">
                                {trend.points.map((point, index) => {
                                  const normalizedHeight = ((point.value - trend.min) / spread) * 100;
                                  const safeHeight = Math.max(10, Math.round(Number.isFinite(normalizedHeight) ? normalizedHeight : 10));
                                  return (
                                    <div
                                      key={`${trend.key}-${index}`}
                                      className="w-2.5 rounded-sm bg-cyan-500/80"
                                      style={{ height: `${safeHeight}%` }}
                                      title={`${point.value}${point.unit ? ` ${point.unit}` : ''} @ ${formatDate(point.createdAt)}`}
                                    />
                                  );
                                })}
                              </div>
                              <p className="text-[11px] text-slate-500">
                                {trend.previous === null || trend.latest === null
                                  ? 'Only one data point so far.'
                                  : `Delta: ${(trend.latest - trend.previous).toFixed(2)}${trend.unit ? ` ${trend.unit}` : ''}`}
                              </p>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 space-y-2">
                    {documentIntelligenceLoading && (
                      <p className="text-xs text-slate-500">Loading document intelligence extracts…</p>
                    )}
                    {!documentIntelligenceLoading && effectiveDocumentIntelligence.length === 0 && (
                      <p className="text-xs text-slate-500">
                        No document intelligence ingests yet. Upload a report/prescription image or PDF to extract and map FHIR.
                      </p>
                    )}
                    {effectiveDocumentIntelligence.map((item) => {
                      const observations = Array.isArray(item.structured?.observations) ? item.structured?.observations : [];
                      const medications = Array.isArray(item.structured?.medications) ? item.structured?.medications : [];
                      const findings = Array.isArray(item.structured?.findings) ? item.structured?.findings : [];
                      return (
                        <article key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{item.documentName}</p>
                              <p className="text-[11px] text-slate-500">
                                {item.documentType.replace('_', ' ')} • status {item.extractionStatus} • uploaded {formatDate(item.createdAt)}
                              </p>
                              <p className="mt-1 text-[11px] text-slate-500">
                                OCR {item.ocrEngine || 'n/a'} • confidence{' '}
                                {item.ocrConfidence === null || item.ocrConfidence === undefined
                                  ? 'n/a'
                                  : `${Math.round(item.ocrConfidence * 100)}%`}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {item.extractionStatus === 'duplicate' && (
                                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                                  duplicate
                                </span>
                              )}
                              {item.criticalDetected && (
                                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                                  critical detected
                                </span>
                              )}
                              {item.criticalRouted && (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                  escalation routed
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="mt-2 grid gap-2 text-[11px] text-slate-600 sm:grid-cols-3">
                            <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                              Observations: {observations.length}
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                              Medications: {medications.length}
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                              Findings: {findings.length}
                            </div>
                          </div>
                          {item.extractionStatus === 'duplicate' && item.duplicateSimilarity !== null && item.duplicateSimilarity !== undefined && (
                            <p className="mt-2 text-[11px] text-slate-500">
                              Similarity: {(item.duplicateSimilarity * 100).toFixed(1)}%
                              {item.duplicateOfDocumentId ? ` • duplicate of ${item.duplicateOfDocumentId}` : ''}
                            </p>
                          )}
                          {item.criticalDetected && (
                            <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-rose-700">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Review clinician escalation {item.escalationEventId ? `(${item.escalationEventId})` : 'event'} for follow-up.
                            </p>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900">Diarization Review</h3>
                    {diarizationLoading && <span className="text-xs text-slate-500">Loading diarization…</span>}
                  </div>

                  {!diarizationLoading && !diarizationData && (
                    <p className="text-xs text-slate-500">
                      Diarization output is not available for this session yet. Run transcription to refresh segments.
                    </p>
                  )}

                  {diarizationData && (
                    <>
                      <div className="mb-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-5">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                          Segments: {diarizationData.summary.totalSegments}
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-amber-50 px-3 py-2 text-amber-700">
                          Needs review: {diarizationData.summary.unresolvedSegments}
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-cyan-50 px-3 py-2">
                          Doctor/Patient: {diarizationData.summary.doctorSegments}/{diarizationData.summary.patientSegments}
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                          Unknown: {diarizationData.summary.unknownSegments}
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                          Threshold: {(diarizationData.confidenceThreshold * 100).toFixed(0)}%
                        </div>
                      </div>

                      {!diarizationData.reviewEnabled && (
                        <p className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                          Review gate is disabled by feature flag. Enable <code>FEATURE_POSTVISIT_DIARIZATION_REVIEW</code> to enforce signoff.
                        </p>
                      )}

                      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                        {diarizationData.segments.length === 0 && (
                          <p className="text-xs text-slate-500">No transcript segments available.</p>
                        )}
                        {diarizationData.segments.map((segment) => {
                          const selectedRole = pendingSpeakerRole[segment.id] || segment.speakerRole;
                          const hasPendingChange = selectedRole !== segment.speakerRole;
                          const confidence = segment.diarizationConfidence;
                          const confidenceLabel =
                            confidence === null || confidence === undefined
                              ? 'n/a'
                              : `${Math.round(Math.max(0, Math.min(1, confidence)) * 100)}%`;
                          return (
                            <article
                              key={segment.id}
                              className={`rounded-xl border px-3 py-2 ${
                                segment.needsReview
                                  ? 'border-amber-300 bg-amber-50/70'
                                  : 'border-slate-200 bg-slate-50/60'
                              }`}
                            >
                              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-semibold text-slate-700">#{segment.order + 1}</span>
                                  <span className="text-[11px] text-slate-500">
                                    {formatSecondMark(segment.start)} - {formatSecondMark(segment.end)}
                                  </span>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                      segment.speakerRole === 'doctor'
                                        ? 'bg-cyan-100 text-cyan-700'
                                        : segment.speakerRole === 'patient'
                                          ? 'bg-emerald-100 text-emerald-700'
                                          : 'bg-slate-200 text-slate-700'
                                    }`}
                                  >
                                    {segment.speakerRole}
                                  </span>
                                  {segment.needsReview && (
                                    <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                                      review required
                                    </span>
                                  )}
                                  <span className="text-[11px] text-slate-500">confidence {confidenceLabel}</span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <select
                                    value={selectedRole}
                                    onChange={(event) =>
                                      setPendingSpeakerRole((prev) => ({
                                        ...prev,
                                        [segment.id]: event.target.value as 'doctor' | 'patient' | 'unknown',
                                      }))
                                    }
                                    className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                                  >
                                    <option value="doctor">doctor</option>
                                    <option value="patient">patient</option>
                                    <option value="unknown">unknown</option>
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => handleReassignDiarization(segment, selectedRole)}
                                    disabled={!hasPendingChange || workingActionKey === `diarization:${segment.id}`}
                                    className="rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                                  >
                                    {workingActionKey === `diarization:${segment.id}` ? 'Saving…' : 'Apply'}
                                  </button>
                                </div>
                              </div>
                              <p className="text-xs text-slate-700">{segment.text}</p>
                            </article>
                          );
                        })}
                      </div>
                    </>
                  )}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900">Artifact Review</h3>
                    {draftLoading && <span className="text-xs text-slate-500">Loading draft…</span>}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Visit Summary</p>
                      <p className="mt-1 text-xs text-slate-600">Status: {visitSummaryArtifact?.status || 'missing'}</p>
                      <p className="mt-2 text-sm text-slate-800">
                        {String(visitSummaryArtifact?.content?.plain_language_summary || '').trim() || 'No generated summary yet.'}
                      </p>
                      {Array.isArray(visitSummaryArtifact?.content?.teach_back_questions) &&
                        visitSummaryArtifact?.content?.teach_back_questions.length > 0 && (
                          <div className="mt-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                              Teach-back prompts
                            </p>
                            <p className="mt-1 text-[11px] text-slate-700">
                              {visitSummaryArtifact.content.teach_back_questions.slice(0, 3).join(' | ')}
                            </p>
                          </div>
                        )}
                      <button
                        type="button"
                        onClick={() => handleReviewArtifact('visit_summary')}
                        disabled={workingActionKey === 'review:visit_summary' || !visitSummaryArtifact}
                        className="mt-3 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                        Accept Summary
                      </button>
                    </article>

                    <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Recommendation Bundle</p>
                      <p className="mt-1 text-xs text-slate-600">Status: {recommendationArtifact?.status || 'missing'}</p>
                      <p className="mt-2 text-sm text-slate-800">
                        {recommendationItems.length} recommendations ready for execution and patient checklist publication.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleReviewArtifact('recommendation_bundle')}
                        disabled={workingActionKey === 'review:recommendation_bundle' || !recommendationArtifact}
                        className="mt-3 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                        Accept Bundle
                      </button>
                    </article>
                  </div>
                </section>

                {supersededCitations.length > 0 && (
                  <section className="rounded-2xl border border-amber-300 bg-amber-50/60 p-4 shadow-sm">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-amber-900">Superseded Citation Acknowledgement</h3>
                      <span className="text-xs font-semibold text-amber-800">
                        Pending: {unresolvedSupersededCitationCount}
                      </span>
                    </div>
                    <p className="mb-3 text-xs text-amber-900">
                      These citations are marked superseded. Doctor acknowledgement is required before publish.
                    </p>
                    <div className="space-y-2">
                      {supersededCitations.map((citation) => {
                        const acknowledged =
                          citation.acknowledgedSuperseded === true ||
                          supersededCitationAcknowledgements[citation.id] === true;
                        return (
                          <label
                            key={citation.id}
                            className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-200 bg-white/80 p-2"
                          >
                            <input
                              type="checkbox"
                              checked={acknowledged}
                              onChange={(event) =>
                                setSupersededCitationAcknowledgements((prev) => ({
                                  ...prev,
                                  [citation.id]: event.target.checked,
                                }))
                              }
                              className="mt-0.5"
                            />
                            <div>
                              <p className="text-xs font-semibold text-amber-900">{citation.label || citation.guidelineId || citation.id}</p>
                              <p className="text-[11px] text-amber-800">
                                Guideline {citation.guidelineId || 'n/a'}
                                {citation.supersededByGuidelineId ? ` -> ${citation.supersededByGuidelineId}` : ''}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </section>
                )}

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="mb-3 text-sm font-bold text-slate-900">Executable Recommendation Bundle</h3>
                  <div className="space-y-2">
                    {recommendationItems.length === 0 && (
                      <p className="text-xs text-slate-500">No recommendation items generated yet. Regenerate draft after transcription.</p>
                    )}
                    {recommendationItems.map((item: any) => {
                      const actionId = String(item?.id || item?.action_id || '');
                      const executionStatus = String(item?.execution?.status || '').toLowerCase();
                      const alreadyExecuted = executionStatus === 'executed';
                      const title = String(item?.title || actionId || 'Recommendation');
                      const medicationIntelligence = item?.context?.medicationIntelligence || null;
                      const medicationHighestSeverity = String(medicationIntelligence?.highestSeverity || '').toLowerCase();
                      const medicationHighRiskCount =
                        Number(medicationIntelligence?.highRiskCount ?? item?.context?.highRiskCount ?? 0) || 0;
                      const medicationInteractionCount = Array.isArray(medicationIntelligence?.interactions)
                        ? medicationIntelligence.interactions.length
                        : 0;
                      const medicationBeersCount = Array.isArray(medicationIntelligence?.beersAlerts)
                        ? medicationIntelligence.beersAlerts.length
                        : 0;
                      const medicationRenalCount = Array.isArray(medicationIntelligence?.renalAlerts)
                        ? medicationIntelligence.renalAlerts.length
                        : 0;
                      const itemCitations = Array.isArray(item?.citations) ? item.citations : [];
                      const weakCitationCount = itemCitations.filter((citation: any) => {
                        const score = Number(citation?.relevance_score ?? citation?.relevanceScore);
                        return Number.isFinite(score) && score < 0.55;
                      }).length;
                      const supersededCitationCount = itemCitations.filter(
                        (citation: any) => citation?.is_superseded === true || citation?.isSuperseded === true,
                      ).length;
                      return (
                        <article key={actionId} className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{title}</p>
                              <p className="text-xs text-slate-600">{String(item?.description || '').trim() || 'No description provided.'}</p>
                              <p className="mt-1 text-[11px] text-slate-500">
                                Urgency {String(item?.urgency || 'routine')} • Action {String(item?.action_type || 'follow_up')} • Citations {Array.isArray(item?.citations) ? item.citations.length : 0}
                              </p>
                              {(weakCitationCount > 0 || supersededCitationCount > 0) && (
                                <p className="mt-1 text-[11px] font-semibold text-amber-700">
                                  {weakCitationCount > 0 ? `${weakCitationCount} weak relevance` : ''}
                                  {weakCitationCount > 0 && supersededCitationCount > 0 ? ' • ' : ''}
                                  {supersededCitationCount > 0 ? `${supersededCitationCount} superseded` : ''}
                                </p>
                              )}
                              {medicationIntelligence && (
                                <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-700">
                                  <p className="font-semibold text-slate-800">
                                    Medication intelligence
                                    {medicationHighestSeverity ? ` • severity ${medicationHighestSeverity}` : ''}
                                    {medicationHighRiskCount > 0 ? ` • high-risk ${medicationHighRiskCount}` : ''}
                                  </p>
                                  <p className="mt-1 text-slate-600">
                                    Interactions {medicationInteractionCount} • Beers {medicationBeersCount} • Renal {medicationRenalCount}
                                  </p>
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleExecuteRecommendation(actionId, title)}
                              disabled={alreadyExecuted || workingActionKey === `execute:${actionId}` || !actionId}
                              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                                alreadyExecuted
                                  ? 'cursor-not-allowed bg-emerald-100 text-emerald-700'
                                  : 'bg-cyan-600 text-white hover:bg-cyan-700'
                              }`}
                            >
                              {alreadyExecuted ? 'Executed' : workingActionKey === `execute:${actionId}` ? 'Executing…' : 'Execute'}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="mb-2 text-sm font-bold text-slate-900">Clinical Context Snapshot</h3>
                  <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-5">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      Transcript segments: {draftData?.transcript?.segmentCount || 0}
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      Extracted entities: {draftData?.extractedEntities?.length || 0}
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      Review actions: {draftData?.reviewActions?.length || 0}
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      Specialty SOAP:{' '}
                      {specialtySoapValidation
                        ? `${String(specialtySoapValidation.specialty || 'general_practice').replace('_', ' ')} • ${
                            specialtySoapValidation.isComplete ? 'complete' : 'incomplete'
                          }`
                        : 'n/a'}
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      Literacy:{' '}
                      {visitSummaryArtifact?.content?.literacy_score !== undefined
                        ? `${visitSummaryArtifact?.content?.literacy_score} (${visitSummaryArtifact?.content?.literacy_level || 'n/a'})`
                        : 'n/a'}
                    </div>
                  </div>
                </section>

                {(fhirPreview || mobilePreview) && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h3 className="mb-3 text-sm font-bold text-slate-900">Interop Preview</h3>
                    <div className="grid gap-3 lg:grid-cols-2">
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">FHIR</p>
                        <pre className="max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 text-[11px] text-emerald-200">
                          {JSON.stringify(fhirPreview || {}, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Mobile Contract + Events</p>
                        <pre className="max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 text-[11px] text-cyan-200">
                          {JSON.stringify(mobilePreview || {}, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </section>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default PostVisitDoctorWorkspace;
