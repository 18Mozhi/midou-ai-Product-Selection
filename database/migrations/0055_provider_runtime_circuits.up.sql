CREATE TABLE `provider_runtime_circuits` (
  `provider_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `state` ENUM('closed','open') NOT NULL DEFAULT 'closed',
  `consecutive_failures` INT UNSIGNED NOT NULL DEFAULT 0,
  `failure_threshold` INT UNSIGNED NOT NULL,
  `last_error_code` VARCHAR(80) CHARACTER SET ascii NULL,
  `opened_at` DATETIME(3) NULL,
  `recovered_at` DATETIME(3) NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`provider_id`),
  KEY `idx_provider_runtime_circuit_state` (`state`,`updated_at`),
  CONSTRAINT `fk_provider_runtime_circuit_provider` FOREIGN KEY (`provider_id`) REFERENCES `providers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
