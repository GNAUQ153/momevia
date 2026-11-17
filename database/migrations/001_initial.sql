-- Momevia v0.7: lược đồ PostgreSQL khởi tạo.
-- Chỉ dùng cho database mới, chưa thay thế JSON Repository lúc runtime.
-- Thực thi bằng psql -v ON_ERROR_STOP=1 -f database/migrations/001_initial.sql
BEGIN;

CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE IF NOT EXISTS app.schema_migrations (
    version VARCHAR(40) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app.users (
    id UUID PRIMARY KEY,
    provider VARCHAR(30) NOT NULL,
    provider_id TEXT NOT NULL,
    name VARCHAR(100) NOT NULL,
    email TEXT,
    password_hash TEXT,
    avatar TEXT,
    role VARCHAR(20) NOT NULL DEFAULT 'sender',
    created_at TIMESTAMPTZ NOT NULL,
    legacy_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT users_provider_identity_uk UNIQUE (provider, provider_id),
    CONSTRAINT users_role_ck CHECK (role IN ('sender', 'creator', 'admin')),
    CONSTRAINT users_email_provider_ck CHECK (provider <> 'email' OR (email IS NOT NULL AND password_hash IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_login_uk
    ON app.users (LOWER(email)) WHERE provider = 'email';

CREATE TABLE IF NOT EXISTS app.sessions (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON app.sessions (expires_at);

CREATE TABLE IF NOT EXISTS app.templates (
    id TEXT PRIMARY KEY,
    creator_id UUID REFERENCES app.users(id) ON DELETE SET NULL,
    title VARCHAR(100) NOT NULL,
    style TEXT NOT NULL,
    theme TEXT NOT NULL,
    price_vnd INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL,
    CONSTRAINT templates_price_ck CHECK (price_vnd BETWEEN 0 AND 500000),
    CONSTRAINT templates_status_ck CHECK (status IN ('published', 'pending', 'rejected'))
);
CREATE INDEX IF NOT EXISTS templates_discover_idx ON app.templates(status, style, created_at DESC);
CREATE INDEX IF NOT EXISTS templates_creator_idx ON app.templates(creator_id, created_at DESC);

CREATE TABLE IF NOT EXISTS app.favorites (
    user_id UUID NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    template_id TEXT NOT NULL REFERENCES app.templates(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (user_id, template_id)
);

CREATE TABLE IF NOT EXISTS app.gifts (
    id UUID PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES app.users(id),
    template_id TEXT NOT NULL REFERENCES app.templates(id),
    recipient_name VARCHAR(100) NOT NULL,
    sender_name VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    image_file TEXT,
    reply_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL,
    CONSTRAINT gifts_reply_count_ck CHECK (reply_count >= 0),
    CONSTRAINT gifts_expiry_ck CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS gifts_owner_created_idx ON app.gifts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS gifts_expiry_idx ON app.gifts (expires_at);

CREATE TABLE IF NOT EXISTS app.gift_replies (
    id UUID PRIMARY KEY,
    gift_id UUID NOT NULL REFERENCES app.gifts(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS gift_replies_gift_idx ON app.gift_replies (gift_id, created_at);

CREATE TABLE IF NOT EXISTS app.orders (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app.users(id),
    template_id TEXT NOT NULL REFERENCES app.templates(id),
    gross_vnd INTEGER NOT NULL,
    platform_fee_vnd INTEGER NOT NULL,
    creator_amount_vnd INTEGER NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'VND',
    status TEXT NOT NULL,
    payment_provider TEXT NOT NULL,
    is_test BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL,
    CONSTRAINT orders_nonnegative_ck CHECK (gross_vnd >= 0 AND platform_fee_vnd >= 0 AND creator_amount_vnd >= 0),
    CONSTRAINT orders_balance_ck CHECK (gross_vnd = platform_fee_vnd + creator_amount_vnd),
    CONSTRAINT orders_currency_ck CHECK (currency = 'VND')
);
CREATE INDEX IF NOT EXISTS orders_user_created_idx ON app.orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_template_idx ON app.orders (template_id, created_at DESC);

CREATE TABLE IF NOT EXISTS app.support_requests (
    id UUID PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    user_id UUID REFERENCES app.users(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    email TEXT NOT NULL,
    topic VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS support_status_created_idx ON app.support_requests(status, created_at DESC);

-- Các bảng chuẩn bị cho giao dịch production, KHÔNG có luồng thanh toán thật tại v0.7.
CREATE TABLE IF NOT EXISTS app.payment_transactions (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES app.orders(id),
    provider TEXT NOT NULL,
    provider_reference TEXT,
    amount_vnd INTEGER NOT NULL CHECK (amount_vnd > 0),
    status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
    provider_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, provider_reference)
);
CREATE INDEX IF NOT EXISTS payment_order_idx ON app.payment_transactions(order_id);

CREATE TABLE IF NOT EXISTS app.payment_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    provider TEXT NOT NULL,
    event_key TEXT NOT NULL,
    payload JSONB NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, event_key)
);

CREATE TABLE IF NOT EXISTS app.template_entitlements (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app.users(id),
    template_id TEXT NOT NULL REFERENCES app.templates(id),
    order_id UUID NOT NULL UNIQUE REFERENCES app.orders(id),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS entitlements_lookup_idx ON app.template_entitlements (user_id, template_id) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS app.creator_ledger (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES app.orders(id),
    creator_id UUID NOT NULL REFERENCES app.users(id),
    amount_vnd INTEGER NOT NULL CHECK (amount_vnd <> 0),
    category TEXT NOT NULL CHECK (category IN ('sale', 'refund', 'adjustment', 'payout')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app.outbox_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    topic TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0)
);
CREATE INDEX IF NOT EXISTS outbox_ready_idx ON app.outbox_events (available_at, id) WHERE processed_at IS NULL;

INSERT INTO app.schema_migrations(version) VALUES ('001_initial') ON CONFLICT (version) DO NOTHING;
COMMIT;
