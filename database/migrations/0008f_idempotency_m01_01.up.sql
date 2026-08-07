CREATE TABLE `auth_idempotency_records` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `scope_hash` CHAR(64) CHARACTER SET ascii NOT NULL,
  `route` VARCHAR(180) CHARACTER SET ascii NOT NULL,
  `http_method` ENUM('POST','PUT','PATCH','DELETE') NOT NULL,
  `idempotency_key_hash` CHAR(64) CHARACTER SET ascii NOT NULL,
  `status` ENUM('processing','succeeded','failed') NOT NULL,
  `response_status` SMALLINT UNSIGNED NULL,
  `response_json` JSON NULL,
  `request_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `trace_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_auth_idempotency_scope` (`scope_hash`,`route`,`http_method`,`idempotency_key_hash`),
  KEY `idx_auth_idempotency_status_expiry` (`status`,`expires_at`),
  KEY `idx_auth_idempotency_trace` (`trace_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
