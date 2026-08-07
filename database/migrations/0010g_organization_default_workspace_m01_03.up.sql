ALTER TABLE `organizations` ADD CONSTRAINT `fk_organizations_default_workspace` FOREIGN KEY (`default_workspace_id`) REFERENCES `workspaces` (`id`) ON DELETE RESTRICT;
