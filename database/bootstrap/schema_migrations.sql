CREATE TABLE IF NOT EXISTS `schema_migrations` (
  `name` VARCHAR(180) NOT NULL,
  `checksum` CHAR(64) CHARACTER SET ascii NOT NULL,
  `applied_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
