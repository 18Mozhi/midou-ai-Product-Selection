CREATE TABLE account_trend_topic_follows (
  id CHAR(36) CHARACTER SET ascii NOT NULL,
  account_id CHAR(36) CHARACTER SET ascii NOT NULL,
  topic_id CHAR(36) CHARACTER SET ascii NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_account_trend_follow (account_id,topic_id),
  KEY idx_account_trend_follow_topic (topic_id),
  CONSTRAINT fk_account_trend_follow_account FOREIGN KEY (account_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_account_trend_follow_topic FOREIGN KEY (topic_id) REFERENCES trend_topics (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
