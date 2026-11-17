-- Momevia v1.1 Payment Foundation. Execute ONLY after migrations 001-004.
-- Do NOT interpret demo_paid as settled real money.
CREATE TABLE IF NOT EXISTS payment_intents (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  order_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  provider VARCHAR(30) NOT NULL,
  provider_order_code VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  amount_vnd INT NOT NULL,
  status VARCHAR(25) NOT NULL DEFAULT 'pending',
  checkout_url TEXT,
  qr_payload TEXT,
  provider_payment_id VARCHAR(191),
  provider_reference VARCHAR(191),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  paid_at DATETIME(3),
  UNIQUE KEY payment_intents_order_uk (order_id),
  UNIQUE KEY payment_intents_code_uk (provider, provider_order_code),
  CONSTRAINT payment_intents_order_fk FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT payment_intents_amount_ck CHECK (amount_vnd > 0),
  CONSTRAINT payment_intents_status_ck CHECK (status IN ('pending','paid','failed','cancelled'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- A single pending or successful checkout per user/template. Locked by unique key.
CREATE TABLE IF NOT EXISTS payment_checkout_keys (
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  template_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  intent_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (user_id, template_id),
  UNIQUE KEY payment_checkout_intent_uk (intent_id),
  CONSTRAINT payment_checkout_user_fk FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT payment_checkout_template_fk FOREIGN KEY (template_id) REFERENCES templates(id),
  CONSTRAINT payment_checkout_intent_fk FOREIGN KEY (intent_id) REFERENCES payment_intents(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- One receipt per verified paid order. Internal receipt, NOT a VAT invoice.
CREATE TABLE IF NOT EXISTS payment_receipts (
  order_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  receipt_no VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
  provider VARCHAR(30) NOT NULL,
  provider_reference VARCHAR(191) NOT NULL,
  amount_vnd INT NOT NULL,
  issued_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT payment_receipts_order_fk FOREIGN KEY (order_id) REFERENCES orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO schema_migrations(version) VALUES ('005_payment_receipts');
