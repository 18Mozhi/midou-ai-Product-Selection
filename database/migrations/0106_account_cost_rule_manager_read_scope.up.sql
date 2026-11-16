-- Freeze legacy authorization writers. Approval capability alone is not read permission.
ALTER TABLE account_cost_rule_manager_grants ADD COLUMN can_read TINYINT(1) NOT NULL DEFAULT 0;

UPDATE account_cost_rule_manager_grants g
JOIN cost_rules cr ON cr.id=g.cost_rule_id
JOIN organizations o ON o.id=cr.organization_id AND o.status='active'
JOIN workspaces w ON w.id=cr.workspace_id AND w.organization_id=o.id AND w.status='active'
JOIN memberships m ON m.organization_id=o.id AND m.user_id=g.manager_id AND m.status='active'
JOIN users u ON u.id=m.user_id AND u.status='active'
JOIN membership_role_assignments mgr ON mgr.membership_id=m.id AND mgr.role_code='selection_manager'
JOIN roles manager ON manager.code=mgr.role_code AND manager.category='organization' AND manager.status='active'
SET g.can_read=1
WHERE (
  EXISTS (
    SELECT 1 FROM membership_role_assignments a
    JOIN roles r ON r.code=a.role_code AND r.category='organization' AND r.status='active'
    JOIN role_capabilities c ON c.role_code=r.code AND c.capability_code='opportunity:read'
    WHERE a.membership_id=m.id
  )
  AND EXISTS (
    SELECT 1 FROM membership_data_scopes s WHERE s.membership_id=m.id
      AND (s.scope_type='organization' OR (s.scope_type='workspace' AND s.workspace_id=w.id))
  )
) OR EXISTS (
  SELECT 1 FROM platform_role_assignments a
  JOIN roles r ON r.code=a.role_code AND r.category='platform' AND r.status='active'
  JOIN role_capabilities c ON c.role_code=r.code AND c.capability_code='opportunity:read'
  WHERE a.user_id=m.user_id
);
