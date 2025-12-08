import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { colors, borderRadius, typography, shadows } from '../../theme/designSystem';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: string;
}

const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        (disabled || loading) && styles.buttonDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={colors.textPrimary} />
      ) : (
        <>
          {icon && <Text style={styles.icon}>{icon}</Text>}
          <Text style={[styles.buttonText, textStyle]}>{title}</Text>
          {!icon && <Text style={styles.arrow}>→</Text>}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  buttonDisabled: {
    backgroundColor: colors.primaryLight,
    opacity: 0.6,
  },
  buttonText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textPrimary,
    fontSize: 18,
  },
  icon: {
    fontSize: 20,
    marginRight: 8,
  },
  arrow: {
    fontSize: 20,
    color: colors.textPrimary,
    marginLeft: 8,
  },
});

export default PrimaryButton;


