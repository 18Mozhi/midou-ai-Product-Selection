CREATE TABLE `deployment_release_write_samples` (
  `seq_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `release_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `sample_id` BINARY(16) NOT NULL,
  `build_sha` BINARY(20) NOT NULL,
  `nonce_hash` BINARY(32) NOT NULL,
  `request_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `trace_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `observed_at` DATETIME(3) NOT NULL,
  `schema_version` SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (`seq_id`),
  UNIQUE KEY `uq_release_write_sample` (`release_id`,`sample_id`),
  UNIQUE KEY `uq_release_write_nonce` (`release_id`,`nonce_hash`),
  KEY `idx_release_write_sample_build_time` (`build_sha`,`observed_at`),
  CONSTRAINT `fk_release_write_sample_release` FOREIGN KEY (`release_id`) REFERENCES `deployment_releases` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
