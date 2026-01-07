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
    status TEXT NOT NULL, -- pending, waiting_approval, paid, etc.
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

-- Note: Policies would be added here depending on specific user roles.
