ALTER TABLE `provider_versions`
  MODIFY COLUMN `action` ENUM(
    'created',
    'updated',
    'configuration_updated',
    'configuration_rolled_back'
  ) NOT NULL;
