// SELECT-only derived rows; the production predicate is passed in unchanged.
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const literal = (value) =>
  value === null
    ? "NULL"
    : typeof value === "number"
      ? String(value)
      : "'" + String(value).replaceAll("'", "''") + "'";
const table = (row, empty = false) =>
  "(SELECT " +
  Object.entries(row)
    .map(([key, value]) => literal(value) + " " + key)
    .join(",") +
  (empty ? " WHERE 1=0" : "") +
  ")";
export function collectedProductProjectionSqlCases(guard, activeScope) {
  const scope = { organization_id: id(1), workspace_id: id(2) };
  const target = {
    projection_type: "intelligence_product_discovery",
    query: "cooling fan",
    intelligence_source_record_id: id(8),
  };
  const base = {
    normalized_records: {
      id: id(3),
      ...scope,
      provider_id: id(4),
      raw_evidence_id: id(5),
      status: "active",
    },
    providers: { id: id(4), code: "amazon_product" },
    raw_evidence: { id: id(5), ...scope, collection_subquery_id: id(6) },
    collection_subqueries: {
      id: id(6),
      ...scope,
      provider_id: id(4),
      task_id: id(7),
      status: "succeeded",
      target_json: JSON.stringify(target),
    },
    collection_tasks: { id: id(7), ...scope, status: "succeeded" },
    collection_task_evidence_links: {
      collection_task_id: id(7),
      ...scope,
      normalized_record_id: id(3),
      raw_evidence_id: id(5),
    },
    collection_task_events: {
      task_id: id(7),
      ...scope,
      event_type: "intelligence.product_search.auto_scheduled",
      actor_type: "worker",
    },
    organizations: { id: id(1), status: "active" },
    workspaces: { id: id(2), organization_id: id(1), status: "active" },
  };
  const cases = [
    { name: "actual collected result at999 uses completion admission", backlog: 999, expected: 1 },
    { name: "completion remains closed at1000", backlog: 1000, expected: 0 },
    { name: "completion remains closed above1000", backlog: 1001, expected: 0 },
    { name: "raw intelligence still cannot enter at999", backlog: 999, limit: 997, expected: 0 },
    { name: "raw intelligence retains996 admission", backlog: 996, limit: 997, expected: 1 },
    {
      name: "superseded exact collected evidence remains readable",
      change: ["normalized_records", "status", "superseded"],
      expected: 1,
    },
    {
      name: "warning task with successful query remains eligible",
      change: ["collection_tasks", "status", "completed_with_warnings"],
      expected: 1,
    },
    {
      name: "failed task cannot receive completion admission",
      change: ["collection_tasks", "status", "failed_terminal"],
      expected: 0,
    },
    {
      name: "unfinished task cannot receive completion admission",
      change: ["collection_tasks", "status", "running"],
      expected: 0,
    },
    {
      name: "failed query cannot receive completion admission",
      change: ["collection_subqueries", "status", "failed"],
      expected: 0,
    },
    {
      name: "different provider code is excluded",
      change: ["providers", "code", "google_news"],
      expected: 0,
    },
    {
      name: "different query provider is excluded",
      change: ["collection_subqueries", "provider_id", id(99)],
      expected: 0,
    },
    {
      name: "different projection is excluded",
      change: [
        "collection_subqueries",
        "target_json",
        JSON.stringify({ ...target, projection_type: "competitor_snapshot" }),
      ],
      expected: 0,
    },
    {
      name: "malformed original record id is excluded",
      change: [
        "collection_subqueries",
        "target_json",
        JSON.stringify({ ...target, intelligence_source_record_id: "invalid" }),
      ],
      expected: 0,
    },
    {
      name: "non-string original record id is excluded",
      change: [
        "collection_subqueries",
        "target_json",
        JSON.stringify({ ...target, intelligence_source_record_id: 123 }),
      ],
      expected: 0,
    },
    {
      name: "non-string query is excluded",
      change: ["collection_subqueries", "target_json", JSON.stringify({ ...target, query: 123 })],
      expected: 0,
    },
    {
      name: "user actor cannot gain completion admission",
      change: ["collection_task_events", "actor_type", "user"],
      expected: 0,
    },
    {
      name: "wrong producer event cannot gain completion admission",
      change: ["collection_task_events", "event_type", "collection.task.created"],
      expected: 0,
    },
    { name: "missing producer event is excluded", empty: "collection_task_events", expected: 0 },
    {
      name: "missing exact evidence link is excluded",
      empty: "collection_task_evidence_links",
      expected: 0,
    },
    {
      name: "wrong linked record is excluded",
      change: ["collection_task_evidence_links", "normalized_record_id", id(99)],
      expected: 0,
    },
    {
      name: "wrong linked evidence is excluded",
      change: ["collection_task_evidence_links", "raw_evidence_id", id(99)],
      expected: 0,
    },
    {
      name: "wrong linked task is excluded",
      change: ["collection_task_evidence_links", "collection_task_id", id(99)],
      expected: 0,
    },
    {
      name: "wrong normalized record is excluded",
      change: ["normalized_records", "id", id(99)],
      expected: 0,
    },
    { name: "wrong raw identity is excluded", change: ["raw_evidence", "id", id(99)], expected: 0 },
    {
      name: "wrong query identity is excluded",
      change: ["collection_subqueries", "id", id(99)],
      expected: 0,
    },
    {
      name: "archived organization is excluded",
      change: ["organizations", "status", "archived"],
      expected: 0,
    },
    {
      name: "archived workspace is excluded",
      change: ["workspaces", "status", "archived"],
      expected: 0,
    },
    { name: "tiny budget admits the first result", backlog: 0, limit: 1, expected: 1 },
    { name: "tiny budget stops at its original limit", backlog: 1, limit: 1, expected: 0 },
  ];
  for (const name of [
    "raw_evidence",
    "collection_subqueries",
    "collection_tasks",
    "collection_task_evidence_links",
    "collection_task_events",
  ])
    for (const field of ["organization_id", "workspace_id"])
      cases.push({
        name: `${name} wrong ${field} is excluded`,
        change: [name, field, id(99)],
        expected: 0,
      });
  return cases.map((item) => {
    const rows = structuredClone(base);
    if (item.change) {
      const [name, field, value] = item.change;
      rows[name][field] = value;
    }
    let sql = `SELECT CASE WHEN ${activeScope} AND ${guard} AND ${item.backlog ?? 999}<${item.limit ?? 1000} THEN 1 ELSE 0 END eligible FROM ${table({ ...scope, normalized_record_id: id(3) })} trend_projection_jobs`;
    sql = sql.replace(
      /\b(FROM|JOIN) (normalized_records|providers|raw_evidence|collection_subqueries|collection_tasks|collection_task_evidence_links|collection_task_events|organizations|workspaces)\b/g,
      (_match, keyword, name) => keyword + " " + table(rows[name], item.empty === name),
    );
    return { name: item.name, sql, expected: item.expected };
  });
}
