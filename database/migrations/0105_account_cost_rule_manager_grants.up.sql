-- Rehearsal only. Freeze legacy role/scope writers while taking this projection.
DROP TEMPORARY TABLE IF EXISTS scoutops_cost_manager_owner_guard;
CREATE TEMPORARY TABLE scoutops_cost_manager_owner_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_cost_manager_owner_guard VALUES (1);
INSERT INTO scoutops_cost_manager_owner_guard
SELECT 1 FROM cost_rules r LEFT JOIN account_owned_records a ON a.source_table='cost_rules' AND a.source_id=r.id
WHERE a.source_id IS NULL LIMIT 1;
DROP TEMPORARY TABLE scoutops_cost_manager_owner_guard;

CREATE TABLE account_cost_rule_manager_grants (
  cost_rule_id CHAR(36) CHARACTER SET ascii NOT NULL,
  manager_id CHAR(36) CHARACTER SET ascii NOT NULL,
  PRIMARY KEY (cost_rule_id,manager_id),
  KEY idx_account_cost_manager_rules (manager_id,cost_rule_id),
  FOREIGN KEY (cost_rule_id) REFERENCES cost_rules(id) ON DELETE RESTRICT,
  FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Match the prior session + authorization predicate. The request had neither
-- team/owner input nor resource-grant fields, so those grants never qualified.
INSERT INTO account_cost_rule_manager_grants (cost_rule_id,manager_id)
SELECT DISTINCT cr.id,m.user_id
FROM cost_rules cr
JOIN organizations o ON o.id=cr.organization_id AND o.status='active'
JOIN workspaces w ON w.id=cr.workspace_id AND w.organization_id=o.id AND w.status='active'
JOIN memberships m ON m.organization_id=o.id AND m.status='active'
JOIN users u ON u.id=m.user_id AND u.status='active'
JOIN membership_role_assignments mgr ON mgr.membership_id=m.id AND mgr.role_code='selection_manager'
JOIN roles manager ON manager.code=mgr.role_code AND manager.category='organization' AND manager.status='active'
WHERE (
  EXISTS (
    SELECT 1 FROM membership_role_assignments a
    JOIN roles role ON role.code=a.role_code AND role.category='organization' AND role.status='active'
    JOIN role_capabilities c ON c.role_code=role.code AND c.capability_code='opportunity:approve'
    WHERE a.membership_id=m.id
  )
  AND EXISTS (
    SELECT 1 FROM membership_data_scopes s WHERE s.membership_id=m.id
      AND (s.scope_type='organization' OR (s.scope_type='workspace' AND s.workspace_id=w.id))
  )
) OR EXISTS (
  SELECT 1 FROM platform_role_assignments a
  JOIN roles role ON role.code=a.role_code AND role.category='platform' AND role.status='active'
  JOIN role_capabilities c ON c.role_code=role.code AND c.capability_code='opportunity:approve'
  WHERE a.user_id=m.user_id
);
