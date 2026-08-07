ALTER TABLE `users` DROP KEY `idx_users_security_setup`, DROP COLUMN `security_setup_completed_at`, DROP COLUMN `must_enroll_mfa`, DROP COLUMN `must_change_password`;
