ALTER TABLE `data_quality_issues`
  DROP FOREIGN KEY `fk_quality_issue_attributor`,
  DROP FOREIGN KEY `fk_quality_issue_assignee`,
  DROP KEY `idx_quality_issue_assignee_status`,
  DROP COLUMN `attributed_at`,
  DROP COLUMN `attributed_by`,
  DROP COLUMN `attribution_reason`,
  DROP COLUMN `assigned_membership_id`;
