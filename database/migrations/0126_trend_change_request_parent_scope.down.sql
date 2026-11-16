ALTER TABLE trend_topic_change_requests
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE trend_topic_change_requests c JOIN trend_topics t ON t.id=c.target_topic_id
SET c.organization_id=t.organization_id,c.workspace_id=t.workspace_id;
ALTER TABLE trend_topic_change_requests
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_trend_change_queue (organization_id,workspace_id,status,created_at),
  ADD CONSTRAINT fk_trend_change_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  ADD CONSTRAINT fk_trend_change_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id);
