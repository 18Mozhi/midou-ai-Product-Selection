CREATE TABLE `trend_topics` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `organization_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `workspace_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `topic_key` CHAR(64) CHARACTER SET ascii NOT NULL,
  `title` VARCHAR(500) NOT NULL,
  `category` VARCHAR(80) NULL,
  `market` VARCHAR(40) CHARACTER SET ascii NOT NULL,
  `language` VARCHAR(40) CHARACTER SET ascii NOT NULL,
  `status` ENUM('active','irrelevant','stale') NOT NULL,
  `signal_count` INT UNSIGNED NOT NULL,
  `source_count` INT UNSIGNED NOT NULL,
  `heat_value` INT UNSIGNED NOT NULL,
  `heat_unit` ENUM('signals') NOT NULL,
  `momentum_percent` DECIMAL(10,2) NULL,
  `confidence_score` DECIMAL(5,2) NULL,
  `confidence_status` ENUM('measured','insufficient_data') NOT NULL,
  `first_seen_at` DATETIME(3) NOT NULL,
  `last_seen_at` DATETIME(3) NOT NULL,
  `source_fresh_at` DATETIME(3) NOT NULL,
  `version` INT UNSIGNED NOT NULL,
  `created_by` CHAR(36) CHARACTER SET ascii NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_trend_topic_scope_key` (`organization_id`,`workspace_id`,`topic_key`),
  KEY `idx_trend_topic_scope_list` (`organization_id`,`workspace_id`,`status`,`last_seen_at`),
  KEY `idx_trend_topic_market_category` (`organization_id`,`workspace_id`,`market`,`category`,`last_seen_at`),
  CONSTRAINT `fk_trend_topic_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`),
  CONSTRAINT `fk_trend_topic_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces` (`id`),
  CONSTRAINT `fk_trend_topic_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `trend_signals` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `organization_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `workspace_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `topic_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `normalized_record_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `raw_evidence_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `provider_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `title` VARCHAR(1000) NOT NULL,
  `publisher` VARCHAR(300) NOT NULL,
  `canonical_url` VARCHAR(2048) NOT NULL,
  `published_at` DATETIME(3) NOT NULL,
  `observed_at` DATETIME(3) NOT NULL,
  `request_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `trace_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_trend_signal_record` (`normalized_record_id`),
  KEY `idx_trend_signal_scope_time` (`organization_id`,`workspace_id`,`published_at`),
  KEY `idx_trend_signal_topic_time` (`topic_id`,`published_at`),
  CONSTRAINT `fk_trend_signal_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`),
  CONSTRAINT `fk_trend_signal_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces` (`id`),
  CONSTRAINT `fk_trend_signal_topic` FOREIGN KEY (`topic_id`) REFERENCES `trend_topics` (`id`),
  CONSTRAINT `fk_trend_signal_record` FOREIGN KEY (`normalized_record_id`) REFERENCES `normalized_records` (`id`),
  CONSTRAINT `fk_trend_signal_evidence` FOREIGN KEY (`raw_evidence_id`) REFERENCES `raw_evidence` (`id`),
  CONSTRAINT `fk_trend_signal_provider` FOREIGN KEY (`provider_id`) REFERENCES `providers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `trend_topic_keywords` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `organization_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `workspace_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `topic_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `keyword` VARCHAR(300) NOT NULL,
  `keyword_type` ENUM('primary','related','negative') NOT NULL,
  `language` VARCHAR(40) CHARACTER SET ascii NOT NULL,
  `market` VARCHAR(40) CHARACTER SET ascii NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_trend_keyword` (`topic_id`,`keyword`,`keyword_type`),
  KEY `idx_trend_keyword_scope` (`organization_id`,`workspace_id`,`keyword_type`),
  CONSTRAINT `fk_trend_keyword_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`),
  CONSTRAINT `fk_trend_keyword_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces` (`id`),
  CONSTRAINT `fk_trend_keyword_topic` FOREIGN KEY (`topic_id`) REFERENCES `trend_topics` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `trend_topic_follows` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `organization_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `workspace_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `topic_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `user_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_trend_follow` (`topic_id`,`user_id`),
  KEY `idx_trend_follow_scope_user` (`organization_id`,`workspace_id`,`user_id`,`created_at`),
  CONSTRAINT `fk_trend_follow_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`),
  CONSTRAINT `fk_trend_follow_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces` (`id`),
  CONSTRAINT `fk_trend_follow_topic` FOREIGN KEY (`topic_id`) REFERENCES `trend_topics` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_trend_follow_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `trend_monitoring_rules` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `organization_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `workspace_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `include_keywords_json` JSON NOT NULL,
  `negative_keywords_json` JSON NOT NULL,
  `market` VARCHAR(40) CHARACTER SET ascii NOT NULL,
  `language` VARCHAR(40) CHARACTER SET ascii NOT NULL,
  `category` VARCHAR(80) NULL,
  `notification_channel` ENUM('in_app') NOT NULL,
  `status` ENUM('enabled','paused') NOT NULL,
  `last_evaluated_at` DATETIME(3) NULL,
  `version` INT UNSIGNED NOT NULL,
  `created_by` CHAR(36) CHARACTER SET ascii NOT NULL,
  `updated_by` CHAR(36) CHARACTER SET ascii NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_trend_rule_scope_name` (`organization_id`,`workspace_id`,`name`),
  KEY `idx_trend_rule_scope_status` (`organization_id`,`workspace_id`,`status`,`updated_at`),
  CONSTRAINT `fk_trend_rule_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`),
  CONSTRAINT `fk_trend_rule_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces` (`id`),
  CONSTRAINT `fk_trend_rule_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_trend_rule_updater` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `trend_projection_jobs` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `organization_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `workspace_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `normalized_record_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `status` ENUM('scheduled','leased','succeeded','succeeded_empty','failed_terminal','dead_letter') NOT NULL,
  `attempt_count` TINYINT UNSIGNED NOT NULL,
  `available_at` DATETIME(3) NOT NULL,
  `lease_owner` VARCHAR(160) CHARACTER SET ascii NULL,
  `lease_expires_at` DATETIME(3) NULL,
  `last_error_code` VARCHAR(80) CHARACTER SET ascii NULL,
  `request_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `trace_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_trend_projection_record` (`normalized_record_id`),
  KEY `idx_trend_projection_ready` (`status`,`available_at`,`lease_expires_at`),
  KEY `idx_trend_projection_scope` (`organization_id`,`workspace_id`,`created_at`),
  CONSTRAINT `fk_trend_projection_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`),
  CONSTRAINT `fk_trend_projection_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces` (`id`),
  CONSTRAINT `fk_trend_projection_record` FOREIGN KEY (`normalized_record_id`) REFERENCES `normalized_records` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `trend_events` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `organization_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `workspace_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `event_type` VARCHAR(100) CHARACTER SET ascii NOT NULL,
  `resource_type` VARCHAR(80) CHARACTER SET ascii NOT NULL,
  `resource_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `actor_type` ENUM('user','worker','system') NOT NULL,
  `actor_id` VARCHAR(160) CHARACTER SET ascii NOT NULL,
  `request_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `trace_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `payload_json` JSON NOT NULL,
  `occurred_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_trend_event_scope_time` (`organization_id`,`workspace_id`,`occurred_at`),
  KEY `idx_trend_event_resource` (`resource_type`,`resource_id`,`occurred_at`),
  KEY `idx_trend_event_trace` (`trace_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `trend_outbox` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `organization_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `workspace_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `event_type` VARCHAR(100) CHARACTER SET ascii NOT NULL,
  `resource_type` VARCHAR(80) CHARACTER SET ascii NOT NULL,
  `resource_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `payload_json` JSON NOT NULL,
  `status` ENUM('queued','leased','published','dead_letter') NOT NULL,
  `attempt_count` TINYINT UNSIGNED NOT NULL,
  `available_at` DATETIME(3) NOT NULL,
  `request_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `trace_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_trend_outbox_ready` (`status`,`available_at`),
  KEY `idx_trend_outbox_scope` (`organization_id`,`workspace_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `trend_operations` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `actor_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `route` VARCHAR(220) CHARACTER SET ascii NOT NULL,
  `idempotency_key` VARCHAR(255) CHARACTER SET ascii NOT NULL,
  `resource_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `result_json` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_trend_operation` (`actor_id`,`route`,`idempotency_key`),
  KEY `idx_trend_operation_resource` (`resource_id`),
  CONSTRAINT `fk_trend_operation_actor` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `capabilities` (`code`,`description`,`version`,`created_at`)
VALUES ('trend:manage','关注趋势并管理监控规则',1,UTC_TIMESTAMP(3));

INSERT INTO `role_capabilities` (`role_code`,`capability_code`,`created_at`)
SELECT `code`,'trend:manage',UTC_TIMESTAMP(3) FROM `roles`
WHERE `code` IN ('member','selection_manager','organization_admin','platform_super_admin');
