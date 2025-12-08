import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, FlatList } from 'react-native';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';

const AppointmentsScreen: React.FC = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [appointments, setAppointments] = useState<any[]>([]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const renderAppointment = ({ item, index }: { item: any; index: number }) => (
    <Animated.View
      style={[
        {
          opacity: fadeAnim,
          transform: [
            {
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
        },
      ]}
    >
      <GlassCard style={styles.appointmentCard} padding={spacing.lg}>
        <View style={styles.appointmentHeader}>
          <View style={styles.appointmentIconContainer}>
            <Text style={styles.appointmentIcon}>📅</Text>
          </View>
          <View style={styles.appointmentInfo}>
            <Text style={styles.appointmentTitle}>No Appointments</Text>
            <Text style={styles.appointmentSubtitle}>Your appointments will appear here</Text>
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title="My Appointments" subtitle="Manage your appointments" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {appointments.length === 0 ? (
          <Animated.View style={{ opacity: fadeAnim }}>
            <GlassCard style={styles.emptyState} padding={spacing.xl}>
              <Text style={styles.emptyIcon}>📅</Text>
              <Text style={styles.emptyTitle}>No Appointments</Text>
              <Text style={styles.emptySubtitle}>
                Your upcoming and past appointments will appear here
              </Text>
            </GlassCard>
          </Animated.View>
        ) : (
          <FlatList
            data={appointments}
            renderItem={renderAppointment}
            keyExtractor={(item, index) => `appointment-${index}`}
            scrollEnabled={false}
          />
        )}
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
  appointmentCard: {
    marginBottom: spacing.md,
  },
  appointmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appointmentIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: `${colors.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  appointmentIcon: {
    fontSize: 24,
  },
  appointmentInfo: {
    flex: 1,
  },
  appointmentTitle: {
    ...typography.h4,
    marginBottom: spacing.xs,
  },
  appointmentSubtitle: {
    ...typography.bodySmall,
    color: colors.textTertiary,
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

export default AppointmentsScreen;
