-- Migration: Add Clinical Documentation Fields to Appointments Table
-- This migration adds fields to support comprehensive clinical documentation
-- and follow-up appointment tracking

-- Add new columns to appointments table for better clinical documentation support
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS patient_instructions TEXT,
ADD COLUMN IF NOT EXISTS priority_level VARCHAR(50) DEFAULT 'normal' CHECK (priority_level IN ('low', 'normal', 'high', 'urgent')),
ADD COLUMN IF NOT EXISTS virtual_meeting_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS is_telehealth BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS check_in_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS actual_start_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS actual_end_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS wait_time_minutes INTEGER,
ADD COLUMN IF NOT EXISTS recurring_pattern VARCHAR(100),
ADD COLUMN IF NOT EXISTS parent_appointment_id UUID REFERENCES appointments(id),
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS preparation_notes TEXT,
ADD COLUMN IF NOT EXISTS estimated_cost DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS insurance_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reminder_sent_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_reminder_sent TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

-- Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_appointments_parent_id ON appointments(parent_appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointments_priority ON appointments(priority_level);
CREATE INDEX IF NOT EXISTS idx_appointments_telehealth ON appointments(is_telehealth);
CREATE INDEX IF NOT EXISTS idx_appointments_created_by ON appointments(created_by);

-- Add comments for documentation
COMMENT ON COLUMN appointments.patient_instructions IS 'Instructions given to patient during appointment';
COMMENT ON COLUMN appointments.priority_level IS 'Priority level of the appointment';
COMMENT ON COLUMN appointments.virtual_meeting_url IS 'URL for virtual/telehealth appointments';
COMMENT ON COLUMN appointments.is_telehealth IS 'Whether this is a telehealth appointment';
COMMENT ON COLUMN appointments.check_in_time IS 'When patient checked in';
COMMENT ON COLUMN appointments.actual_start_time IS 'When appointment actually started';
COMMENT ON COLUMN appointments.actual_end_time IS 'When appointment actually ended';
COMMENT ON COLUMN appointments.wait_time_minutes IS 'How long patient waited';
COMMENT ON COLUMN appointments.recurring_pattern IS 'Pattern for recurring appointments';
COMMENT ON COLUMN appointments.parent_appointment_id IS 'Reference to parent appointment for follow-ups';
COMMENT ON COLUMN appointments.cancellation_reason IS 'Reason for appointment cancellation';
COMMENT ON COLUMN appointments.preparation_notes IS 'Notes for appointment preparation';
COMMENT ON COLUMN appointments.estimated_cost IS 'Estimated cost of appointment';
COMMENT ON COLUMN appointments.insurance_verified IS 'Whether insurance has been verified';
COMMENT ON COLUMN appointments.reminder_sent_count IS 'Number of reminders sent';
COMMENT ON COLUMN appointments.last_reminder_sent IS 'When last reminder was sent';
COMMENT ON COLUMN appointments.created_by IS 'User who created the appointment';

-- Update the updated_at trigger to include new columns
-- (The existing trigger should already handle this, but let's ensure it's working)
