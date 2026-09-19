CREATE TABLE suppliers (
  id SERIAL PRIMARY KEY,
  supplier_id VARCHAR(100) UNIQUE NOT NULL,
  supplier_name VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE biomass_inspections (
  id SERIAL PRIMARY KEY,
  supplier_id VARCHAR(100) NOT NULL REFERENCES suppliers(supplier_id),
  capture_id UUID NOT NULL,
  image_reference TEXT NOT NULL,
  api_response JSONB NOT NULL,
  moisture_pct NUMERIC(5,2),
  ash_pct NUMERIC(5,2),
  foreign_stones_present BOOLEAN,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  physical_lab_result JSONB,
  lab_result_received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_inspections_supplier ON biomass_inspections(supplier_id);
CREATE INDEX idx_inspections_capture ON biomass_inspections(capture_id);
