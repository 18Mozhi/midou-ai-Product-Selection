-- Stopped-writer account cutover. Preserve every original identity and payload.
-- The old scope contributes only to an opaque version-chain token, never authorization.
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
  OR NOT (e.organization_id<=>t.organization_id AND e.workspace_id<=>t.workspace_id)
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
  OR (n.supersedes_record_id IS NOT NULL AND (p.id IS NULL OR NOT (no.account_id<=>po.account_id
    AND n.organization_id<=>p.organization_id AND n.workspace_id<=>p.workspace_id AND n.record_key<=>p.record_key)))
  OR NOT (no.reason='exclusive_owner' OR (no.reason IN ('shared','unassigned') AND no.account_id=cut.primary_account_id))
  OR NOT (n.organization_id<=>e.organization_id AND n.workspace_id<=>e.workspace_id)
LIMIT 1;
INSERT INTO scoutops_evidence_scope_guard
SELECT 1 FROM raw_evidence e JOIN account_owned_records o ON o.source_table='raw_evidence' AND o.source_id=e.id
GROUP BY o.account_id,e.provider_id,e.dedupe_key,UNHEX(SHA2(CONCAT('scoutops:evidence-history:v1:',e.organization_id,':',e.workspace_id),256)) HAVING COUNT(*)>1 LIMIT 1;
INSERT INTO scoutops_evidence_scope_guard
SELECT 1 FROM normalized_records n JOIN account_owned_records o ON o.source_table='normalized_records' AND o.source_id=n.id
GROUP BY o.account_id,n.provider_id,n.record_key,UNHEX(SHA2(CONCAT('scoutops:evidence-history:v1:',n.organization_id,':',n.workspace_id),256))
HAVING COUNT(*)>COUNT(DISTINCT n.record_version) OR SUM(n.status='active')>1 LIMIT 1;
INSERT INTO scoutops_evidence_scope_guard
SELECT 1 FROM (
  SELECT UNHEX(SHA2(CONCAT('scoutops:evidence-history:v1:',s.legacy_org_id,':',s.legacy_workspace_id),256)) chain_key, COUNT(*) n
  FROM account_retirement_scopes s JOIN account_ownership_cutover cut ON cut.source_run_id=s.run_id AND cut.slot='current' AND cut.contract_version=25
  GROUP BY chain_key
) history_scope WHERE n>1 OR chain_key=0x0000000000000000000000000000000000000000000000000000000000000000 LIMIT 1;
DROP TEMPORARY TABLE scoutops_evidence_scope_guard;
ALTER TABLE raw_evidence ADD COLUMN account_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN history_chain BINARY(32) NOT NULL DEFAULT 0x0000000000000000000000000000000000000000000000000000000000000000 AFTER account_id;
ALTER TABLE normalized_records ADD COLUMN account_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN history_chain BINARY(32) NOT NULL DEFAULT 0x0000000000000000000000000000000000000000000000000000000000000000 AFTER account_id;
UPDATE raw_evidence e JOIN account_owned_records o ON o.source_table='raw_evidence' AND o.source_id=e.id
SET e.account_id=o.account_id,e.history_chain=UNHEX(SHA2(CONCAT('scoutops:evidence-history:v1:',e.organization_id,':',e.workspace_id),256));
UPDATE normalized_records n JOIN account_owned_records o ON o.source_table='normalized_records' AND o.source_id=n.id
SET n.account_id=o.account_id,n.history_chain=UNHEX(SHA2(CONCAT('scoutops:evidence-history:v1:',n.organization_id,':',n.workspace_id),256));
ALTER TABLE raw_evidence MODIFY COLUMN account_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD UNIQUE KEY uq_raw_evidence_account_dedupe (account_id,provider_id,dedupe_key,history_chain),
  ADD KEY idx_raw_evidence_account_time (account_id,captured_at),
  ADD CONSTRAINT fk_raw_evidence_account FOREIGN KEY (account_id) REFERENCES users(id),
  DROP FOREIGN KEY fk_raw_evidence_organization, DROP FOREIGN KEY fk_raw_evidence_workspace,
  DROP INDEX uq_raw_evidence_scope_dedupe, DROP INDEX idx_raw_evidence_scope_time, DROP INDEX fk_raw_evidence_workspace,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
ALTER TABLE normalized_records MODIFY COLUMN account_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD UNIQUE KEY uq_normalized_account_record_version (account_id,provider_id,record_key,history_chain,record_version),
  ADD KEY idx_normalized_account_status (account_id,status,created_at),
  ADD CONSTRAINT fk_normalized_account FOREIGN KEY (account_id) REFERENCES users(id),
  DROP FOREIGN KEY fk_normalized_organization, DROP FOREIGN KEY fk_normalized_workspace,
  DROP INDEX uq_normalized_scope_record_version, DROP INDEX idx_normalized_scope_status, DROP INDEX fk_normalized_workspace,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
