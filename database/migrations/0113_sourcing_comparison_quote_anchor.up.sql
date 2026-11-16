-- Apply after 0100 with writers stopped. The first quote anchors legacy provenance only.
DROP TEMPORARY TABLE IF EXISTS scoutops_comparison_quote_guard;
CREATE TEMPORARY TABLE scoutops_comparison_quote_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_comparison_quote_guard VALUES (1);
INSERT INTO scoutops_comparison_quote_guard
SELECT 1 FROM sourcing_comparisons c
LEFT JOIN supplier_quotes q ON LOWER(q.id)=LOWER(CONVERT(JSON_UNQUOTE(JSON_EXTRACT(c.quote_ids_json,'$[0]')) USING ascii))
LEFT JOIN sourcing_candidates a ON a.id=q.candidate_id
LEFT JOIN sourcing_searches s ON s.id=a.search_id
  AND s.organization_id=c.organization_id AND s.workspace_id=c.workspace_id
WHERE JSON_TYPE(c.quote_ids_json)<>'ARRAY' OR JSON_LENGTH(c.quote_ids_json) NOT BETWEEN 2 AND 5
  OR s.id IS NULL LIMIT 1;
INSERT INTO scoutops_comparison_quote_guard
SELECT 1 FROM sourcing_comparisons c
JOIN (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4) p
  ON p.n<JSON_LENGTH(c.quote_ids_json)
LEFT JOIN supplier_quotes q ON LOWER(q.id)=LOWER(CONVERT(JSON_UNQUOTE(JSON_EXTRACT(c.quote_ids_json,CONCAT('$[',p.n,']'))) USING ascii))
LEFT JOIN sourcing_candidates a ON a.id=q.candidate_id
LEFT JOIN sourcing_searches s ON s.id=a.search_id
LEFT JOIN account_owned_records co ON co.source_table='sourcing_comparisons' AND co.source_id=c.id
LEFT JOIN account_owned_records qo ON qo.source_table='supplier_quotes' AND qo.source_id=q.id AND qo.account_id=co.account_id
GROUP BY c.id,c.organization_id,c.workspace_id
HAVING COUNT(DISTINCT LOWER(q.id))<>COUNT(*) OR COUNT(s.id)<>COUNT(*)
  OR (SUM(s.organization_id<>c.organization_id OR s.workspace_id<>c.workspace_id)>0 AND COUNT(qo.account_id)<>COUNT(*))
LIMIT 1;
DROP TEMPORARY TABLE scoutops_comparison_quote_guard;
ALTER TABLE sourcing_comparisons ADD COLUMN anchor_quote_id CHAR(36) CHARACTER SET ascii NULL AFTER id;
UPDATE sourcing_comparisons c JOIN supplier_quotes q
  ON LOWER(q.id)=LOWER(CONVERT(JSON_UNQUOTE(JSON_EXTRACT(c.quote_ids_json,'$[0]')) USING ascii))
SET c.anchor_quote_id=q.id;
ALTER TABLE sourcing_comparisons
  MODIFY COLUMN anchor_quote_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_sourcing_comparison_created (created_at),
  ADD CONSTRAINT fk_sourcing_comparison_anchor_quote FOREIGN KEY (anchor_quote_id) REFERENCES supplier_quotes(id),
  DROP INDEX idx_sourcing_comparison_scope,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
