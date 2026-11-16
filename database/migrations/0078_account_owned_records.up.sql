CREATE TABLE account_ownership_cutover (
  slot ENUM('current') NOT NULL,
  source_run_id CHAR(36) CHARACTER SET ascii NOT NULL,
  primary_account_id CHAR(36) CHARACTER SET ascii NOT NULL,
  source_record_count BIGINT UNSIGNED NOT NULL,
  contract_version SMALLINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (slot),
  FOREIGN KEY (primary_account_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE account_owned_records (
  source_table VARCHAR(64) CHARACTER SET ascii NOT NULL,
  source_id CHAR(36) CHARACTER SET ascii NOT NULL,
  account_id CHAR(36) CHARACTER SET ascii NOT NULL,
  reason ENUM('shared','unassigned','exclusive_owner') NOT NULL,
  PRIMARY KEY (source_table,source_id),
  KEY idx_account_owned_record (account_id,source_table,source_id),
  FOREIGN KEY (account_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
