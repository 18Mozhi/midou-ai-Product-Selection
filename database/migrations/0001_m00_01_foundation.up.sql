-- ScoutOps M00-01 repository foundation. MySQL 5.7 / utf8mb4 only.
CREATE TABLE `outbox_events` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `organization_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `workspace_id` CHAR(36) CHARACTER SET ascii NULL,
  `event_type` VARCHAR(120) NOT NULL,
  `schema_version` INT UNSIGNED NOT NULL DEFAULT 1,
  `payload_json` JSON NOT NULL,
  `status` ENUM('pending','leased','published','failed','dead_letter') NOT NULL DEFAULT 'pending',
  `attempt_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `available_at` DATETIME(3) NOT NULL,
  `leased_at` DATETIME(3) NULL,
  `lease_expires_at` DATETIME(3) NULL,
  `published_at` DATETIME(3) NULL,
  `request_id` VARCHAR(64) NOT NULL,
  `trace_id` VARCHAR(64) NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_outbox_org_status_available` (`organization_id`, `status`, `available_at`),
  KEY `idx_outbox_lease_expiry` (`lease_expires_at`),
  KEY `idx_outbox_trace` (`trace_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
