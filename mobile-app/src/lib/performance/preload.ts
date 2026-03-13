import type { QueryClient } from '@tanstack/react-query';
import type { AuthSession } from '../auth/types';
import {
  getPatientAppointments,
  getPatientBills,
  getPatientDashboardSummary,
  getPatientMessages,
  getPatientNotifications
} from '../../services/api/patient';
import {
  getDoctorSyncFeed,
  getNurseCrossModuleFeed,
  getNurseWorklistState,
  getProviderMessageInbox,
  getProviderUnreadCount,
  listTelemedicineConsultations
} from '../../services/api/provider';

async function prefetchPatientQueries(queryClient: QueryClient): Promise<number> {
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ['patient', 'home', 'summary'],
      queryFn: getPatientDashboardSummary
    }),
    queryClient.prefetchQuery({
      queryKey: ['patient', 'home', 'appointments'],
      queryFn: () => getPatientAppointments()
    }),
    queryClient.prefetchQuery({
      queryKey: ['patient', 'home', 'notifications'],
      queryFn: () => getPatientNotifications({ limit: 20 })
    }),
    queryClient.prefetchQuery({
      queryKey: ['patient', 'home', 'messages'],
      queryFn: () => getPatientMessages({ limit: 20 })
    }),
    queryClient.prefetchQuery({
      queryKey: ['patient', 'billing', 'bills'],
      queryFn: () => getPatientBills()
    }),
    queryClient.prefetchQuery({
      queryKey: ['notifications', 'patient', 'list'],
      queryFn: () => getPatientNotifications({ limit: 30 })
    }),
    queryClient.prefetchQuery({
      queryKey: ['notifications', 'patient', 'messages'],
      queryFn: () => getPatientMessages({ limit: 30 })
    })
  ]);

  return 7;
}

async function prefetchDoctorQueries(queryClient: QueryClient): Promise<number> {
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ['provider', 'messages', 'unread'],
      queryFn: getProviderUnreadCount
    }),
    queryClient.prefetchQuery({
      queryKey: ['provider', 'messages', 'inbox', 'all'],
      queryFn: () => getProviderMessageInbox({ limit: 20 })
    }),
    queryClient.prefetchQuery({
      queryKey: ['provider', 'telemedicine', 'consultations'],
      queryFn: () => listTelemedicineConsultations({ limit: 20 })
    }),
    queryClient.prefetchQuery({
      queryKey: ['provider', 'doctor', 'sync-feed', 'all', 'open-only'],
      queryFn: () => getDoctorSyncFeed({ focus: 'all', includeAcknowledged: false })
    })
  ]);

  return 4;
}

async function prefetchNurseQueries(queryClient: QueryClient): Promise<number> {
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ['provider', 'messages', 'unread'],
      queryFn: getProviderUnreadCount
    }),
    queryClient.prefetchQuery({
      queryKey: ['provider', 'messages', 'inbox', 'all'],
      queryFn: () => getProviderMessageInbox({ limit: 20 })
    }),
    queryClient.prefetchQuery({
      queryKey: ['provider', 'nurse', 'state'],
      queryFn: getNurseWorklistState
    }),
    queryClient.prefetchQuery({
      queryKey: ['provider', 'nurse', 'cross-module-feed'],
      queryFn: getNurseCrossModuleFeed
    })
  ]);

  return 4;
}

export async function prefetchRoleQueries(
  queryClient: QueryClient,
  role: AuthSession['role']
): Promise<number> {
  if (role === 'patient') {
    return prefetchPatientQueries(queryClient);
  }

  if (role === 'doctor') {
    return prefetchDoctorQueries(queryClient);
  }

  if (role === 'nurse') {
    return prefetchNurseQueries(queryClient);
  }

  return 0;
}
