ALTER TABLE `opportunities`
  ADD COLUMN `lifecycle_entered_at` DATETIME(3) NULL AFTER `lifecycle_status`,
  ADD KEY `idx_opportunity_scope_lifecycle_age`
    (`organization_id`,`workspace_id`,`lifecycle_status`,`lifecycle_entered_at`);

UPDATE `opportunities`
SET `lifecycle_entered_at` = `updated_at`
WHERE `lifecycle_entered_at` IS NULL;

ALTER TABLE `opportunities`
  MODIFY `lifecycle_entered_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

ALTER TABLE `opportunity_score_jobs`
  ADD COLUMN `trigger_task_id` CHAR(36) CHARACTER SET ascii NULL AFTER `score_rule_id`,
  ADD KEY `idx_score_job_trigger_task` (`trigger_task_id`),
  ADD CONSTRAINT `fk_score_job_trigger_task`
    FOREIGN KEY (`trigger_task_id`) REFERENCES `tasks` (`id`) ON DELETE SET NULL;
