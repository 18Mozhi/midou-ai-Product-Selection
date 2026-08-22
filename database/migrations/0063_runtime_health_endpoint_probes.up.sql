CREATE TABLE `runtime_health_endpoint_probes` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `endpoint` ENUM('live','ready','available') NOT NULL,
  `outcome` ENUM('succeeded','http_error','timeout','network_error') NOT NULL,
  `status_code` SMALLINT UNSIGNED NULL,
  `latency_ms` INT UNSIGNED NOT NULL,
  `request_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `trace_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `observed_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_runtime_health_endpoint_time` (`endpoint`,`observed_at`),
  KEY `idx_runtime_health_observed` (`observed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
