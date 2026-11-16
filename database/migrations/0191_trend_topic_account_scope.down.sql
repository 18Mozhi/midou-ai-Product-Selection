-- Stopped-writer historical rehearsal. No fabricated legacy scope for new topics.
CREATE TEMPORARY TABLE scoutops_topic_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_topic_scope_guard VALUES (1);
INSERT INTO scoutops_topic_scope_guard
SELECT 1 WHERE DATABASE() NOT REGEXP '^product_scout_[a-z0-9_]+rehearsal$'
  OR SUBSTRING_INDEX(VERSION(),'.',2)<>'5.7'
  OR NOT EXISTS (SELECT 1 FROM account_ownership_cutover WHERE slot='current' AND contract_version=25);
INSERT INTO scoutops_topic_scope_guard
SELECT 1 FROM trend_topics t
JOIN account_ownership_cutover c ON c.slot='current' AND c.contract_version=25
LEFT JOIN account_retirement_records r ON r.run_id=c.source_run_id AND r.source_table='trend_topics' AND r.source_id=t.id
LEFT JOIN account_retirement_scopes s ON s.run_id=r.run_id AND s.legacy_org_id=r.legacy_org_id AND s.legacy_workspace_id=r.legacy_workspace_id
LEFT JOIN account_owned_records o ON o.source_table='trend_topics' AND o.source_id=t.id
LEFT JOIN workspaces w ON w.id=r.legacy_workspace_id AND w.organization_id=r.legacy_org_id
WHERE r.source_id IS NULL OR w.id IS NULL OR s.account_id IS NULL OR o.source_id IS NULL
  OR t.account_id<>o.account_id OR t.account_id<>s.account_id OR o.reason<>s.reason
  OR (o.reason IN ('shared','unassigned') AND o.account_id<>c.primary_account_id)
LIMIT 1;
INSERT INTO scoutops_topic_scope_guard
SELECT 1 FROM trend_topics t
JOIN account_ownership_cutover c ON c.slot='current' AND c.contract_version=25
JOIN account_retirement_records r ON r.run_id=c.source_run_id AND r.source_table='trend_topics' AND r.source_id=t.id
GROUP BY r.legacy_org_id,r.legacy_workspace_id,t.topic_key HAVING COUNT(*)>1 LIMIT 1;
DROP TEMPORARY TABLE scoutops_topic_scope_guard;
ALTER TABLE trend_topics ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE trend_topics t
JOIN account_ownership_cutover c ON c.slot='current' AND c.contract_version=25
JOIN account_retirement_records r ON r.run_id=c.source_run_id AND r.source_table='trend_topics' AND r.source_id=t.id
SET t.organization_id=r.legacy_org_id,t.workspace_id=r.legacy_workspace_id;
ALTER TABLE trend_topics MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD UNIQUE KEY uq_trend_topic_scope_key (organization_id,workspace_id,topic_key),
  ADD KEY idx_trend_topic_scope_list (organization_id,workspace_id,status,last_seen_at),
  ADD KEY idx_trend_topic_market_category (organization_id,workspace_id,market,category,last_seen_at),
  ADD KEY fk_trend_topic_workspace (workspace_id),
  ADD CONSTRAINT fk_trend_topic_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  ADD CONSTRAINT fk_trend_topic_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  DROP FOREIGN KEY fk_trend_topic_account, DROP INDEX idx_trend_topic_account_key,
  DROP INDEX idx_trend_topic_account_list, DROP INDEX idx_trend_topic_account_market, DROP COLUMN account_id;
