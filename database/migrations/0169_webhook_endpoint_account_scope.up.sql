CREATE TEMPORARY TABLE scoutops_webhook_endpoint_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_webhook_endpoint_guard VALUES (1);
INSERT INTO scoutops_webhook_endpoint_guard
SELECT 1 FROM webhook_endpoints e LEFT JOIN organizations o ON o.id=e.organization_id
LEFT JOIN account_ownership_cutover c ON c.slot='current' AND c.contract_version=25
LEFT JOIN account_retirement_scopes m ON m.run_id=c.source_run_id AND m.legacy_org_id=o.id
WHERE o.id IS NULL OR m.account_id IS NULL OR NOT (m.reason='exclusive_owner' OR (m.reason IN ('shared','unassigned') AND m.account_id=c.primary_account_id))
  OR EXISTS (SELECT 1 FROM account_retirement_scopes alt WHERE alt.run_id=m.run_id
    AND alt.legacy_org_id=m.legacy_org_id AND alt.account_id<>m.account_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_webhook_endpoint_guard;
ALTER TABLE webhook_endpoints ADD COLUMN account_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN historical_context JSON NULL AFTER account_id;
UPDATE webhook_endpoints e JOIN account_ownership_cutover c ON c.slot='current' AND c.contract_version=25
JOIN account_retirement_scopes m ON m.run_id=c.source_run_id AND m.legacy_org_id=e.organization_id
SET e.account_id=m.account_id,e.historical_context=JSON_OBJECT('organization_id',e.organization_id);
ALTER TABLE webhook_endpoints MODIFY COLUMN account_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN historical_context JSON NOT NULL,
  ADD KEY idx_webhook_endpoint_account_status (account_id,status,updated_at),
  ADD CONSTRAINT fk_webhook_endpoint_account FOREIGN KEY (account_id) REFERENCES users(id) ON DELETE RESTRICT,
  DROP FOREIGN KEY fk_webhook_endpoint_org, DROP INDEX idx_webhook_endpoint_org_status, DROP COLUMN organization_id;
