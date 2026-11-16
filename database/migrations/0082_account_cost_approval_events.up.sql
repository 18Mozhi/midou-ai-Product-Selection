CREATE TABLE account_cost_approval_events (
  id CHAR(36) CHARACTER SET ascii NOT NULL PRIMARY KEY,
  account_id CHAR(36) CHARACTER SET ascii NOT NULL,
  cost_rule_id CHAR(36) CHARACTER SET ascii NOT NULL,
  approval_id CHAR(36) CHARACTER SET ascii NOT NULL,
  event_type ENUM('cost_rule.approve','cost_rule.reject') NOT NULL,
  ownership_reason ENUM('shared','unassigned','exclusive_owner') NOT NULL,
  request_id VARCHAR(128) CHARACTER SET ascii NOT NULL,
  trace_id VARCHAR(128) CHARACTER SET ascii NOT NULL,
  payload_json JSON NOT NULL,
  occurred_at DATETIME(3) NOT NULL,
  UNIQUE KEY uq_account_cost_approval_event (approval_id),
  KEY idx_account_cost_approval_history (account_id,cost_rule_id,occurred_at,id),
  FOREIGN KEY (account_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (cost_rule_id) REFERENCES cost_rules(id) ON DELETE RESTRICT,
  FOREIGN KEY (approval_id) REFERENCES cost_rule_approvals(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE account_cost_approval_outbox (
  id CHAR(36) CHARACTER SET ascii NOT NULL PRIMARY KEY,
  status ENUM('queued','published','dead_letter') NOT NULL,
  attempt_count INT UNSIGNED NOT NULL,
  available_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  KEY idx_account_cost_approval_delivery (status,available_at,id),
  FOREIGN KEY (id) REFERENCES account_cost_approval_events(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
