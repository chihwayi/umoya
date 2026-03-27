import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Mic, MicOff, Pause, Play, Square, Pill, Stethoscope,
  AlertTriangle, CheckCircle, X, ChevronDown, ChevronUp, Brain,
} from 'lucide-react';
import { getSocketOriginFromApiUrl, runtimeUrls } from '../../config/runtime';
import { useNotification } from '../GlobalNotification';

interface Diagnosis   { text: string; icd?: string; confidence: number }
interface Medication  { name: string; dose?: string; route?: string }
interface OrderSuggestion { type: string; description: string; urgency?: string }
interface AmbientAlert    { type: string; message: string; severity: string }

interface AmbientBarProps {
  patientId: string;
  providerId: string;
  appointmentId?: string;
  tenantSlug: string;
  token: string;
  /** Called with the latest SOAP fields so the parent encounter form can update */
  onDraftNoteUpdate?: (draft: { subjective?: string; objective?: string; assessment?: string; plan?: string }) => void;
}

type SessionStatus = 'idle' | 'connecting' | 'active' | 'paused' | 'ended';

const ALERT_COLORS: Record<string, string> = {
  critical: 'bg-red-600 text-white',
  high:     'bg-orange-500 text-white',
  medium:   'bg-amber-400 text-slate-900',
  low:      'bg-blue-100 text-blue-800',
};

/**
 * Sticky ambient AI bar that sits at the top of the encounter workspace.
 * Streams audio via WebSocket to /ambient namespace, receives real-time
 * entities and SOAP draft updates, lets the provider one-click accept/dismiss.
 */
