/**
 * Patient Consent Modal
 * Required before starting voice recording
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/designSystem';
import GlassCard from '../shared/GlassCard';
import PrimaryButton from '../shared/PrimaryButton';
import Icon from '../shared/Icon';

export interface ConsentModalProps {
  visible: boolean;
  patientName?: string;
  onConsent: () => void;
  onDecline: () => void;
}

const ConsentModal: React.FC<ConsentModalProps> = ({
  visible,
  patientName,
  onConsent,
  onDecline,
}) => {
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDecline}
    >
      <View style={styles.overlay}>
        <GlassCard style={styles.modalCard}>
          <View style={styles.header}>
            <Icon name="microphone" size={32} />
            <Text style={styles.title}>Voice Recording Consent</Text>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {patientName && (
              <Text style={styles.patientName}>Patient: {patientName}</Text>
            )}

            <Text style={styles.sectionTitle}>What is being recorded?</Text>
            <Text style={styles.text}>
              This consultation will be audio recorded to help your doctor document your visit more accurately. The recording will be used to:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bullet}>• Transcribe the conversation into medical notes</Text>
              <Text style={styles.bullet}>• Extract important information (symptoms, vitals, medications)</Text>
              <Text style={styles.bullet}>• Improve documentation accuracy</Text>
            </View>

            <Text style={styles.sectionTitle}>Privacy & Security</Text>
            <Text style={styles.text}>
              • Recordings are encrypted and stored securely{'\n'}
              • Only authorized medical staff can access recordings{'\n'}
              • Recordings are deleted after transcription (unless you consent to retention){'\n'}
              • Your privacy is protected under HIPAA/GDPR regulations
            </Text>

            <Text style={styles.sectionTitle}>Your Rights</Text>
            <Text style={styles.text}>
              • You can decline recording at any time{'\n'}
              • You can request deletion of recordings{'\n'}
              • You can review and correct extracted information{'\n'}
              • Manual documentation is always available as an alternative
            </Text>

            <View style={styles.checkboxContainer}>
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => setAcknowledged(!acknowledged)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkboxBox, acknowledged && styles.checkboxChecked]}>
                  {acknowledged && <Icon name="check" size={16} />}
                </View>
                <Text style={styles.checkboxLabel}>
                  I understand and consent to audio recording of this consultation
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.declineButton}
              onPress={onDecline}
              activeOpacity={0.7}
            >
              <Text style={styles.declineButtonText}>Decline</Text>
            </TouchableOpacity>
            <PrimaryButton
              title="I Consent"
              onPress={onConsent}
              disabled={!acknowledged}
              icon="✓"
            />
          </View>
        </GlassCard>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    padding: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  patientName: {
    ...typography.bodyBold,
    color: colors.primary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  text: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  bulletList: {
    marginLeft: spacing.md,
    marginBottom: spacing.md,
  },
  bullet: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.xs,
  },
  checkboxContainer: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
  },
  checkboxLabel: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  declineButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: colors.glassBackground,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButtonText: {
    ...typography.bodyBold,
    color: colors.textSecondary,
  },
});

export default ConsentModal;
