ALTER TABLE `competitors`
  ADD COLUMN `deleted_at` DATETIME(3) NULL AFTER `updated_at`,
  ADD KEY `idx_competitor_active_scope` (`organization_id`,`workspace_id`,`deleted_at`,`status`,`updated_at`);
