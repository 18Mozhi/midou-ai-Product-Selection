CREATE TABLE `score_rules` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL, `organization_id` CHAR(36) CHARACTER SET ascii NOT NULL, `workspace_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `version_code` VARCHAR(64) CHARACTER SET ascii NOT NULL, `name` VARCHAR(160) NOT NULL,
  `status` ENUM('draft','pending_approval','approved','active','retired','rolled_back','rejected') NOT NULL DEFAULT 'draft',
  `dimensions_json` JSON NOT NULL, `thresholds_json` JSON NOT NULL, `revision` INT UNSIGNED NOT NULL DEFAULT 1,
  `submitted_by` CHAR(36) CHARACTER SET ascii NULL, `submitted_at` DATETIME(3) NULL, `approved_by` CHAR(36) CHARACTER SET ascii NULL, `approved_at` DATETIME(3) NULL,
  `activated_at` DATETIME(3) NULL, `rollback_target_id` CHAR(36) CHARACTER SET ascii NULL, `rolled_back_at` DATETIME(3) NULL,
  `created_by` CHAR(36) CHARACTER SET ascii NOT NULL, `created_at` DATETIME(3) NOT NULL, `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_score_rule_scope_version` (`organization_id`,`workspace_id`,`version_code`),
  KEY `idx_score_rule_scope_status` (`organization_id`,`workspace_id`,`status`,`updated_at`),
  CONSTRAINT `fk_score_rule_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`),
  CONSTRAINT `fk_score_rule_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces` (`id`),
  CONSTRAINT `fk_score_rule_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_score_rule_submitter` FOREIGN KEY (`submitted_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_score_rule_approver` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_score_rule_rollback_target` FOREIGN KEY (`rollback_target_id`) REFERENCES `score_rules` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `score_rule_actions` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL, `organization_id` CHAR(36) CHARACTER SET ascii NOT NULL, `workspace_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `score_rule_id` CHAR(36) CHARACTER SET ascii NOT NULL, `action` ENUM('submit','approve','reject','activate','rollback') NOT NULL,
  `reason` VARCHAR(1000) NOT NULL, `previous_status` VARCHAR(40) CHARACTER SET ascii NOT NULL, `resulting_status` VARCHAR(40) CHARACTER SET ascii NOT NULL,
  `actor_id` CHAR(36) CHARACTER SET ascii NOT NULL, `request_id` VARCHAR(128) CHARACTER SET ascii NOT NULL, `trace_id` VARCHAR(128) CHARACTER SET ascii NOT NULL, `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), KEY `idx_score_rule_action_scope` (`organization_id`,`workspace_id`,`score_rule_id`,`created_at`),
  CONSTRAINT `fk_score_rule_action_rule` FOREIGN KEY (`score_rule_id`) REFERENCES `score_rules` (`id`), CONSTRAINT `fk_score_rule_action_actor` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `opportunity_score_inputs` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL, `organization_id` CHAR(36) CHARACTER SET ascii NOT NULL, `workspace_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `opportunity_id` CHAR(36) CHARACTER SET ascii NOT NULL, `dimension_code` VARCHAR(64) CHARACTER SET ascii NOT NULL, `evidence_group` ENUM('market','competition','cost','other') NOT NULL,
  `score_value` DECIMAL(6,2) NULL, `source_type` VARCHAR(80) CHARACTER SET ascii NOT NULL, `source_ref_id` VARCHAR(160) CHARACTER SET ascii NOT NULL,
  `evidence_ids_json` JSON NOT NULL, `missing_fields_json` JSON NOT NULL, `observed_at` DATETIME(3) NOT NULL, `input_version` INT UNSIGNED NOT NULL, `is_current` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` VARCHAR(120) CHARACTER SET ascii NOT NULL, `request_id` VARCHAR(128) CHARACTER SET ascii NOT NULL, `trace_id` VARCHAR(128) CHARACTER SET ascii NOT NULL, `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_score_input_version` (`opportunity_id`,`dimension_code`,`input_version`),
  KEY `idx_score_input_current` (`organization_id`,`workspace_id`,`opportunity_id`,`is_current`,`dimension_code`),
  CONSTRAINT `fk_score_input_opportunity` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `opportunity_score_jobs` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL, `organization_id` CHAR(36) CHARACTER SET ascii NOT NULL, `workspace_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `opportunity_id` CHAR(36) CHARACTER SET ascii NOT NULL, `score_rule_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `status` ENUM('queued','leased','retry_scheduled','succeeded','completed_with_warnings','failed_terminal','dead_letter') NOT NULL DEFAULT 'queued',
  `attempt_count` INT UNSIGNED NOT NULL DEFAULT 0, `available_at` DATETIME(3) NOT NULL, `lease_owner` VARCHAR(120) NULL, `lease_expires_at` DATETIME(3) NULL, `last_error_code` VARCHAR(120) NULL,
  `request_id` VARCHAR(128) CHARACTER SET ascii NOT NULL, `trace_id` VARCHAR(128) CHARACTER SET ascii NOT NULL, `created_at` DATETIME(3) NOT NULL, `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), KEY `idx_score_job_claim` (`status`,`available_at`,`lease_expires_at`),
  CONSTRAINT `fk_score_job_opportunity` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities` (`id`) ON DELETE CASCADE, CONSTRAINT `fk_score_job_rule` FOREIGN KEY (`score_rule_id`) REFERENCES `score_rules` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `opportunity_score_runs` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL, `organization_id` CHAR(36) CHARACTER SET ascii NOT NULL, `workspace_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `opportunity_id` CHAR(36) CHARACTER SET ascii NOT NULL, `score_rule_id` CHAR(36) CHARACTER SET ascii NOT NULL, `rule_version_code` VARCHAR(64) CHARACTER SET ascii NOT NULL,
  `status` ENUM('calculated','insufficient_data') NOT NULL, `overall_score` DECIMAL(6,2) NULL, `coverage_percent` DECIMAL(6,2) NOT NULL,
  `confidence_score` DECIMAL(6,2) NULL, `recommendation_status` ENUM('insufficient_data','recommend','observe','not_recommend') NOT NULL,
  `missing_fields_json` JSON NOT NULL, `input_snapshot_json` JSON NOT NULL, `request_id` VARCHAR(128) CHARACTER SET ascii NOT NULL, `trace_id` VARCHAR(128) CHARACTER SET ascii NOT NULL, `scored_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), KEY `idx_score_run_scope` (`organization_id`,`workspace_id`,`opportunity_id`,`scored_at`),
  CONSTRAINT `fk_score_run_opportunity` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities` (`id`) ON DELETE CASCADE, CONSTRAINT `fk_score_run_rule` FOREIGN KEY (`score_rule_id`) REFERENCES `score_rules` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `opportunity_score_components` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL, `score_run_id` CHAR(36) CHARACTER SET ascii NOT NULL, `dimension_code` VARCHAR(64) CHARACTER SET ascii NOT NULL,
  `weight_percent` DECIMAL(6,2) NOT NULL, `input_score` DECIMAL(6,2) NULL, `weighted_score` DECIMAL(6,2) NULL, `evidence_ids_json` JSON NOT NULL, `missing_fields_json` JSON NOT NULL,
  PRIMARY KEY (`id`), KEY `idx_score_component_run` (`score_run_id`,`dimension_code`), CONSTRAINT `fk_score_component_run` FOREIGN KEY (`score_run_id`) REFERENCES `opportunity_score_runs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `score_rule_operations` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL, `actor_id` CHAR(36) CHARACTER SET ascii NOT NULL, `route` VARCHAR(255) NOT NULL, `idempotency_key` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `resource_id` CHAR(36) CHARACTER SET ascii NOT NULL, `result_json` JSON NOT NULL, `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_score_rule_operation` (`actor_id`,`route`,`idempotency_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
