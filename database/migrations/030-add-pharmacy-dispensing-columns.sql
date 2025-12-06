-- Migration: Add missing columns to pharmacy_dispensings table
-- Date: 2025-12-06
-- Purpose: Add dispensing_number, total_amount, amount_paid, discount_amount columns for complete pharmacy dispensing functionality

-- Add dispensing_number column (unique identifier for dispensing)
ALTER TABLE pharmacy_dispensings ADD COLUMN IF NOT EXISTS dispensing_number VARCHAR(50) UNIQUE;

-- Add total_amount column (total cost of dispensing)
ALTER TABLE pharmacy_dispensings ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12,2) DEFAULT 0;

-- Add amount_paid column (amount paid by patient)
ALTER TABLE pharmacy_dispensings ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2) DEFAULT 0;

-- Add discount_amount column (discount applied)
ALTER TABLE pharmacy_dispensings ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) DEFAULT 0;

-- Create index on dispensing_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_pharmacy_dispensings_dispensing_number ON pharmacy_dispensings(dispensing_number);

-- Add comments
COMMENT ON COLUMN pharmacy_dispensings.dispensing_number IS 'Unique dispensing number/identifier';
COMMENT ON COLUMN pharmacy_dispensings.total_amount IS 'Total amount for the dispensing';
COMMENT ON COLUMN pharmacy_dispensings.amount_paid IS 'Amount paid by patient';
COMMENT ON COLUMN pharmacy_dispensings.discount_amount IS 'Discount amount applied';

