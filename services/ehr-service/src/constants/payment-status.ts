export type PaymentStatus =
  | 'awaiting_payment'
  | 'payment_confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export const PAYMENT_STATUS = {
  AWAITING_PAYMENT: 'awaiting_payment' as PaymentStatus,
  PAYMENT_CONFIRMED: 'payment_confirmed' as PaymentStatus,
  IN_PROGRESS: 'in_progress' as PaymentStatus,
  COMPLETED: 'completed' as PaymentStatus,
  CANCELLED: 'cancelled' as PaymentStatus,
};



