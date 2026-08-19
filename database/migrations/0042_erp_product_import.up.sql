CREATE TABLE `erp_product_import_operations` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `organization_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `workspace_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `actor_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `idempotency_key` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `task_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `result_json` JSON NOT NULL,
  `request_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `trace_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_erp_product_import_actor_key` (`actor_id`,`idempotency_key`),
  KEY `idx_erp_product_import_scope` (`organization_id`,`workspace_id`,`created_at`),
  CONSTRAINT `fk_erp_product_import_actor` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_erp_product_import_task` FOREIGN KEY (`task_id`) REFERENCES `collection_tasks` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
