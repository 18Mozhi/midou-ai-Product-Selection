ALTER TABLE `opportunity_score_jobs`
  DROP FOREIGN KEY `fk_score_job_trigger_task`,
  DROP INDEX `idx_score_job_trigger_task`,
  DROP COLUMN `trigger_task_id`;

ALTER TABLE `opportunities`
  DROP INDEX `idx_opportunity_scope_lifecycle_age`,
  DROP COLUMN `lifecycle_entered_at`;
