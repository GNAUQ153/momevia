-- Bổ sung khóa theo phạm vi; không sửa hoặc xóa khóa checkout lịch sử.
-- Runtime đọc cả khóa cũ và khóa mới, không cần backfill dữ liệu khách hàng.
CREATE TABLE IF NOT EXISTS payment_checkout_scope_keys (
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  template_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  is_test BOOLEAN NOT NULL,
  intent_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (user_id, template_id, is_test),
  UNIQUE KEY payment_scope_intent_uk (intent_id),
  CONSTRAINT payment_scope_user_fk FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT payment_scope_template_fk FOREIGN KEY (template_id) REFERENCES templates(id),
  CONSTRAINT payment_scope_intent_fk FOREIGN KEY (intent_id) REFERENCES payment_intents(id),
  CONSTRAINT payment_scope_mode_ck CHECK (is_test IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO schema_migrations(version) VALUES ('017_payment_scope_keys');
