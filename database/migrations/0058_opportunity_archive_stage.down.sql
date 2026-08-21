UPDATE `opportunities` SET `lifecycle_status`='rejected' WHERE `lifecycle_status`='archived';
ALTER TABLE `opportunities`
  MODIFY `lifecycle_status` ENUM('candidate','validating','ready','adopted','observing','rejected')
  NOT NULL DEFAULT 'candidate';
