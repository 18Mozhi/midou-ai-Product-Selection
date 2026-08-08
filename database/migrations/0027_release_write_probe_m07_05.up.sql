CREATE TABLE `deployment_release_write_probes` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `release_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `sample_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `build_sha` VARCHAR(64) CHARACTER SET ascii NOT NULL,
  `nonce_hash` CHAR(64) CHARACTER SET ascii NOT NULL,
  `request_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `trace_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `observed_at` DATETIME(3) NOT NULL,
  `schema_version` SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_release_write_probe_sample` (`release_id`,`sample_id`),
  UNIQUE KEY `uq_release_write_probe_nonce` (`release_id`,`nonce_hash`),
  KEY `idx_release_write_probe_build_time` (`build_sha`,`observed_at`),
  KEY `idx_release_write_probe_trace` (`trace_id`),
  CONSTRAINT `fk_release_write_probe_release` FOREIGN KEY (`release_id`) REFERENCES `deployment_releases` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
