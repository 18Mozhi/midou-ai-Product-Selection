-- Isolated account rehearsal only. Do not retire populated teams or grants.
CREATE TEMPORARY TABLE scoutops_team_retirement_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_team_retirement_guard VALUES (1);
INSERT INTO scoutops_team_retirement_guard SELECT 1 FROM teams LIMIT 1;
INSERT INTO scoutops_team_retirement_guard SELECT 1 FROM team_memberships LIMIT 1;
INSERT INTO scoutops_team_retirement_guard
SELECT 1 FROM membership_data_scopes WHERE team_id IS NOT NULL OR scope_type IN ('team','') LIMIT 1;
INSERT INTO scoutops_team_retirement_guard
SELECT 1 FROM information_schema.KEY_COLUMN_USAGE
WHERE REFERENCED_TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IN ('teams','team_memberships')
  AND NOT (TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME='teams' AND REFERENCED_COLUMN_NAME='id'
    AND COLUMN_NAME='team_id' AND (
      (TABLE_NAME='team_memberships' AND CONSTRAINT_NAME='fk_team_membership_team') OR
      (TABLE_NAME='membership_data_scopes' AND CONSTRAINT_NAME='fk_membership_scopes_team')
    ))
LIMIT 1;
DROP TEMPORARY TABLE scoutops_team_retirement_guard;
ALTER TABLE membership_data_scopes
  DROP FOREIGN KEY fk_membership_scopes_team,
  DROP INDEX idx_membership_scope_team,
  DROP COLUMN team_id,
  MODIFY COLUMN scope_type ENUM('own','workspace','organization') NOT NULL;
DROP TABLE team_memberships,teams;
