/**
 * Voice Consultation Button Component for EHR Web Frontend
 */

import React, { useState, useRef } from 'react';
import { Mic, Square, Pause, Play, Loader2 } from 'lucide-react';
import ConsentModal from './ConsentModal';
import transcriptionService, { WhisperLanguageCode } from '../../services/transcription.service';
import medicalEntityExtractor, { ExtractedEntities } from '../../services/medical-entity-extractor.service';

interface VoiceConsultationButtonProps {
  patientName?: string;
  patientId?: string;
  token: string;
  tenantSlug: string;
  language?: WhisperLanguageCode;
  onTranscriptionComplete?: (text: string, entities: ExtractedEntities, soapNote?: any) => void;
  onError?: (error: string) => void;
}

const VoiceConsultationButton: React.FC<VoiceConsultationButtonProps> = ({
  patientName,
  patientId,
  token,
  tenantSlug,
  language = 'auto',
  onTranscriptionComplete,
  onError,
}) => {
  const [showConsent, setShowConsent] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const durationIntervalRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      setShowConsent(false);
      setIsRecording(true);
      setIsPaused(false);
      audioChunksRef.current = [];
      startTimeRef.current = Date.now();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        await processRecording();
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect data every second

      // Update duration every second
      durationIntervalRef.current = setInterval(() => {
        if (!isPaused) {
          setRecordingDuration(Date.now() - startTimeRef.current);
        }
      }, 1000);
    } catch (error: any) {
      setIsRecording(false);
      onError?.(error.message || 'Failed to start recording. Please check microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      setIsRecording(false);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      startTimeRef.current = Date.now() - recordingDuration; // Adjust start time
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    setIsRecording(false);
    setIsPaused(false);
    setRecordingDuration(0);
    audioChunksRef.current = [];
  };

  const processRecording = async () => {
    try {
      setIsProcessing(true);

      // Combine audio chunks
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      
      // Convert to WAV format (simplified - in production, use a proper converter)
      const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });

      // Transcribe
      const transcription = await transcriptionService.transcribe(
        audioFile,
        { language },
        token,
        tenantSlug,
      );

      // Extract entities
      const entities = medicalEntityExtractor.extractEntities(transcription.transcription.text);

      // Format transcription
      const formattedText = transcriptionService.formatTranscription(transcription.transcription.text);

      // Callback
      onTranscriptionComplete?.(formattedText, entities, transcription.soap_note);

      // Reset
      setRecordingDuration(0);
      setIsProcessing(false);
    } catch (error: any) {
      setIsProcessing(false);
      onError?.(error.message || 'Failed to process recording');
    }
  };

  if (isProcessing) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
        <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
        <span className="text-sm font-medium text-indigo-900">Processing...</span>
      </div>
    );
  }

  if (isRecording) {
    return (
      <div className="flex items-center gap-3 bg-red-50 border-2 border-red-300 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
          <span className="text-sm font-mono font-semibold text-red-900">
            {formatDuration(recordingDuration)}
          </span>
        </div>
        <div className="flex gap-2">
          {isPaused ? (
            <button
              onClick={resumeRecording}
              className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              title="Resume"
            >
              <Play className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={pauseRecording}
              className="p-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
              title="Pause"
            >
              <Pause className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={stopRecording}
            className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            title="Stop"
          >
            <Square className="w-4 h-4" />
          </button>
          <button
            onClick={cancelRecording}
            className="px-3 py-2 text-sm text-red-700 hover:bg-red-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowConsent(true)}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm"
      >
        <Mic className="w-4 h-4" />
        Voice Record
      </button>

      <ConsentModal
        visible={showConsent}
        patientName={patientName}
        onConsent={startRecording}
        onDecline={() => setShowConsent(false)}
      />
    </>
  );
};

export default VoiceConsultationButton;
