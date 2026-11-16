-- Quiesce issue writers. Retain the original membership ID as history only.
CREATE TEMPORARY TABLE scoutops_quality_assignee_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_quality_assignee_guard VALUES (1);
INSERT INTO scoutops_quality_assignee_guard
SELECT 1 FROM data_quality_issues i
LEFT JOIN memberships m ON m.id=i.assigned_membership_id
LEFT JOIN users u ON u.id=m.user_id
WHERE i.assigned_membership_id IS NOT NULL AND u.id IS NULL LIMIT 1;
DROP TEMPORARY TABLE scoutops_quality_assignee_guard;
ALTER TABLE data_quality_issues ADD COLUMN assigned_account_id CHAR(36) CHARACTER SET ascii NULL AFTER assigned_membership_id;
UPDATE data_quality_issues i JOIN memberships m ON m.id=i.assigned_membership_id
SET i.assigned_account_id=m.user_id;
ALTER TABLE data_quality_issues DROP FOREIGN KEY fk_quality_issue_assignee,
  DROP INDEX idx_quality_issue_assignee_status,
  CHANGE COLUMN assigned_membership_id historical_assignee_membership_id CHAR(36) CHARACTER SET ascii NULL,
  ADD INDEX idx_quality_issue_account_status(assigned_account_id,status,updated_at),
  ADD CONSTRAINT fk_quality_issue_assignee_account FOREIGN KEY (assigned_account_id) REFERENCES users(id) ON DELETE RESTRICT;
