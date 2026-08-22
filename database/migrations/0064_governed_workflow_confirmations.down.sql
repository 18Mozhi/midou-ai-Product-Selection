ALTER TABLE `provider_parser_samples`
  DROP FOREIGN KEY `fk_provider_parser_sample_reviewer`,
  DROP KEY `idx_provider_parser_sample_review`,
  DROP COLUMN `review_version`,
  DROP COLUMN `reviewed_at`,
  DROP COLUMN `review_reason`,
  DROP COLUMN `reviewed_by`,
  DROP COLUMN `review_status`;

DROP TABLE IF EXISTS `opportunity_cost_input_reviews`;

UPDATE `opportunity_cost_inputs`
SET `confirmed_by`=COALESCE(`confirmed_by`,`submitted_by`),`is_current`=0;

UPDATE `opportunity_cost_inputs` i
JOIN (
  SELECT `opportunity_id`,`platform`,`input_type`,MAX(`input_version`) AS `input_version`
  FROM `opportunity_cost_inputs`
  GROUP BY `opportunity_id`,`platform`,`input_type`
) latest
  ON latest.`opportunity_id`=i.`opportunity_id`
 AND latest.`platform`=i.`platform`
 AND latest.`input_type`=i.`input_type`
 AND latest.`input_version`=i.`input_version`
SET i.`is_current`=1;

ALTER TABLE `opportunity_cost_inputs`
  DROP FOREIGN KEY `fk_cost_input_submitter`,
  DROP COLUMN `submitted_by`,
  MODIFY COLUMN `confirmed_by` CHAR(36) CHARACTER SET ascii NOT NULL;

DROP TABLE IF EXISTS `trend_topic_change_requests`;

UPDATE `trend_topics` SET `status`='stale' WHERE `status`='archived';

ALTER TABLE `trend_topics`
  MODIFY COLUMN `status` ENUM('active','irrelevant','stale') NOT NULL;
