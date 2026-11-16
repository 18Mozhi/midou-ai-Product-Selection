-- Stop writers. Delivery and event IDs may legitimately differ.
DROP TEMPORARY TABLE IF EXISTS scoutops_opportunity_delivery_parent;
CREATE TEMPORARY TABLE scoutops_opportunity_delivery_parent (
  delivery_id CHAR(36) CHARACTER SET ascii PRIMARY KEY,
  event_id CHAR(36) CHARACTER SET ascii NOT NULL
) ENGINE=InnoDB;
INSERT INTO scoutops_opportunity_delivery_parent
SELECT o.id, COALESCE(MAX(IF(e.id=o.id,e.id,NULL)),MIN(e.id))
FROM opportunity_outbox o JOIN opportunity_events e
  ON e.organization_id=o.organization_id AND e.workspace_id=o.workspace_id
  AND e.resource_type=o.resource_type AND e.resource_id=o.resource_id
  AND BINARY e.resource_type=BINARY o.resource_type AND BINARY e.event_type=BINARY o.event_type
  AND BINARY e.request_id=BINARY o.request_id AND BINARY e.trace_id=BINARY o.trace_id
GROUP BY o.id HAVING COUNT(*)=1 OR MAX(e.id=o.id)=1;
DROP TEMPORARY TABLE IF EXISTS scoutops_opportunity_delivery_guard;
CREATE TEMPORARY TABLE scoutops_opportunity_delivery_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_opportunity_delivery_guard VALUES (1);
INSERT INTO scoutops_opportunity_delivery_guard
SELECT 1 FROM opportunity_outbox o LEFT JOIN scoutops_opportunity_delivery_parent m ON m.delivery_id=o.id
WHERE m.delivery_id IS NULL LIMIT 1;
DROP TEMPORARY TABLE scoutops_opportunity_delivery_guard;
ALTER TABLE opportunity_outbox ADD COLUMN event_id CHAR(36) CHARACTER SET ascii NULL AFTER id;
UPDATE opportunity_outbox o JOIN scoutops_opportunity_delivery_parent m ON m.delivery_id=o.id SET o.event_id=m.event_id;
DROP TEMPORARY TABLE scoutops_opportunity_delivery_parent;
ALTER TABLE opportunity_outbox MODIFY COLUMN event_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_opportunity_delivery_event (event_id),
  ADD CONSTRAINT fk_opportunity_delivery_event FOREIGN KEY (event_id) REFERENCES opportunity_events(id),
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
