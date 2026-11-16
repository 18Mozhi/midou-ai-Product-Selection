-- Stopped-writer historical rehearsal after 0190; same-key topics are retained, not merged.
CREATE TEMPORARY TABLE scoutops_topic_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_topic_scope_guard VALUES (1);
INSERT INTO scoutops_topic_scope_guard
SELECT 1 WHERE DATABASE() NOT REGEXP '^product_scout_[a-z0-9_]+rehearsal$'
  OR SUBSTRING_INDEX(VERSION(),'.',2)<>'5.7'
  OR NOT EXISTS (SELECT 1 FROM account_ownership_cutover WHERE slot='current' AND contract_version=25)
  OR EXISTS (SELECT 1 FROM information_schema.VIEWS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='trend_signals_with_topic_scope')
  OR (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
    AND TABLE_NAME IN ('raw_evidence','normalized_records') AND COLUMN_NAME='account_id')<>2;
INSERT INTO scoutops_topic_scope_guard
SELECT 1 FROM trend_topics t
JOIN account_ownership_cutover c ON c.slot='current' AND c.contract_version=25
LEFT JOIN account_retirement_records r ON r.run_id=c.source_run_id AND r.source_table='trend_topics' AND r.source_id=t.id
LEFT JOIN account_retirement_scopes s ON s.run_id=r.run_id AND s.legacy_org_id=r.legacy_org_id AND s.legacy_workspace_id=r.legacy_workspace_id
LEFT JOIN account_owned_records o ON o.source_table='trend_topics' AND o.source_id=t.id
LEFT JOIN users u ON u.id=o.account_id
WHERE r.source_id IS NULL OR s.account_id IS NULL OR u.id IS NULL
  OR r.legacy_org_id<>t.organization_id OR r.legacy_workspace_id<>t.workspace_id
  OR s.account_id<>o.account_id OR s.reason<>o.reason
  OR (o.reason IN ('shared','unassigned') AND o.account_id<>c.primary_account_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_topic_scope_guard;
ALTER TABLE trend_topics ADD COLUMN account_id CHAR(36) CHARACTER SET ascii NULL AFTER id;
UPDATE trend_topics t JOIN account_owned_records o ON o.source_table='trend_topics' AND o.source_id=t.id
SET t.account_id=o.account_id;
ALTER TABLE trend_topics MODIFY COLUMN account_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_trend_topic_account_key (account_id,topic_key,created_at,id),
  ADD KEY idx_trend_topic_account_list (account_id,status,last_seen_at),
  ADD KEY idx_trend_topic_account_market (account_id,market,category,last_seen_at),
  ADD CONSTRAINT fk_trend_topic_account FOREIGN KEY (account_id) REFERENCES users(id),
  DROP FOREIGN KEY fk_trend_topic_org, DROP FOREIGN KEY fk_trend_topic_workspace,
  DROP INDEX uq_trend_topic_scope_key, DROP INDEX idx_trend_topic_scope_list,
  DROP INDEX idx_trend_topic_market_category, DROP INDEX fk_trend_topic_workspace,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
