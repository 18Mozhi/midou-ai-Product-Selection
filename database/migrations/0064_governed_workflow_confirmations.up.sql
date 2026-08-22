ALTER TABLE `trend_topics`
  MODIFY COLUMN `status` ENUM('active','irrelevant','stale','archived') NOT NULL;

CREATE TABLE `trend_topic_change_requests` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `organization_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `workspace_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `operation` ENUM('merge','split') NOT NULL,
  `target_topic_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `source_topic_ids_json` JSON NOT NULL,
  `signal_ids_json` JSON NOT NULL,
  `new_title` VARCHAR(500) NULL,
  `new_category` VARCHAR(80) NULL,
  `expected_versions_json` JSON NOT NULL,
  `reason` VARCHAR(1000) NOT NULL,
  `status` ENUM('pending','confirmed','rejected') NOT NULL DEFAULT 'pending',
  `result_topic_id` CHAR(36) CHARACTER SET ascii NULL,
  `proposed_by` CHAR(36) CHARACTER SET ascii NOT NULL,
  `decided_by` CHAR(36) CHARACTER SET ascii NULL,
  `decision_reason` VARCHAR(1000) NULL,
  `decided_at` DATETIME(3) NULL,
  `request_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `trace_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_trend_change_queue` (`organization_id`,`workspace_id`,`status`,`created_at`),
  KEY `idx_trend_change_target` (`target_topic_id`,`status`,`created_at`),
  CONSTRAINT `fk_trend_change_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`),
  CONSTRAINT `fk_trend_change_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces` (`id`),
  CONSTRAINT `fk_trend_change_target` FOREIGN KEY (`target_topic_id`) REFERENCES `trend_topics` (`id`),
  CONSTRAINT `fk_trend_change_proposer` FOREIGN KEY (`proposed_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_trend_change_decider` FOREIGN KEY (`decided_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `opportunity_cost_inputs`
  ADD COLUMN `submitted_by` CHAR(36) CHARACTER SET ascii NULL AFTER `is_current`,
  MODIFY COLUMN `confirmed_by` CHAR(36) CHARACTER SET ascii NULL,
  ADD CONSTRAINT `fk_cost_input_submitter` FOREIGN KEY (`submitted_by`) REFERENCES `users` (`id`);

UPDATE `opportunity_cost_inputs`
SET `submitted_by`=`confirmed_by`
WHERE `submitted_by` IS NULL;

ALTER TABLE `opportunity_cost_inputs`
  MODIFY COLUMN `submitted_by` CHAR(36) CHARACTER SET ascii NOT NULL;

CREATE TABLE `opportunity_cost_input_reviews` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `organization_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `workspace_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `opportunity_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `cost_input_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `submitter_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `reviewer_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `status` ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `due_at` DATETIME(3) NOT NULL,
  `decision_reason` VARCHAR(1000) NULL,
  `reviewed_at` DATETIME(3) NULL,
  `request_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `trace_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cost_input_review` (`cost_input_id`),
  KEY `idx_cost_review_queue` (`organization_id`,`workspace_id`,`reviewer_id`,`status`,`due_at`),
  KEY `idx_cost_review_opportunity` (`opportunity_id`,`created_at`),
  CONSTRAINT `fk_cost_review_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`),
  CONSTRAINT `fk_cost_review_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces` (`id`),
  CONSTRAINT `fk_cost_review_opportunity` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cost_review_input` FOREIGN KEY (`cost_input_id`) REFERENCES `opportunity_cost_inputs` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cost_review_submitter` FOREIGN KEY (`submitter_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_cost_review_reviewer` FOREIGN KEY (`reviewer_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `provider_parser_samples`
  ADD COLUMN `review_status` ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending' AFTER `last_replay_at`,
  ADD COLUMN `reviewed_by` CHAR(36) CHARACTER SET ascii NULL AFTER `review_status`,
  ADD COLUMN `review_reason` VARCHAR(1000) NULL AFTER `reviewed_by`,
  ADD COLUMN `reviewed_at` DATETIME(3) NULL AFTER `review_reason`,
  ADD COLUMN `review_version` INT UNSIGNED NOT NULL DEFAULT 1 AFTER `reviewed_at`,
  ADD KEY `idx_provider_parser_sample_review` (`provider_id`,`status`,`review_status`,`created_at`),
  ADD CONSTRAINT `fk_provider_parser_sample_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`);
