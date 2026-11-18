-- Momevia Payment Lifecycle Phase 2: operator review and append-only inquiry evidence.
-- This table records server-side provider inquiries, NOT proof of a completed payment.
CREATE TABLE IF NOT EXISTS payment_reconciliation_attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  intent_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  actor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  outcome VARCHAR(32) NOT NULL,
  checked_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY reconciliation_intent_time_idx (intent_id, checked_at),
  KEY reconciliation_outcome_time_idx (outcome, checked_at),
  CONSTRAINT reconciliation_intent_fk FOREIGN KEY (intent_id) REFERENCES payment_intents(id),
  CONSTRAINT reconciliation_actor_fk FOREIGN KEY (actor_id) REFERENCES users(id),
  CONSTRAINT reconciliation_outcome_ck CHECK (outcome IN
    ('pending','paid','terminal_review','provider_error','invalid_response','mismatch','settlement_error'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO schema_migrations(version) VALUES ('009_payment_reconciliation_audit');
