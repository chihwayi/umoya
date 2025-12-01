-- Appointment Templates Table
CREATE TABLE IF NOT EXISTS appointment_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  instructions TEXT,
  color VARCHAR(7) DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointment_templates_type ON appointment_templates(type);
CREATE INDEX IF NOT EXISTS idx_appointment_templates_active ON appointment_templates(is_active);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_appointment_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_appointment_templates_updated_at
  BEFORE UPDATE ON appointment_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_appointment_templates_updated_at();


