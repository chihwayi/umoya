import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPatientPayment, getPatientBills, requestAppointmentWithPayment } from '../../../services/api/patient';

const QUERY_KEYS = {
  bills: ['patient', 'billing', 'bills'] as const
};

export function usePatientBills() {
  return useQuery({
    queryKey: QUERY_KEYS.bills,
    queryFn: () => getPatientBills(),
    refetchInterval: 45_000
  });
}

export function usePatientBillingMutations() {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.bills });
  };

  const createPayment = useMutation({
    mutationFn: (payload: {
      billId?: string;
      amount: number;
      paymentMethod: 'ecocash' | 'onemoney' | 'card' | 'bank_transfer';
      paymentReference?: string;
    }) => createPatientPayment(payload),
    onSuccess: invalidate
  });

  const requestWithPayment = useMutation({
    mutationFn: requestAppointmentWithPayment
  });

  return {
    createPayment,
    requestWithPayment
  };
}
