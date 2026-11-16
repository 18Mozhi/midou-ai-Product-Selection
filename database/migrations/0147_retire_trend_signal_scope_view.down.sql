-- Restore the exact read relation required by older builds and migration history.
CREATE SQL SECURITY INVOKER VIEW trend_signals_with_topic_scope AS
SELECT s.*,t.organization_id,t.workspace_id
FROM trend_signals s JOIN trend_topics t ON t.id=s.topic_id;
