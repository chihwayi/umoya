-- Fix Medication Reminders Table
-- Add missing columns: reminder_type, timezone, sent_count
-- Fix column name: next_send_at -> next_reminder_at (already correct in schema)

-- Add reminder_type column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'medication_reminders' 
        AND column_name = 'reminder_type'
    ) THEN
        ALTER TABLE medication_reminders 
        ADD COLUMN reminder_type VARCHAR(20) DEFAULT 'all' 
        CHECK (reminder_type IN ('sms', 'email', 'notification', 'push', 'all'));
    END IF;
END $$;

-- Add timezone column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'medication_reminders' 
        AND column_name = 'timezone'
    ) THEN
        ALTER TABLE medication_reminders 
        ADD COLUMN timezone VARCHAR(100) DEFAULT 'Africa/Harare';
    END IF;
END $$;

-- Add sent_count column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'medication_reminders' 
        AND column_name = 'sent_count'
    ) THEN
        ALTER TABLE medication_reminders 
        ADD COLUMN sent_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- Create index on next_reminder_at if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_medication_reminders_next_reminder 
ON medication_reminders(next_reminder_at) 
WHERE is_active = true;

COMMENT ON COLUMN medication_reminders.reminder_type IS 'Type of reminder: sms, email, notification, push, or all';
COMMENT ON COLUMN medication_reminders.timezone IS 'Timezone for reminder scheduling (e.g., Africa/Harare)';
COMMENT ON COLUMN medication_reminders.sent_count IS 'Number of times this reminder has been sent';


