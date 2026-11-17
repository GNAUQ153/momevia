-- Momevia 0.8: MySQL 8.4 LTS + InnoDB, UTF-8 tiếng Việt, thời gian lưu ở UTC.
-- Dành cho DB mới. Không chạy trên production nếu chưa sao lưu và review migration.
-- Các ID hiện có trong JSON là chuỗi UUID, giữ CHAR(36) để import không biến đổi.
-- Một số bảng chỉ là foundation; KHÔNG có luồng thanh toán thật.
SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(40) NOT NULL PRIMARY KEY,
    applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    provider VARCHAR(30) NOT NULL,
    provider_id VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(254),
    password_hash TEXT,
    avatar TEXT,
    role VARCHAR(20) NOT NULL DEFAULT 'sender',
    created_at DATETIME(3) NOT NULL,
    legacy_payload JSON NOT NULL,
    -- Chỉ email provider kiểm soát unique; NULL không cản nhiều tài khoản OAuth.
    email_login VARCHAR(254) GENERATED ALWAYS AS (
        CASE WHEN provider = 'email' THEN LOWER(email) ELSE NULL END
    ) STORED,
    UNIQUE KEY users_provider_identity_uk (provider, provider_id),
    UNIQUE KEY users_email_login_uk (email_login),
    CONSTRAINT users_role_ck CHECK (role IN ('sender', 'creator', 'admin')),
    CONSTRAINT users_email_provider_ck CHECK (provider <> 'email' OR (email IS NOT NULL AND password_hash IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    expires_at DATETIME(3) NOT NULL,
    KEY sessions_expiry_idx (expires_at),
    CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS templates (
    id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    creator_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin,
    title VARCHAR(100) NOT NULL,
    style VARCHAR(100) NOT NULL,
    theme VARCHAR(100) NOT NULL,
    price_vnd INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL,
    created_at DATETIME(3) NOT NULL,
    payload JSON NOT NULL,
    KEY templates_discover_idx (status, style, created_at),
    KEY templates_creator_idx (creator_id, created_at),
    CONSTRAINT templates_creator_fk FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT templates_price_ck CHECK (price_vnd BETWEEN 0 AND 500000),
    CONSTRAINT templates_status_ck CHECK (status IN ('published', 'pending', 'rejected'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS favorites (
    user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    template_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME(3) NOT NULL,
    PRIMARY KEY (user_id, template_id),
    CONSTRAINT favorites_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT favorites_template_fk FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS gifts (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    slug VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    template_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    recipient_name VARCHAR(100) NOT NULL,
    sender_name VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    image_file VARCHAR(255),
    reply_count INT NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL,
    expires_at DATETIME(3) NOT NULL,
    payload JSON NOT NULL,
    UNIQUE KEY gifts_slug_uk (slug),
    KEY gifts_owner_created_idx (user_id, created_at),
    KEY gifts_expiry_idx (expires_at),
    CONSTRAINT gifts_user_fk FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT gifts_template_fk FOREIGN KEY (template_id) REFERENCES templates(id),
    CONSTRAINT gifts_reply_count_ck CHECK (reply_count >= 0),
    CONSTRAINT gifts_expiry_ck CHECK (expires_at > created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS gift_replies (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    gift_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME(3) NOT NULL,
    KEY gift_replies_gift_idx (gift_id, created_at),
    CONSTRAINT gift_replies_gift_fk FOREIGN KEY (gift_id) REFERENCES gifts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS orders (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    template_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    gross_vnd INT NOT NULL,
    platform_fee_vnd INT NOT NULL,
    creator_amount_vnd INT NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'VND',
    status VARCHAR(40) NOT NULL,
    payment_provider VARCHAR(80) NOT NULL,
    is_test BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL,
    payload JSON NOT NULL,
    KEY orders_user_created_idx (user_id, created_at),
    KEY orders_template_idx (template_id, created_at),
    CONSTRAINT orders_user_fk FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT orders_template_fk FOREIGN KEY (template_id) REFERENCES templates(id),
    CONSTRAINT orders_nonnegative_ck CHECK (gross_vnd >= 0 AND platform_fee_vnd >= 0 AND creator_amount_vnd >= 0),
    CONSTRAINT orders_balance_ck CHECK (gross_vnd = platform_fee_vnd + creator_amount_vnd),
    CONSTRAINT orders_currency_ck CHECK (currency = 'VND')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS support_requests (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    code VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL,
    topic VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at DATETIME(3) NOT NULL,
    UNIQUE KEY support_code_uk (code),
    KEY support_status_created_idx (status, created_at),
    CONSTRAINT support_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Các bảng foundation cho nghiệp vụ tương lai, chưa được kích hoạt.
CREATE TABLE IF NOT EXISTS payment_transactions (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    order_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    provider VARCHAR(80) NOT NULL,
    provider_reference VARCHAR(191),
    amount_vnd INT NOT NULL,
    status VARCHAR(20) NOT NULL,
    provider_payload JSON NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY payment_provider_reference_uk (provider, provider_reference),
    KEY payment_order_idx (order_id),
    CONSTRAINT payment_order_fk FOREIGN KEY (order_id) REFERENCES orders(id),
    CONSTRAINT payment_amount_ck CHECK (amount_vnd > 0),
    CONSTRAINT payment_status_ck CHECK (status IN ('pending', 'paid', 'failed', 'refunded'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS payment_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    provider VARCHAR(80) NOT NULL,
    event_key VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    payload JSON NOT NULL,
    received_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY payment_event_uk (provider, event_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS template_entitlements (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    template_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    order_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    granted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    revoked_at DATETIME(3),
    UNIQUE KEY entitlements_order_uk (order_id),
    KEY entitlements_lookup_idx (user_id, template_id, revoked_at),
    CONSTRAINT entitlements_user_fk FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT entitlements_template_fk FOREIGN KEY (template_id) REFERENCES templates(id),
    CONSTRAINT entitlements_order_fk FOREIGN KEY (order_id) REFERENCES orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS creator_ledger (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    order_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    creator_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    amount_vnd INT NOT NULL,
    category VARCHAR(20) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    KEY creator_ledger_creator_idx (creator_id, created_at),
    CONSTRAINT creator_ledger_order_fk FOREIGN KEY (order_id) REFERENCES orders(id),
    CONSTRAINT creator_ledger_user_fk FOREIGN KEY (creator_id) REFERENCES users(id),
    CONSTRAINT creator_ledger_amount_ck CHECK (amount_vnd <> 0),
    CONSTRAINT creator_ledger_category_ck CHECK (category IN ('sale', 'refund', 'adjustment', 'payout'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS outbox_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    topic VARCHAR(120) NOT NULL,
    aggregate_id VARCHAR(191) NOT NULL,
    payload JSON NOT NULL,
    available_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    processed_at DATETIME(3),
    attempts INT NOT NULL DEFAULT 0,
    KEY outbox_ready_idx (processed_at, available_at, id),
    CONSTRAINT outbox_attempts_ck CHECK (attempts >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO schema_migrations(version) VALUES ('001_initial');
