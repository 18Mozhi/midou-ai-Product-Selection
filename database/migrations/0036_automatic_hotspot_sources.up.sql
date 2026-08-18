CREATE TABLE `automatic_source_schedules` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `organization_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `workspace_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `last_task_id` CHAR(36) CHARACTER SET ascii NULL,
  `provider_offset` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `last_scheduled_at` DATETIME(3) NULL,
  `next_scheduled_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_automatic_source_schedule_scope` (`organization_id`,`workspace_id`),
  KEY `idx_automatic_source_schedule_due` (`next_scheduled_at`),
  CONSTRAINT `fk_automatic_source_schedule_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_automatic_source_schedule_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_automatic_source_schedule_task` FOREIGN KEY (`last_task_id`) REFERENCES `collection_tasks` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `provider_refresh_operations` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `actor_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `route` VARCHAR(200) CHARACTER SET ascii NOT NULL,
  `idempotency_key` VARCHAR(255) CHARACTER SET ascii NOT NULL,
  `task_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `source_count` SMALLINT UNSIGNED NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_provider_refresh_operation` (`actor_id`,`route`,`idempotency_key`),
  CONSTRAINT `fk_provider_refresh_actor` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_provider_refresh_task` FOREIGN KEY (`task_id`) REFERENCES `collection_tasks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `platform_account_operations` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `actor_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `route` VARCHAR(200) CHARACTER SET ascii NOT NULL,
  `idempotency_key` VARCHAR(255) CHARACTER SET ascii NOT NULL,
  `result_json` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_platform_account_operation` (`actor_id`,`route`,`idempotency_key`),
  CONSTRAINT `fk_platform_account_operation_actor` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
