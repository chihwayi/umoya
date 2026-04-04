import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as SecureStore from 'expo-secure-store';
import { getApiClient } from './api';
import { api } from './api';

export interface ApiPrescription {
  id: string;
  patientId: string;
  drugName: string;
  genericName?: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  duration?: string;
  quantity?: number;
  refills?: number;
  instructions?: string;
  prescribedBy?: string;
  prescribedDate?: string;
  status?: 'active' | 'completed' | 'cancelled' | 'dispensed';
  dispensedDate?: string;
  sideEffects?: string[];
  contraindications?: string[];
}

export const PrescriptionsService = {
  forPatient: (patientId: string) =>
    api.get<ApiPrescription[]>(`/prescriptions/patient/${patientId}`).then(r => r.data),

  forCurrentPatient: (activeOnly = false) => {
    const qs = activeOnly ? '?activeOnly=true' : '';
    return api.get<any[]>(`/patient-portal/prescriptions${qs}`).then(r =>
      (r.data ?? []).map((item: any) => ({
        id: item.id,
        patientId: item.patientId ?? '',
        drugName: item.drugName ?? item.medicationName ?? 'Medication',
        genericName: item.genericName,
        dosage: item.dosage,
        frequency: item.frequency,
        route: item.route,
        duration: item.duration,
        quantity: item.quantity,
        refills: item.refills,
        instructions: item.instructions,
        prescribedBy: item.prescribedBy
          ?? ([item.prescriber?.firstName, item.prescriber?.lastName].filter(Boolean).join(' ') || undefined),
        prescribedDate: item.prescribedDate,
        status: item.status,
        dispensedDate: item.dispensedDate,
        sideEffects: item.sideEffects,
        contraindications: item.contraindications,
      } as ApiPrescription)),
    );
  },

  create: (dto: Partial<ApiPrescription>) =>
    api.post<ApiPrescription>('/prescriptions', dto).then(r => r.data),

  /**
   * Download prescription PDF to device cache then open native share sheet.
   * The share sheet on iOS includes AirDrop, Save to Files, and Print.
   * On Android it opens the system share intent.
   */
  downloadAndShare: async (id: string, rxLabel: string): Promise<void> => {
    const jwt = await SecureStore.getItemAsync('medicore_jwt');
    const baseUrl = getApiClient().defaults.baseURL ?? '';
    const remoteUri = `${baseUrl}/patient-portal/prescriptions/${id}/download`;
    const localUri = `${FileSystem.cacheDirectory}prescription-${id}.pdf`;

    const result = await FileSystem.downloadAsync(remoteUri, localUri, {
      headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
    });
    if (result.status !== 200) throw new Error('Download failed');

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) throw new Error('Sharing not available on this device');

    await Sharing.shareAsync(result.uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Prescription — ${rxLabel}`,
      UTI: 'com.adobe.pdf',
    });
  },

  /** Send prescription PDF to patient's email via the backend mailer. */
  shareByEmail: (id: string, email: string) =>
    api.post<void>(`/patient-portal/prescriptions/${id}/share`, { email }).then(r => r.data),
};
