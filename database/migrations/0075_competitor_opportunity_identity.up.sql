-- Preserve each opportunity's own product, snapshots and collection task identity.
-- NULL opportunity identities are serialized and checked by the API create transaction.
ALTER TABLE `competitors`
  DROP INDEX `uq_competitor_identity`,
  ADD UNIQUE KEY `uq_competitor_identity` (`organization_id`,`workspace_id`,`market`,`source_site`,`external_id`,`opportunity_id`);
