-- Recipient roster/confirmations live in gifts.payload, committed with publication.
-- Old payloads remain unchanged and continue in manual mode. These nullable
-- columns attach new replies to an opaque receipt and preserve the name on card.
ALTER TABLE gift_replies
  ADD COLUMN recipient_id CHAR(36) NULL,
  ADD COLUMN card_name VARCHAR(60) NULL,
  ADD INDEX idx_gift_reply_recipient (gift_id, recipient_id);

INSERT IGNORE INTO schema_migrations(version) VALUES ('016_recipient_naming');
