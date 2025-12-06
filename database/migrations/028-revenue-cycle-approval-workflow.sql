-- Migration 028: Revenue Cycle Approval Workflow
-- Date: December 5, 2025
-- Description: Adds approval workflow columns to patient_charges table for doctor review and approval

-- =====================================================================================================================
-- Add Approval Workflow Columns to patient_charges
-- =====================================================================================================================

DO $$
BEGIN
    -- Add reviewed_by column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_charges' AND column_name = 'reviewed_by') THEN
        ALTER TABLE patient_charges ADD COLUMN reviewed_by UUID REFERENCES users(id);
        RAISE NOTICE 'Added column reviewed_by to patient_charges table.';
    ELSE
        RAISE NOTICE 'Column reviewed_by already exists in patient_charges table.';
    END IF;

    -- Add reviewed_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_charges' AND column_name = 'reviewed_at') THEN
        ALTER TABLE patient_charges ADD COLUMN reviewed_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added column reviewed_at to patient_charges table.';
    ELSE
        RAISE NOTICE 'Column reviewed_at already exists in patient_charges table.';
    END IF;

    -- Add approved_by column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_charges' AND column_name = 'approved_by') THEN
        ALTER TABLE patient_charges ADD COLUMN approved_by UUID REFERENCES users(id);
        RAISE NOTICE 'Added column approved_by to patient_charges table.';
    ELSE
        RAISE NOTICE 'Column approved_by already exists in patient_charges table.';
    END IF;

    -- Add approved_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_charges' AND column_name = 'approved_at') THEN
        ALTER TABLE patient_charges ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added column approved_at to patient_charges table.';
    ELSE
        RAISE NOTICE 'Column approved_at already exists in patient_charges table.';
    END IF;

    -- Add approval_notes column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_charges' AND column_name = 'approval_notes') THEN
        ALTER TABLE patient_charges ADD COLUMN approval_notes TEXT;
        RAISE NOTICE 'Added column approval_notes to patient_charges table.';
    ELSE
        RAISE NOTICE 'Column approval_notes already exists in patient_charges table.';
    END IF;

    -- Add rejection_reason column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_charges' AND column_name = 'rejection_reason') THEN
        ALTER TABLE patient_charges ADD COLUMN rejection_reason TEXT;
        RAISE NOTICE 'Added column rejection_reason to patient_charges table.';
    ELSE
        RAISE NOTICE 'Column rejection_reason already exists in patient_charges table.';
    END IF;

    -- Update charge_status check constraint to include 'approved' and 'rejected'
    -- First, drop the existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'patient_charges' 
        AND constraint_name = 'patient_charges_charge_status_check'
    ) THEN
        ALTER TABLE patient_charges DROP CONSTRAINT patient_charges_charge_status_check;
        RAISE NOTICE 'Dropped existing charge_status check constraint.';
    END IF;

    -- Add new constraint with 'approved' and 'rejected' statuses
    ALTER TABLE patient_charges ADD CONSTRAINT patient_charges_charge_status_check 
        CHECK (charge_status IN ('pending', 'reviewed', 'approved', 'rejected', 'billed', 'paid', 'adjusted', 'written_off'));
    RAISE NOTICE 'Added updated charge_status check constraint with approved and rejected statuses.';

    -- Create indexes for approval workflow queries
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_patient_charges_reviewed_by') THEN
        CREATE INDEX idx_patient_charges_reviewed_by ON patient_charges(reviewed_by);
        RAISE NOTICE 'Created index idx_patient_charges_reviewed_by.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_patient_charges_approved_by') THEN
        CREATE INDEX idx_patient_charges_approved_by ON patient_charges(approved_by);
        RAISE NOTICE 'Created index idx_patient_charges_approved_by.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_patient_charges_approval_status') THEN
        CREATE INDEX idx_patient_charges_approval_status ON patient_charges(charge_status) WHERE charge_status IN ('pending', 'reviewed', 'approved', 'rejected');
        RAISE NOTICE 'Created index idx_patient_charges_approval_status.';
    END IF;

END $$;

-- =====================================================================================================================
-- Create notifications table for accounts department (if it doesn't exist)
-- =====================================================================================================================

CREATE TABLE IF NOT EXISTS charge_approval_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  admission_id UUID REFERENCES admissions(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  
  -- Notification Details
  notification_type VARCHAR(50) DEFAULT 'charge_approved' CHECK (notification_type IN ('charge_approved', 'charges_ready_for_billing')),
  notification_status VARCHAR(50) DEFAULT 'unread' CHECK (notification_status IN ('unread', 'read', 'dismissed')),
  
  -- Charge Summary
  total_charges_count INTEGER DEFAULT 0,
  total_charges_amount DECIMAL(10, 2) DEFAULT 0,
  
  -- Notification Metadata
  created_by UUID REFERENCES users(id), -- Doctor who approved
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_by UUID REFERENCES users(id),
  read_at TIMESTAMP WITH TIME ZONE,
  
  -- Additional Info
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_charge_notifications_admission ON charge_approval_notifications(admission_id);
CREATE INDEX IF NOT EXISTS idx_charge_notifications_patient ON charge_approval_notifications(patient_id);
CREATE INDEX IF NOT EXISTS idx_charge_notifications_status ON charge_approval_notifications(notification_status);
CREATE INDEX IF NOT EXISTS idx_charge_notifications_created_at ON charge_approval_notifications(created_at DESC);

COMMENT ON TABLE charge_approval_notifications IS 'Notifications sent to accounts department when charges are approved by doctors';
COMMENT ON COLUMN charge_approval_notifications.notification_type IS 'Type of notification: charge_approved or charges_ready_for_billing';
COMMENT ON COLUMN charge_approval_notifications.notification_status IS 'Status: unread, read, or dismissed';


