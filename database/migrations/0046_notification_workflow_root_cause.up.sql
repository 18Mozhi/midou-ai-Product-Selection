ALTER TABLE `notifications`
  ADD COLUMN `workflow_status` ENUM('open','in_progress','closed') NOT NULL DEFAULT 'open' AFTER `read_at`,
  ADD COLUMN `root_cause_key` VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER `resource_id`,
  ADD KEY `idx_notification_workflow` (`organization_id`,`workspace_id`,`recipient_id`,`workflow_status`,`updated_at`),
  ADD KEY `idx_notification_root_cause` (`organization_id`,`workspace_id`,`recipient_id`,`root_cause_key`,`created_at`);
