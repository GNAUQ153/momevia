-- Sender canvas, additive to 001-005. Apply ONCE to a verified, backed-up target.
-- MySQL DDL commits implicitly. A partial failure requires schema inspection and
-- forward repair; wrapping this file in a transaction does not undo its DDL.
SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS designs (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  owner_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  title VARCHAR(160) NOT NULL,
  source_kind VARCHAR(12) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  template_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
  template_version_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  provenance JSON NOT NULL,
  policy JSON NOT NULL,
  revision INT UNSIGNED NOT NULL,
  schema_version INT UNSIGNED NOT NULL,
  document JSON NOT NULL,
  document_hash VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  archived_at DATETIME(3) NULL,
  KEY designs_owner_updated_idx (owner_id, updated_at, id),
  CONSTRAINT designs_owner_fk FOREIGN KEY (owner_id) REFERENCES users(id),
  CONSTRAINT designs_template_fk FOREIGN KEY (template_id) REFERENCES templates(id),
  CONSTRAINT designs_revision_ck CHECK (revision BETWEEN 1 AND 4294967294),
  CONSTRAINT designs_source_ck CHECK (
    (source_kind='blank' AND template_id IS NULL AND template_version_id IS NULL) OR
    (source_kind='template' AND template_id IS NOT NULL AND template_version_id IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS design_create_requests (
  owner_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  mutation_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  request_hash VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  design_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (owner_id, mutation_id),
  CONSTRAINT design_create_owner_fk FOREIGN KEY (owner_id) REFERENCES users(id),
  CONSTRAINT design_create_design_fk FOREIGN KEY (design_id) REFERENCES designs(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS design_mutations (
  design_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  owner_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  mutation_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  request_hash VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  response JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (design_id, mutation_id),
  CONSTRAINT design_mutation_design_fk FOREIGN KEY (design_id) REFERENCES designs(id),
  CONSTRAINT design_mutation_owner_fk FOREIGN KEY (owner_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS design_versions (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  design_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  revision INT UNSIGNED NOT NULL,
  schema_version INT UNSIGNED NOT NULL,
  runtime_version INT UNSIGNED NOT NULL,
  document_hash VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  document JSON NOT NULL,
  created_at DATETIME(3) NOT NULL,
  UNIQUE KEY design_versions_revision_uk (design_id, revision),
  CONSTRAINT design_version_design_fk FOREIGN KEY (design_id) REFERENCES designs(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS design_assets (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  owner_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  design_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  status VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  mime VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  bytes INT UNSIGNED NOT NULL,
  width INT UNSIGNED NOT NULL,
  height INT UNSIGNED NOT NULL,
  content_hash VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  storage_key VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME(3) NOT NULL,
  KEY design_assets_owner_idx (owner_id, id),
  CONSTRAINT design_asset_owner_fk FOREIGN KEY (owner_id) REFERENCES users(id),
  CONSTRAINT design_asset_design_fk FOREIGN KEY (design_id) REFERENCES designs(id),
  CONSTRAINT design_asset_status_ck CHECK (status IN ('processing','ready','failed','delete_pending','removed')),
  CONSTRAINT design_asset_mime_ck CHECK (mime IN ('image/png','image/jpeg','image/webp')),
  CONSTRAINT design_asset_size_ck CHECK (bytes > 0 AND width > 0 AND height > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS design_asset_refs (
  design_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  asset_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (design_id, asset_id),
  CONSTRAINT design_ref_design_fk FOREIGN KEY (design_id) REFERENCES designs(id),
  CONSTRAINT design_ref_asset_fk FOREIGN KEY (asset_id) REFERENCES design_assets(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE gifts
  MODIFY COLUMN template_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
  ADD COLUMN source_kind VARCHAR(12) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'legacy',
  ADD COLUMN design_version_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  ADD CONSTRAINT gifts_design_version_fk FOREIGN KEY (design_version_id) REFERENCES design_versions(id),
  ADD CONSTRAINT gifts_source_ck CHECK (
    (source_kind='legacy' AND template_id IS NOT NULL AND design_version_id IS NULL) OR
    (source_kind='blank' AND template_id IS NULL AND design_version_id IS NOT NULL) OR
    (source_kind='template' AND template_id IS NOT NULL AND design_version_id IS NOT NULL)
  );

CREATE TABLE IF NOT EXISTS gift_asset_refs (
  gift_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  asset_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (gift_id, asset_id),
  CONSTRAINT gift_ref_gift_fk FOREIGN KEY (gift_id) REFERENCES gifts(id),
  CONSTRAINT gift_ref_asset_fk FOREIGN KEY (asset_id) REFERENCES design_assets(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS gift_publication_requests (
  owner_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  idempotency_key CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  request_hash VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  design_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  design_revision INT UNSIGNED NOT NULL,
  gift_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (owner_id, idempotency_key),
  CONSTRAINT publication_owner_fk FOREIGN KEY (owner_id) REFERENCES users(id),
  CONSTRAINT publication_design_fk FOREIGN KEY (design_id) REFERENCES designs(id),
  CONSTRAINT publication_gift_fk FOREIGN KEY (gift_id) REFERENCES gifts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS checkout_design_contexts (
  context_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  owner_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  order_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  design_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  design_revision INT UNSIGNED NOT NULL,
  document_hash VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  template_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  template_version_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  mutation_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  request_hash VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY checkout_context_mutation_uk (owner_id, order_id, mutation_id),
  KEY checkout_context_owner_order_idx (owner_id, order_id, created_at, context_id),
  CONSTRAINT checkout_context_owner_fk FOREIGN KEY (owner_id) REFERENCES users(id),
  CONSTRAINT checkout_context_order_fk FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT checkout_context_design_fk FOREIGN KEY (design_id) REFERENCES designs(id),
  CONSTRAINT checkout_context_template_fk FOREIGN KEY (template_id) REFERENCES templates(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO schema_migrations(version) VALUES ('006_canvas');
