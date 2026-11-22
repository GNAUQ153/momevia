-- Editable, declarative library. Document snapshots pin the recipes they use.
CREATE TABLE IF NOT EXISTS canvas_library_items (
  kind VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  revision INT UNSIGNED NOT NULL DEFAULT 1,
  status VARCHAR(12) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'active',
  sort_order INT NOT NULL DEFAULT 0,
  definition LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (kind,id),
  KEY canvas_library_order_idx (kind,status,sort_order,id),
  CONSTRAINT canvas_library_kind_ck CHECK (kind IN ('element_type','element','animation','effect','preset','template','artwork')),
  CONSTRAINT canvas_library_status_ck CHECK (status IN ('active','disabled')),
  CONSTRAINT canvas_library_revision_ck CHECK (revision > 0),
  CONSTRAINT canvas_library_definition_json_ck CHECK (JSON_VALID(definition))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS canvas_library_history (
  kind VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  revision INT UNSIGNED NOT NULL,
  snapshot LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  recorded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (kind,id,revision),
  CONSTRAINT canvas_library_history_json_ck CHECK (JSON_VALID(snapshot))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO schema_migrations(version) VALUES ('013_canvas_library');
