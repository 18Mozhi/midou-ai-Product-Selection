-- Restore both coordinates from the original normalized record.
ALTER TABLE field_provenance
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE field_provenance f JOIN normalized_records n ON n.id=f.normalized_record_id
SET f.organization_id=n.organization_id,f.workspace_id=n.workspace_id;
ALTER TABLE field_provenance
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_field_provenance_scope (organization_id,workspace_id,field_path),
  ADD KEY fk_field_provenance_workspace (workspace_id),
  ADD CONSTRAINT fk_field_provenance_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  ADD CONSTRAINT fk_field_provenance_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id);
