ALTER TABLE `data_quality_issues`
  ADD COLUMN `assigned_membership_id` CHAR(36) CHARACTER SET ascii NULL AFTER `details_json`,
  ADD COLUMN `attribution_reason` VARCHAR(500) NULL AFTER `assigned_membership_id`,
  ADD COLUMN `attributed_by` CHAR(36) CHARACTER SET ascii NULL AFTER `attribution_reason`,
  ADD COLUMN `attributed_at` DATETIME(3) NULL AFTER `attributed_by`,
  ADD KEY `idx_quality_issue_assignee_status` (`assigned_membership_id`,`status`,`updated_at`),
  ADD CONSTRAINT `fk_quality_issue_assignee` FOREIGN KEY (`assigned_membership_id`) REFERENCES `memberships` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_quality_issue_attributor` FOREIGN KEY (`attributed_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT;
