import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getPatientAppointments,
  getPatientDashboardSummary,
  getPatientMessages,
  getPatientNotifications,
  markAllPatientNotificationsRead,
  markPatientNotificationRead
} from '../../../services/api/patient';

const QUERY_KEYS = {
  summary: ['patient', 'home', 'summary'] as const,
  appointments: ['patient', 'home', 'appointments'] as const,
  notifications: ['patient', 'home', 'notifications'] as const,
  messages: ['patient', 'home', 'messages'] as const
};

export function usePatientDashboardSummary() {
  return useQuery({
    queryKey: QUERY_KEYS.summary,
    queryFn: getPatientDashboardSummary,
    refetchInterval: 45_000
  });
}

export function usePatientHomeAppointments() {
  return useQuery({
    queryKey: QUERY_KEYS.appointments,
    queryFn: () => getPatientAppointments(),
    refetchInterval: 60_000
  });
}

export function usePatientNotifications() {
  return useQuery({
    queryKey: QUERY_KEYS.notifications,
    queryFn: () => getPatientNotifications({ limit: 20 }),
    refetchInterval: 30_000
  });
}

export function usePatientMessages() {
  return useQuery({
    queryKey: QUERY_KEYS.messages,
    queryFn: () => getPatientMessages({ limit: 20 }),
    refetchInterval: 30_000
  });
}

export function usePatientHomeMutations() {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.summary })
    ]);
  };

  const markNotificationRead = useMutation({
    mutationFn: (notificationId: string) => markPatientNotificationRead(notificationId),
    onSuccess: invalidate
  });

  const markNotificationsReadAll = useMutation({
    mutationFn: () => markAllPatientNotificationsRead(),
    onSuccess: invalidate
  });

  return {
    markNotificationRead,
    markNotificationsReadAll
  };
}
