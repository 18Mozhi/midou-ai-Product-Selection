CREATE TABLE `user_sessions` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `user_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `token_hash` CHAR(64) CHARACTER SET ascii NOT NULL,
  `status` ENUM('active','revoked','expired') NOT NULL,
  `device_label` VARCHAR(120) NOT NULL,
  `user_agent_hash` CHAR(64) CHARACTER SET ascii NULL,
  `ip_hash` CHAR(64) CHARACTER SET ascii NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `last_seen_at` DATETIME(3) NOT NULL,
  `revoked_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_sessions_token_hash` (`token_hash`),
  KEY `idx_user_sessions_user_status_expiry` (`user_id`,`status`,`expires_at`),
  CONSTRAINT `fk_user_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
