-- v0.9: OAuth/demo provider IDs are case-sensitive; email login stays case-insensitive.
-- Apply after 001_initial and 002_support_user_bridge, BEFORE importing JSON.
ALTER TABLE users MODIFY COLUMN provider_id VARCHAR(255)
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL;

INSERT IGNORE INTO schema_migrations(version) VALUES ('003_identity_catalog');
