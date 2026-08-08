DROP TABLE IF EXISTS `automation_operations`;
DROP TABLE IF EXISTS `automation_executions`;
DROP TABLE IF EXISTS `automation_rules`;
ALTER TABLE `tasks` MODIFY `source_type` ENUM('manual','sourcing_purchase') NOT NULL DEFAULT 'manual';
