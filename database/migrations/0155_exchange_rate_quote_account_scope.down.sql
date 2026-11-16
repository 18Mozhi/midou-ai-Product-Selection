-- Do not invent original scope for account-only records.
CREATE TEMPORARY TABLE scoutops_fx_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_fx_scope_guard VALUES (1);
INSERT INTO scoutops_fx_scope_guard
SELECT 1 FROM exchange_rate_quotes q
LEFT JOIN workspaces w ON BINARY w.id=BINARY JSON_UNQUOTE(JSON_EXTRACT(q.historical_context,'$.workspace_id'))
  AND BINARY w.organization_id=BINARY JSON_UNQUOTE(JSON_EXTRACT(q.historical_context,'$.organization_id'))
WHERE w.id IS NULL LIMIT 1;
INSERT INTO scoutops_fx_scope_guard
SELECT 1 FROM exchange_rate_quotes q
GROUP BY JSON_UNQUOTE(JSON_EXTRACT(q.historical_context,'$.organization_id')),
  JSON_UNQUOTE(JSON_EXTRACT(q.historical_context,'$.workspace_id')),
  provider_id,base_currency,quote_currency,quote_date,source_ref_id
HAVING COUNT(*)>1 LIMIT 1;
DROP TEMPORARY TABLE scoutops_fx_scope_guard;
ALTER TABLE exchange_rate_quotes ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE exchange_rate_quotes SET
  organization_id=JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.organization_id')),
  workspace_id=JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.workspace_id'));
ALTER TABLE exchange_rate_quotes
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  DROP COLUMN historical_context, DROP INDEX idx_exchange_quote_account_lookup,
  ADD UNIQUE KEY uq_exchange_quote_source (organization_id,workspace_id,provider_id,base_currency,quote_currency,quote_date,source_ref_id),
  ADD KEY idx_exchange_quote_lookup (organization_id,workspace_id,base_currency,quote_currency,quote_date);
