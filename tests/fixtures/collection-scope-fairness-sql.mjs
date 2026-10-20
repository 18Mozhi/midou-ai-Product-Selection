// Synthetic SELECT-only MySQL 5.7 proof. No tables, fixtures or events are written.
import { completionReadyCompetitorTaskSql } from "../../apps/worker/dist/completion-competitor-policy.js";
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const scopes = {
  a: { organization_id: uuid(1), workspace_id: uuid(11) },
  b: { organization_id: uuid(2), workspace_id: uuid(12) },
  c: { organization_id: uuid(1), workspace_id: uuid(13) },
};
const stamp = (n) => `2026-10-18 00:00:${String(n).padStart(2, "0")}.000`;
const task = (id, scope = "a", extra = {}) => ({
  id: uuid(id),
  ...scopes[scope],
  status: "queued",
  priority: "high",
  attempt_count: 0,
  available_at: stamp(1),
  ...extra,
});
const claim = (scope, at, extra = {}) => ({
  ...scopes[scope],
  occurred_at: stamp(at),
  event_type: "collection.task.leased",
  actor_type: "worker",
  ...extra,
});
const scenarios = [
  {
    name: "ordinary validation retry retains successful browser-result preference",
    tasks: [
      task(101, "a", { lane: "completion" }),
      task(102, "a", {
        lane: "completion",
        queryStatus: "failed",
        errorCode: "validation_failed",
        browserResult: true,
      }),
    ],
    events: [],
    expected: 102,
  },
  {
    name: "other failed subquery cannot gain retained-result preference",
    tasks: [
      task(101, "a", { lane: "completion" }),
      task(102, "a", {
        lane: "completion",
        queryStatus: "failed",
        errorCode: "source_failed",
        browserResult: true,
      }),
    ],
    events: [],
    expected: 101,
  },
  {
    name: "competitor preference preserves durable scope fairness",
    tasks: [
      task(101, "b", { lane: "completion" }),
      task(102, "a", { lane: "completion", nearCompetitor: true }),
    ],
    events: [claim("b", 5), claim("a", 10)],
    expected: 101,
  },
  {
    name: "independent competitor detail precedes older primary detail within completion",
    tasks: [
      task(101, "a", { lane: "completion" }),
      task(102, "a", { lane: "completion", nearCompetitor: true }),
    ],
    events: [],
    expected: 102,
  },
  {
    name: "already collected browser result precedes independent detail preference",
    tasks: [
      task(101, "a", { lane: "completion", browserResult: true }),
      task(102, "a", { lane: "completion", nearCompetitor: true }),
    ],
    events: [],
    expected: 101,
  },
  {
    name: "competitor preference preserves product-search stage turn",
    tasks: [
      task(101, "a", { lane: "product_search" }),
      task(102, "a", { lane: "completion", nearCompetitor: true }),
    ],
    events: [],
    productSearchFirst: true,
    expected: 101,
  },
  {
    name: "competitor preference preserves shared FIFO escape",
    tasks: [
      task(101, "a", { lane: "completion" }),
      task(102, "a", { lane: "completion", nearCompetitor: true }),
    ],
    events: [],
    completionFirst: false,
    expected: 101,
  },
  {
    name: "competitor preference preserves critical priority",
    tasks: [
      task(101, "a", { lane: "completion", priority: "critical" }),
      task(102, "a", { lane: "completion", nearCompetitor: true }),
    ],
    events: [],
    expected: 101,
  },
  {
    name: "product-search turn advances intelligence-derived Amazon queries",
    tasks: [task(101, "a", { lane: "completion" }), task(102, "a", { lane: "product_search" })],
    events: [],
    productSearchFirst: true,
    expected: 102,
  },
  {
    name: "completion turn retains existing primary competitor and sourcing preference",
    tasks: [task(101, "a", { lane: "product_search" }), task(102, "a", { lane: "completion" })],
    events: [],
    productSearchFirst: false,
    expected: 102,
  },
  {
    name: "product-search producer beats ordinary history when completion is absent",
    tasks: [task(101), task(102, "a", { lane: "product_search" })],
    events: [],
    expected: 102,
  },
  {
    name: "manual actor cannot claim the product-search stage",
    tasks: [task(101), task(102, "a", { lane: "product_search", eventActor: "user" })],
    events: [],
    productSearchFirst: true,
    expected: 101,
  },
  {
    name: "foreign workspace producer cannot claim the product-search stage",
    tasks: [task(101), task(102, "a", { lane: "product_search", eventScope: scopes.b })],
    events: [],
    productSearchFirst: true,
    expected: 101,
  },
  {
    name: "wrong source cannot claim the product-search stage",
    tasks: [task(101), task(102, "a", { lane: "product_search", provider: "held" })],
    events: [],
    productSearchFirst: true,
    expected: 101,
  },
  {
    name: "wrong target cannot claim the product-search stage",
    tasks: [
      task(101),
      task(102, "a", { lane: "product_search", projection: "competitor_snapshot" }),
    ],
    events: [],
    productSearchFirst: true,
    expected: 101,
  },
  {
    name: "shared FIFO escape ignores product-search preference",
    tasks: [task(101), task(102, "a", { lane: "product_search" })],
    events: [],
    completionFirst: false,
    productSearchFirst: true,
    expected: 101,
  },
  {
    name: "raw intelligence intake keeps its existing precedence",
    tasks: [task(101, "a", { lane: "product_search" }), task(102, "a", { lane: "intake" })],
    events: [],
    productSearchFirst: true,
    expected: 102,
  },
  {
    name: "tenant fairness remains before product-search stage preference",
    tasks: [task(101, "a", { lane: "product_search" }), task(102, "b", { lane: "completion" })],
    events: [claim("a", 10), claim("b", 5)],
    productSearchFirst: true,
    expected: 102,
  },
  {
    name: "unclaimed scope beats recently claimed scope",
    tasks: [task(101), task(102, "b", { available_at: stamp(5) })],
    events: [claim("a", 10)],
    expected: 102,
  },
  {
    name: "oldest committed scope claim wins",
    tasks: [task(101), task(102, "b")],
    events: [claim("a", 5), claim("b", 10)],
    expected: 101,
  },
  {
    name: "same organization workspaces remain independent",
    tasks: [task(101), task(103, "c")],
    events: [claim("a", 10), claim("c", 5)],
    expected: 103,
  },
  {
    name: "critical priority remains before scope fairness",
    tasks: [task(101), task(102, "b", { priority: "critical" })],
    events: [claim("b", 10)],
    expected: 102,
  },
  {
    name: "normal priority cannot bypass high priority",
    tasks: [task(101), task(102, "b", { priority: "normal" })],
    events: [claim("a", 10)],
    expected: 101,
  },
  {
    name: "automatic intake normal priority retains high promotion",
    tasks: [task(101), task(102, "b", { priority: "normal", lane: "intake" })],
    events: [claim("a", 10)],
    expected: 102,
  },
  {
    name: "local intake stays before completion",
    tasks: [
      task(101, "a", { lane: "completion" }),
      task(102, "a", { lane: "intake", available_at: stamp(5) }),
    ],
    events: [],
    expected: 102,
  },
  {
    name: "local completion stays before discovery",
    tasks: [task(101), task(102, "a", { lane: "completion", available_at: stamp(5) })],
    events: [],
    expected: 102,
  },
  {
    name: "existing FIFO turn stays local",
    tasks: [task(101), task(102, "a", { lane: "completion", available_at: stamp(5) })],
    events: [],
    completionFirst: false,
    expected: 101,
  },
  {
    name: "waiting discovery scope precedes busy completion scope",
    tasks: [task(101, "a", { lane: "completion" }), task(102, "b")],
    events: [claim("a", 10)],
    expected: 102,
  },
  {
    name: "latest committed claim is MAX not MIN",
    tasks: [task(101), task(102, "b")],
    events: [claim("a", 2), claim("a", 15), claim("b", 10)],
    expected: 102,
  },
  {
    name: "user events cannot change worker fairness",
    tasks: [task(101), task(102, "b")],
    events: [claim("a", 20, { actor_type: "user" }), claim("b", 10)],
    expected: 101,
  },
  {
    name: "running events cannot masquerade as claims",
    tasks: [task(101), task(102, "b")],
    events: [claim("a", 20, { event_type: "collection.task.running" }), claim("b", 10)],
    expected: 101,
  },
  {
    name: "foreign organization event cannot alter workspace fairness",
    tasks: [task(101), task(102, "b")],
    events: [claim("a", 20, { organization_id: scopes.b.organization_id }), claim("b", 10)],
    expected: 101,
  },
  {
    name: "null claim ties retain available time then id",
    tasks: [task(102, "b"), task(101)],
    events: [],
    expected: 101,
  },
  {
    name: "open required source stays held",
    tasks: [task(101), task(102, "b", { provider: "held" })],
    events: [claim("a", 10)],
    heldSource: "open",
    expected: 101,
  },
  {
    name: "disabled required source stays held",
    tasks: [task(101), task(102, "b", { provider: "held" })],
    events: [claim("a", 10)],
    heldSource: "disabled",
    expected: 101,
  },
  {
    name: "optional disabled source does not become a new hold",
    tasks: [task(101), task(102, "b", { provider: "held", required: 0 })],
    events: [claim("a", 10)],
    heldSource: "disabled",
    expected: 102,
  },
  {
    name: "archived organization never gains capacity",
    tasks: [task(101), task(102, "b")],
    events: [claim("a", 10)],
    archivedOrganization: "b",
    expected: 101,
  },
  {
    name: "archived workspace never gains capacity",
    tasks: [task(101), task(102, "b")],
    events: [claim("a", 10)],
    archivedWorkspace: "b",
    expected: 101,
  },
  {
    name: "exhausted task stays ineligible",
    tasks: [task(101), task(102, "b", { attempt_count: 4 })],
    events: [claim("a", 10)],
    expected: 101,
  },
  {
    name: "an absent rollback event does not advance fairness",
    tasks: [task(101), task(102, "b")],
    events: [claim("a", 5), claim("b", 10)],
    expected: 101,
  },
  {
    name: "a committed claim advances fairness",
    tasks: [task(101), task(102, "b")],
    events: [claim("a", 5), claim("b", 10), claim("a", 20)],
    expected: 102,
  },
];
for (const [name, extra, expected, completionFirst = true] of [
  ["successful browser result precedes fresh work in the same lane", {}, 102],
  ["empty browser success is also consumed", { browserStatus: "succeeded_empty" }, 102],
  ["failed browser result has no consumption preference", { browserStatus: "failed" }, 101],
  ["missing result payload has no consumption preference", { resultJson: null }, 101],
  ["already completed subquery has no consumption preference", { queryStatus: "succeeded" }, 101],
  ["pending result does not bypass the FIFO escape turn", {}, 101, false],
  ...[
    "organization_id",
    "workspace_id",
    "collection_task_id",
    "collection_subquery_id",
    "provider_id",
  ].map((field) => [
    `foreign browser ${field} cannot promote a task`,
    { browserMismatch: field },
    101,
  ]),
])
  scenarios.push({
    name,
    tasks: [
      task(101, "a", { lane: "completion" }),
      task(102, "a", { lane: "completion", available_at: stamp(5), browserResult: true, ...extra }),
    ],
    events: [],
    expected,
    completionFirst,
  });
