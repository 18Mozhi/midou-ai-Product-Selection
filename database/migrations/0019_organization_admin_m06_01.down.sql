DROP TABLE IF EXISTS `organization_admin_operations`;
DROP TABLE IF EXISTS `organization_api_tokens`;
DROP TABLE IF EXISTS `organization_invitations`;
DROP TABLE IF EXISTS `team_memberships`;
ALTER TABLE `teams` DROP FOREIGN KEY `fk_teams_lead_membership`, DROP KEY `idx_teams_lead`, DROP COLUMN `default_workflow_key`, DROP COLUMN `lead_membership_id`;
ALTER TABLE `organizations` DROP COLUMN `logo_url`;
