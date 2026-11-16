export const sampleAccountJoins =
  "JOIN account_owned_records ot ON ot.source_table='collection_tasks' AND ot.source_id=job_task.id AND ot.account_id=job_task.account_id " +
  "JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25 " +
  "AND (ot.reason='exclusive_owner' OR (ot.reason IN ('shared','unassigned') AND ot.account_id=cut.primary_account_id)) " +
  "JOIN collection_subqueries q ON q.id=j.collection_subquery_id AND q.task_id=job_task.id AND q.provider_id=j.provider_id " +
  "JOIN account_owned_records oq ON oq.source_table='collection_subqueries' AND oq.source_id=q.id AND oq.account_id=ot.account_id ";
export const sampleArtifactJoins =
  "JOIN account_owned_records oa ON oa.source_table='browser_evidence_artifacts' AND oa.source_id=a.id AND oa.account_id=ot.account_id ";
export const sampleArtifactProof =
  "a.collection_task_id=job_task.id AND a.collection_subquery_id=j.collection_subquery_id AND a.provider_id=j.provider_id ";

export const lockNativeParserSampleEvidence =
  "SELECT j.id,j.result_json FROM browser_collection_jobs j " +
  "JOIN collection_tasks job_task ON job_task.id=j.collection_task_id " +
  sampleAccountJoins +
  "WHERE j.id=? AND j.provider_id=? AND job_task.account_id=? AND j.status='succeeded' " +
  "AND JSON_EXTRACT(j.result_json,'$.snapshots') IS NOT NULL " +
  "AND EXISTS (SELECT 1 FROM browser_evidence_artifacts a " +
  "JOIN account_owned_records oa ON oa.source_table='browser_evidence_artifacts' AND oa.source_id=a.id " +
  "WHERE a.browser_job_id=j.id AND a.status='active' AND oa.account_id=job_task.account_id AND " +
  sampleArtifactProof +
  "GROUP BY a.browser_job_id HAVING COUNT(DISTINCT a.kind)=2 " +
  "AND COUNT(DISTINCT a.parser_version)=1 AND MIN(a.parser_version)=?) FOR UPDATE";
