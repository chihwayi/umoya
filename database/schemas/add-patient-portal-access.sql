-- Add patient portal access fields to patients table
-- This allows patients to register and login to the portal

ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS portal_password_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS portal_access_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS portal_registered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS portal_last_login TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS portal_email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS portal_email_verification_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS portal_password_reset_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS portal_password_reset_expires TIMESTAMPTZ;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_patients_portal_email ON patients(email) WHERE portal_access_enabled = true;
CREATE INDEX IF NOT EXISTS idx_patients_portal_verification_token ON patients(portal_email_verification_token) WHERE portal_email_verification_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patients_portal_reset_token ON patients(portal_password_reset_token) WHERE portal_password_reset_token IS NOT NULL;

-- Add comments
COMMENT ON COLUMN patients.portal_password_hash IS 'Hashed password for patient portal access';
COMMENT ON COLUMN patients.portal_access_enabled IS 'Whether patient has portal access enabled';
COMMENT ON COLUMN patients.portal_registered_at IS 'When patient registered for portal access';
COMMENT ON COLUMN patients.portal_last_login IS 'Last portal login timestamp';
COMMENT ON COLUMN patients.portal_email_verified IS 'Whether patient email is verified';
COMMENT ON COLUMN patients.portal_email_verification_token IS 'Token for email verification';
COMMENT ON COLUMN patients.portal_password_reset_token IS 'Token for password reset';
COMMENT ON COLUMN patients.portal_password_reset_expires IS 'Password reset token expiration';


