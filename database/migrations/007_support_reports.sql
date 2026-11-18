ALTER TABLE support_requests
    ADD COLUMN report_kind VARCHAR(16) NULL,
    ADD COLUMN report_target VARCHAR(128) NULL,
    ADD COLUMN assigned_to CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    ADD COLUMN resolution VARCHAR(500) NULL;

INSERT IGNORE INTO schema_migrations(version) VALUES ('007_support_reports');
