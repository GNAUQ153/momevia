-- Trong giai đoạn Identity còn sử dụng JSON, user_id của yêu cầu Support
-- chưa thể có khóa ngoại đến bảng users MySQL. Giữ ID gốc tại legacy_user_id.
ALTER TABLE support_requests
  ADD COLUMN legacy_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER user_id;
CREATE INDEX support_legacy_user_idx ON support_requests(legacy_user_id);
INSERT IGNORE INTO schema_migrations(version) VALUES ('002_support_user_bridge');
