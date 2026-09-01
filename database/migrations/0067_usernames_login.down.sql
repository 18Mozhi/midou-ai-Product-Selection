ALTER TABLE `users`
  DROP INDEX `uq_users_username_normalized`,
  DROP COLUMN `username_normalized`,
  DROP COLUMN `username`;
