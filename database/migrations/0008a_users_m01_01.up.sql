CREATE TABLE `users` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `email` VARCHAR(254) NOT NULL,
  `email_normalized` VARCHAR(254) NOT NULL,
  `password_hash` VARCHAR(255) CHARACTER SET ascii NOT NULL,
  `status` ENUM('pending_verification','active','locked','disabled') NOT NULL,
  `email_verified_at` DATETIME(3) NULL,
  `failed_login_count` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `locked_until` DATETIME(3) NULL,
  `password_changed_at` DATETIME(3) NOT NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email_normalized` (`email_normalized`),
  KEY `idx_users_status_locked` (`status`,`locked_until`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
