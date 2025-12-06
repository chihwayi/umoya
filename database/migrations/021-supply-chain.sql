-- Migration 021: Supply Chain Management
-- Date: December 4, 2025

CREATE TABLE IF NOT EXISTS supply_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name VARCHAR(255) NOT NULL,
  item_code VARCHAR(50) UNIQUE NOT NULL,
  category VARCHAR(100),
  quantity INTEGER DEFAULT 0,
  par_level INTEGER DEFAULT 10,
  unit_cost DECIMAL(10, 2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_supply_inventory_code ON supply_inventory(item_code);
CREATE INDEX idx_supply_inventory_category ON supply_inventory(category);




