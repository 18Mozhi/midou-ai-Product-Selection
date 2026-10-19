/** Only actual scoped successful automatic Amazon search evidence gets completion admission. */
export const collectedProductProjectionSql =
  "EXISTS (SELECT 1 FROM normalized_records n_collected " +
  "JOIN providers p_collected ON p_collected.id=n_collected.provider_id AND p_collected.code='amazon_product' " +
  "JOIN raw_evidence e_collected ON e_collected.id=n_collected.raw_evidence_id " +
  "AND e_collected.organization_id=n_collected.organization_id AND e_collected.workspace_id=n_collected.workspace_id " +
  "JOIN collection_subqueries q_collected ON q_collected.id=e_collected.collection_subquery_id " +
  "AND q_collected.organization_id=n_collected.organization_id AND q_collected.workspace_id=n_collected.workspace_id " +
  "AND q_collected.provider_id=n_collected.provider_id " +
  "JOIN collection_tasks t_collected ON t_collected.id=q_collected.task_id " +
  "AND t_collected.organization_id=n_collected.organization_id AND t_collected.workspace_id=n_collected.workspace_id " +
  "JOIN collection_task_evidence_links l_collected ON l_collected.collection_task_id=t_collected.id " +
  "AND l_collected.normalized_record_id=n_collected.id AND l_collected.raw_evidence_id=n_collected.raw_evidence_id " +
  "AND l_collected.organization_id=n_collected.organization_id AND l_collected.workspace_id=n_collected.workspace_id " +
  "WHERE n_collected.id=trend_projection_jobs.normalized_record_id " +
  "AND n_collected.organization_id=trend_projection_jobs.organization_id AND n_collected.workspace_id=trend_projection_jobs.workspace_id " +
  "AND n_collected.status IN ('active','superseded') AND q_collected.status='succeeded' " +
  "AND t_collected.status IN ('succeeded','completed_with_warnings') " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(q_collected.target_json,'$.projection_type'))='intelligence_product_discovery' " +
  "AND JSON_TYPE(JSON_EXTRACT(q_collected.target_json,'$.query'))='STRING' " +
  "AND JSON_TYPE(JSON_EXTRACT(q_collected.target_json,'$.intelligence_source_record_id'))='STRING' " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(q_collected.target_json,'$.intelligence_source_record_id')) REGEXP '^[0-9A-Fa-f-]{36}$' " +
  "AND EXISTS (SELECT 1 FROM collection_task_events a_collected WHERE a_collected.task_id=t_collected.id " +
  "AND a_collected.organization_id=t_collected.organization_id AND a_collected.workspace_id=t_collected.workspace_id " +
  "AND a_collected.event_type='intelligence.product_search.auto_scheduled' AND a_collected.actor_type='worker'))";
