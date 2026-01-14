-- Supabase SQL Schema for HSU CRM (Nexus Edition)
-- Based on types.ts

-- 1. Enum for User Roles
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('client', 'admin', 'staff');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    instagram TEXT NOT NULL,
    phone_number TEXT,
    pin TEXT NOT NULL,
    role user_role DEFAULT 'client'::user_role,
    balance NUMERIC DEFAULT 0,
    stars INTEGER DEFAULT 1,
    courtesy_progress INTEGER DEFAULT 0,
    lifetime_tickets INTEGER DEFAULT 0,
    is_promoter BOOLEAN DEFAULT FALSE,
    referral_count INTEGER DEFAULT 0,
    pending_edits JSONB, -- Stores partial updates if needed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Purchase Groups (Transaction Headers)
CREATE TABLE IF NOT EXISTS purchase_groups (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    seller_email TEXT, -- Promoter or system email
    total_amount NUMERIC DEFAULT 0,
    is_full_payment BOOLEAN DEFAULT FALSE,
    status TEXT NOT NULL, -- TicketStatus type
    event_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tickets (Individual Items / Order Lines)
CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES purchase_groups(id) ON DELETE CASCADE,
    status TEXT NOT NULL, -- TicketStatus type
    price NUMERIC DEFAULT 0,
    paid_amount NUMERIC DEFAULT 0,
    pending_payment NUMERIC DEFAULT 0,
    cost NUMERIC DEFAULT 0,
    assigned_link TEXT,
    event_name TEXT,
    event_id TEXT,
    is_unlocked BOOLEAN DEFAULT FALSE, -- NEW FIELD
    is_courtesy BOOLEAN DEFAULT FALSE,
    internal_correlative INTEGER, -- Cross-ref to inventory
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Inventory (Stock Management)
CREATE TABLE IF NOT EXISTS inventory (
    correlative_id INTEGER NOT NULL,
    event_id TEXT NOT NULL,
    name TEXT NOT NULL,
    link TEXT,
    cost NUMERIC DEFAULT 0,
    is_assigned BOOLEAN DEFAULT FALSE,
    assigned_to TEXT, -- Client Name string
    assigned_user_email TEXT REFERENCES users(email) ON DELETE SET NULL,
    assigned_ticket_id TEXT REFERENCES tickets(id) ON DELETE SET NULL, -- NEW FIELD
    batch_number INTEGER, -- Tanda numbering
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    event_name TEXT,
    is_pending_link BOOLEAN DEFAULT TRUE,
    status TEXT DEFAULT 'active', -- 'active' | 'reversion'
    PRIMARY KEY (event_id, correlative_id)
);

-- 6. Activity Logs (Audit Trail)
CREATE TABLE IF NOT EXISTS activity_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    action TEXT NOT NULL,
    user_email TEXT, -- Can be email or 'SYSTEM'
    user_full_name TEXT,
    type TEXT NOT NULL, -- LogType enum in TS
    event_id TEXT,
    details TEXT
);

-- 7. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_tickets_group_id ON tickets(group_id);
CREATE INDEX IF NOT EXISTS idx_purchase_groups_user ON purchase_groups(user_email);
CREATE INDEX IF NOT EXISTS idx_inventory_ticket ON inventory(assigned_ticket_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_type ON activity_logs(type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_event ON activity_logs(event_id);

-- 8. Basic RLS (Optional logic - Enable if using Supabase Auth)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- 9. Event Config Table (Single Row Pattern)
-- Drop if exists to ensure clean slate for new structure
DROP TABLE IF EXISTS event_config;

CREATE TABLE event_config (
  id uuid not null default gen_random_uuid(),
  singleton_key text not null unique default 'current' check (singleton_key = 'current'),
  titulo_evento text null,
  id_interno text null,
  fecha_evento timestamp with time zone null,
  precio_referencial numeric default 0,
  precio_final numeric default 0,
  event_location text null, -- Keep for backward compatibility or remove if strictly following new spec (user passed map_url, maybe location text is useful too?)
  banner_url text null,
  map_url text null,
  whatsapp_contacto text null,
  estado_evento text null default 'active',
  updated_at timestamp with time zone null default now(),
  constraint event_config_pkey primary key (id)
);

ALTER TABLE event_config ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read
CREATE POLICY "Allow public read access" ON event_config FOR SELECT USING (true);

-- Policy: Only service role (admin API) can update, or authenticated admins if using direct connection
CREATE POLICY "Allow admin update" ON event_config FOR UPDATE USING (
  auth.role() = 'service_role' OR 
  (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM users WHERE email = auth.email() AND role = 'admin'))
);
-- Note: Insert is technically possible but limited by singleton_key. 
-- We allow admin insert to initialize the single row if it's missing.
CREATE POLICY "Allow admin insert" ON event_config FOR INSERT WITH CHECK (
  auth.role() = 'service_role' OR 
  (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM users WHERE email = auth.email() AND role = 'admin'))
);
