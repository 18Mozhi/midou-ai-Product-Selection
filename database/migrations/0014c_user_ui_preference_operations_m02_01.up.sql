CREATE TABLE `user_ui_preference_operations` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `user_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `organization_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `workspace_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `key_hash` CHAR(64) CHARACTER SET ascii NOT NULL,
  `request_hash` CHAR(64) CHARACTER SET ascii NOT NULL,
  `preference_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `preference_version` INT UNSIGNED NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ui_preference_operation` (`user_id`,`organization_id`,`workspace_id`,`key_hash`),
  KEY `idx_ui_preference_operation_created` (`created_at`),
  CONSTRAINT `fk_ui_preference_operation_preference` FOREIGN KEY (`preference_id`) REFERENCES `user_ui_preferences` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
