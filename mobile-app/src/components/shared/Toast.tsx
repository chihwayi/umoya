import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Icon from './Icon';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/designSystem';

const { width } = Dimensions.get('window');

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  visible: boolean;
  message: string;
  title?: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({
  visible,
  message,
  title,
  type = 'info',
  duration = 3000,
  onClose,
}) => {
  const slideAnim = useRef(new Animated.Value(-200)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Slide in animation
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      handleClose();
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -200,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  if (!visible) return null;

  const getTypeConfig = () => {
    switch (type) {
      case 'success':
        return {
          icon: 'success',
          color: colors.success,
          bgColor: colors.success + '20',
          borderColor: colors.success,
        };
      case 'error':
        return {
          icon: 'error',
          color: colors.error,
          bgColor: colors.error + '20',
          borderColor: colors.error,
        };
      case 'warning':
        return {
          icon: 'warning',
          color: colors.warning,
          bgColor: colors.warning + '20',
          borderColor: colors.warning,
        };
      default:
        return {
          icon: 'info',
          color: colors.info,
          bgColor: colors.info + '20',
          borderColor: colors.info,
        };
    }
  };

  const config = getTypeConfig();

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.toast,
          {
            backgroundColor: config.bgColor,
            borderColor: config.borderColor,
            transform: [{ translateY: slideAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        <View style={[styles.iconContainer, { backgroundColor: config.color + '30' }]}>
          <Icon name={config.icon} size={24} color={config.color} />
        </View>
        <View style={styles.content}>
          {title && <Text style={[styles.title, { color: config.color }]}>{title}</Text>}
          <Text style={styles.message}>{message}</Text>
        </View>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleClose}
          activeOpacity={0.7}
        >
          <Icon name="close" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10000,
    elevation: 10000,
    pointerEvents: 'box-none',
  },
  toast: {
    width: width - spacing.xl * 2,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    ...shadows.lg,
    maxWidth: 500,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  title: {
    ...typography.bodyBold,
    marginBottom: spacing.xs / 2,
    fontSize: 16,
  },
  message: {
    ...typography.body,
    color: colors.textPrimary,
    fontSize: 14,
  },
  closeButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
});

export default Toast;

