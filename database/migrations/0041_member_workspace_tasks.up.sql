ALTER TABLE `tasks`
  ADD COLUMN `progress_percent` TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER `completed_at`,
  ADD COLUMN `progress_note` VARCHAR(500) NULL AFTER `progress_percent`,
  ADD COLUMN `deleted_at` DATETIME(3) NULL AFTER `progress_note`,
  ADD COLUMN `deleted_by` CHAR(36) CHARACTER SET ascii NULL AFTER `deleted_at`,
  ADD KEY `idx_tasks_scope_active` (`organization_id`,`workspace_id`,`deleted_at`,`status`,`updated_at`),
  ADD CONSTRAINT `fk_tasks_deleted_by` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT;
