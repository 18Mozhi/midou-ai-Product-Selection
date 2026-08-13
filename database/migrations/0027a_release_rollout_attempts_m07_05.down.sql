ALTER TABLE `deployment_releases`
  DROP INDEX `idx_deployment_build_stage`,
  ADD UNIQUE KEY `uq_deployment_build_stage` (`stage`,`build_sha`);
