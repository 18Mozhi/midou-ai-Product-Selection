-- Export competitor identities, snapshots, rules, changes and alerts before rollback.
DROP TABLE IF EXISTS `competitor_operations`;
DROP TABLE IF EXISTS `competitor_outbox`;
DROP TABLE IF EXISTS `competitor_events`;
DROP TABLE IF EXISTS `competitor_alerts`;
DROP TABLE IF EXISTS `competitor_changes`;
DROP TABLE IF EXISTS `competitor_snapshot_jobs`;
DROP TABLE IF EXISTS `competitor_monitor_rules`;
ALTER TABLE `competitors` DROP FOREIGN KEY `fk_competitor_latest_snapshot`;
DROP TABLE IF EXISTS `competitor_snapshots`;
DROP TABLE IF EXISTS `competitors`;
DELETE FROM `role_capabilities` WHERE `capability_code`='competitor:manage';
DELETE FROM `capabilities` WHERE `code`='competitor:manage';
