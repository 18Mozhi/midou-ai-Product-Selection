ALTER TABLE `providers`
  ADD COLUMN `terms_version` VARCHAR(80) CHARACTER SET ascii NULL AFTER `terms_reference_url`,
  ADD COLUMN `terms_expires_at` DATETIME(3) NULL AFTER `terms_version`;
