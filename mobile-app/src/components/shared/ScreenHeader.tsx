import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, typography, spacing } from '../../theme/designSystem';

const { width } = Dimensions.get('window');

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
}

const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  showBack = true,
  rightAction,
}) => {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <View style={styles.gradientBackground} />
      <View style={styles.content}>
        {showBack && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
        )}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        {rightAction && <View style={styles.rightAction}>{rightAction}</View>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: 'hidden',
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.backgroundSecondary,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  backIcon: {
    fontSize: 24,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    ...typography.h2,
    marginBottom: 4,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  rightAction: {
    marginLeft: spacing.md,
  },
});

export default ScreenHeader;

