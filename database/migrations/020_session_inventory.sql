-- NULL đánh dấu các phiên được cấp trước migration, không suy đoán credential version.
ALTER TABLE sessions
  ADD COLUMN credential_version BIGINT UNSIGNED NULL,
  ADD COLUMN issued_at DATETIME(3) NULL,
  ADD KEY sessions_owner_version_expiry_idx (user_id, credential_version, expires_at);

INSERT IGNORE INTO schema_migrations(version) VALUES ('020_session_inventory');
