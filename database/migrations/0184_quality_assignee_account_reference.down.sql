-- Refuse to reconstruct an assignment that cannot be represented in the old schema.
CREATE TEMPORARY TABLE scoutops_quality_assignee_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_quality_assignee_guard VALUES (1);
INSERT INTO scoutops_quality_assignee_guard
SELECT 1 FROM data_quality_issues i LEFT JOIN memberships m ON m.id=i.historical_assignee_membership_id
WHERE (i.historical_assignee_membership_id IS NOT NULL AND m.id IS NULL)
   OR NOT (i.assigned_account_id <=> m.user_id) LIMIT 1;
DROP TEMPORARY TABLE scoutops_quality_assignee_guard;
ALTER TABLE data_quality_issues DROP FOREIGN KEY fk_quality_issue_assignee_account,
  DROP INDEX idx_quality_issue_account_status,
  DROP COLUMN assigned_account_id,
  CHANGE COLUMN historical_assignee_membership_id assigned_membership_id CHAR(36) CHARACTER SET ascii NULL,
  ADD INDEX idx_quality_issue_assignee_status(assigned_membership_id,status,updated_at),
  ADD CONSTRAINT fk_quality_issue_assignee FOREIGN KEY (assigned_membership_id) REFERENCES memberships(id) ON DELETE RESTRICT;
