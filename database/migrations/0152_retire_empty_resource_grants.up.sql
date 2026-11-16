-- Do not delete any grant, action, audit record or replay history.
CREATE TEMPORARY TABLE scoutops_legacy_grant_retirement_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_legacy_grant_retirement_guard VALUES (1);
INSERT INTO scoutops_legacy_grant_retirement_guard SELECT 1 FROM resource_grants LIMIT 1;
INSERT INTO scoutops_legacy_grant_retirement_guard SELECT 1 FROM resource_grant_actions LIMIT 1;
INSERT INTO scoutops_legacy_grant_retirement_guard SELECT 1 FROM resource_grant_audit_events LIMIT 1;
INSERT INTO scoutops_legacy_grant_retirement_guard SELECT 1 FROM resource_grant_operations LIMIT 1;
INSERT INTO scoutops_legacy_grant_retirement_guard
SELECT 1 FROM information_schema.KEY_COLUMN_USAGE
WHERE REFERENCED_TABLE_SCHEMA=DATABASE()
  AND REFERENCED_TABLE_NAME IN ('resource_grants','resource_grant_actions','resource_grant_audit_events','resource_grant_operations')
  AND NOT (TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('resource_grant_actions','resource_grant_audit_events','resource_grant_operations')
    AND REFERENCED_TABLE_NAME='resource_grants')
LIMIT 1;
DROP TEMPORARY TABLE scoutops_legacy_grant_retirement_guard;
DROP TABLE resource_grant_operations,resource_grant_audit_events,resource_grant_actions,resource_grants;
