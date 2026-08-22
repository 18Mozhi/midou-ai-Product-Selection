ALTER TABLE `selection_journey_decisions`
  ADD COLUMN `selected_raw_evidence_id` char(36) CHARACTER SET ascii DEFAULT NULL AFTER `opportunity_id`,
  ADD KEY `idx_selection_decision_selected_evidence` (`selected_raw_evidence_id`),
  ADD CONSTRAINT `fk_selection_decision_selected_evidence`
    FOREIGN KEY (`selected_raw_evidence_id`) REFERENCES `raw_evidence` (`id`) ON DELETE SET NULL;
