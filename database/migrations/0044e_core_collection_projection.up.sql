CREATE TABLE `core_collection_projection_runs` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `organization_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `workspace_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `collection_task_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `projection_type` ENUM('opportunity_competitors','competitor_snapshot','sourcing_search') NOT NULL,
  `resource_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `status` ENUM('processing','succeeded','succeeded_empty','failed') NOT NULL,
  `item_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `error_code` VARCHAR(120) CHARACTER SET ascii NULL,
  `started_at` DATETIME(3) NOT NULL,
  `finished_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_core_projection_task` (`collection_task_id`),
  KEY `idx_core_projection_scope` (`organization_id`,`workspace_id`,`projection_type`,`status`,`started_at`),
  CONSTRAINT `fk_core_projection_task` FOREIGN KEY (`collection_task_id`) REFERENCES `collection_tasks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
