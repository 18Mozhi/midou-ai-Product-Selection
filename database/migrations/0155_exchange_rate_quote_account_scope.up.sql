-- Stop writers. The sealed source and its account ledger must agree before removing the old coordinates.
CREATE TEMPORARY TABLE scoutops_fx_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_fx_scope_guard VALUES (1);
INSERT INTO scoutops_fx_scope_guard
SELECT 1 FROM exchange_rate_quotes q
LEFT JOIN account_ownership_cutover c ON c.slot='current' AND c.contract_version=25
LEFT JOIN account_retirement_records r ON r.run_id=c.source_run_id AND r.source_table='exchange_rate_quotes' AND r.source_id=q.id
LEFT JOIN account_retirement_scopes s ON s.run_id=r.run_id AND s.legacy_org_id=r.legacy_org_id AND s.legacy_workspace_id=r.legacy_workspace_id
LEFT JOIN account_owned_records a ON a.source_table=r.source_table AND a.source_id=r.source_id
  AND a.account_id=s.account_id AND a.reason=s.reason
WHERE a.source_id IS NULL OR r.legacy_org_id<>q.organization_id OR r.legacy_workspace_id<>q.workspace_id
LIMIT 1;
DROP TEMPORARY TABLE scoutops_fx_scope_guard;
ALTER TABLE exchange_rate_quotes ADD COLUMN historical_context JSON NULL AFTER id;
UPDATE exchange_rate_quotes SET historical_context=JSON_OBJECT('organization_id',organization_id,'workspace_id',workspace_id);
ALTER TABLE exchange_rate_quotes
  DROP INDEX uq_exchange_quote_source, DROP INDEX idx_exchange_quote_lookup,
  DROP COLUMN organization_id, DROP COLUMN workspace_id,
  ADD KEY idx_exchange_quote_account_lookup (base_currency,quote_currency,quote_date,observed_at);
