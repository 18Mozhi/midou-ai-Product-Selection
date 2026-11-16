-- Stop writers. Each delivery shares the ID and exact provenance of its original event.
DROP TEMPORARY TABLE IF EXISTS scoutops_trend_outbox_scope_guard;
CREATE TEMPORARY TABLE scoutops_trend_outbox_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_trend_outbox_scope_guard VALUES (1);
INSERT INTO scoutops_trend_outbox_scope_guard
SELECT 1 FROM trend_outbox o
LEFT JOIN trend_events e ON e.id=o.id AND e.organization_id=o.organization_id AND e.workspace_id=o.workspace_id
  AND BINARY e.event_type=BINARY o.event_type AND BINARY e.resource_type=BINARY o.resource_type
  AND e.resource_id=o.resource_id AND BINARY e.request_id=BINARY o.request_id AND BINARY e.trace_id=BINARY o.trace_id
WHERE e.id IS NULL LIMIT 1;
DROP TEMPORARY TABLE scoutops_trend_outbox_scope_guard;
ALTER TABLE trend_outbox
  DROP INDEX idx_trend_outbox_scope,
  DROP COLUMN organization_id, DROP COLUMN workspace_id,
  ADD CONSTRAINT fk_trend_outbox_original_event FOREIGN KEY (id) REFERENCES trend_events(id) ON DELETE RESTRICT;
