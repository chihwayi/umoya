import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import Icon from './Icon';
import PrimaryButton from './PrimaryButton';
import GlassCard from './GlassCard';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/designSystem';

const { width } = Dimensions.get('window');

export type AlertType = 'success' | 'error' | 'warning' | 'info' | 'confirm';

interface AlertModalProps {
  visible: boolean;
  title: string;
  message: string;
  type?: AlertType;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  onClose: () => void;
}

const AlertModal: React.FC<AlertModalProps> = ({
  visible,
  title,
  message,
  type = 'info',
  confirmText = 'OK',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  onClose,
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onClose();
  };

  const getTypeConfig = () => {
    switch (type) {
      case 'success':
        return {
          icon: 'success',
          color: colors.success,
          bgGradient: [colors.success + '20', colors.success + '10'],
        };
      case 'error':
        return {
          icon: 'error',
          color: colors.error,
          bgGradient: [colors.error + '20', colors.error + '10'],
        };
      case 'warning':
        return {
          icon: 'warning',
          color: colors.warning,
          bgGradient: [colors.warning + '20', colors.warning + '10'],
        };
      case 'confirm':
        return {
          icon: 'info',
          color: colors.info,
          bgGradient: [colors.info + '20', colors.info + '10'],
        };
      default:
        return {
          icon: 'info',
          color: colors.info,
          bgGradient: [colors.info + '20', colors.info + '10'],
        };
    }
  };

  const config = getTypeConfig();
  const isConfirmType = type === 'confirm';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.modalContainer,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <GlassCard
            style={[
              styles.alertCard,
              { borderLeftColor: config.color, borderLeftWidth: 4 },
            ]}
            padding={spacing.lg}
          >
            {/* Icon */}
            <View style={[styles.iconContainer, { backgroundColor: config.color + '20' }]}>
              <Icon name={config.icon} size={48} color={config.color} />
            </View>

            {/* Title */}
            <Text style={styles.title}>{title}</Text>

            {/* Message */}
            <Text style={styles.message}>{message}</Text>

            {/* Actions */}
            <View style={styles.actions}>
              {isConfirmType ? (
                <>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={handleCancel}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelButtonText}>{cancelText}</Text>
                  </TouchableOpacity>
                  <PrimaryButton
                    title={confirmText}
                    onPress={handleConfirm}
                    icon="check"
                    style={styles.confirmButton}
                  />
                </>
              ) : (
                <PrimaryButton
                  title={confirmText}
                  onPress={handleConfirm}
                  icon="check"
                  style={styles.singleButton}
                />
              )}
            </View>
          </GlassCard>
        </Animated.View>
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
  modalContainer: {
    width: '100%',
    maxWidth: 400,
  },
  alertCard: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h3,
    textAlign: 'center',
    marginBottom: spacing.md,
    color: colors.textPrimary,
  },
  message: {
    ...typography.body,
    textAlign: 'center',
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  actions: {
    width: '100%',
    flexDirection: 'row',
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.glassCard,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  confirmButton: {
    flex: 1,
  },
  singleButton: {
    width: '100%',
  },
});

export default AlertModal;

