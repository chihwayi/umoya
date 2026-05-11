import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { useTenantSlug } from '../hooks/useTenantSlug';
import { patientPortalApi } from '../services/api';

type VoiceState = 'idle' | 'requesting' | 'recording' | 'processing' | 'error';

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  context?: string;
  language?: string;
  disabled?: boolean;
  className?: string;
}

const MAX_RECORDING_SECONDS = 60;

const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  onTranscript,
  context,
  language,
  disabled,
  className = '',
}) => {
  const { token } = usePatientAuth();
  const tenantSlug = useTenantSlug();
  const [state, setState] = useState<VoiceState>('idle');
  const [secondsLeft, setSecondsLeft] = useState(MAX_RECORDING_SECONDS);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);

  const supported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined';

  const clearTimers = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (countdownRef.current) {
      window.clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  };

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    return () => {
      clearTimers();
      if (recorderRef.current?.state === 'recording') {
        recorderRef.current.stop();
      }
      stopTracks();
    };
  }, []);

  const stopRecording = () => {
    clearTimers();
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
  };

  const startRecording = async () => {
    if (!supported || disabled || !token || state !== 'idle') return;

    try {
      setState('requesting');
      setSecondsLeft(MAX_RECORDING_SECONDS);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      recorder.onstop = async () => {
        clearTimers();
        stopTracks();
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setState('processing');

        try {
          const result = await patientPortalApi.voiceTranscribe(blob, token, tenantSlug, context, language);
          if (result.text?.trim()) {
            onTranscript(result.text.trim());
          }
          setState('idle');
        } catch {
          setState('error');
          window.setTimeout(() => setState('idle'), 2000);
        }
      };

      recorderRef.current = recorder;
      recorder.start();
      setState('recording');

      countdownRef.current = window.setInterval(() => {
        setSecondsLeft((current) => Math.max(0, current - 1));
      }, 1000);
      timeoutRef.current = window.setTimeout(stopRecording, MAX_RECORDING_SECONDS * 1000);
    } catch {
      clearTimers();
      stopTracks();
      setState('error');
      window.setTimeout(() => setState('idle'), 2000);
    }
  };

  const handleClick = () => {
    if (state === 'recording') {
      stopRecording();
      return;
    }
    startRecording();
  };

  if (!supported) {
    return (
      <button
        type="button"
        disabled
        title="Voice input is not supported in this browser"
        className={`w-10 h-10 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center cursor-not-allowed opacity-60 ${className}`}
      >
        <Mic className="w-5 h-5 text-gray-400" />
      </button>
    );
  }

  const isBusy = state === 'requesting' || state === 'processing';
  const buttonClass =
    state === 'recording'
      ? 'w-10 h-10 rounded-full bg-red-500 flex items-center justify-center animate-pulse cursor-pointer'
      : state === 'processing' || state === 'requesting'
        ? 'w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center cursor-not-allowed'
        : state === 'error'
          ? 'w-10 h-10 rounded-full bg-white border-2 border-red-400 flex items-center justify-center cursor-pointer'
          : 'w-10 h-10 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center hover:bg-indigo-100 transition-colors cursor-pointer';

  return (
    <div className={`inline-flex flex-col items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isBusy}
        title={state === 'recording' ? 'Click to stop recording' : 'Click to speak'}
        className={`${buttonClass} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {state === 'recording' ? (
          <MicOff className="w-5 h-5 text-white" />
        ) : state === 'processing' || state === 'requesting' ? (
          <svg className="w-5 h-5 animate-spin text-indigo-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        ) : (
          <Mic className={state === 'error' ? 'w-5 h-5 text-red-500' : 'w-5 h-5 text-indigo-600'} />
        )}
      </button>
      {state === 'recording' && (
        <span className="text-xs font-semibold text-red-600">
          0:{secondsLeft.toString().padStart(2, '0')}
        </span>
      )}
    </div>
  );
};

export default VoiceInputButton;
