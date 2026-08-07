CREATE TABLE `auth_action_tokens` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `user_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `purpose` ENUM('email_verification','password_reset') NOT NULL,
  `token_hash` CHAR(64) CHARACTER SET ascii NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `consumed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_auth_action_token_hash` (`token_hash`),
  KEY `idx_auth_action_user_purpose_expiry` (`user_id`,`purpose`,`expires_at`),
  CONSTRAINT `fk_auth_action_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
