// Read-only virtual views over currently eligible source rows; never mutate business data.
export function completionSourcingGateCases(sql) {
  const provider = (
    status = "status",
    access = "access_mode",
    review = "terms_review_status",
    permanent = "terms_permanent",
    expiry = "terms_expires_at",
  ) =>
    `(SELECT id,code,${status} status,${access} access_mode,${review} terms_review_status,terms_version,${permanent} terms_permanent,${expiry} terms_expires_at FROM providers)`;
  const replaceProvider = (view) => sql.replace("JOIN providers p ON", `JOIN ${view} p ON`);
  const scopeView = (field) =>
    `(SELECT id,${field === "organization_id" ? "CONVERT('00000000-0000-4000-8000-000000000000' USING ascii) COLLATE ascii_general_ci" : "organization_id"} organization_id,${field === "workspace_id" ? "CONVERT('00000000-0000-4000-8000-000000000000' USING ascii) COLLATE ascii_general_ci" : "workspace_id"} workspace_id,collection_task_id,input_type,input_ref,status,deleted_at,created_at,updated_at FROM sourcing_searches)`;
  return [
    { name: "actual formal completion-ready sources exist", sql, minimum: 1 },
    {
      name: "disabled source is not preferred",
      sql: replaceProvider(provider("'disabled'")),
      expected: 0,
    },
    {
      name: "wrong access mode is not preferred",
      sql: replaceProvider(provider("status", "'public_page'")),
      expected: 0,
    },
    {
      name: "missing terms approval is not preferred",
      sql: replaceProvider(provider("status", "access_mode", "NULL")),
      expected: 0,
    },
    {
      name: "expired nonpermanent terms are not preferred",
      sql: replaceProvider(
        provider(
          "status",
          "access_mode",
          "terms_review_status",
          "0",
          "DATE_SUB(NOW(3),INTERVAL 1 SECOND)",
        ),
      ),
      expected: 0,
    },
    {
      name: "open source circuit is not preferred",
      sql: sql.replace(
        "FROM provider_runtime_circuits source_circuit",
        "FROM (SELECT id provider_id,'open' state FROM providers) source_circuit",
      ),
      expected: 0,
    },
    ...["organization_id", "workspace_id"].map((field) => ({
      name: `foreign ${field} search binding is not preferred`,
      sql: sql.replace("FROM sourcing_searches ss", `FROM ${scopeView(field)} ss`),
      expected: 0,
    })),
    {
      name: "without actual detailed competitors source cannot be completion-ready",
      sql: sql.replace(
        "FROM competitors c_sample",
        "FROM (SELECT * FROM competitors WHERE 1=0) c_sample",
      ),
      expected: 0,
    },
    {
      name: "without formal main detail source cannot be completion-ready",
      sql: sql.replace(
        "FROM competitors c JOIN",
        "FROM (SELECT * FROM competitors WHERE 1=0) c JOIN",
      ),
      expected: 0,
    },
    {
      name: "without waiting evaluation source is not preferred",
      sql: sql.replace(
        "FROM automatic_selection_evaluations e WHERE",
        "FROM (SELECT * FROM automatic_selection_evaluations WHERE 1=0) e WHERE",
      ),
      expected: 0,
    },
    {
      name: "without worker producer source is not preferred",
      sql: sql.replace(
        "FROM collection_task_events a WHERE",
        "FROM (SELECT * FROM collection_task_events WHERE 1=0) a WHERE",
      ),
      expected: 0,
    },
    {
      name: "user events cannot claim worker preference",
      sql: sql.replace(
        "FROM collection_task_events a WHERE",
        "FROM (SELECT task_id,organization_id,workspace_id,event_type,'user' actor_type FROM collection_task_events) a WHERE",
      ),
      expected: 0,
    },
    {
      name: "positive current purchase blocks source-only completion preference",
      sql: sql.replace(
        "FROM opportunity_cost_inputs ci WHERE",
        "FROM (SELECT opportunity_id,organization_id,workspace_id,platform,input_type,is_current,amount_value FROM opportunity_cost_inputs UNION ALL SELECT id,organization_id,workspace_id,'amazon','purchase_price',1,1 FROM opportunities) ci WHERE",
      ),
      expected: 0,
    },
  ];
}
