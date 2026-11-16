-- Rehearsal only. Reconstruct the original coordinates from the original task.
ALTER TABLE selection_journeys
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE selection_journeys j JOIN collection_tasks t ON t.id=j.task_id
SET j.organization_id=t.organization_id,j.workspace_id=t.workspace_id;
ALTER TABLE selection_journeys
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_selection_journey_scope_time (organization_id,workspace_id,created_at,id),
  ADD KEY fk_selection_journey_workspace (workspace_id),
  ADD CONSTRAINT fk_selection_journey_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  ADD CONSTRAINT fk_selection_journey_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id);
