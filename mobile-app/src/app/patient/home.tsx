import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../features/shared/ui/Screen';
import { Card } from '../../features/shared/ui/Card';
import { StatePanel } from '../../features/shared/ui/StatePanel';
import { theme } from '../../design/theme';
import { PatientHero, PatientMetricGrid } from '../../features/patient/ui/PatientHero';
import { PatientSectionHeader } from '../../features/patient/ui/SectionHeader';
import { PatientStatusPill } from '../../features/patient/ui/StatusPill';
import { usePatientDashboardSummary, usePatientHomeAppointments, usePatientHomeMutations, usePatientMessages, usePatientNotifications } from '../../features/patient/hooks/usePatientHome';
import { formatDateTime, formatRelative, formatStatusLabel, safeNumber, valueFromKeys } from '../../features/patient/utils/format';
import type { PatientAppointment, PatientNotification } from '../../services/api/patient';

function appointmentTone(status?: string | null) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'cancelled' || normalized === 'missed') return 'critical' as const;
  if (normalized === 'completed') return 'success' as const;
  if (normalized === 'confirmed' || normalized === 'scheduled') return 'info' as const;
  return 'neutral' as const;
}

function notificationTone(notification: PatientNotification) {
  const type = String(notification.notification_type || '').toLowerCase();
  if (type.includes('bill') || type.includes('payment')) return 'warning' as const;
  if (type.includes('lab') || type.includes('critical') || type.includes('alert')) return 'critical' as const;
  if (type.includes('medication') || type.includes('refill')) return 'info' as const;
  return 'neutral' as const;
}

function sortAppointmentsByDate(appointments: PatientAppointment[]): PatientAppointment[] {
  return [...appointments].sort((a, b) => {
    const aTs = new Date(String(a.appointment_date || a.created_at || '')).getTime();
    const bTs = new Date(String(b.appointment_date || b.created_at || '')).getTime();
    return (Number.isFinite(aTs) ? aTs : Number.MAX_SAFE_INTEGER) - (Number.isFinite(bTs) ? bTs : Number.MAX_SAFE_INTEGER);
  });
}

