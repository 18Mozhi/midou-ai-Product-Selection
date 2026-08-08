CREATE TABLE `platform_dashboard_views` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `actor_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `window_code` ENUM('15m','24h','7d','30d') NOT NULL,
  `request_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `trace_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `observed_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_platform_dashboard_actor_time` (`actor_id`,`observed_at`),
  KEY `idx_platform_dashboard_request` (`request_id`),
  CONSTRAINT `fk_platform_dashboard_actor` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
