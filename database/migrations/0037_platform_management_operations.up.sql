CREATE TABLE `platform_management_operations` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `actor_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `route` VARCHAR(220) CHARACTER SET ascii NOT NULL,
  `idempotency_key` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `resource_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `result_json` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_platform_management_operation` (`actor_id`,`route`,`idempotency_key`),
  KEY `idx_platform_management_resource` (`resource_id`,`created_at`),
  CONSTRAINT `fk_platform_management_actor` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
