-- Stopped-writer historical rehearsal. Preserve original opportunities and their topic links.
CREATE TEMPORARY TABLE scoutops_opportunity_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_opportunity_scope_guard VALUES (1);
INSERT INTO scoutops_opportunity_scope_guard
SELECT 1 WHERE DATABASE() NOT REGEXP '^product_scout_[a-z0-9_]+rehearsal$'
  OR SUBSTRING_INDEX(VERSION(),'.',2)<>'5.7'
  OR NOT EXISTS (SELECT 1 FROM account_ownership_cutover WHERE slot='current' AND contract_version=25);
INSERT INTO scoutops_opportunity_scope_guard
SELECT 1 FROM opportunities t
JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25
LEFT JOIN account_retirement_records r ON r.run_id=cut.source_run_id AND r.source_table='opportunities' AND r.source_id=t.id
LEFT JOIN account_retirement_scopes s ON s.run_id=r.run_id AND s.legacy_org_id=r.legacy_org_id AND s.legacy_workspace_id=r.legacy_workspace_id
LEFT JOIN account_owned_records o ON o.source_table='opportunities' AND o.source_id=t.id
LEFT JOIN workspaces w ON w.id=r.legacy_workspace_id AND w.organization_id=r.legacy_org_id
LEFT JOIN users u ON u.id=o.account_id
LEFT JOIN account_owned_records topic ON topic.source_table='trend_topics' AND topic.source_id=t.source_ref_id
WHERE r.source_id IS NULL OR s.account_id IS NULL OR o.source_id IS NULL OR w.id IS NULL OR u.id IS NULL
  OR NOT (s.account_id<=>o.account_id AND s.reason<=>o.reason)
  OR (o.reason IN ('shared','unassigned') AND o.account_id<>cut.primary_account_id)
  OR NOT (r.legacy_org_id<=>t.organization_id AND r.legacy_workspace_id<=>t.workspace_id)
  OR (t.source_type='trend_topic' AND (topic.source_id IS NULL OR NOT(topic.account_id<=>o.account_id)))
LIMIT 1;
INSERT INTO scoutops_opportunity_scope_guard
SELECT 1 FROM opportunities t JOIN account_owned_records o ON o.source_table='opportunities' AND o.source_id=t.id
WHERE t.source_ref_id IS NOT NULL
GROUP BY o.account_id,t.source_type,t.source_ref_id HAVING COUNT(*)>1
LIMIT 1;
DROP TEMPORARY TABLE scoutops_opportunity_scope_guard;
ALTER TABLE opportunities ADD COLUMN account_id CHAR(36) CHARACTER SET ascii NULL AFTER id;
UPDATE opportunities t JOIN account_owned_records o ON o.source_table='opportunities' AND o.source_id=t.id SET t.account_id=o.account_id;
ALTER TABLE opportunities MODIFY COLUMN account_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD UNIQUE KEY uq_opportunity_account_source (account_id,source_type,source_ref_id),
  ADD KEY idx_opportunity_account_updated (account_id,updated_at,id),
  ADD KEY idx_opportunity_account_decision (account_id,decision_status,updated_at),
  ADD KEY idx_opportunity_account_lifecycle_age (account_id,lifecycle_status,lifecycle_entered_at),
  ADD CONSTRAINT fk_opportunity_account FOREIGN KEY (account_id) REFERENCES users(id),
  DROP FOREIGN KEY fk_opportunity_org, DROP FOREIGN KEY fk_opportunity_workspace,
  DROP INDEX uq_opportunity_source, DROP INDEX idx_opportunity_scope_updated,
  DROP INDEX idx_opportunity_scope_decision, DROP INDEX idx_opportunity_scope_lifecycle_age, DROP INDEX fk_opportunity_workspace,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
