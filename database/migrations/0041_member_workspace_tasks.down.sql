ALTER TABLE `tasks`
  DROP FOREIGN KEY `fk_tasks_deleted_by`,
  DROP KEY `idx_tasks_scope_active`,
  DROP COLUMN `deleted_by`,
  DROP COLUMN `deleted_at`,
  DROP COLUMN `progress_note`,
  DROP COLUMN `progress_percent`;
