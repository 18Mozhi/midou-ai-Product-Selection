ALTER TABLE `cost_rules`
  ADD COLUMN `conversion_rates_json` JSON NULL AFTER `fee_lines_json`,
  ADD COLUMN `automatic_scope_json` JSON NULL AFTER `conversion_rates_json`;

ALTER TABLE `opportunity_cost_inputs`
  ADD COLUMN `confirmation_mode` ENUM('human_review','automatic_evidence') NOT NULL DEFAULT 'human_review'
    AFTER `is_current`;

CREATE TABLE `automatic_selection_evaluations` (
  `opportunity_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `organization_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `workspace_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `status` ENUM('queued','leased','waiting_evidence','waiting_profit','succeeded','retry_scheduled','failed_terminal','dead_letter') NOT NULL DEFAULT 'queued',
  `attempt_count` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `available_at` DATETIME(3) NOT NULL,
  `lease_owner` VARCHAR(120) CHARACTER SET ascii NULL,
  `lease_expires_at` DATETIME(3) NULL,
  `last_error_code` VARCHAR(120) CHARACTER SET ascii NULL,
  `evidence_fingerprint` CHAR(64) CHARACTER SET ascii NULL,
  `result_json` JSON NULL,
  `evaluated_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`opportunity_id`),
  KEY `idx_automatic_selection_evaluation_claim` (`status`,`available_at`,`lease_expires_at`),
  KEY `idx_automatic_selection_evaluation_scope` (`organization_id`,`workspace_id`,`updated_at`),
  CONSTRAINT `fk_automatic_selection_evaluation_opportunity`
    FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `automatic_selection_evaluations`
  (`opportunity_id`,`organization_id`,`workspace_id`,`status`,`attempt_count`,`available_at`,`created_at`,`updated_at`)
SELECT DISTINCT o.id,o.organization_id,o.workspace_id,'queued',0,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)
FROM `opportunities` o
JOIN `opportunity_rule_matches` m
  ON m.opportunity_id=o.id
  AND m.organization_id=o.organization_id
  AND m.workspace_id=o.workspace_id
JOIN `trend_monitoring_rules` r
  ON r.id=m.monitoring_rule_id
  AND r.organization_id=m.organization_id
  AND r.workspace_id=m.workspace_id
WHERE o.decision_status='pending'
  AND r.status='enabled'
  AND o.source_count>=r.recommendation_min_source_count;
