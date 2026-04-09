-- Seed Data: Operating Rooms for Demo Clinic

-- Insert 5 Operating Rooms
INSERT INTO operating_rooms (room_number, room_name, location, room_type, has_laminar_flow, has_c_arm, has_microscope, equipment_list, capacity) VALUES
('OR-1', 'Main Operating Theatre 1', 'Surgical Suite - 2nd Floor', 'general', true, true, false,
 '["Surgical Table", "Anesthesia Machine", "Electrocautery", "Suction System", "Surgical Lights", "Monitoring System"]'::jsonb, 1),

('OR-2', 'Main Operating Theatre 2', 'Surgical Suite - 2nd Floor', 'general', true, false, false,
 '["Surgical Table", "Anesthesia Machine", "Electrocautery", "Suction System", "Surgical Lights", "Monitoring System"]'::jsonb, 1),

('OR-3', 'Cardiac Surgery Suite', 'Surgical Suite - 2nd Floor', 'cardiac', true, true, false,
 '["Cardiac Surgical Table", "Anesthesia Machine", "Heart-Lung Machine", "TEE Probe", "Defibrillator", "Surgical Lights", "C-Arm", "Cell Saver"]'::jsonb, 1),

('OR-4', 'Orthopedic Suite', 'Surgical Suite - 2nd Floor', 'ortho', true, true, false,
 '["Orthopedic Table", "Anesthesia Machine", "C-Arm", "Arthroscopy Tower", "Power Tools", "Surgical Lights", "Tourniquet System"]'::jsonb, 1),

('OR-5', 'Minor Procedures Room', 'Day Surgery Unit - 1st Floor', 'minor_procedure', false, false, false,
 '["Procedure Table", "Surgical Lights", "Anesthesia Cart", "Monitoring System"]'::jsonb, 1)

ON CONFLICT (room_number) DO UPDATE SET
  room_name = EXCLUDED.room_name,
  location = EXCLUDED.location,
  room_type = EXCLUDED.room_type,
  equipment_list = EXCLUDED.equipment_list,
  updated_at = NOW();

-- Verify
DO $$
DECLARE
  or_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO or_count FROM operating_rooms;
  RAISE NOTICE '✅ Operating Rooms seeded: % rooms', or_count;
END $$;

