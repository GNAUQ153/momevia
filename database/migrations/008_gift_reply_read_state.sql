ALTER TABLE gift_replies
    ADD COLUMN read_status ENUM('unread', 'read') NULL DEFAULT NULL,
    ADD KEY gift_replies_unread_idx (gift_id, read_status);

INSERT IGNORE INTO schema_migrations(version) VALUES ('008_gift_reply_read_state');
