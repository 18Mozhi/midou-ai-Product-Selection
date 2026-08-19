ALTER TABLE `tasks`
  MODIFY `status` ENUM('todo','in_progress','paused','completed','cancelled') NOT NULL DEFAULT 'todo',
  MODIFY `source_type` ENUM('manual','sourcing_purchase','selection_verification','evidence_completion','collection_followup') NOT NULL DEFAULT 'manual',
  ADD COLUMN `collection_task_id` CHAR(36) CHARACTER SET ascii NULL AFTER `source_ref_id`,
  ADD KEY `idx_tasks_collection_task` (`organization_id`,`workspace_id`,`collection_task_id`),
  ADD CONSTRAINT `fk_tasks_collection_task`
    FOREIGN KEY (`collection_task_id`) REFERENCES `collection_tasks` (`id`)
    ON DELETE SET NULL;
