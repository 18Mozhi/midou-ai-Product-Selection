-- Stopped-writer historical rehearsal only. Historical provenance is never a delivery queue.
CREATE TEMPORARY TABLE scoutops_outbox_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_outbox_scope_guard VALUES (1);
INSERT INTO scoutops_outbox_scope_guard
SELECT 1 WHERE DATABASE() NOT REGEXP '^product_scout_[a-z0-9_]+rehearsal$'
  OR SUBSTRING_INDEX(VERSION(),'.',2)<>'5.7'
  OR NOT EXISTS (SELECT 1 FROM account_ownership_cutover WHERE slot='current' AND contract_version=25)
  OR NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
    AND TABLE_NAME='outbox_events' AND COLUMN_NAME='organization_id' AND IS_NULLABLE='YES')
  OR NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
    AND TABLE_NAME='outbox_events' AND COLUMN_NAME='workspace_id' AND IS_NULLABLE='YES')
  OR NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE()
    AND TABLE_NAME='outbox_events' AND INDEX_NAME='idx_outbox_org_status_available'
    GROUP BY INDEX_NAME HAVING COUNT(*)=3 AND GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX)='organization_id,status,available_at')
  OR NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
    AND TABLE_NAME='opportunities' AND COLUMN_NAME='account_id');
INSERT INTO scoutops_outbox_scope_guard
SELECT 1 FROM outbox_events e
LEFT JOIN account_owned_records own ON own.source_table='outbox_events' AND own.source_id=e.id
WHERE e.status IN ('pending','leased','failed')
  AND (e.status<>'pending' OR e.leased_at IS NOT NULL OR e.lease_expires_at IS NOT NULL OR e.organization_id IS NULL OR own.source_id IS NOT NULL OR e.event_type NOT IN
    ('organization.invitation.created','organization.workspace.archived','organization.workspace.created'))
LIMIT 1;
DROP TEMPORARY TABLE scoutops_outbox_scope_guard;

CREATE TABLE outbox_event_scope_history (
  event_id CHAR(36) CHARACTER SET ascii NOT NULL,
  legacy_org_id CHAR(36) CHARACTER SET ascii NULL,
  legacy_workspace_id CHAR(36) CHARACTER SET ascii NULL,
  PRIMARY KEY (event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO outbox_event_scope_history (event_id,legacy_org_id,legacy_workspace_id)
SELECT id,organization_id,workspace_id FROM outbox_events;
ALTER TABLE outbox_events DROP INDEX idx_outbox_org_status_available,
  ADD KEY idx_outbox_status_available (status,available_at),
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
