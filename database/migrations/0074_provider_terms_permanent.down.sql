-- Roll back application code first. Permanent approvals must be re-reviewed before legacy code can run them.
ALTER TABLE `providers` DROP COLUMN `terms_permanent`;
