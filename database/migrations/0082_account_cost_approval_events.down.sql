-- Stop writers. Refuse rollback if it would destroy account audit history.
DROP TEMPORARY TABLE IF EXISTS scoutops_cost_approval_event_guard;
CREATE TEMPORARY TABLE scoutops_cost_approval_event_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_cost_approval_event_guard VALUES (1);
INSERT INTO scoutops_cost_approval_event_guard SELECT 1 FROM account_cost_approval_events LIMIT 1;
DROP TEMPORARY TABLE scoutops_cost_approval_event_guard;
DROP TABLE account_cost_approval_outbox, account_cost_approval_events;
