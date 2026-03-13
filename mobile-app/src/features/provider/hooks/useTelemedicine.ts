import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  endTelemedicineConsultation,
  getTelemedicineMeetingUrl,
  joinTelemedicineConsultation,
  listTelemedicineConsultations
} from '../../../services/api/provider';

const QUERY_KEYS = {
  consultations: ['provider', 'telemedicine', 'consultations'] as const
};

export function useTelemedicineConsultations() {
  return useQuery({
    queryKey: QUERY_KEYS.consultations,
    queryFn: () => listTelemedicineConsultations({ limit: 20 }),
    refetchInterval: 30_000
  });
}

export function useTelemedicineMutations() {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.consultations });
  };

  const joinConsultation = useMutation({
    mutationFn: (consultationId: string) => joinTelemedicineConsultation(consultationId),
    onSuccess: invalidate
  });

  const endConsultation = useMutation({
    mutationFn: (consultationId: string) => endTelemedicineConsultation(consultationId),
    onSuccess: invalidate
  });

  const getMeetingUrl = useMutation({
    mutationFn: (consultationId: string) => getTelemedicineMeetingUrl(consultationId)
  });

  return {
    joinConsultation,
    endConsultation,
    getMeetingUrl
  };
}
