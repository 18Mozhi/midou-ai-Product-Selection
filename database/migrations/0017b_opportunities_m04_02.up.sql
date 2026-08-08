CREATE TABLE `opportunities` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `organization_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `workspace_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `market` VARCHAR(40) NOT NULL,
  `category` VARCHAR(80) NULL,
  `source_type` ENUM('manual','trend_topic') NOT NULL,
  `source_ref_id` CHAR(36) CHARACTER SET ascii NULL,
  `owner_id` CHAR(36) CHARACTER SET ascii NULL,
  `lifecycle_status` ENUM('candidate','validating','ready','adopted','observing','rejected') NOT NULL DEFAULT 'candidate',
  `recommendation_status` ENUM('insufficient_data','recommend','observe','not_recommend') NOT NULL DEFAULT 'insufficient_data',
  `overall_score` DECIMAL(6,2) NULL,
  `trend_score` DECIMAL(6,2) NULL,
  `competition_score` DECIMAL(6,2) NULL,
  `profit_status` ENUM('insufficient_data','calculated') NOT NULL DEFAULT 'insufficient_data',
  `risk_level` ENUM('unknown','low','medium','high') NOT NULL DEFAULT 'unknown',
  `confidence_status` ENUM('insufficient_data','measured') NOT NULL DEFAULT 'insufficient_data',
  `confidence_score` DECIMAL(6,2) NULL,
  `evidence_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `source_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `coverage_status` ENUM('insufficient','partial','complete') NOT NULL DEFAULT 'insufficient',
  `score_rule_version` VARCHAR(64) NULL,
  `scored_at` DATETIME(3) NULL,
  `decision_status` ENUM('pending','adopted','observing','rejected') NOT NULL DEFAULT 'pending',
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  `created_by` CHAR(36) CHARACTER SET ascii NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_opportunity_source` (`organization_id`,`workspace_id`,`source_type`,`source_ref_id`),
  KEY `idx_opportunity_scope_updated` (`organization_id`,`workspace_id`,`updated_at`,`id`),
  KEY `idx_opportunity_scope_decision` (`organization_id`,`workspace_id`,`decision_status`,`updated_at`),
  CONSTRAINT `fk_opportunity_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`),
  CONSTRAINT `fk_opportunity_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces` (`id`),
  CONSTRAINT `fk_opportunity_owner` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_opportunity_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `opportunity_evidence_links` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL, `organization_id` CHAR(36) CHARACTER SET ascii NOT NULL, `workspace_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `opportunity_id` CHAR(36) CHARACTER SET ascii NOT NULL, `evidence_type` ENUM('trend_signal') NOT NULL,
  `evidence_id` CHAR(36) CHARACTER SET ascii NOT NULL, `provider_id` CHAR(36) CHARACTER SET ascii NOT NULL, `raw_evidence_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `observed_at` DATETIME(3) NOT NULL, `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_opportunity_evidence` (`opportunity_id`,`evidence_type`,`evidence_id`),
  KEY `idx_opportunity_evidence_scope` (`organization_id`,`workspace_id`,`opportunity_id`,`observed_at`),
  CONSTRAINT `fk_opportunity_evidence_opportunity` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_opportunity_evidence_raw` FOREIGN KEY (`raw_evidence_id`) REFERENCES `raw_evidence` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `opportunity_decisions` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL, `organization_id` CHAR(36) CHARACTER SET ascii NOT NULL, `workspace_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `opportunity_id` CHAR(36) CHARACTER SET ascii NOT NULL, `action` ENUM('adopt','observe','reject') NOT NULL,
  `reason` VARCHAR(1000) NOT NULL, `previous_status` ENUM('pending','adopted','observing','rejected') NOT NULL,
  `resulting_status` ENUM('adopted','observing','rejected') NOT NULL, `opportunity_version` INT UNSIGNED NOT NULL,
  `actor_id` CHAR(36) CHARACTER SET ascii NOT NULL, `request_id` VARCHAR(128) CHARACTER SET ascii NOT NULL, `trace_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), KEY `idx_opportunity_decisions_scope` (`organization_id`,`workspace_id`,`opportunity_id`,`created_at`),
  CONSTRAINT `fk_opportunity_decision_opportunity` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities` (`id`),
  CONSTRAINT `fk_opportunity_decision_actor` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `opportunity_refresh_jobs` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL, `organization_id` CHAR(36) CHARACTER SET ascii NOT NULL, `workspace_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `opportunity_id` CHAR(36) CHARACTER SET ascii NOT NULL, `status` ENUM('queued','leased','running','retry_scheduled','succeeded','succeeded_empty','failed_terminal','dead_letter') NOT NULL DEFAULT 'queued',
  `attempt_count` INT UNSIGNED NOT NULL DEFAULT 0, `available_at` DATETIME(3) NOT NULL,
  `lease_owner` VARCHAR(120) NULL, `lease_expires_at` DATETIME(3) NULL, `last_error_code` VARCHAR(120) NULL,
  `request_id` VARCHAR(128) CHARACTER SET ascii NOT NULL, `trace_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `created_at` DATETIME(3) NOT NULL, `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_opportunity_refresh_active` (`opportunity_id`,`request_id`),
  KEY `idx_opportunity_refresh_claim` (`status`,`available_at`,`lease_expires_at`),
  CONSTRAINT `fk_opportunity_refresh_opportunity` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `opportunity_events` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL, `organization_id` CHAR(36) CHARACTER SET ascii NOT NULL, `workspace_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `event_type` VARCHAR(120) NOT NULL, `resource_type` VARCHAR(80) NOT NULL, `resource_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `actor_type` ENUM('user','worker') NOT NULL, `actor_id` VARCHAR(120) NOT NULL,
  `request_id` VARCHAR(128) CHARACTER SET ascii NOT NULL, `trace_id` VARCHAR(128) CHARACTER SET ascii NOT NULL, `payload_json` JSON NOT NULL,
  `occurred_at` DATETIME(3) NOT NULL, PRIMARY KEY (`id`),
  KEY `idx_opportunity_event_scope` (`organization_id`,`workspace_id`,`resource_type`,`resource_id`,`occurred_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `opportunity_outbox` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL, `organization_id` CHAR(36) CHARACTER SET ascii NOT NULL, `workspace_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `event_type` VARCHAR(120) NOT NULL, `resource_type` VARCHAR(80) NOT NULL, `resource_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `payload_json` JSON NOT NULL, `status` ENUM('queued','published','failed') NOT NULL DEFAULT 'queued',
  `attempt_count` INT UNSIGNED NOT NULL DEFAULT 0, `available_at` DATETIME(3) NOT NULL,
  `request_id` VARCHAR(128) CHARACTER SET ascii NOT NULL, `trace_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `created_at` DATETIME(3) NOT NULL, `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), KEY `idx_opportunity_outbox_claim` (`status`,`available_at`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `opportunity_operations` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL, `actor_id` CHAR(36) CHARACTER SET ascii NOT NULL, `route` VARCHAR(255) NOT NULL,
  `idempotency_key` VARCHAR(128) CHARACTER SET ascii NOT NULL, `resource_id` CHAR(36) CHARACTER SET ascii NOT NULL, `result_json` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL, PRIMARY KEY (`id`), UNIQUE KEY `uq_opportunity_operation` (`actor_id`,`route`,`idempotency_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
