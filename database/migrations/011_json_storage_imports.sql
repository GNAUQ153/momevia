-- Preserve the complete source snapshot and version-ID mapping of each offline
-- JSON cutover. Runtime tables retain their foreign keys and uniqueness rules.
CREATE TABLE IF NOT EXISTS json_storage_imports (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  source_label VARCHAR(160) NOT NULL,
  source_hash VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  source_snapshot JSON NOT NULL,
  version_aliases JSON NOT NULL,
  counts JSON NOT NULL,
  imported_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY json_storage_import_hash_uk (source_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO schema_migrations(version) VALUES ('011_json_storage_imports');
