-- Do not discard any token metadata or history if the old table is populated.
CREATE TEMPORARY TABLE scoutops_org_token_retirement_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_org_token_retirement_guard VALUES (1);
INSERT INTO scoutops_org_token_retirement_guard SELECT 1 FROM organization_api_tokens LIMIT 1;
INSERT INTO scoutops_org_token_retirement_guard
SELECT 1 FROM information_schema.KEY_COLUMN_USAGE
WHERE REFERENCED_TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME='organization_api_tokens'
  AND NOT (TABLE_SCHEMA=DATABASE() AND TABLE_NAME='organization_api_tokens')
LIMIT 1;
DROP TEMPORARY TABLE scoutops_org_token_retirement_guard;
DROP TABLE organization_api_tokens;
