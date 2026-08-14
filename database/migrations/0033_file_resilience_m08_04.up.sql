ALTER TABLE `report_exports`
  ADD COLUMN `content_sha256` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER `byte_size`;

CREATE TABLE `file_resilience_observations` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `organization_id` CHAR(36) CHARACTER SET ascii NULL,
  `workspace_id` CHAR(36) CHARACTER SET ascii NULL,
  `manager` ENUM('baota') NOT NULL DEFAULT 'baota',
  `mode` ENUM('local_managed_directories') NOT NULL DEFAULT 'local_managed_directories',
  `state` ENUM('ready','warning','blocked') NOT NULL,
  `root_count` INT UNSIGNED NOT NULL,
  `available_root_count` INT UNSIGNED NOT NULL,
  `active_file_count` BIGINT UNSIGNED NOT NULL,
  `indexed_bytes` BIGINT UNSIGNED NOT NULL,
  `maximum_usage_basis_points` INT UNSIGNED NOT NULL,
  `checksum_sampled_files` INT UNSIGNED NOT NULL,
  `checksum_verified_files` INT UNSIGNED NOT NULL,
  `checksum_mismatch_files` INT UNSIGNED NOT NULL,
  `missing_files` INT UNSIGNED NOT NULL,
  `recovery_status` ENUM('verified','stale','blocked','empty') NOT NULL,
  `recovery_drill_age_days` DECIMAL(10,2) UNSIGNED NULL,
  `finding_codes_json` JSON NOT NULL,
  `request_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `trace_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `observed_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_file_resilience_observed` (`observed_at`),
  KEY `idx_file_resilience_state_time` (`state`,`observed_at`),
  KEY `idx_file_resilience_scope_time` (`organization_id`,`workspace_id`,`observed_at`),
  CONSTRAINT `fk_file_resilience_organization` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_file_resilience_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `file_resilience_views` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `actor_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `observation_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `request_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `trace_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `observed_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_file_resilience_views_actor_time` (`actor_id`,`observed_at`),
  KEY `idx_file_resilience_views_request` (`request_id`),
  CONSTRAINT `fk_file_resilience_views_actor` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_file_resilience_views_observation` FOREIGN KEY (`observation_id`) REFERENCES `file_resilience_observations` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
