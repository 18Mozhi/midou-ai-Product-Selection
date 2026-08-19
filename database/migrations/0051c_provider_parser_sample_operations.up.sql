CREATE TABLE `provider_parser_sample_operations` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `actor_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `route` VARCHAR(220) CHARACTER SET ascii NOT NULL,
  `idempotency_key` VARCHAR(255) CHARACTER SET ascii NOT NULL,
  `sample_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `replay_run_id` CHAR(36) CHARACTER SET ascii NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_provider_parser_sample_operation` (`actor_id`,`route`,`idempotency_key`),
  CONSTRAINT `fk_provider_parser_sample_operation_actor` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_provider_parser_sample_operation_sample` FOREIGN KEY (`sample_id`) REFERENCES `provider_parser_samples` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_provider_parser_sample_operation_run` FOREIGN KEY (`replay_run_id`) REFERENCES `provider_parser_sample_replay_runs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
