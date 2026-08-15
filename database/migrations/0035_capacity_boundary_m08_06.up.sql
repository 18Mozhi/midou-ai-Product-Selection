CREATE TABLE `capacity_boundary_observations` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `source` ENUM('production_benchmark','api_view') NOT NULL,
  `state` ENUM('ready','warning','blocked') NOT NULL,
  `measured_concurrency` SMALLINT UNSIGNED NOT NULL,
  `planning_users` SMALLINT UNSIGNED NOT NULL DEFAULT 100,
  `read_p95_ms` INT UNSIGNED NOT NULL,
  `write_p95_ms` INT UNSIGNED NOT NULL,
  `error_rate_basis_points` INT UNSIGNED NOT NULL,
  `async_lag_seconds` INT UNSIGNED NOT NULL,
  `load_basis_points` INT UNSIGNED NOT NULL,
  `available_memory_mb` BIGINT UNSIGNED NOT NULL,
  `free_disk_mb` BIGINT UNSIGNED NOT NULL,
  `archive_verified` TINYINT(1) UNSIGNED NOT NULL,
  `recovery_verified` TINYINT(1) UNSIGNED NOT NULL,
  `finding_codes_json` JSON NOT NULL,
  `request_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `trace_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `observed_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_capacity_boundary_source_time` (`source`,`observed_at`),
  KEY `idx_capacity_boundary_state_time` (`state`,`observed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `capacity_boundary_drills` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `kind` ENUM('archive_recovery') NOT NULL,
  `status` ENUM('verified','blocked') NOT NULL,
  `reason` VARCHAR(500) NOT NULL,
  `actor_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `observation_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `request_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `trace_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `observed_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_capacity_drill_time` (`observed_at`),
  KEY `idx_capacity_drill_actor_time` (`actor_id`,`observed_at`),
  CONSTRAINT `fk_capacity_drill_actor` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_capacity_drill_observation` FOREIGN KEY (`observation_id`) REFERENCES `capacity_boundary_observations` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `capacity_boundary_operations` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `actor_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `route` VARCHAR(180) CHARACTER SET ascii NOT NULL,
  `idempotency_key` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `result_json` JSON NOT NULL,
  `request_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `trace_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_capacity_boundary_operation` (`actor_id`,`route`,`idempotency_key`),
  KEY `idx_capacity_boundary_operation_request` (`request_id`),
  CONSTRAINT `fk_capacity_boundary_operation_actor` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
