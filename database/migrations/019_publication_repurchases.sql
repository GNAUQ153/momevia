-- Mỗi đơn đã tiêu hao chỉ được mở một lần mua tiếp; giữ lịch sử để retry không tạo đơn mới.
CREATE TABLE IF NOT EXISTS publication_repurchases (
  previous_order_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  intent_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  UNIQUE KEY publication_repurchase_intent_uk (intent_id),
  CONSTRAINT publication_repurchase_order_fk FOREIGN KEY (previous_order_id) REFERENCES orders(id),
  CONSTRAINT publication_repurchase_intent_fk FOREIGN KEY (intent_id) REFERENCES payment_intents(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO schema_migrations(version) VALUES ('019_publication_repurchases');
