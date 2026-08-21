ALTER TABLE `opportunities`
  MODIFY `lifecycle_status` ENUM('candidate','validating','ready','adopted','observing','rejected','archived')
  NOT NULL DEFAULT 'candidate';
