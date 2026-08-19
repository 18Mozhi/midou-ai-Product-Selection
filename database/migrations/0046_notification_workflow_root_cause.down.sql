ALTER TABLE `notifications`
  DROP KEY `idx_notification_root_cause`,
  DROP KEY `idx_notification_workflow`,
  DROP COLUMN `root_cause_key`,
  DROP COLUMN `workflow_status`;
