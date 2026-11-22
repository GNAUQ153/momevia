-- Additive image-compatible PCM audio metadata. Apply once; DDL auto-commits.
SET NAMES utf8mb4;
ALTER TABLE design_assets
  DROP CHECK design_asset_mime_ck,
  DROP CHECK design_asset_size_ck,
  ADD COLUMN media_kind VARCHAR(12) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'image',
  ADD COLUMN duration_ms DECIMAL(12,6) NULL,
  ADD COLUMN sample_count INT UNSIGNED NULL,
  ADD COLUMN sample_rate INT UNSIGNED NULL,
  ADD COLUMN channels TINYINT UNSIGNED NULL,
  ADD CONSTRAINT design_asset_media_ck CHECK (
    (media_kind='image' AND mime IN ('image/png','image/jpeg','image/webp') AND bytes>0 AND width>0 AND height>0 AND duration_ms IS NULL AND sample_count IS NULL AND sample_rate IS NULL AND channels IS NULL)
    OR (media_kind='audio' AND mime='audio/wav' AND width=0 AND height=0 AND sample_rate=44100 AND channels=1 AND sample_count BETWEEN 4410 AND 441000 AND bytes=44+sample_count*2 AND duration_ms BETWEEN 100 AND 10000 AND ABS(duration_ms-sample_count/44.1)<0.00001)
  );
INSERT IGNORE INTO schema_migrations(version) VALUES ('014_canvas_audio');
