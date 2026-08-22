CREATE TABLE `runtime_process_restart_observations` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `process_name` VARCHAR(80) CHARACTER SET ascii NOT NULL,
  `status` VARCHAR(32) CHARACTER SET ascii NOT NULL,
  `restart_count` INT UNSIGNED NOT NULL,
  `sample_bucket_at` DATETIME(3) NOT NULL,
  `request_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `trace_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `observed_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_runtime_process_bucket` (`process_name`,`sample_bucket_at`),
  KEY `idx_runtime_process_observed` (`observed_at`,`process_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
