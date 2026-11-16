-- Stopped-writer historical rehearsal. Preserve roots as audit records, not authorization tables.
CREATE TEMPORARY TABLE scoutops_tenancy_root_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_tenancy_root_guard VALUES (1);
INSERT INTO scoutops_tenancy_root_guard
SELECT 1 WHERE DATABASE() NOT REGEXP '^product_scout_[a-z0-9_]+rehearsal$'
  OR SUBSTRING_INDEX(VERSION(),'.',2)<>'5.7'
  OR NOT EXISTS (SELECT 1 FROM account_ownership_cutover WHERE slot='current' AND contract_version=25)
  OR NOT EXISTS (SELECT 1 FROM schema_migrations WHERE name='0196_outbox_historical_scope.up.sql')
  OR (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()
    AND TABLE_TYPE='BASE TABLE' AND TABLE_NAME IN ('organizations','workspaces'))<>2
  OR (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE()
    AND REFERENCED_TABLE_SCHEMA=DATABASE() AND (
      (TABLE_NAME='workspaces' AND CONSTRAINT_NAME='fk_workspaces_org' AND COLUMN_NAME='organization_id'
        AND REFERENCED_TABLE_NAME='organizations' AND REFERENCED_COLUMN_NAME='id')
      OR (TABLE_NAME='organizations' AND CONSTRAINT_NAME='fk_organizations_default_workspace' AND COLUMN_NAME='default_workspace_id'
        AND REFERENCED_TABLE_NAME='workspaces' AND REFERENCED_COLUMN_NAME='id')))<>2
  OR EXISTS (SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()
    AND TABLE_NAME IN ('historical_organizations','historical_workspaces'));
INSERT INTO scoutops_tenancy_root_guard
SELECT 1 FROM information_schema.KEY_COLUMN_USAGE k
WHERE k.REFERENCED_TABLE_SCHEMA=DATABASE() AND k.REFERENCED_TABLE_NAME IN ('organizations','workspaces')
  AND NOT (k.TABLE_SCHEMA=DATABASE() AND (
    (k.TABLE_NAME='workspaces' AND k.CONSTRAINT_NAME='fk_workspaces_org' AND k.COLUMN_NAME='organization_id'
      AND k.REFERENCED_TABLE_NAME='organizations' AND k.REFERENCED_COLUMN_NAME='id')
    OR (k.TABLE_NAME='organizations' AND k.CONSTRAINT_NAME='fk_organizations_default_workspace' AND k.COLUMN_NAME='default_workspace_id'
      AND k.REFERENCED_TABLE_NAME='workspaces' AND k.REFERENCED_COLUMN_NAME='id')))
LIMIT 1;
INSERT INTO scoutops_tenancy_root_guard
SELECT 1 FROM information_schema.TRIGGERS
WHERE EVENT_OBJECT_SCHEMA=DATABASE() AND EVENT_OBJECT_TABLE IN ('organizations','workspaces') LIMIT 1;
INSERT INTO scoutops_tenancy_root_guard
SELECT 1 FROM information_schema.TABLES t
LEFT JOIN information_schema.VIEWS v ON v.TABLE_SCHEMA=t.TABLE_SCHEMA AND v.TABLE_NAME=t.TABLE_NAME
WHERE t.TABLE_SCHEMA=DATABASE() AND t.TABLE_TYPE='VIEW'
  AND (NULLIF(v.VIEW_DEFINITION,'') IS NULL
    OR LOWER(v.VIEW_DEFINITION) REGEXP '(^|[^[:alnum:]_])(organizations|workspaces)([^[:alnum:]_]|$)')
LIMIT 1;
DROP TEMPORARY TABLE scoutops_tenancy_root_guard;
-- RENAME preserves the original rows and both existing parent checks without opening a partial state.
RENAME TABLE organizations TO historical_organizations, workspaces TO historical_workspaces;
