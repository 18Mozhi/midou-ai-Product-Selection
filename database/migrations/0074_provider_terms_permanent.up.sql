ALTER TABLE `providers`
  ADD COLUMN `terms_permanent` TINYINT(1) NOT NULL DEFAULT 0 AFTER `terms_expires_at`;
