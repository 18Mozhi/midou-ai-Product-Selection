-- Account ownership remains in the existing ledger. Never drop a divergent native owner.
DROP TEMPORARY TABLE IF EXISTS scoutops_trend_rule_account_guard;
CREATE TEMPORARY TABLE scoutops_trend_rule_account_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_trend_rule_account_guard VALUES (1);
INSERT INTO scoutops_trend_rule_account_guard
SELECT 1 FROM trend_monitoring_rules r LEFT JOIN account_owned_records o
  ON o.source_table='trend_monitoring_rules' AND o.source_id=r.id
WHERE NOT (r.account_id <=> o.account_id) LIMIT 1;
DROP TEMPORARY TABLE scoutops_trend_rule_account_guard;
ALTER TABLE trend_monitoring_rules DROP FOREIGN KEY fk_trend_rule_account,
  DROP INDEX idx_trend_rule_account_updated, DROP COLUMN account_id;
