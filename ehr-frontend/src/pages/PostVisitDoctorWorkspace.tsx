import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
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

const STATUS_OPTIONS: Array<'all' | SessionStatus> = [
  'all',
  'captured',
  'processing',
  'draft_ready',
  'doctor_reviewed',
  'published',
  'closed',
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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<number | null>(null);
  const recordingStartRef = useRef<number>(0);
  const recordingCancelledRef = useRef<boolean>(false);

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

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (!selectedSessionId) return;
    loadDraft(selectedSessionId);
    loadDiarization(selectedSessionId);
    setSessionTranscribeFile(null);
  }, [loadDiarization, loadDraft, selectedSessionId]);

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

      const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg'];
      const selectedMimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = selectedMimeType ? new MediaRecorder(stream, { mimeType: selectedMimeType }) : new MediaRecorder(stream);

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
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
          setRecordingDurationMs(0);
          return;
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
      recordingStartRef.current = Date.now();
      recorder.start(1000);
      recordingIntervalRef.current = window.setInterval(() => {
        setRecordingDurationMs(Date.now() - recordingStartRef.current);
      }, 1000);
    } catch {
      stopAudioStream();
      showError('Microphone access failed', 'Could not access microphone. Check browser permission settings.');
    }
  }, [clearRecordingInterval, selectedSessionId, showError, showSuccess, stopAudioStream]);

  const pauseInBrowserRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    recorder.pause();
    setIsRecordingPaused(true);
  }, []);

  const resumeInBrowserRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'paused') return;
    recorder.resume();
    setIsRecordingPaused(false);
    recordingStartRef.current = Date.now() - recordingDurationMs;
  }, [recordingDurationMs]);

  const stopInBrowserRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    recorder.stop();
  }, []);

  const cancelInBrowserRecording = useCallback(() => {
    recordingCancelledRef.current = true;
    setSessionTranscribeFile(null);
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
      await Promise.all([loadDraft(createdId), loadDiarization(createdId)]);
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
      await Promise.all([loadSessions(), loadDraft(selectedSessionId), loadDiarization(selectedSessionId)]);
    } catch {
      showError('Draft regeneration failed', 'Could not regenerate post-visit artifacts.');
    } finally {
      setWorkingActionKey(null);
    }
  }, [loadDiarization, loadDraft, loadSessions, selectedSessionId, showError, showSuccess, tenantSlug, token]);

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
      await Promise.all([loadSessions(), loadDraft(selectedSessionId), loadDiarization(selectedSessionId)]);
    } catch {
      showError('Session transcription failed', 'Unable to transcribe selected audio for this session.');
    } finally {
      setWorkingActionKey(null);
    }
  }, [
    loadDraft,
    loadDiarization,
    loadSessions,
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
        await Promise.all([loadSessions(), loadDraft(selectedSessionId), loadDiarization(selectedSessionId)]);
      } catch {
        showError('Review failed', `Unable to review ${artifactType.replace('_', ' ')}.`);
      } finally {
        setWorkingActionKey(null);
      }
    },
    [loadDiarization, loadDraft, loadSessions, selectedSessionId, showError, showSuccess, tenantSlug, token],
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
        await Promise.all([loadSessions(), loadDraft(selectedSessionId), loadDiarization(selectedSessionId)]);
      } catch {
        showError('Execution failed', `Unable to execute recommendation: ${title}`);
      } finally {
        setWorkingActionKey(null);
      }
    },
    [loadDiarization, loadDraft, loadSessions, selectedSessionId, showError, showSuccess, tenantSlug, token],
  );

  const handlePublish = useCallback(async () => {
    if (!tenantSlug || !token || !selectedSessionId) return;
    try {
      setWorkingActionKey('publish');
      await ehrApi.publishPostVisitSession(
        selectedSessionId,
        {
          note: 'Published from doctor workspace',
          publishMetadata: { source: 'doctor_workspace' },
        },
        token,
        tenantSlug,
      );
      showSuccess('Published', 'Post-visit companion summary is now available to patient portal.');
      await Promise.all([loadSessions(), loadDraft(selectedSessionId), loadDiarization(selectedSessionId)]);
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
  }, [loadDiarization, loadDraft, loadSessions, selectedSessionId, showError, showSuccess, tenantSlug, token]);

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
                        disabled={workingActionKey === 'publish'}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
                        Publish
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
                      return (
                        <article key={actionId} className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{title}</p>
                              <p className="text-xs text-slate-600">{String(item?.description || '').trim() || 'No description provided.'}</p>
                              <p className="mt-1 text-[11px] text-slate-500">
                                Urgency {String(item?.urgency || 'routine')} • Action {String(item?.action_type || 'follow_up')} • Citations {Array.isArray(item?.citations) ? item.citations.length : 0}
                              </p>
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
                  <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      Transcript segments: {draftData?.transcript?.segmentCount || 0}
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      Extracted entities: {draftData?.extractedEntities?.length || 0}
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      Review actions: {draftData?.reviewActions?.length || 0}
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
