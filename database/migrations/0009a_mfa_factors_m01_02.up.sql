CREATE TABLE `user_mfa_factors` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL, `user_id` CHAR(36) CHARACTER SET ascii NOT NULL, `type` VARCHAR(16) NOT NULL,
  `status` VARCHAR(16) NOT NULL, `secret_ciphertext` BLOB NOT NULL, `secret_nonce` VARBINARY(12) NOT NULL,
  `secret_auth_tag` VARBINARY(16) NOT NULL, `last_used_step` BIGINT NULL, `enrolled_at` DATETIME(3) NOT NULL,
  `confirmed_at` DATETIME(3) NULL, `disabled_at` DATETIME(3) NULL, `version` INT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL, `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), KEY `idx_mfa_user_status` (`user_id`,`status`),
  CONSTRAINT `fk_mfa_factor_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
