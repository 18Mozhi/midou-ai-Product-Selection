-- Rollback only the M00-01 foundation object. Audit/evidence data must be exported first.
DROP TABLE IF EXISTS `outbox_events`;
