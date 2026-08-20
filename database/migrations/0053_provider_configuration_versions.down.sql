UPDATE `provider_versions`
SET `action` = 'updated'
WHERE `action` IN ('configuration_updated', 'configuration_rolled_back');

ALTER TABLE `provider_versions`
  MODIFY COLUMN `action` ENUM('created', 'updated') NOT NULL;
