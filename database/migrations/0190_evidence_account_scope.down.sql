-- Stopped-writer rehearsal only. Restore original coordinates from exact retained parents.
CREATE TEMPORARY TABLE scoutops_evidence_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_evidence_scope_guard VALUES (1);
INSERT INTO scoutops_evidence_scope_guard
SELECT 1 WHERE DATABASE() NOT REGEXP '^product_scout_[a-z0-9_]+rehearsal$'
  OR SUBSTRING_INDEX(VERSION(),'.',2)<>'5.7'
  OR NOT EXISTS (SELECT 1 FROM account_ownership_cutover WHERE slot='current' AND contract_version=25);
INSERT INTO scoutops_evidence_scope_guard
SELECT 1 FROM raw_evidence e
LEFT JOIN collection_tasks t ON t.id=e.collection_task_id
LEFT JOIN collection_subqueries q ON q.id=e.collection_subquery_id AND q.task_id=t.id AND q.provider_id=e.provider_id
LEFT JOIN account_owned_records eo ON eo.source_table='raw_evidence' AND eo.source_id=e.id
LEFT JOIN account_owned_records tor ON tor.source_table='collection_tasks' AND tor.source_id=t.id
LEFT JOIN account_owned_records fo ON fo.source_table='file_assets' AND fo.source_id=e.file_asset_id
LEFT JOIN users u ON u.id=eo.account_id
JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25
WHERE q.id IS NULL OR u.id IS NULL OR NOT (eo.account_id<=>tor.account_id AND eo.account_id<=>fo.account_id)
  OR NOT (eo.reason='exclusive_owner' OR (eo.reason IN ('shared','unassigned') AND eo.account_id=cut.primary_account_id))
  OR NOT (e.account_id<=>eo.account_id)
LIMIT 1;
INSERT INTO scoutops_evidence_scope_guard
SELECT 1 FROM normalized_records n
LEFT JOIN raw_evidence e ON e.id=n.raw_evidence_id AND e.provider_id=n.provider_id
LEFT JOIN normalized_records p ON p.id=n.supersedes_record_id AND p.provider_id=n.provider_id
LEFT JOIN account_owned_records no ON no.source_table='normalized_records' AND no.source_id=n.id
LEFT JOIN account_owned_records eo ON eo.source_table='raw_evidence' AND eo.source_id=e.id
LEFT JOIN account_owned_records po ON po.source_table='normalized_records' AND po.source_id=p.id
JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25
WHERE e.id IS NULL OR no.account_id IS NULL OR NOT (no.account_id<=>eo.account_id)
  OR (n.supersedes_record_id IS NOT NULL AND NOT (no.account_id<=>po.account_id))
  OR NOT (no.reason='exclusive_owner' OR (no.reason IN ('shared','unassigned') AND no.account_id=cut.primary_account_id))
  OR NOT (n.account_id<=>e.account_id)
LIMIT 1;
INSERT INTO scoutops_evidence_scope_guard
SELECT 1 FROM raw_evidence e JOIN collection_tasks t ON t.id=e.collection_task_id
GROUP BY t.organization_id,t.workspace_id,e.provider_id,e.dedupe_key HAVING COUNT(*)>1 LIMIT 1;
INSERT INTO scoutops_evidence_scope_guard
SELECT 1 FROM normalized_records n JOIN raw_evidence e ON e.id=n.raw_evidence_id
JOIN collection_tasks t ON t.id=e.collection_task_id
GROUP BY t.organization_id,t.workspace_id,n.provider_id,n.record_key,n.record_version HAVING COUNT(*)>1 LIMIT 1;
DROP TEMPORARY TABLE scoutops_evidence_scope_guard;
ALTER TABLE raw_evidence ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
ALTER TABLE normalized_records ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE raw_evidence e JOIN collection_tasks t ON t.id=e.collection_task_id
SET e.organization_id=t.organization_id,e.workspace_id=t.workspace_id;
UPDATE normalized_records n JOIN raw_evidence e ON e.id=n.raw_evidence_id
SET n.organization_id=e.organization_id,n.workspace_id=e.workspace_id;
ALTER TABLE raw_evidence MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD UNIQUE KEY uq_raw_evidence_scope_dedupe (organization_id,workspace_id,provider_id,dedupe_key),
  ADD KEY idx_raw_evidence_scope_time (organization_id,workspace_id,captured_at),
  ADD KEY fk_raw_evidence_workspace (workspace_id),
  ADD CONSTRAINT fk_raw_evidence_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  ADD CONSTRAINT fk_raw_evidence_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  DROP FOREIGN KEY fk_raw_evidence_account, DROP INDEX uq_raw_evidence_account_dedupe, DROP INDEX idx_raw_evidence_account_time,
  DROP COLUMN account_id, DROP COLUMN history_chain;
ALTER TABLE normalized_records MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD UNIQUE KEY uq_normalized_scope_record_version (organization_id,workspace_id,provider_id,record_key,record_version),
  ADD KEY idx_normalized_scope_status (organization_id,workspace_id,status,created_at),
  ADD KEY fk_normalized_workspace (workspace_id),
  ADD CONSTRAINT fk_normalized_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  ADD CONSTRAINT fk_normalized_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  DROP FOREIGN KEY fk_normalized_account, DROP INDEX uq_normalized_account_record_version, DROP INDEX idx_normalized_account_status,
  DROP COLUMN account_id, DROP COLUMN history_chain;
