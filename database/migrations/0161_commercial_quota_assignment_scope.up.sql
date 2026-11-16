-- With writers stopped, prove the adjustment's organization is identical to its parent.
DROP TEMPORARY TABLE IF EXISTS scoutops_quota_assignment_guard;
CREATE TEMPORARY TABLE scoutops_quota_assignment_guard (id INT PRIMARY KEY);
INSERT INTO scoutops_quota_assignment_guard VALUES (1);
INSERT INTO scoutops_quota_assignment_guard
SELECT 1 FROM commercial_quota_adjustments q
LEFT JOIN organization_plan_assignments a ON a.id=q.assignment_id
WHERE a.id IS NULL OR NOT (q.organization_id <=> a.organization_id) LIMIT 1;
DROP TEMPORARY TABLE scoutops_quota_assignment_guard;
ALTER TABLE commercial_quota_adjustments
  DROP FOREIGN KEY fk_quota_adjustment_org, DROP INDEX idx_quota_adjustment_org_key,
  ADD KEY idx_quota_adjustment_assignment_key (assignment_id,quota_key,status,expires_at),
  DROP COLUMN organization_id;
