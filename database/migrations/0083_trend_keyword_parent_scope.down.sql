-- Stop writers before reconstructing the original coordinates and constraints.
ALTER TABLE trend_topic_keywords
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE trend_topic_keywords k JOIN trend_topics t ON t.id=k.topic_id
SET k.organization_id=t.organization_id,k.workspace_id=t.workspace_id;
ALTER TABLE trend_topic_keywords
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_trend_keyword_scope (organization_id,workspace_id,keyword_type),
  ADD KEY fk_trend_keyword_workspace (workspace_id),
  ADD CONSTRAINT fk_trend_keyword_org FOREIGN KEY (organization_id) REFERENCES organizations (id),
  ADD CONSTRAINT fk_trend_keyword_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id);
