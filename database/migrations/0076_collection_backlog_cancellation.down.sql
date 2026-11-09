-- Offline only. Execute in one dedicated connection, stop on the first error,
-- and close the connection on failure to release locks. Never use --force.
-- Both live cancelled statuses and durable cancellation receipts must be absent.
SET @rollback_0076_sql_mode = @@SESSION.sql_mode;
SET @rollback_0076_lock_wait = @@SESSION.lock_wait_timeout;
SET SESSION sql_mode = IF(FIND_IN_SET('STRICT_ALL_TABLES', @@SESSION.sql_mode), @@SESSION.sql_mode,
  CONCAT_WS(',', NULLIF(@@SESSION.sql_mode, ''), 'STRICT_ALL_TABLES'));
SET SESSION lock_wait_timeout = 15;

CREATE TEMPORARY TABLE `rollback_0076_refused_cancellation_present` (
  `guard` TINYINT NOT NULL PRIMARY KEY
) ENGINE=InnoDB;
INSERT INTO `rollback_0076_refused_cancellation_present` VALUES (1);

LOCK TABLES `collection_tasks` WRITE, `collection_task_events` READ;
-- Duplicate primary key (1062) is the deliberate refusal. The guard is session-local;
-- this branch cannot change business rows or reach the ALTER below.
INSERT INTO `rollback_0076_refused_cancellation_present` (`guard`)
SELECT 1 FROM DUAL
WHERE EXISTS (SELECT 1 FROM `collection_tasks` WHERE `status` = 'cancelled')
   OR EXISTS (SELECT 1 FROM `collection_task_events`
     WHERE `event_type` = 'collection.task.cancelled' OR `to_status` = 'cancelled');

ALTER TABLE `collection_tasks`
  MODIFY `status` ENUM('draft','scheduled','queued','leased','running','parsing','validating','persisted','retry_scheduled','blocked_login','blocked_captcha','blocked_robots','rate_limited','succeeded','succeeded_empty','completed_with_warnings','failed_terminal','dead_letter','manually_replayed','automatically_replayed') NOT NULL,
  ALGORITHM=COPY, LOCK=EXCLUSIVE;
UNLOCK TABLES;

DROP TEMPORARY TABLE `rollback_0076_refused_cancellation_present`;
SET SESSION lock_wait_timeout = @rollback_0076_lock_wait;
SET SESSION sql_mode = @rollback_0076_sql_mode;
