-- MySQL binary JSON can print a double with a different final digit, changing
-- document hashes (e.g. 52.382775119617236 -> 52.38277511961723). Store the JSON
-- serialization verbatim while retaining server-side JSON validity checks.
-- Existing adapters already parse string/object JSON through jsonValue.
ALTER TABLE designs
  MODIFY COLUMN document LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  ADD CONSTRAINT designs_document_json_ck CHECK (JSON_VALID(document));
ALTER TABLE design_versions
  MODIFY COLUMN document LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  ADD CONSTRAINT design_versions_document_json_ck CHECK (JSON_VALID(document));
-- These payloads also embed immutable canvas documents and Creator versions.
ALTER TABLE gifts
  MODIFY COLUMN payload LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  ADD CONSTRAINT gifts_payload_json_ck CHECK (JSON_VALID(payload));
ALTER TABLE templates
  MODIFY COLUMN payload LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  ADD CONSTRAINT templates_payload_json_ck CHECK (JSON_VALID(payload));
ALTER TABLE json_storage_imports
  MODIFY COLUMN source_snapshot LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  ADD CONSTRAINT json_storage_import_snapshot_json_ck CHECK (JSON_VALID(source_snapshot));

INSERT IGNORE INTO schema_migrations(version) VALUES ('012_canvas_lossless_json');
