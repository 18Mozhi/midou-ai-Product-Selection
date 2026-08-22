CREATE TABLE `crawler_completion_spool_status` (
  `crawler_id` VARCHAR(160) CHARACTER SET ascii NOT NULL,
  `pending_count` INT UNSIGNED NOT NULL,
  `pending_bytes` BIGINT UNSIGNED NOT NULL,
  `quarantined_count` INT UNSIGNED NOT NULL,
  `quarantined_bytes` BIGINT UNSIGNED NOT NULL,
  `oldest_pending_at` DATETIME(3) NULL,
  `retention_days` SMALLINT UNSIGNED NOT NULL,
  `max_bytes` BIGINT UNSIGNED NOT NULL,
  `minimum_free_disk_mb` INT UNSIGNED NOT NULL,
  `free_disk_mb` BIGINT UNSIGNED NOT NULL,
  `request_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `trace_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `observed_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`crawler_id`),
  KEY `idx_crawler_completion_spool_observed` (`observed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
