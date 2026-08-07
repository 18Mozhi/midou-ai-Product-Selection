CREATE TABLE `runtime_config_releases` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `organization_id` CHAR(36) CHARACTER SET ascii NULL,
  `workspace_id` CHAR(36) CHARACTER SET ascii NULL,
  `service_name` VARCHAR(80) NOT NULL,
  `config_version` INT UNSIGNED NOT NULL,
  `config_fingerprint` CHAR(64) CHARACTER SET ascii NOT NULL,
  `status` ENUM('draft','validated','active','rolled_back','failed') NOT NULL,
  `created_by` CHAR(36) CHARACTER SET ascii NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  `activated_at` DATETIME(3) NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_config_service_version` (`service_name`, `config_version`),
  KEY `idx_config_org_status_updated` (`organization_id`, `status`, `updated_at`),
  KEY `idx_config_fingerprint` (`config_fingerprint`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
