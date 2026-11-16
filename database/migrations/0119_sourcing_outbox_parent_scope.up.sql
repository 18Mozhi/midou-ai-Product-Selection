-- Stop writers. The exact original sourcing event supplies delivery provenance.
DROP TEMPORARY TABLE IF EXISTS scoutops_sourcing_outbox_scope_guard;
CREATE TEMPORARY TABLE scoutops_sourcing_outbox_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_sourcing_outbox_scope_guard VALUES (1);
INSERT INTO scoutops_sourcing_outbox_scope_guard
SELECT 1 FROM sourcing_outbox o
LEFT JOIN sourcing_events e ON e.id=o.id AND e.organization_id=o.organization_id AND e.workspace_id=o.workspace_id
  AND BINARY e.event_type=BINARY o.event_type AND e.resource_id=o.resource_id
WHERE e.id IS NULL OR (
  o.event_type IN ('sourcing.purchase_task.queued','sourcing.purchase_task.account_rehearsal.queued')
  AND NOT (BINARY JSON_UNQUOTE(JSON_EXTRACT(o.payload_json,'$.id')) <=> BINARY o.resource_id)
) LIMIT 1;
DROP TEMPORARY TABLE scoutops_sourcing_outbox_scope_guard;
ALTER TABLE sourcing_outbox
  DROP COLUMN organization_id, DROP COLUMN workspace_id,
  ADD CONSTRAINT fk_sourcing_outbox_original_event FOREIGN KEY (id) REFERENCES sourcing_events(id) ON DELETE RESTRICT;
