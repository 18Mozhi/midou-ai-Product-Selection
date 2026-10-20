// SELECT-only counterfactual views of actual queued rows. No task, table or evidence is written.
export function completionCompetitorGateCases(sql) {
  const wrongId =
    "CONVERT('00000000-0000-4000-8000-000000000000' USING ascii) COLLATE ascii_general_ci";
  const competitor = (field) =>
    sql.replaceAll(
      "JOIN competitors c ON",
      `JOIN (SELECT id,opportunity_id,${field === "organization_id" ? wrongId : "organization_id"} organization_id,${field === "workspace_id" ? wrongId : "workspace_id"} workspace_id,provider_id,status,deleted_at,source_site FROM competitors) c ON`,
    );
  const taskView = (changes) =>
    `(SELECT id,organization_id,workspace_id,${changes.status ?? "status"} status,${changes.available_at ?? "available_at"} available_at,${changes.attempt_count ?? "attempt_count"} attempt_count FROM collection_tasks)`;
  const tasks = (changes) =>
    sql.replaceAll("FROM collection_tasks t JOIN", `FROM ${taskView(changes)} t JOIN`);
  const providerView = (changes) =>
    `(SELECT id,${changes.code ?? "code"} code,${changes.status ?? "status"} status,${changes.review ?? "terms_review_status"} terms_review_status,terms_version,${changes.permanent ?? "terms_permanent"} terms_permanent,${changes.expiry ?? "terms_expires_at"} terms_expires_at FROM providers)`;
  const provider = (changes) =>
    sql.replaceAll("JOIN providers p ON", `JOIN ${providerView(changes)} p ON`);
  const mainView = (changes) =>
    `(SELECT id,organization_id,workspace_id,${changes.price ?? "current_price"} current_price,currency,${changes.reviews ?? "review_count"} review_count,rating_value,${changes.freshness ?? "freshness"} freshness,${changes.source ?? "source_status"} source_status FROM competitor_snapshots)`;
  const main = (changes) =>
    sql.replaceAll("JOIN competitor_snapshots s_main ON", `JOIN ${mainView(changes)} s_main ON`);
  return [
    { name: "actual independent detail candidates exist", sql, minimum: 1 },
    {
      name: "foreign competitor organization cannot gain preference",
      sql: competitor("organization_id"),
      expected: 0,
    },
    {
      name: "foreign competitor workspace cannot gain preference",
      sql: competitor("workspace_id"),
      expected: 0,
    },
    {
      name: "archived organization cannot gain preference",
      sql: sql.replaceAll(
        "JOIN organizations org ON",
        "JOIN (SELECT id,'archived' status FROM organizations) org ON",
      ),
      expected: 0,
    },
    {
      name: "archived workspace cannot gain preference",
      sql: sql.replaceAll(
        "JOIN workspaces ws ON",
        "JOIN (SELECT id,organization_id,'archived' status FROM workspaces) ws ON",
      ),
      expected: 0,
    },
    {
      name: "open source circuit cannot gain preference",
      sql: sql.replaceAll(
        "FROM provider_runtime_circuits circuit",
        "FROM (SELECT provider_id,'open' state FROM provider_runtime_circuits) circuit",
      ),
      expected: 0,
    },
    {
      name: "invalid classification fingerprint cannot gain preference",
      sql: sql.replaceAll(
        "JOIN opportunity_events e_relation ON",
        "JOIN (SELECT id,organization_id,workspace_id,resource_id,resource_type,event_type,occurred_at,JSON_SET(payload_json,'$.model_fingerprint','invalid') payload_json FROM opportunity_events) e_relation ON",
      ),
      expected: 0,
    },
    {
      name: "unadmitted tasks cannot gain preference",
      sql: tasks({ status: "'scheduled'" }),
      expected: 0,
    },
    {
      name: "exhausted attempts cannot gain preference",
      sql: tasks({ attempt_count: "4" }),
      expected: 0,
    },
    {
      name: "future availability cannot gain preference",
      sql: tasks({ available_at: "DATE_ADD(NOW(3),INTERVAL 1 DAY)" }),
      expected: 0,
    },
    {
      name: "disabled provider cannot gain preference",
      sql: provider({ status: "'disabled'" }),
      expected: 0,
    },
    {
      name: "other provider cannot gain preference",
      sql: provider({ code: "'other'" }),
      expected: 0,
    },
    {
      name: "unapproved terms cannot gain preference",
      sql: provider({ review: "NULL" }),
      expected: 0,
    },
    {
      name: "expired terms cannot gain preference",
      sql: provider({ permanent: "0", expiry: "DATE_SUB(NOW(3),INTERVAL 1 SECOND)" }),
      expected: 0,
    },
    {
      name: "missing actual primary price cannot gain preference",
      sql: main({ price: "NULL" }),
      expected: 0,
    },
    {
      name: "missing actual primary reviews cannot gain preference",
      sql: main({ reviews: "NULL" }),
      expected: 0,
    },
    {
      name: "stale primary cannot gain preference",
      sql: main({ freshness: "'stale'" }),
      expected: 0,
    },
    {
      name: "unhealthy primary cannot gain preference",
      sql: main({ source: "'failed'" }),
      expected: 0,
    },
    {
      name: "manual event cannot grant independent detail preference",
      sql: sql.replaceAll("e.actor_type='worker'", "e.actor_type='user'"),
      expected: 0,
    },
    {
      name: "primary-detail producer cannot grant independent detail preference",
      sql: sql.replaceAll(
        "e.event_type='competitor.detail.auto_scheduled'",
        "e.event_type='competitor.collection.auto_scheduled'",
      ),
      expected: 0,
    },
    {
      name: "main product cannot count as an independent competitor",
      sql: sql.replaceAll(
        "UPPER(c_sample.external_id)<>BINARY o.primary_asin",
        "UPPER(c_sample.external_id)=BINARY o.primary_asin",
      ),
      expected: 0,
    },
  ];
}
