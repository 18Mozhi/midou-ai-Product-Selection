UPDATE `crawler_browser_runs` SET `status`='succeeded' WHERE `status`='succeeded_empty';
UPDATE `browser_collection_jobs` SET `status`='succeeded' WHERE `status`='succeeded_empty';

ALTER TABLE `crawler_browser_runs`
  MODIFY `status` ENUM('running','succeeded','blocked','failed','timed_out','cancelled') NOT NULL;

ALTER TABLE `browser_collection_jobs`
  MODIFY `status` ENUM('queued','leased','succeeded','blocked','failed','timed_out','cancelled') NOT NULL;
