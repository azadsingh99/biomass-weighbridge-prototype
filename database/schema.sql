CREATE TABLE IF NOT EXISTS suppliers (
  id BIGSERIAL PRIMARY KEY,
  supplier_id VARCHAR(100) UNIQUE NOT NULL,
  supplier_name VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS biomass_inspections (
  id BIGSERIAL PRIMARY KEY,
  supplier_id VARCHAR(100) NOT NULL REFERENCES suppliers(supplier_id),
  capture_id UUID NOT NULL UNIQUE,
  image_reference JSONB NOT NULL,
  api_response JSONB NOT NULL,
  moisture_pct NUMERIC(5,2),
  ash_pct NUMERIC(5,2),
  foreign_stones_present BOOLEAN,
  ai_confidence NUMERIC(4,3),
  model_name VARCHAR(100),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  physical_lab_result JSONB,
  lab_result_received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inspections_supplier ON biomass_inspections(supplier_id);
CREATE INDEX IF NOT EXISTS idx_inspections_capture ON biomass_inspections(capture_id);
CREATE INDEX IF NOT EXISTS idx_inspections_created_at ON biomass_inspections(created_at);

COMMENT ON COLUMN biomass_inspections.physical_lab_result IS
'Delayed physical laboratory measurements used for offline AI calibration/validation.';
