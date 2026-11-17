-- Momevia v1.0: idempotency key for LOCAL DEMO purchases only.
-- Requires 001_initial, 002_support_user_bridge, 003_identity_catalog.
-- InnoDB locks a unique (user_id, template_id) row across concurrent checkout requests.
-- No real payment provider, webhook, creator payout or financial settlement is enabled.
CREATE TABLE IF NOT EXISTS demo_purchases (
    user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    template_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    order_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (user_id, template_id),
    UNIQUE KEY demo_purchases_order_uk (order_id),
    CONSTRAINT demo_purchases_user_fk FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT demo_purchases_template_fk FOREIGN KEY (template_id) REFERENCES templates(id),
    CONSTRAINT demo_purchases_order_fk FOREIGN KEY (order_id) REFERENCES orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO schema_migrations(version) VALUES ('004_gifts_checkout');
