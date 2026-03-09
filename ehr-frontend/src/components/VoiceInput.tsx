import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Mic, MicOff, Square, Loader2 } from 'lucide-react';

export interface VoiceCommand {
  type: string;
  data: Record<string, any>;
}

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  onCommand?: (command: VoiceCommand) => void;
  tenantSlug: string;
  mode?: 'push_to_talk' | 'continuous';
  compact?: boolean;
}

const VoiceInput: React.FC<VoiceInputProps> = ({
  onTranscript,
  onCommand,
  tenantSlug,
  mode = 'push_to_talk',
  compact = false,
}) => {
  const [recording, setRecording] = useState(false);
  const [connected, setConnected] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lastCommand, setLastCommand] = useState<VoiceCommand | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('ehr_token');
    const apiUrl = process.env.REACT_APP_EHR_API_URL || 'http://localhost:3000';
    const socket = io(`${apiUrl}/voice`, {
      auth: { token },
      transports: ['websocket'],
      autoConnect: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('transcription', (data: { text: string; command: VoiceCommand | null; timestamp: number }) => {
      if (data.text) {
        setTranscript((prev) => (prev ? `${prev} ${data.text}` : data.text));
        onTranscript(data.text);
      }
      if (data.command) {
        setLastCommand(data.command);
        if (onCommand) onCommand(data.command);
      }
    });

    socket.on('transcription_error', (data: { error: string }) => {
      setError(data.error);
      setTimeout(() => setError(null), 5000);
    });

    return () => {
      socket.disconnect();
    };
  }, [onTranscript, onCommand]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1 },
      });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && socketRef.current?.connected) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            if (base64) {
              socketRef.current?.emit('audio_chunk', {
                audio: base64,
                format: 'webm',
                tenantId: tenantSlug,
              });
            }
          };
          reader.readAsDataURL(event.data);
        }
      };

      mediaRecorder.start(500);
      setRecording(true);
    } catch (e: any) {
      setError(e.message || 'Microphone access denied');
    }
  }, [tenantSlug]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    socketRef.current?.emit('audio_end', {});
    setRecording(false);
  }, []);

  const toggleRecording = useCallback(() => {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [recording, startRecording, stopRecording]);

  const clearTranscript = () => {
    setTranscript('');
    setLastCommand(null);
  };

  if (compact) {
    return (
      <button
        onMouseDown={mode === 'push_to_talk' ? startRecording : undefined}
        onMouseUp={mode === 'push_to_talk' ? stopRecording : undefined}
        onClick={mode === 'continuous' ? toggleRecording : undefined}
        className={`p-2 rounded-lg transition-all ${
          recording
            ? 'bg-red-500 text-white animate-pulse'
            : connected
            ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
        }`}
        disabled={!connected}
        title={recording ? 'Stop recording' : 'Start voice input'}
      >
        {recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </button>
    );
  }

  return (
    <div className="border border-slate-200 rounded-xl p-3 bg-white">
      <div className="flex items-center gap-2 mb-2">
        <button
          onMouseDown={mode === 'push_to_talk' ? startRecording : undefined}
          onMouseUp={mode === 'push_to_talk' ? stopRecording : undefined}
          onClick={mode === 'continuous' ? toggleRecording : undefined}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            recording
              ? 'bg-red-500 text-white animate-pulse'
              : connected
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
          disabled={!connected}
        >
          {recording ? (
            <>
              <Square className="w-4 h-4" />
              {mode === 'push_to_talk' ? 'Release to stop' : 'Stop'}
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" />
              {mode === 'push_to_talk' ? 'Hold to speak' : 'Start'}
            </>
          )}
        </button>

        {!connected && (
          <span className="flex items-center gap-1 text-xs text-amber-600">
            <Loader2 className="w-3 h-3 animate-spin" /> Connecting...
          </span>
        )}

        {recording && (
          <span className="flex items-center gap-1 text-xs text-red-600">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            Listening...
          </span>
        )}

        {transcript && (
          <button
            onClick={clearTranscript}
            className="ml-auto text-xs text-slate-400 hover:text-slate-600"
          >
            Clear
          </button>
        )}
      </div>

      {transcript && (
        <div className="text-sm text-slate-700 bg-slate-50 rounded-lg p-2 max-h-24 overflow-y-auto">
          {transcript}
        </div>
      )}

      {lastCommand && (
        <div className="mt-1 text-xs text-blue-600 bg-blue-50 rounded-lg px-2 py-1">
          Command: {lastCommand.type} — {JSON.stringify(lastCommand.data)}
        </div>
      )}

      {error && (
        <div className="mt-1 text-xs text-red-600 bg-red-50 rounded-lg px-2 py-1">
          {error}
        </div>
      )}
    </div>
  );
};

export default VoiceInput;
