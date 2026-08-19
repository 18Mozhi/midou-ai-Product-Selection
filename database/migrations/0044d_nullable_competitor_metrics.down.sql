ALTER TABLE `competitor_snapshots`
  MODIFY COLUMN `current_price` DECIMAL(18,6) NULL,
  MODIFY COLUMN `currency` CHAR(3) CHARACTER SET ascii NULL,
  MODIFY COLUMN `rank_value` INT UNSIGNED NULL,
  MODIFY COLUMN `review_count` INT UNSIGNED NULL,
  MODIFY COLUMN `rating_value` DECIMAL(4,2) NULL;
