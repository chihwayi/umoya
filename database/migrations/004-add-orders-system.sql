-- Add orders system for doctor-nurse workflow
-- This ensures nurses can only execute authorized orders from doctors

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_type VARCHAR(50) NOT NULL CHECK (order_type IN ('medication', 'procedure', 'lab_test', 'imaging', 'consultation', 'diet', 'activity')),
    order_name VARCHAR(255) NOT NULL,
    description TEXT,
    instructions TEXT NOT NULL,
    dosage VARCHAR(100),
    frequency VARCHAR(100),
    duration VARCHAR(100),
    priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'in_progress', 'completed', 'cancelled', 'rejected')),
    authorized_by UUID REFERENCES users(id),
    authorized_at TIMESTAMP WITH TIME ZONE,
    executed_by UUID REFERENCES users(id),
    executed_at TIMESTAMP WITH TIME ZONE,
    execution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_patient_id ON orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_orders_appointment_id ON orders(appointment_id);
CREATE INDEX IF NOT EXISTS idx_orders_doctor_id ON orders(doctor_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_type ON orders(order_type);
CREATE INDEX IF NOT EXISTS idx_orders_authorized_by ON orders(authorized_by);
CREATE INDEX IF NOT EXISTS idx_orders_executed_by ON orders(executed_by);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- Add trigger for updated_at
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
