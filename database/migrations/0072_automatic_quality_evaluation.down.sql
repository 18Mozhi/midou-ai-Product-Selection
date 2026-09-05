DROP TABLE IF EXISTS `automatic_selection_evaluations`;

DELETE FROM `opportunity_score_inputs`
WHERE `source_type`='automatic_crawler_evidence';

DELETE FROM `opportunity_cost_inputs`
WHERE `confirmation_mode`='automatic_evidence';

ALTER TABLE `opportunity_cost_inputs`
  DROP COLUMN `confirmation_mode`;

ALTER TABLE `cost_rules`
  DROP COLUMN `automatic_scope_json`,
  DROP COLUMN `conversion_rates_json`;
