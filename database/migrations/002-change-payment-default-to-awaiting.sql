-- Migration: Change payment_status default to 'awaiting_payment' for Pay-Per-Visit model
-- Date: 2025-12-03
-- Description: Implements Pay-Per-Visit payment model where patients pay at each visit

-- Change the default payment_status from 'payment_confirmed' to 'awaiting_payment'
-- This ensures all new appointments require payment confirmation before service delivery

ALTER TABLE appointments 
ALTER COLUMN payment_status SET DEFAULT 'awaiting_payment';

-- Update constraint to keep all valid statuses
-- (Already correct, just documenting)
-- CHECK (payment_status IN ('awaiting_payment','payment_confirmed','in_progress','completed','cancelled'))

-- Note: Existing appointments are NOT affected by this migration
-- Only new appointments created after this migration will default to 'awaiting_payment'

-- To apply to existing unpaid appointments (OPTIONAL - run separately if needed):
-- UPDATE appointments 
-- SET payment_status = 'awaiting_payment', 
--     status = 'awaiting_payment'
-- WHERE fee_amount > 0 
--   AND payment_status = 'payment_confirmed' 
--   AND finance_transaction_id IS NULL
--   AND status = 'scheduled';

COMMENT ON COLUMN appointments.payment_status IS 'Payment status: awaiting_payment (default for paid appointments), payment_confirmed (after payment), in_progress, completed, cancelled';

