-- Fails with ER_DUP_ENTRY when independently owned products share an identity.
-- Never delete, merge or reassign those records to make rollback succeed.
ALTER TABLE `competitors`
  DROP INDEX `uq_competitor_identity`,
  ADD UNIQUE KEY `uq_competitor_identity` (`organization_id`,`workspace_id`,`market`,`source_site`,`external_id`);
