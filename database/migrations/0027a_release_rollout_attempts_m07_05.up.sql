ALTER TABLE `deployment_releases`
  DROP INDEX `uq_deployment_build_stage`,
  ADD KEY `idx_deployment_build_stage` (`stage`,`build_sha`);