export default function PatientHomeScreen() {
  const summaryQuery = usePatientDashboardSummary();
  const appointmentsQuery = usePatientHomeAppointments();
  const notificationsQuery = usePatientNotifications();
  const messagesQuery = usePatientMessages();
  const { markNotificationRead, markNotificationsReadAll } = usePatientHomeMutations();

  const summary = summaryQuery.data || {};
  const appointments = sortAppointmentsByDate(appointmentsQuery.data || []);
  const notifications = notificationsQuery.data?.notifications || [];
  const unreadNotifications =
    notificationsQuery.data?.unreadCount || notifications.filter((entry) => !Boolean(entry.is_read)).length;

  const unreadMessages = useMemo(() => {
    const messages = messagesQuery.data?.messages || [];
    return messages.filter((item) => !String(item.read_at || '').trim()).length;
  }, [messagesQuery.data?.messages]);

  const metrics = useMemo(
    () => [
      {
        label: 'Upcoming',
        value: valueFromKeys(summary, ['upcomingAppointments', 'appointmentsUpcoming', 'upcomingCount'], appointments.length),
        tone: 'info' as const
      },
      {
        label: 'Unread Alerts',
        value: unreadNotifications,
        tone: unreadNotifications > 0 ? ('warning' as const) : ('success' as const)
      },
      {
        label: 'Messages',
        value: unreadMessages,
        tone: unreadMessages > 0 ? ('info' as const) : ('neutral' as const)
      },
      {
        label: 'Bills Due',
        value: valueFromKeys(summary, ['billsDueCount', 'pendingBills', 'billCount'], 0),
        tone:
          valueFromKeys(summary, ['billsDueCount', 'pendingBills', 'billCount'], 0) > 0
            ? ('warning' as const)
            : ('success' as const)
      }
    ],
    [appointments.length, summary, unreadMessages, unreadNotifications]
  );

  const quickActions = [
    'Book Appointment',
    'Join Telemedicine',
    'View Bills',
    'Medication Reminders',
    'Message Clinic',
    'PostVisit Companion'
  ];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <PatientHero
          title="Patient Home"
          subtitle="Appointments, reminders, post-visit guidance, and payment actions in one place."
        >
          <PatientMetricGrid items={metrics} />
        </PatientHero>

        {(summaryQuery.isLoading || appointmentsQuery.isLoading || notificationsQuery.isLoading) && (
          <StatePanel state="loading" title="Loading dashboard" message="Syncing patient summary and engagement feed..." />
        )}

        {(summaryQuery.isError || appointmentsQuery.isError || notificationsQuery.isError) && (
          <StatePanel state="error" title="Dashboard unavailable" message="Could not load patient dashboard data." />
        )}

        <Card>
          <PatientSectionHeader
            title="Quick Actions"
            subtitle="Main patient tasks optimized for daily use"
          />
          <View style={styles.quickActionGrid}>
            {quickActions.map((action) => (
              <View key={action} style={styles.quickActionCard}>
                <Text style={styles.quickActionText}>{action}</Text>
              </View>
            ))}
          </View>
        </Card>

        <Card>
          <PatientSectionHeader
            title="Upcoming Appointments"
            subtitle={`${appointments.length} scheduled in your timeline`}
          />

          {appointments.slice(0, 5).map((appointment) => (
            <View key={appointment.id} style={styles.listCard}>
              <View style={styles.rowTop}>
                <PatientStatusPill label={formatStatusLabel(appointment.status || 'scheduled')} tone={appointmentTone(appointment.status)} />
                <Text style={styles.metaText}>
                  {formatDateTime(String(appointment.appointment_date || appointment.appointmentDate || null))}
                </Text>
              </View>
              <Text style={styles.titleText}>{String(appointment.doctor_name || appointment.doctorName || 'Assigned clinician')}</Text>
              <Text style={styles.subText}>{String(appointment.reason || appointment.appointment_type || 'General consultation')}</Text>
            </View>
          ))}

          {!appointmentsQuery.isLoading && appointments.length === 0 ? (
            <StatePanel
              state="empty"
              title="No upcoming appointments"
              message="Book your next review to keep your care plan on track."
            />
          ) : null}
        </Card>

        <Card>
          <View style={styles.inlineHeader}>
            <PatientSectionHeader title="Notifications" subtitle={`${unreadNotifications} unread`} />
            <Pressable
              disabled={markNotificationsReadAll.isPending || unreadNotifications === 0}
              style={[
                styles.actionButton,
                (markNotificationsReadAll.isPending || unreadNotifications === 0) && styles.disabled
              ]}
              onPress={() => markNotificationsReadAll.mutate()}
            >
              <Text style={styles.actionButtonText}>
                {markNotificationsReadAll.isPending ? 'Updating...' : 'Mark All Read'}
              </Text>
            </Pressable>
          </View>

          {notifications.slice(0, 6).map((notification) => {
            const isUnread = !Boolean(notification.is_read);
            return (
              <View key={notification.id} style={styles.listCard}>
                <View style={styles.rowTop}>
                  <PatientStatusPill
                    label={formatStatusLabel(String(notification.notification_type || 'update'))}
                    tone={notificationTone(notification)}
                  />
                  <Text style={styles.metaText}>{formatRelative(notification.created_at || null)}</Text>
                </View>

                <Text style={styles.titleText}>{String(notification.title || 'Clinic Update')}</Text>
                <Text style={styles.subText}>{String(notification.message || 'You have a new patient portal update.')}</Text>

                {isUnread ? (
                  <Pressable
                    disabled={markNotificationRead.isPending}
                    style={[styles.markReadButton, markNotificationRead.isPending && styles.disabled]}
                    onPress={() => markNotificationRead.mutate(notification.id)}
                  >
                    <Text style={styles.markReadText}>
                      {markNotificationRead.isPending ? 'Updating...' : 'Mark Read'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}

          {!notificationsQuery.isLoading && notifications.length === 0 ? (
            <StatePanel state="empty" title="No notifications" message="Important updates will appear here." />
          ) : null}
        </Card>

        {safeNumber(summary.nextAppointmentInDays) > 0 ? (
          <StatePanel
            state="empty"
            title="Next appointment reminder"
            message={`Your next visit is in ${safeNumber(summary.nextAppointmentInDays)} day(s).`}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xxl
  },
  quickActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm
  },
  quickActionCard: {
    minWidth: 122,
    flexGrow: 1,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  quickActionText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '600'
  },
  listCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    gap: 4,
    marginBottom: theme.spacing.sm
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.sm
  },
  metaText: {
    color: theme.colors.textMuted,
    fontSize: 11
  },
  titleText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700'
  },
  subText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 16
  },
  inlineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: theme.spacing.sm
  },
  actionButton: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accentBlue,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8
  },
  actionButtonText: {
    color: '#EEF4FF',
    fontSize: 12,
    fontWeight: '700'
  },
  markReadButton: {
    alignSelf: 'flex-start',
    marginTop: theme.spacing.xs,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6
  },
  markReadText: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontWeight: '600'
  },
  disabled: {
    opacity: 0.5
  }
});
