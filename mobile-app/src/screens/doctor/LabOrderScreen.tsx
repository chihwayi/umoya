import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated } from 'react-native';
import { colors, typography, spacing } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';

const LabOrderScreen: React.FC = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Lab Order" subtitle="Order laboratory tests" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <GlassCard style={styles.emptyState} padding={spacing.xl}>
            <Text style={styles.emptyIcon}>🔬</Text>
            <Text style={styles.emptyTitle}>Lab Order Form</Text>
            <Text style={styles.emptySubtitle}>
              Laboratory order form coming soon
            </Text>
          </GlassCard>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: spacing.xl * 2,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});

export default LabOrderScreen;
