UPDATE `tasks`
SET `status` = 'in_progress'
WHERE `status` = 'paused';

UPDATE `tasks`
SET `source_type` = 'manual', `source_ref_id` = NULL
WHERE `source_type` IN ('selection_verification','evidence_completion','collection_followup');

ALTER TABLE `tasks`
  DROP FOREIGN KEY `fk_tasks_collection_task`,
  DROP KEY `idx_tasks_collection_task`,
  DROP COLUMN `collection_task_id`,
  MODIFY `status` ENUM('todo','in_progress','completed','cancelled') NOT NULL DEFAULT 'todo',
  MODIFY `source_type` ENUM('manual','sourcing_purchase') NOT NULL DEFAULT 'manual';
