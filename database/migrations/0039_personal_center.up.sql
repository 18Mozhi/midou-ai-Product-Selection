CREATE TABLE `user_profiles` (
  `user_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `display_name` VARCHAR(120) NOT NULL,
  `avatar_url` VARCHAR(1000) CHARACTER SET ascii NULL,
  `phone` VARCHAR(40) CHARACTER SET ascii NULL,
  `phone_verified_at` DATETIME(3) NULL,
  `locale` VARCHAR(20) CHARACTER SET ascii NOT NULL,
  `timezone` VARCHAR(64) CHARACTER SET ascii NOT NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_user_profiles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `personal_profile_operations` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `user_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `idempotency_key` VARCHAR(255) CHARACTER SET ascii NOT NULL,
  `result_json` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_personal_profile_operation` (`user_id`,`idempotency_key`),
  CONSTRAINT `fk_personal_profile_operation_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
