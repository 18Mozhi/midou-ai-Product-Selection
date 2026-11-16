-- Stop writers. Never remove historical receipts or a referenced table.
DROP TEMPORARY TABLE IF EXISTS scoutops_unused_idempotency_guard;
CREATE TEMPORARY TABLE scoutops_unused_idempotency_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_unused_idempotency_guard VALUES (1);
INSERT INTO scoutops_unused_idempotency_guard
SELECT 1 FROM api_idempotency_records LIMIT 1;
INSERT INTO scoutops_unused_idempotency_guard
SELECT 1 FROM information_schema.KEY_COLUMN_USAGE
WHERE REFERENCED_TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME='api_idempotency_records'
LIMIT 1;
DROP TEMPORARY TABLE scoutops_unused_idempotency_guard;
DROP TABLE api_idempotency_records;
