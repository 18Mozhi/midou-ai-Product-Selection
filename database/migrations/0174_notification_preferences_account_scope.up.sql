CREATE TEMPORARY TABLE scoutops_notification_pref_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_notification_pref_guard VALUES (1);
INSERT INTO scoutops_notification_pref_guard
SELECT 1 FROM notification_preferences p GROUP BY p.user_id HAVING COUNT(*)>1 LIMIT 1;
DROP TEMPORARY TABLE scoutops_notification_pref_guard;
ALTER TABLE notification_preferences ADD COLUMN historical_context JSON NULL AFTER id;
UPDATE notification_preferences SET historical_context=JSON_OBJECT('organization_id',organization_id,'workspace_id',workspace_id);
ALTER TABLE notification_preferences ADD UNIQUE KEY uq_notification_preference_account (user_id),
  DROP INDEX uq_notification_preference_scope, DROP COLUMN organization_id, DROP COLUMN workspace_id;
