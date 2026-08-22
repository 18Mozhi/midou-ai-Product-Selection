ALTER TABLE `selection_journey_decisions`
  DROP FOREIGN KEY `fk_selection_decision_selected_evidence`,
  DROP KEY `idx_selection_decision_selected_evidence`,
  DROP COLUMN `selected_raw_evidence_id`;
