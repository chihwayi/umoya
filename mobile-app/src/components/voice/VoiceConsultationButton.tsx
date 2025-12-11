/**
 * Voice Consultation Button Component
 * Simple button to start voice recording for consultations
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../theme/designSystem';
import Icon from '../shared/Icon';
import ConsentModal from './ConsentModal';
import voiceRecordingService from '../../services/voice-recording.service';
import transcriptionService from '../../services/transcription.service';
import medicalEntityExtractor from '../../services/medical-entity-extractor.service';

export interface VoiceConsultationButtonProps {
  patientName?: string;
  patientId?: string;
  onTranscriptionComplete?: (text: string, entities: any) => void;
  onError?: (error: string) => void;
  language?: 'en' | 'sn' | 'nd' | 'auto';
  size?: 'small' | 'medium' | 'large';
}

const VoiceConsultationButton: React.FC<VoiceConsultationButtonProps> = ({
  patientName,
  patientId,
  onTranscriptionComplete,
  onError,
  language = 'auto',
  size = 'medium',
}) => {
  const [showConsent, setShowConsent] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Start recording after consent
  const handleStartRecording = async () => {
    try {
      setShowConsent(false);
      setIsRecording(true);
      setRecordingDuration(0);

      // Start recording
      await voiceRecordingService.startRecording({
        sampleRate: 16000,
        channels: 1,
        format: 'wav',
      });

      // Update duration every second
      const interval = setInterval(() => {
        const status = voiceRecordingService.getRecordingStatus();
        setRecordingDuration(status.duration);
      }, 1000);

      // Store interval to clear later
      (voiceRecordingService as any).durationInterval = interval;
    } catch (error: any) {
      setIsRecording(false);
      Alert.alert('Recording Error', error.message || 'Failed to start recording');
      onError?.(error.message);
    }
  };

  // Stop recording and process
  const handleStopRecording = async () => {
    try {
      setIsRecording(false);
      setIsProcessing(true);

      // Clear duration interval
      if ((voiceRecordingService as any).durationInterval) {
        clearInterval((voiceRecordingService as any).durationInterval);
      }

      // Stop recording
      const recordingResult = await voiceRecordingService.stopRecording();

      // Transcribe audio
      const transcription = await transcriptionService.transcribe(
        recordingResult.uri,
        { language }
      );

      // Extract medical entities
      const entities = medicalEntityExtractor.extractEntities(transcription.text);

      // Format transcription
      const formattedText = transcriptionService.formatTranscription(transcription.text);

      // Callback with results
      onTranscriptionComplete?.(formattedText, entities);

      // Reset
      setRecordingDuration(0);
      setIsProcessing(false);

      Alert.alert(
        'Recording Complete',
        `Transcribed ${transcription.text.length} characters. Extracted ${Object.keys(entities.vitals || {}).length} vitals and ${entities.symptoms?.length || 0} symptoms.`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      setIsProcessing(false);
      Alert.alert('Processing Error', error.message || 'Failed to process recording');
      onError?.(error.message);
    }
  };

  // Cancel recording
  const handleCancelRecording = async () => {
    try {
      await voiceRecordingService.cancelRecording();
      setIsRecording(false);
      setRecordingDuration(0);
      if ((voiceRecordingService as any).durationInterval) {
        clearInterval((voiceRecordingService as any).durationInterval);
      }
    } catch (error) {
      console.error('Error canceling recording:', error);
    }
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const buttonSize = {
    small: { padding: spacing.sm, fontSize: 12 },
    medium: { padding: spacing.md, fontSize: 14 },
    large: { padding: spacing.lg, fontSize: 16 },
  }[size];

  if (isProcessing) {
    return (
      <View style={[styles.container, styles.processing]}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.processingText}>Processing...</Text>
      </View>
    );
  }

  if (isRecording) {
    return (
      <View style={styles.recordingContainer}>
        <TouchableOpacity
          style={[styles.recordingButton, { backgroundColor: colors.error }]}
          onPress={handleStopRecording}
          activeOpacity={0.8}
        >
          <View style={styles.recordingIndicator} />
          <Text style={styles.recordingText}>
            {formatDuration(recordingDuration)}
          </Text>
          <Text style={styles.stopText}>Stop</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancelRecording}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        style={[
          styles.button,
          {
            paddingVertical: buttonSize.padding,
            paddingHorizontal: buttonSize.padding * 1.5,
          },
        ]}
        onPress={() => setShowConsent(true)}
        activeOpacity={0.8}
      >
        <Icon name="microphone" size={20} />
        <Text style={[styles.buttonText, { fontSize: buttonSize.fontSize }]}>
          Voice Record
        </Text>
      </TouchableOpacity>

      <ConsentModal
        visible={showConsent}
        patientName={patientName}
        onConsent={handleStartRecording}
        onDecline={() => setShowConsent(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    ...shadows.sm,
  },
  buttonText: {
    ...typography.bodyBold,
    color: colors.textOnPrimary,
  },
  recordingContainer: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  recordingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    gap: spacing.md,
    minWidth: 150,
    justifyContent: 'center',
  },
  recordingIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.textOnPrimary,
  },
  recordingText: {
    ...typography.bodyBold,
    color: colors.textOnPrimary,
    fontFamily: 'monospace',
  },
  stopText: {
    ...typography.bodyBold,
    color: colors.textOnPrimary,
  },
  cancelButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  cancelText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  processing: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.glassBackground,
  },
  processingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
});

export default VoiceConsultationButton;
