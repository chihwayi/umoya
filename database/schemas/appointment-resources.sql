-- Appointment Resources (Rooms & Equipment)
CREATE TABLE IF NOT EXISTS appointment_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('room', 'equipment')),
  description TEXT,
  capacity INTEGER, -- For rooms: max occupancy
  location VARCHAR(255), -- For equipment: storage location
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointment_resources_type ON appointment_resources(type);
CREATE INDEX IF NOT EXISTS idx_appointment_resources_active ON appointment_resources(is_active);

-- Appointment Resource Bookings
CREATE TABLE IF NOT EXISTS appointment_resource_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES appointment_resources(id) ON DELETE CASCADE,
  booking_start TIMESTAMPTZ NOT NULL,
  booking_end TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(appointment_id, resource_id, booking_start)
);

CREATE INDEX IF NOT EXISTS idx_appointment_resource_bookings_appointment ON appointment_resource_bookings(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_resource_bookings_resource ON appointment_resource_bookings(resource_id);
CREATE INDEX IF NOT EXISTS idx_appointment_resource_bookings_time ON appointment_resource_bookings(booking_start, booking_end);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_appointment_resources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_appointment_resources_updated_at
  BEFORE UPDATE ON appointment_resources
  FOR EACH ROW
  EXECUTE FUNCTION update_appointment_resources_updated_at();

CREATE TRIGGER trigger_appointment_resource_bookings_updated_at
  BEFORE UPDATE ON appointment_resource_bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_appointment_resources_updated_at();

