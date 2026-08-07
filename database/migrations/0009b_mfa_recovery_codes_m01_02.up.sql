CREATE TABLE `user_mfa_recovery_codes` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL, `user_id` CHAR(36) CHARACTER SET ascii NOT NULL, `factor_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `code_hash` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, `used_at` DATETIME(3) NULL, `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_mfa_recovery_hash` (`code_hash`), KEY `idx_mfa_recovery_user_unused` (`user_id`,`used_at`),
  CONSTRAINT `fk_mfa_recovery_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_mfa_recovery_factor` FOREIGN KEY (`factor_id`) REFERENCES `user_mfa_factors` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
