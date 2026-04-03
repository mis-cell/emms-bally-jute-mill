-- ================================================================
-- ELECTRIC METER MONITORING SYSTEM — Supabase Schema
-- Bally Jute Mill | Run this in Supabase SQL Editor
-- ================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================================
-- TABLES
-- ================================================================

-- Users (custom auth, not Supabase auth)
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username    TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,          -- SHA-256 hex stored here
  role        TEXT NOT NULL CHECK (role IN ('admin','superadmin','user')),
  full_name   TEXT DEFAULT '',
  email       TEXT DEFAULT '',
  phone       TEXT DEFAULT '',
  status      TEXT DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  last_login  TIMESTAMPTZ
);

-- Workers
CREATE TABLE IF NOT EXISTS workers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_code   TEXT DEFAULT '',
  name            TEXT NOT NULL,
  department      TEXT DEFAULT '',
  designation     TEXT DEFAULT '',
  phone           TEXT DEFAULT '',
  email           TEXT DEFAULT '',
  joining_date    DATE,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active','inactive')),
  address         TEXT DEFAULT '',
  meter_number    TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Meters
CREATE TABLE IF NOT EXISTS meters (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meter_number  TEXT UNIQUE NOT NULL,
  location      TEXT DEFAULT '',
  worker_id     UUID REFERENCES workers(id) ON DELETE SET NULL,
  worker_name   TEXT DEFAULT '',
  install_date  DATE,
  status        TEXT DEFAULT 'active' CHECK (status IN ('active','inactive')),
  max_load      NUMERIC DEFAULT 10,
  phase         TEXT DEFAULT '1-Phase',
  remarks       TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Meter Readings
CREATE TABLE IF NOT EXISTS meter_readings (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meter_id         UUID REFERENCES meters(id) ON DELETE CASCADE,
  meter_number     TEXT NOT NULL,
  worker_id        UUID REFERENCES workers(id) ON DELETE SET NULL,
  worker_name      TEXT DEFAULT '',
  reading_date     DATE NOT NULL,
  reading_value    NUMERIC NOT NULL,
  previous_reading NUMERIC DEFAULT 0,
  consumption      NUMERIC GENERATED ALWAYS AS (reading_value - previous_reading) STORED,
  month            INTEGER,
  year             INTEGER,
  entered_by       TEXT DEFAULT '',
  is_anomaly       BOOLEAN DEFAULT FALSE,
  anomaly_reason   TEXT DEFAULT '',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Master Meter Readings
CREATE TABLE IF NOT EXISTS master_meter_readings (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reading_date     DATE NOT NULL,
  reading_value    NUMERIC NOT NULL,
  previous_reading NUMERIC DEFAULT 0,
  consumption      NUMERIC GENERATED ALWAYS AS (reading_value - previous_reading) STORED,
  month            INTEGER,
  year             INTEGER,
  entered_by       TEXT DEFAULT '',
  remarks          TEXT DEFAULT '',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Anomalies
CREATE TABLE IF NOT EXISTS anomalies (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meter_id            UUID REFERENCES meters(id) ON DELETE CASCADE,
  meter_number        TEXT NOT NULL,
  worker_id           UUID REFERENCES workers(id) ON DELETE SET NULL,
  worker_name         TEXT DEFAULT '',
  month               INTEGER,
  year                INTEGER,
  consumption         NUMERIC,
  average_consumption NUMERIC,
  deviation_percent   NUMERIC,
  type                TEXT CHECK (type IN ('HIGH','LOW','INACTIVE_CONSUMING')),
  status              TEXT DEFAULT 'open' CHECK (status IN ('open','resolved')),
  alert_sent          BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Alert Log
CREATE TABLE IF NOT EXISTS alert_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_type  TEXT DEFAULT '',
  recipient   TEXT DEFAULT '',
  subject     TEXT DEFAULT '',
  message     TEXT DEFAULT '',
  status      TEXT DEFAULT 'sent',
  sent_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Settings (key-value)
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT DEFAULT '',
  description TEXT DEFAULT '',
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- INDEXES for performance
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_readings_meter    ON meter_readings(meter_id);
CREATE INDEX IF NOT EXISTS idx_readings_month    ON meter_readings(month, year);
CREATE INDEX IF NOT EXISTS idx_readings_worker   ON meter_readings(worker_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_status  ON anomalies(status);
CREATE INDEX IF NOT EXISTS idx_anomalies_month   ON anomalies(month, year);
CREATE INDEX IF NOT EXISTS idx_workers_status    ON workers(status);
CREATE INDEX IF NOT EXISTS idx_meters_status     ON meters(status);

-- ================================================================
-- ROW LEVEL SECURITY — disable for service_role key (API uses it)
-- ================================================================
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE meters              ENABLE ROW LEVEL SECURITY;
ALTER TABLE meter_readings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_meter_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomalies           ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings            ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access (used by Vercel API)
CREATE POLICY "service_role_all" ON users               FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON workers             FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON meters              FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON meter_readings      FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON master_meter_readings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON anomalies           FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON alert_log           FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON settings            FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ================================================================
-- SEED DATA
-- ================================================================

-- Default users (passwords are SHA-256 of the plain text)
-- admin        → Admin@1234
-- superadmin   → Superadmin@1234
-- user1        → User@1234
INSERT INTO users (username, password, role, full_name, email, status) VALUES
  ('admin',      encode(digest('Admin@1234',      'sha256'), 'hex'), 'admin',      'System Admin', 'admin@ballyjutemill.com',      'active'),
  ('superadmin', encode(digest('Superadmin@1234', 'sha256'), 'hex'), 'superadmin', 'Super Admin',  'superadmin@ballyjutemill.com', 'active'),
  ('user1',      encode(digest('User@1234',       'sha256'), 'hex'), 'user',       'Data Entry User','user1@ballyjutemill.com',    'active')
ON CONFLICT (username) DO NOTHING;

-- Default settings
INSERT INTO settings (key, value, description) VALUES
  ('supervisor_emails',    '',    'Comma-separated supervisor alert emails'),
  ('alert_threshold_high', '150', 'High consumption anomaly % threshold'),
  ('alert_threshold_low',  '20',  'Low consumption anomaly % threshold'),
  ('company_name',         'Bally Jute Mill', 'Company name'),
  ('smtp_host',            '',    'SMTP host for email alerts'),
  ('smtp_port',            '587', 'SMTP port'),
  ('smtp_user',            '',    'SMTP username/email'),
  ('smtp_pass',            '',    'SMTP password'),
  ('alert_whatsapp',       '',    'WhatsApp number for alerts')
ON CONFLICT (key) DO NOTHING;

-- Sample workers (20 sample records)
DO $$
DECLARE
  depts TEXT[] := ARRAY['Weaving','Spinning','Processing','Finishing','Maintenance','Administration'];
  desigs TEXT[] := ARRAY['Operator','Senior Operator','Supervisor','Technician','Helper'];
  wid UUID;
  i INTEGER;
BEGIN
  FOR i IN 1..20 LOOP
    INSERT INTO workers (employee_code, name, department, designation, phone, joining_date, status, meter_number)
    VALUES (
      'EMP' || (1000 + i),
      'Worker ' || i,
      depts[((i-1) % array_length(depts,1)) + 1],
      desigs[((i-1) % array_length(desigs,1)) + 1],
      '9000000' || LPAD(i::TEXT, 3, '0'),
      ('2020-01-' || LPAD(((i % 28) + 1)::TEXT, 2, '0'))::DATE,
      CASE WHEN i > 17 THEN 'inactive' ELSE 'active' END,
      'MTR' || LPAD(i::TEXT, 4, '0')
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Sample meters linked to workers
DO $$
DECLARE
  depts TEXT[] := ARRAY['Weaving','Spinning','Processing','Finishing','Maintenance','Administration'];
  w RECORD;
  i INTEGER := 1;
BEGIN
  FOR w IN SELECT id, name, meter_number FROM workers ORDER BY created_at LOOP
    INSERT INTO meters (meter_number, location, worker_id, worker_name, install_date, status, max_load, phase)
    VALUES (
      w.meter_number,
      depts[((i-1) % array_length(depts,1)) + 1] || ' Block ' || CEIL(i::FLOAT/5),
      w.id,
      w.name,
      '2020-01-01',
      CASE WHEN i > 17 THEN 'inactive' ELSE 'active' END,
      10,
      '1-Phase'
    )
    ON CONFLICT (meter_number) DO NOTHING;
    i := i + 1;
  END LOOP;
END $$;

-- Sample readings for last 6 months
DO $$
DECLARE
  m_rec RECORD;
  mnth INTEGER;
  yr INTEGER;
  prev_val NUMERIC := 1000;
  curr_val NUMERIC;
  cons NUMERIC;
  d DATE;
BEGIN
  FOR mnth_offset IN REVERSE 5..0 LOOP
    d := DATE_TRUNC('month', NOW() - (mnth_offset || ' months')::INTERVAL)::DATE;
    mnth := EXTRACT(MONTH FROM d);
    yr   := EXTRACT(YEAR  FROM d);
    FOR m_rec IN SELECT id, meter_number, worker_id, worker_name FROM meters ORDER BY meter_number LOOP
      cons := FLOOR(RANDOM() * 200 + 50);
      prev_val := 1000 + (mnth_offset * 200);
      curr_val := prev_val + cons;
      INSERT INTO meter_readings
        (meter_id, meter_number, worker_id, worker_name, reading_date,
         reading_value, previous_reading, month, year, entered_by)
      VALUES
        (m_rec.id, m_rec.meter_number, m_rec.worker_id, m_rec.worker_name,
         d, curr_val, prev_val, mnth, yr, 'admin')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
