ALTER TABLE commercial_quota_adjustments
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id;
UPDATE commercial_quota_adjustments q JOIN organization_plan_assignments a ON a.id=q.assignment_id
SET q.organization_id=a.organization_id;
ALTER TABLE commercial_quota_adjustments
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  DROP INDEX idx_quota_adjustment_assignment_key,
  ADD KEY idx_quota_adjustment_org_key (organization_id,quota_key,status,expires_at),
  ADD CONSTRAINT fk_quota_adjustment_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
