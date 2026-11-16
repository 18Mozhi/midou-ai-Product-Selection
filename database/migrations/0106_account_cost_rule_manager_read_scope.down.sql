-- Remove only the derived list permission, preserving rule grants and approval history.
ALTER TABLE account_cost_rule_manager_grants DROP COLUMN can_read;
