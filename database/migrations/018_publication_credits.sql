-- Mỗi quyền có tối đa một lượt; không backfill hoặc thay đổi quyền lịch sử.
CREATE TABLE IF NOT EXISTS publication_credits (
  entitlement_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  gift_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  consumed_at DATETIME(3) NULL,
  UNIQUE KEY publication_credit_gift_uk (gift_id),
  CONSTRAINT publication_credit_entitlement_fk FOREIGN KEY (entitlement_id) REFERENCES template_entitlements(id),
  CONSTRAINT publication_credit_gift_fk FOREIGN KEY (gift_id) REFERENCES gifts(id),
  CONSTRAINT publication_credit_state_ck CHECK ((gift_id IS NULL AND consumed_at IS NULL) OR (gift_id IS NOT NULL AND consumed_at IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO schema_migrations(version) VALUES ('018_publication_credits');
