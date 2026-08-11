CREATE TABLE `collection_task_evidence_links` (
  `id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `organization_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `workspace_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `collection_task_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `collection_subquery_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `provider_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `raw_evidence_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `normalized_record_id` CHAR(36) CHARACTER SET ascii NOT NULL,
  `link_type` ENUM('captured','deduplicated') NOT NULL,
  `request_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `trace_id` VARCHAR(128) CHARACTER SET ascii NOT NULL,
  `created_by` CHAR(36) CHARACTER SET ascii NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_collection_task_evidence` (`collection_task_id`,`raw_evidence_id`),
  KEY `idx_collection_task_evidence_scope` (`organization_id`,`workspace_id`,`collection_task_id`,`created_at`),
  KEY `idx_collection_task_evidence_subquery` (`collection_subquery_id`,`provider_id`),
  KEY `idx_collection_task_evidence_raw` (`raw_evidence_id`),
  KEY `idx_collection_task_evidence_record` (`normalized_record_id`),
  CONSTRAINT `fk_collection_task_evidence_organization` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`),
  CONSTRAINT `fk_collection_task_evidence_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces` (`id`),
  CONSTRAINT `fk_collection_task_evidence_task` FOREIGN KEY (`collection_task_id`) REFERENCES `collection_tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_collection_task_evidence_subquery` FOREIGN KEY (`collection_subquery_id`) REFERENCES `collection_subqueries` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_collection_task_evidence_provider` FOREIGN KEY (`provider_id`) REFERENCES `providers` (`id`),
  CONSTRAINT `fk_collection_task_evidence_raw` FOREIGN KEY (`raw_evidence_id`) REFERENCES `raw_evidence` (`id`),
  CONSTRAINT `fk_collection_task_evidence_record` FOREIGN KEY (`normalized_record_id`) REFERENCES `normalized_records` (`id`),
  CONSTRAINT `fk_collection_task_evidence_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `collection_task_evidence_links` (
  `id`,`organization_id`,`workspace_id`,`collection_task_id`,`collection_subquery_id`,`provider_id`,
  `raw_evidence_id`,`normalized_record_id`,`link_type`,`request_id`,`trace_id`,`created_by`,`created_at`
)
SELECT UUID(),e.organization_id,e.workspace_id,e.collection_task_id,e.collection_subquery_id,e.provider_id,
       e.id,n.id,'captured',e.request_id,e.trace_id,e.created_by,e.created_at
FROM `raw_evidence` e
JOIN `normalized_records` n ON n.id=(
  SELECT n2.id
  FROM `normalized_records` n2
  WHERE n2.raw_evidence_id=e.id AND n2.status='active'
  ORDER BY n2.record_version DESC,n2.created_at DESC,n2.id DESC
  LIMIT 1
);
