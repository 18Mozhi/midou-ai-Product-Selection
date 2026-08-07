CREATE TABLE `auth_security_events` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `user_id` CHAR(36) CHARACTER SET ascii NULL,
  `event_type` VARCHAR(80) NOT NULL,
  `outcome` ENUM('succeeded','failed','blocked') NOT NULL,
  `request_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `trace_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `ip_hash` CHAR(64) CHARACTER SET ascii NULL,
  `user_agent_hash` CHAR(64) CHARACTER SET ascii NULL,
  `occurred_at` DATETIME(3) NOT NULL,
  `schema_version` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_auth_security_user_time` (`user_id`,`occurred_at`),
  KEY `idx_auth_security_event_outcome_time` (`event_type`,`outcome`,`occurred_at`),
  KEY `idx_auth_security_trace` (`trace_id`),
  CONSTRAINT `fk_auth_security_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
