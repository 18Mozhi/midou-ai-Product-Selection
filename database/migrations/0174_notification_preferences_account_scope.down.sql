CREATE TEMPORARY TABLE scoutops_notification_pref_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_notification_pref_guard VALUES (1);
INSERT INTO scoutops_notification_pref_guard
SELECT 1 FROM notification_preferences p WHERE
  COALESCE(JSON_TYPE(JSON_EXTRACT(p.historical_context,'$.organization_id')),'NULL')<>'STRING'
  OR COALESCE(JSON_TYPE(JSON_EXTRACT(p.historical_context,'$.workspace_id')),'NULL')<>'STRING'
  OR CHAR_LENGTH(JSON_UNQUOTE(JSON_EXTRACT(p.historical_context,'$.organization_id')))>36
  OR CHAR_LENGTH(JSON_UNQUOTE(JSON_EXTRACT(p.historical_context,'$.workspace_id')))>36
  OR BINARY JSON_UNQUOTE(JSON_EXTRACT(p.historical_context,'$.organization_id'))<>BINARY CONVERT(JSON_UNQUOTE(JSON_EXTRACT(p.historical_context,'$.organization_id')) USING ascii)
  OR BINARY JSON_UNQUOTE(JSON_EXTRACT(p.historical_context,'$.workspace_id'))<>BINARY CONVERT(JSON_UNQUOTE(JSON_EXTRACT(p.historical_context,'$.workspace_id')) USING ascii)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_notification_pref_guard;
ALTER TABLE notification_preferences ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE notification_preferences SET organization_id=JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.organization_id')),
  workspace_id=JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.workspace_id'));
ALTER TABLE notification_preferences MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD UNIQUE KEY uq_notification_preference_scope (organization_id,workspace_id,user_id),
  DROP INDEX uq_notification_preference_account, DROP COLUMN historical_context;
