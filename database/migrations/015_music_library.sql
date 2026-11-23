-- Audio curation is separate from immutable published media and Canvas recipes.
CREATE TABLE IF NOT EXISTS music_library_overrides (
  id VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  revision INT UNSIGNED NOT NULL,
  definition LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT music_library_revision_ck CHECK (revision > 0),
  CONSTRAINT music_library_json_ck CHECK (JSON_VALID(definition))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS music_library_history (
  id VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  revision INT UNSIGNED NOT NULL,
  snapshot LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  recorded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id,revision),
  CONSTRAINT music_library_history_json_ck CHECK (JSON_VALID(snapshot))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
INSERT IGNORE INTO schema_migrations(version) VALUES ('015_music_library');
