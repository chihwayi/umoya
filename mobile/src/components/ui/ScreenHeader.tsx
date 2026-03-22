import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, FONT } from '../../design/tokens';
import { Icon } from './Icon';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  accent?: string;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  accent = C.teal,
  onBack,
  rightSlot,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <View style={styles.row}>
        {onBack && (
          <TouchableOpacity
            onPress={onBack}
            activeOpacity={0.7}
            style={styles.backBtn}
          >
            <Icon name="back" size={20} color={C.textSecondary} />
          </TouchableOpacity>
        )}
        <View style={styles.titleBlock}>
          {subtitle && (
            <Text style={[styles.subtitle, { color: accent }]}>{subtitle}</Text>
          )}
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
        </View>
        {rightSlot && <View style={styles.right}>{rightSlot}</View>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
  },
  subtitle: {
    fontFamily: FONT.uiBd,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  title: {
    fontFamily: FONT.uiBk,
    fontSize: 20,
    color: C.textPrimary,
    letterSpacing: -0.3,
  },
  right: {
    alignItems: 'flex-end',
  },
});
