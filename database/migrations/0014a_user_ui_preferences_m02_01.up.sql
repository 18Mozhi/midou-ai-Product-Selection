CREATE TABLE `user_ui_preferences` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `user_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `organization_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `workspace_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `theme` ENUM('deep-ocean','aurora-purple','cloud-white') NOT NULL DEFAULT 'deep-ocean',
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ui_preference_scope` (`user_id`,`organization_id`,`workspace_id`),
  KEY `idx_ui_preference_org_workspace` (`organization_id`,`workspace_id`,`updated_at`),
  CONSTRAINT `fk_ui_preference_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_ui_preference_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_ui_preference_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
