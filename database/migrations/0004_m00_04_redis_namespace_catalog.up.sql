CREATE TABLE `redis_namespace_catalog` (
  `purpose` ENUM('cache','queue','rate','sse') NOT NULL,
  `namespace_version` INT UNSIGNED NOT NULL,
  `default_ttl_seconds` INT UNSIGNED NOT NULL,
  `maximum_ttl_seconds` INT UNSIGNED NOT NULL,
  `status` ENUM('active','retired') NOT NULL DEFAULT 'active',
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`purpose`, `namespace_version`),
  KEY `idx_redis_namespace_status` (`status`, `updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `redis_namespace_catalog`
  (`purpose`, `namespace_version`, `default_ttl_seconds`, `maximum_ttl_seconds`, `status`, `created_at`, `updated_at`)
VALUES
  ('cache', 1, 300, 3600, 'active', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)),
  ('queue', 1, 86400, 604800, 'active', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)),
  ('rate', 1, 60, 3600, 'active', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)),
  ('sse', 1, 86400, 86400, 'active', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3));
