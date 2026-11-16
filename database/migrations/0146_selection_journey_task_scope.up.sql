-- Rehearsal only. Stop legacy journey writers before applying.
DROP TEMPORARY TABLE IF EXISTS scoutops_journey_task_scope_guard;
CREATE TEMPORARY TABLE scoutops_journey_task_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_journey_task_scope_guard VALUES (1);
INSERT INTO scoutops_journey_task_scope_guard
SELECT 1 FROM selection_journeys j
LEFT JOIN collection_tasks t ON t.id=j.task_id
LEFT JOIN opportunities o ON o.id=j.opportunity_id
WHERE t.id IS NULL OR NOT (t.organization_id <=> j.organization_id AND t.workspace_id <=> j.workspace_id)
   OR (j.opportunity_id IS NOT NULL AND (o.id IS NULL OR NOT
       (o.organization_id <=> j.organization_id AND o.workspace_id <=> j.workspace_id)))
LIMIT 1;
DROP TEMPORARY TABLE scoutops_journey_task_scope_guard;
ALTER TABLE selection_journeys
  DROP FOREIGN KEY fk_selection_journey_org, DROP FOREIGN KEY fk_selection_journey_workspace,
  DROP INDEX idx_selection_journey_scope_time, DROP INDEX fk_selection_journey_workspace,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
