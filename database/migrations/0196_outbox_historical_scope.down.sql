-- A stopped-writer rehearsal may only roll back the exact archived delivery population.
CREATE TEMPORARY TABLE scoutops_outbox_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_outbox_scope_guard VALUES (1);
INSERT INTO scoutops_outbox_scope_guard
SELECT 1 WHERE DATABASE() NOT REGEXP '^product_scout_[a-z0-9_]+rehearsal$'
  OR SUBSTRING_INDEX(VERSION(),'.',2)<>'5.7'
  OR NOT EXISTS (SELECT 1 FROM account_ownership_cutover WHERE slot='current' AND contract_version=25);
INSERT INTO scoutops_outbox_scope_guard
SELECT 1 FROM outbox_events e LEFT JOIN outbox_event_scope_history h ON h.event_id=e.id
WHERE h.event_id IS NULL LIMIT 1;
INSERT INTO scoutops_outbox_scope_guard
SELECT 1 FROM outbox_event_scope_history h LEFT JOIN outbox_events e ON e.id=h.event_id
WHERE e.id IS NULL LIMIT 1;
DROP TEMPORARY TABLE scoutops_outbox_scope_guard;

ALTER TABLE outbox_events ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id,
  DROP INDEX idx_outbox_status_available, DROP INDEX idx_outbox_lease_expiry, DROP INDEX idx_outbox_trace,
  ADD KEY idx_outbox_org_status_available (organization_id,status,available_at),
  ADD KEY idx_outbox_lease_expiry (lease_expires_at),
  ADD KEY idx_outbox_trace (trace_id);
UPDATE outbox_events e JOIN outbox_event_scope_history h ON h.event_id=e.id
SET e.organization_id=h.legacy_org_id,e.workspace_id=h.legacy_workspace_id;
DROP TABLE outbox_event_scope_history;
