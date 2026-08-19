ALTER TABLE `trend_monitoring_rules`
  ADD COLUMN `collection_interval_minutes` SMALLINT UNSIGNED NOT NULL DEFAULT 60 AFTER `notification_channel`,
  ADD COLUMN `source_cursor` SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER `collection_interval_minutes`,
  ADD COLUMN `last_collection_at` DATETIME(3) NULL AFTER `last_evaluated_at`,
  ADD COLUMN `next_collection_at` DATETIME(3) NULL AFTER `last_collection_at`,
  ADD COLUMN `last_collection_task_id` CHAR(36) CHARACTER SET ascii NULL AFTER `next_collection_at`,
  ADD KEY `idx_trend_rule_collection_due` (`status`,`next_collection_at`),
  ADD CONSTRAINT `fk_trend_rule_last_collection_task` FOREIGN KEY (`last_collection_task_id`) REFERENCES `collection_tasks` (`id`) ON DELETE SET NULL;
