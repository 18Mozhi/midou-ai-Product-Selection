-- M00-07 verification evidence index. Detailed command output remains in controlled files.
CREATE TABLE `verification_runs` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `organization_id` CHAR(36) CHARACTER SET ascii NULL,
  `workspace_id` CHAR(36) CHARACTER SET ascii NULL,
  `scope_type` ENUM('module','phase','all') NOT NULL,
  `scope_id` VARCHAR(32) NOT NULL,
  `status` ENUM('running','passed','failed','blocked') NOT NULL,
  `report_path` VARCHAR(500) NOT NULL,
  `failure_code` VARCHAR(120) NULL,
  `started_at` DATETIME(3) NOT NULL,
  `finished_at` DATETIME(3) NULL,
  `request_id` VARCHAR(64) NOT NULL,
  `trace_id` VARCHAR(64) NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_verification_scope_status` (`scope_type`, `scope_id`, `status`, `started_at`),
  KEY `idx_verification_org_started` (`organization_id`, `started_at`),
  KEY `idx_verification_trace` (`trace_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