const AmbientBar: React.FC<AmbientBarProps> = ({
  patientId, providerId, appointmentId, tenantSlug, token, onDraftNoteUpdate,
}) => {
  const [status, setStatus]           = useState<SessionStatus>('idle');
  const [sessionId, setSessionId]     = useState<string | null>(null);
  const [transcript, setTranscript]   = useState('');
  const [diagnoses, setDiagnoses]     = useState<Diagnosis[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [orders, setOrders]           = useState<OrderSuggestion[]>([]);
  const [alerts, setAlerts]           = useState<AmbientAlert[]>([]);
  const [accepted, setAccepted]       = useState<Record<string, 'accepted' | 'dismissed'>>({});
  const [expanded, setExpanded]       = useState(true);

  const socketRef    = useRef<Socket | null>(null);
  const mediaRef     = useRef<MediaRecorder | null>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const { showError, showSuccess } = useNotification();

  // ── Socket setup ────────────────────────────────────────────────────────

  const connectSocket = useCallback(() => {
    if (socketRef.current?.connected) return;
    const origin = getSocketOriginFromApiUrl(runtimeUrls.ehrApi);
    const socket = io(`${origin}/ambient`, {
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('ambient:started', ({ sessionId: sid }: { sessionId: string }) => {
      setSessionId(sid);
      setStatus('active');
    });

    socket.on('ambient:transcript', (data: {
      transcript: string;
      entities: { diagnoses: Diagnosis[]; medications: Medication[]; orders: OrderSuggestion[]; alerts: AmbientAlert[] };
      draftNote: { subjective?: string; objective?: string; assessment?: string; plan?: string };
    }) => {
      if (data.transcript) setTranscript((prev) => `${prev}${prev ? ' ' : ''}${data.transcript}`);
      if (data.entities.diagnoses.length)  setDiagnoses(data.entities.diagnoses);
      if (data.entities.medications.length) setMedications(data.entities.medications);
      if (data.entities.orders.length)     setOrders(data.entities.orders);
      if (data.entities.alerts.length)     setAlerts((prev) => [...prev, ...data.entities.alerts]);
      if (onDraftNoteUpdate && (data.draftNote.subjective || data.draftNote.plan)) {
        onDraftNoteUpdate(data.draftNote);
      }
    });

    socket.on('ambient:paused',  () => setStatus('paused'));
    socket.on('ambient:resumed', () => setStatus('active'));
    socket.on('ambient:ended',   () => { setStatus('ended'); stopMic(); });
    socket.on('ambient:error',   ({ message }: { message: string }) => {
      showError('Ambient AI Error', message);
    });

    socketRef.current = socket;
  }, [token, onDraftNoteUpdate]);

  // ── Mic recording ────────────────────────────────────────────────────────

  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (!e.data.size || !socketRef.current || !sessionId) return;
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          socketRef.current!.emit('ambient:chunk', { sessionId, audio: base64, tenantId: tenantSlug });
        };
        reader.readAsDataURL(e.data);
      };

      recorder.start(3000); // 3-second chunks
    } catch {
      showError('Microphone Error', 'Could not access microphone');
    }
  };

  const stopMic = () => {
    mediaRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    mediaRef.current = null;
    streamRef.current = null;
  };

  // ── Session controls ─────────────────────────────────────────────────────

  const handleStart = () => {
    setStatus('connecting');
    setTranscript(''); setDiagnoses([]); setMedications([]); setOrders([]); setAlerts([]); setAccepted({});
    connectSocket();
    socketRef.current?.emit('ambient:start', { patientId, providerId, appointmentId, tenantId: tenantSlug });
  };

  useEffect(() => {
    if (status === 'active' && sessionId) startMic();
  }, [status, sessionId]);

  const handlePause = () => {
    stopMic();
    socketRef.current?.emit('ambient:pause', { sessionId, tenantId: tenantSlug });
  };

  const handleResume = () => {
    socketRef.current?.emit('ambient:resume', { sessionId, tenantId: tenantSlug });
    startMic();
  };

  const handleEnd = () => {
    stopMic();
    socketRef.current?.emit('ambient:end', { sessionId, tenantId: tenantSlug });
    socketRef.current?.disconnect();
  };

  // ── Accept / dismiss ─────────────────────────────────────────────────────

  const handleAction = (category: 'orders' | 'diagnoses', itemId: string, action: 'accepted' | 'dismissed') => {
    setAccepted((prev) => ({ ...prev, [`${category}:${itemId}`]: action }));
    socketRef.current?.emit('ambient:action', { sessionId, category, itemId, action, patientId, tenantId: tenantSlug });
    if (action === 'accepted') showSuccess('Accepted', `AI suggestion added to chart`);
  };

  // ── Cleanup ──────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => { stopMic(); socketRef.current?.disconnect(); };
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────

  const isActive  = status === 'active';
  const isPaused  = status === 'paused';
  const isRunning = isActive || isPaused;

  return (
    <div className={`rounded-xl border shadow-sm transition-all ${
      alerts.some((a) => a.severity === 'critical')
        ? 'border-red-300 bg-red-50'
        : 'border-indigo-200 bg-gradient-to-r from-indigo-50 to-slate-50'
    }`}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <Brain className={`w-5 h-5 ${isActive ? 'text-indigo-600 animate-pulse' : 'text-slate-400'}`} />
          <span className="text-sm font-semibold text-slate-700">
            Ambient AI
            {isActive  && <span className="ml-2 text-xs text-indigo-500 font-normal">● Live</span>}
            {isPaused  && <span className="ml-2 text-xs text-amber-500 font-normal">⏸ Paused</span>}
            {status === 'ended' && <span className="ml-2 text-xs text-slate-400 font-normal">Session ended</span>}
          </span>

          {/* Alerts badge */}
          {alerts.length > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 border border-red-200 text-red-700 rounded-full text-xs font-semibold">
              <AlertTriangle className="w-3 h-3" />
              {alerts.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {status === 'idle' && (
            <button
              onClick={handleStart}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors"
            >
              <Mic className="w-3.5 h-3.5" />
              Start Ambient AI
            </button>
          )}
          {status === 'connecting' && (
            <span className="text-xs text-indigo-500">Connecting...</span>
          )}
          {isActive && (
            <>
              <button onClick={handlePause} className="flex items-center gap-1 px-2.5 py-1 bg-amber-100 border border-amber-300 text-amber-800 rounded-lg text-xs hover:bg-amber-200">
                <Pause className="w-3.5 h-3.5" /> Pause
              </button>
              <button onClick={handleEnd} className="flex items-center gap-1 px-2.5 py-1 bg-red-100 border border-red-300 text-red-700 rounded-lg text-xs hover:bg-red-200">
                <Square className="w-3.5 h-3.5" /> End
              </button>
            </>
          )}
          {isPaused && (
            <>
              <button onClick={handleResume} className="flex items-center gap-1 px-2.5 py-1 bg-green-100 border border-green-300 text-green-700 rounded-lg text-xs hover:bg-green-200">
                <Play className="w-3.5 h-3.5" /> Resume
              </button>
              <button onClick={handleEnd} className="flex items-center gap-1 px-2.5 py-1 bg-red-100 border border-red-300 text-red-700 rounded-lg text-xs hover:bg-red-200">
                <Square className="w-3.5 h-3.5" /> End
              </button>
            </>
          )}
          {isRunning && (
            <button onClick={() => setExpanded(!expanded)} className="p-1 text-slate-400 hover:text-slate-600">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {isRunning && expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-indigo-100">
          {/* Live transcript ticker */}
          {transcript && (
            <div className="bg-white/70 rounded-lg px-3 py-2 text-xs text-slate-600 italic border border-slate-100 max-h-16 overflow-y-auto">
              {transcript}
            </div>
          )}

          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="space-y-1">
              {alerts.slice(-3).map((a, i) => (
                <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${ALERT_COLORS[a.severity] ?? ALERT_COLORS.low}`}>
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {a.message}
                </div>
              ))}
            </div>
          )}

          {/* Suggested diagnoses */}
          {diagnoses.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
                <Stethoscope className="w-3.5 h-3.5" /> AI Diagnoses
              </p>
              <div className="flex flex-wrap gap-1.5">
                {diagnoses.map((d, i) => {
                  const stableId = `${d.text}:${d.icd ?? i}`;
                  const key = `diagnoses:${stableId}`;
                  const state = accepted[key];
                  return (
                    <div key={stableId} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all ${
                      state === 'accepted' ? 'bg-green-100 border-green-300 text-green-800' :
                      state === 'dismissed' ? 'bg-slate-100 border-slate-200 text-slate-400 line-through' :
                      'bg-white border-indigo-200 text-indigo-800'
                    }`}>
                      {d.text}
                      {d.icd && <span className="text-indigo-400 font-mono">{d.icd}</span>}
                      <span className="text-slate-400">{Math.round(d.confidence * 100)}%</span>
                      {!state && (
                        <>
                          <button onClick={() => handleAction('diagnoses', stableId, 'accepted')} className="text-green-600 hover:text-green-800">
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleAction('diagnoses', stableId, 'dismissed')} className="text-slate-400 hover:text-red-500">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Suggested orders */}
          {orders.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
                <Pill className="w-3.5 h-3.5" /> AI Order Suggestions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {orders.map((o, i) => {
                  const key = `orders:${i}`;
                  const state = accepted[key];
                  return (
                    <div key={i} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${
                      state === 'accepted' ? 'bg-green-100 border-green-300 text-green-800' :
                      state === 'dismissed' ? 'bg-slate-100 border-slate-200 text-slate-400 line-through' :
                      'bg-white border-amber-200 text-amber-800'
                    }`}>
                      {o.description}
                      {!state && (
                        <>
                          <button onClick={() => handleAction('orders', String(i), 'accepted')} className="text-green-600 hover:text-green-800">
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleAction('orders', String(i), 'dismissed')} className="text-slate-400 hover:text-red-500">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Detected medications */}
          {medications.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1.5">Medications Mentioned</p>
              <div className="flex flex-wrap gap-1.5">
                {medications.map((m, i) => (
                  <span key={i} className="px-2 py-0.5 bg-purple-50 border border-purple-200 text-purple-800 rounded-full text-xs">
                    {m.name}{m.dose ? ` ${m.dose}` : ''}{m.route ? ` (${m.route})` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AmbientBar;
