-- Ghi nhận và kiểm tra yêu cầu hoàn tiền nội bộ; KHÔNG thực hiện hoàn tiền.
-- Một đơn được xác minh có tối đa một hồ sơ giai đoạn MVP.
CREATE TABLE IF NOT EXISTS refund_review_requests (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  order_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  requester_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  reason_code VARCHAR(32) NOT NULL,
  reason_detail VARCHAR(500) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'submitted',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY refund_review_order_uk (order_id),
  KEY refund_review_status_created_idx (status, created_at),
  CONSTRAINT refund_review_order_fk FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT refund_review_requester_fk FOREIGN KEY (requester_id) REFERENCES users(id),
  CONSTRAINT refund_review_reason_ck CHECK (reason_code IN
    ('duplicate_payment', 'technical_problem', 'not_as_described', 'other')),
  CONSTRAINT refund_review_status_ck CHECK (status IN
    ('submitted', 'in_review', 'awaiting_provider', 'closed_declined'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Nhật ký ghi thêm, cùng transaction với thay đổi trạng thái hồ sơ.
CREATE TABLE IF NOT EXISTS refund_review_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  actor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  from_status VARCHAR(32),
  to_status VARCHAR(32) NOT NULL,
  note VARCHAR(500) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY refund_events_request_id_idx (request_id, id),
  CONSTRAINT refund_event_request_fk FOREIGN KEY (request_id) REFERENCES refund_review_requests(id),
  CONSTRAINT refund_event_actor_fk FOREIGN KEY (actor_id) REFERENCES users(id),
  CONSTRAINT refund_event_from_ck CHECK (from_status IS NULL OR from_status IN
    ('submitted', 'in_review', 'awaiting_provider', 'closed_declined')),
  CONSTRAINT refund_event_to_ck CHECK (to_status IN
    ('submitted', 'in_review', 'awaiting_provider', 'closed_declined'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO schema_migrations(version) VALUES ('010_refund_review');
