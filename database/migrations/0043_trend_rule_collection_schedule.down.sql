ALTER TABLE `trend_monitoring_rules`
  DROP FOREIGN KEY `fk_trend_rule_last_collection_task`,
  DROP INDEX `idx_trend_rule_collection_due`,
  DROP COLUMN `last_collection_task_id`,
  DROP COLUMN `next_collection_at`,
  DROP COLUMN `last_collection_at`,
  DROP COLUMN `source_cursor`,
  DROP COLUMN `collection_interval_minutes`;
