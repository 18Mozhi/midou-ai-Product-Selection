-- Restore the old table from current account follows and their original topic.
CREATE TABLE `trend_topic_follows` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `organization_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `workspace_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `topic_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `user_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_trend_follow` (`topic_id`,`user_id`),
  KEY `idx_trend_follow_scope_user` (`organization_id`,`workspace_id`,`user_id`,`created_at`),
  CONSTRAINT `fk_trend_follow_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`),
  CONSTRAINT `fk_trend_follow_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces` (`id`),
  CONSTRAINT `fk_trend_follow_topic` FOREIGN KEY (`topic_id`) REFERENCES `trend_topics` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_trend_follow_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO trend_topic_follows (id,organization_id,workspace_id,topic_id,user_id,created_at)
SELECT f.id,t.organization_id,t.workspace_id,f.topic_id,f.account_id,f.created_at
FROM account_trend_topic_follows f JOIN trend_topics t ON t.id=f.topic_id;
