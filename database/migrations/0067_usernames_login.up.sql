ALTER TABLE `users`
  ADD COLUMN `username` VARCHAR(32) NULL AFTER `email_normalized`,
  ADD COLUMN `username_normalized` VARCHAR(32) NULL AFTER `username`,
  ADD UNIQUE KEY `uq_users_username_normalized` (`username_normalized`);
