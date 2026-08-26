ALTER TABLE `tasks`
  MODIFY `source_type` ENUM(
    'manual',
    'sourcing_purchase',
    'selection_verification',
    'evidence_completion',
    'collection_followup'
  ) NOT NULL DEFAULT 'manual';
