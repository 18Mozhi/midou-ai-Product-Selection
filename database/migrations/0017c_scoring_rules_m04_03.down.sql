-- Export score_rules, score_rule_actions and immutable opportunity_score_runs before rollback.
DROP TABLE IF EXISTS `score_rule_operations`;
DROP TABLE IF EXISTS `opportunity_score_components`;
DROP TABLE IF EXISTS `opportunity_score_runs`;
DROP TABLE IF EXISTS `opportunity_score_jobs`;
DROP TABLE IF EXISTS `opportunity_score_inputs`;
DROP TABLE IF EXISTS `score_rule_actions`;
DROP TABLE IF EXISTS `score_rules`;
