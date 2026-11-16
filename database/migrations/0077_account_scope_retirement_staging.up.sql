CREATE TABLE account_retirement_runs (
  id CHAR(36) CHARACTER SET ascii NOT NULL,
  primary_account_id CHAR(36) CHARACTER SET ascii NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (primary_account_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE account_retirement_scopes (
  run_id CHAR(36) CHARACTER SET ascii NOT NULL,
  legacy_org_id CHAR(36) CHARACTER SET ascii NOT NULL,
  legacy_workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  account_id CHAR(36) CHARACTER SET ascii NOT NULL,
  reason ENUM('shared','unassigned','exclusive_owner') NOT NULL,
  PRIMARY KEY (run_id,legacy_org_id,legacy_workspace_id),
  FOREIGN KEY (run_id) REFERENCES account_retirement_runs (id) ON DELETE RESTRICT,
  FOREIGN KEY (account_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE account_retirement_records (
  run_id CHAR(36) CHARACTER SET ascii NOT NULL,
  source_table VARCHAR(64) CHARACTER SET ascii NOT NULL,
  source_id CHAR(36) CHARACTER SET ascii NOT NULL,
  legacy_org_id CHAR(36) CHARACTER SET ascii NOT NULL,
  legacy_workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  PRIMARY KEY (run_id,source_table,source_id),
  KEY idx_account_retirement_scope (run_id,legacy_org_id,legacy_workspace_id),
  FOREIGN KEY (run_id,legacy_org_id,legacy_workspace_id)
    REFERENCES account_retirement_scopes (run_id,legacy_org_id,legacy_workspace_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
