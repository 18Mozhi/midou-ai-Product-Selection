-- Platform notifications address accounts directly. Legacy outbox rows retain their original coordinates.
ALTER TABLE outbox_events MODIFY organization_id CHAR(36) CHARACTER SET ascii NULL;
