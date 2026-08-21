ALTER TABLE `crawler_browser_runs`
  MODIFY `status` ENUM('running','succeeded','succeeded_empty','blocked','failed','timed_out','cancelled') NOT NULL;

ALTER TABLE `browser_collection_jobs`
  MODIFY `status` ENUM('queued','leased','succeeded','succeeded_empty','blocked','failed','timed_out','cancelled') NOT NULL;
