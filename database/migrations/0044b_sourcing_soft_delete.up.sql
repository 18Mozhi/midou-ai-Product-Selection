ALTER TABLE `sourcing_searches`
  ADD COLUMN `deleted_at` DATETIME(3) NULL AFTER `updated_at`,
  ADD KEY `idx_sourcing_search_active_scope` (`organization_id`,`workspace_id`,`deleted_at`,`created_at`);