scenarios.push(
  {
    name: "browser result cannot bypass another workspace turn",
    tasks: [task(101), task(102, "b", { browserResult: true })],
    events: [claim("b", 10)],
    expected: 101,
  },
  {
    name: "browser result cannot bypass critical priority",
    tasks: [task(101, "a", { priority: "critical" }), task(102, "a", { browserResult: true })],
    events: [],
    expected: 101,
  },
  {
    name: "browser result cannot bypass intake lane",
    tasks: [
      task(101, "a", { lane: "intake" }),
      task(102, "a", { lane: "completion", browserResult: true }),
    ],
    events: [],
    expected: 101,
  },
  {
    name: "browser result cannot bypass an open required source",
    tasks: [task(101), task(102, "a", { provider: "held", browserResult: true })],
    events: [],
    heldSource: "open",
    expected: 101,
  },
);
const literal = (value) =>
  value === null || value === undefined
    ? "NULL"
    : typeof value === "number"
      ? String(value)
      : `'${String(value).replaceAll("'", "''")}'`;
function table(columns, rows) {
  const data = rows.length ? rows : [Object.fromEntries(columns.map((column) => [column, null]))];
  return (
    "(" +
    data
      .map(
        (row, index) =>
          "SELECT " +
          columns
            .map((column) => {
              const value = ["occurred_at", "available_at"].includes(column)
                ? `CAST(${literal(row[column])} AS DATETIME(3))`
                : literal(row[column]);
              return value + (index === 0 ? ` AS ${column}` : "");
            })
            .join(",") +
          (rows.length ? "" : " WHERE 1=0"),
      )
      .join(" UNION ALL ") +
    ")"
  );
}
function queryFor(scenario, policy, sourcePreferenceSql) {
  const events = scenario.events.map((row, index) => ({ task_id: uuid(900 + index), ...row }));
  for (const row of scenario.tasks) {
    if (row.lane === "intake")
      events.push({
        ...row,
        task_id: row.id,
        event_type: "hotspot.automatic.scheduled",
        actor_type: "system",
        occurred_at: stamp(1),
      });
    if (row.lane === "completion")
      events.push({
        ...row,
        task_id: row.id,
        event_type: "competitor.detail.auto_scheduled",
        actor_type: "worker",
        occurred_at: stamp(1),
      });
    if (row.lane === "product_search")
      events.push({
        ...row,
        ...row.eventScope,
        task_id: row.id,
        event_type: "intelligence.product_search.auto_scheduled",
        actor_type: row.eventActor ?? "worker",
        occurred_at: stamp(1),
      });
    if (row.lane === "sourcing")
      events.push({
        ...row,
        task_id: row.id,
        event_type: "sourcing.collection.auto_scheduled",
        actor_type: "worker",
        occurred_at: stamp(1),
      });
  }
  const organizations = [
    ...new Set(Object.values(scopes).map((scope) => scope.organization_id)),
  ].map((id) => ({
    id,
    status:
      scenario.archivedOrganization && scopes[scenario.archivedOrganization].organization_id === id
        ? "archived"
        : "active",
  }));
  const workspaces = Object.entries(scopes).map(([name, scope]) => ({
    id: scope.workspace_id,
    organization_id: scope.organization_id,
    status: scenario.archivedWorkspace === name ? "archived" : "active",
  }));
  const queries = scenario.tasks.map((row, index) => ({
    id: uuid(500 + index),
    task_id: row.id,
    organization_id: row.organization_id,
    workspace_id: row.workspace_id,
    provider_id:
      row.provider === "held" ? uuid(402) : row.lane === "sourcing" ? uuid(403) : uuid(401),
    is_required: row.required ?? 1,
    status: row.queryStatus ?? "pending",
    error_code: row.errorCode ?? null,
    target_json: JSON.stringify({
      projection_type:
        row.projection ??
        (row.lane === "completion"
          ? "competitor_snapshot"
          : row.lane === "sourcing"
            ? "sourcing_search"
            : "intelligence_product_discovery"),
    }),
  }));
  const tables = {
    collection_tasks: table(
      [
        "id",
        "organization_id",
        "workspace_id",
        "status",
        "priority",
        "attempt_count",
        "available_at",
      ],
      scenario.tasks,
    ),
    collection_task_events: table(
      ["task_id", "organization_id", "workspace_id", "event_type", "actor_type", "occurred_at"],
      events,
    ),
    collection_subqueries: table(
      [
        "id",
        "task_id",
        "organization_id",
        "workspace_id",
        "provider_id",
        "is_required",
        "status",
        "error_code",
        "target_json",
      ],
      queries,
    ),
    browser_collection_jobs: table(
      [
        "collection_subquery_id",
        "collection_task_id",
        "organization_id",
        "workspace_id",
        "provider_id",
        "status",
        "result_json",
      ],
      scenario.tasks.flatMap((row, index) => {
        if (!row.browserResult) return [];
        const query = queries[index];
        const job = {
          collection_subquery_id: query.id,
          collection_task_id: query.task_id,
          organization_id: query.organization_id,
          workspace_id: query.workspace_id,
          provider_id: query.provider_id,
          status: row.browserStatus ?? "succeeded",
          result_json: Object.hasOwn(row, "resultJson") ? row.resultJson : "{}",
        };
        if (row.browserMismatch) job[row.browserMismatch] = uuid(999);
        return [job];
      }),
    ),
    providers: table(
      ["id", "code", "status"],
      [
        { id: uuid(401), code: "amazon_product", status: "enabled" },
        { id: uuid(403), code: "1688_search", status: "enabled" },
        {
          id: uuid(402),
          code: "fixture_held_source",
          status: scenario.heldSource === "disabled" ? "disabled" : "enabled",
        },
      ],
    ),
    provider_runtime_circuits: table(
      ["provider_id", "state"],
      [
        { provider_id: uuid(401), state: "closed" },
        { provider_id: uuid(403), state: "closed" },
        { provider_id: uuid(402), state: scenario.heldSource === "open" ? "open" : "closed" },
      ],
    ),
    organizations: table(["id", "status"], organizations),
    workspaces: table(["id", "organization_id", "status"], workspaces),
  };
  let order = policy.collectionReadyOrderSql(
    scenario.completionFirst ?? true,
    scenario.productSearchFirst ?? false,
    scenario.sourcingFirst ?? false,
  );
  const closeCompetitors = scenario.tasks
    .filter((row) => row.nearCompetitor)
    .map((row) => literal(row.id));
  order = order.replace(
    completionReadyCompetitorTaskSql,
    closeCompetitors.length ? `collection_tasks.id IN (${closeCompetitors.join(",")})` : "0=1",
  );
  if (scenario.sourcingFirst && scenario.completionFirst !== false) {
    if (!sourcePreferenceSql) throw Error("source_preference_predicate_required");
    const ids = scenario.tasks.filter((row) => row.nearSource).map((row) => literal(row.id));
    // Ordering-only proof: actual readiness is verified independently against real evidence.
    order = order.replace(
      sourcePreferenceSql,
      ids.length ? `collection_tasks.id IN (${ids.join(",")})` : "0=1",
    );
  }
  const sql =
    "SELECT collection_tasks.id FROM collection_tasks" +
    policy.collectionScopeFairnessJoinSql +
    " WHERE status='queued' AND attempt_count<4 AND " +
    policy.activeCollectionScopeSql("collection_tasks") +
    policy.collectionRequiredSourcesReadySql +
    order;
  const keywords = new Set(["WHERE", "GROUP", "LEFT", "JOIN", "ON", "ORDER"]);
  return sql.replace(
    /\b(FROM|JOIN) (collection_tasks|collection_task_events|collection_subqueries|browser_collection_jobs|providers|provider_runtime_circuits|organizations|workspaces)\b(\s+([A-Za-z_][A-Za-z0-9_]*))?/g,
    (_match, keyword, name, suffix = "", next = "") =>
      keyword +
      " " +
      tables[name] +
      (!next || keywords.has(next.toUpperCase()) ? " " + name : "") +
      suffix,
  );
}
export function collectionScopeFairnessSqlCases(policy, sourcePreferenceSql) {
  const sourceCases = sourcePreferenceSql
    ? [
        {
          name: "eligible sourcing turn precedes independent competitor detail preference",
          tasks: [
            task(101, "a", { lane: "completion", nearCompetitor: true }),
            task(102, "a", { lane: "sourcing", nearSource: true }),
          ],
          events: [],
          sourcingFirst: true,
          expected: 102,
        },
        {
          name: "eligible sourcing turn precedes a ready Amazon browser result",
          tasks: [
            task(101, "a", { lane: "completion", browserResult: true }),
            task(102, "a", { lane: "sourcing", nearSource: true }),
          ],
          events: [],
          sourcingFirst: true,
          expected: 102,
        },
        {
          name: "other completion turn preserves browser result preference",
          tasks: [
            task(101, "a", { lane: "completion", browserResult: true }),
            task(102, "a", { lane: "sourcing", nearSource: true }),
          ],
          events: [],
          sourcingFirst: false,
          expected: 101,
        },
        {
          name: "unqualified source does not precede browser results",
          tasks: [
            task(101, "a", { lane: "sourcing" }),
            task(102, "a", { lane: "completion", browserResult: true }),
          ],
          events: [],
          sourcingFirst: true,
          expected: 102,
        },
        {
          name: "sourcing turn preserves raw intake precedence",
          tasks: [
            task(101, "a", { lane: "sourcing", nearSource: true }),
            task(102, "a", { lane: "intake" }),
          ],
          events: [],
          sourcingFirst: true,
          expected: 102,
        },
        {
          name: "sourcing turn preserves critical priority",
          tasks: [
            task(101, "a", { lane: "completion", priority: "critical" }),
            task(102, "a", { lane: "sourcing", nearSource: true }),
          ],
          events: [],
          sourcingFirst: true,
          expected: 101,
        },
        {
          name: "sourcing turn preserves scope fairness",
          tasks: [
            task(101, "b", { lane: "completion" }),
            task(102, "a", { lane: "sourcing", nearSource: true }),
          ],
          events: [claim("a", 10), claim("b", 5)],
          sourcingFirst: true,
          expected: 101,
        },
        {
          name: "held required source cannot use sourcing preference",
          tasks: [
            task(101, "a", { lane: "completion" }),
            task(102, "a", { lane: "sourcing", nearSource: true, provider: "held" }),
          ],
          events: [],
          heldSource: "disabled",
          sourcingFirst: true,
          expected: 101,
        },
        {
          name: "FIFO escape ignores sourcing preference",
          tasks: [task(101), task(102, "a", { lane: "sourcing", nearSource: true })],
          events: [],
          completionFirst: false,
          sourcingFirst: true,
          expected: 101,
        },
        {
          name: "sourcing turn keeps FIFO within equally qualified sources",
          tasks: [
            task(101, "a", { lane: "sourcing", nearSource: true, available_at: stamp(8) }),
            task(102, "a", { lane: "sourcing", nearSource: true }),
          ],
          events: [],
          sourcingFirst: true,
          expected: 102,
        },
        {
          name: "product-search stage remains before sourcing when it owns the turn",
          tasks: [
            task(101, "a", { lane: "product_search" }),
            task(102, "a", { lane: "sourcing", nearSource: true }),
          ],
          events: [],
          productSearchFirst: true,
          sourcingFirst: true,
          expected: 101,
        },
      ]
    : [];
  const result = [...scenarios, ...sourceCases].map((scenario) => ({
    name: scenario.name,
    sql: queryFor(scenario, policy, sourcePreferenceSql),
    expected: uuid(scenario.expected),
  }));
  const rotating = {
    tasks: [task(101), task(102, "b"), task(103, "c")],
    events: [claim("a", 10), claim("b", 5)],
  };
  for (const [turn, scope] of ["c", "b", "a", "c"].entries()) {
    result.push({
      name: `durable three-scope rotation ${turn + 1}`,
      sql: queryFor(rotating, policy),
      expected: rotating.tasks.find((row) => row.workspace_id === scopes[scope].workspace_id).id,
    });
    rotating.events.push(claim(scope, 20 + turn));
  }
  return result;
}
export async function runCollectionScopeFairnessSqlProof(connection, policy) {
  const passed = [];
  for (const item of collectionScopeFairnessSqlCases(policy)) {
    const [rows] = await connection.query(item.sql);
    if (rows.length !== 1 || String(rows[0].id) !== item.expected)
      throw new Error(`scope_fairness_sql_case_failed:${item.name}`);
    passed.push(item.name);
  }
  return { passed: passed.length, cases: passed };
}
