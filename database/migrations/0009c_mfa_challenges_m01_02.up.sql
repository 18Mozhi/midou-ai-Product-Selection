CREATE TABLE `user_mfa_challenges` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL, `user_id` CHAR(36) CHARACTER SET ascii NOT NULL, `token_hash` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `status` VARCHAR(16) NOT NULL, `attempt_count` INT UNSIGNED NOT NULL DEFAULT 0, `expires_at` DATETIME(3) NOT NULL,
  `consumed_at` DATETIME(3) NULL, `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_mfa_challenge_token` (`token_hash`), KEY `idx_mfa_challenge_user_status` (`user_id`,`status`,`expires_at`),
  CONSTRAINT `fk_mfa_challenge_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
