-- Stop writers. Verify the exact normalized record and raw evidence before dropping scope.
DROP TEMPORARY TABLE IF EXISTS scoutops_field_provenance_scope_guard;
CREATE TEMPORARY TABLE scoutops_field_provenance_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_field_provenance_scope_guard VALUES (1);
INSERT INTO scoutops_field_provenance_scope_guard
SELECT 1 FROM field_provenance f
LEFT JOIN normalized_records n ON n.id=f.normalized_record_id AND n.raw_evidence_id=f.raw_evidence_id
  AND n.organization_id=f.organization_id AND n.workspace_id=f.workspace_id
LEFT JOIN raw_evidence e ON e.id=f.raw_evidence_id
  AND e.organization_id=f.organization_id AND e.workspace_id=f.workspace_id
WHERE n.id IS NULL OR e.id IS NULL LIMIT 1;
DROP TEMPORARY TABLE scoutops_field_provenance_scope_guard;
ALTER TABLE field_provenance
  DROP FOREIGN KEY fk_field_provenance_organization,
  DROP FOREIGN KEY fk_field_provenance_workspace,
  DROP INDEX idx_field_provenance_scope,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
