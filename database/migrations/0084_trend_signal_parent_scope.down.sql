-- Stop writers. Reconstruct legacy coordinates through the authoritative topic FK.
DROP VIEW trend_signals_with_topic_scope;
ALTER TABLE trend_signals
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE trend_signals s JOIN trend_topics t ON t.id=s.topic_id
SET s.organization_id=t.organization_id,s.workspace_id=t.workspace_id;
ALTER TABLE trend_signals
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_trend_signal_scope_time (organization_id,workspace_id,published_at),
  ADD KEY fk_trend_signal_workspace (workspace_id),
  ADD CONSTRAINT fk_trend_signal_org FOREIGN KEY (organization_id) REFERENCES organizations (id),
  ADD CONSTRAINT fk_trend_signal_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id);
