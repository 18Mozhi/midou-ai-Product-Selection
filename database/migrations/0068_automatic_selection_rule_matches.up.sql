CREATE TABLE `opportunity_rule_matches` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `organization_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `workspace_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `opportunity_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `monitoring_rule_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `topic_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `matched_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_opportunity_rule_match` (`opportunity_id`,`monitoring_rule_id`),
  KEY `idx_opportunity_rule_scope` (`organization_id`,`workspace_id`,`matched_at`),
  CONSTRAINT `fk_opportunity_rule_match_opportunity` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_opportunity_rule_match_rule` FOREIGN KEY (`monitoring_rule_id`) REFERENCES `trend_monitoring_rules` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_opportunity_rule_match_topic` FOREIGN KEY (`topic_id`) REFERENCES `trend_topics` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
