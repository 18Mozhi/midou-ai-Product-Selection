import { selectionCompetitorRelevanceSql } from "../../packages/database/dist/index.js";

// Read-only derived rows: never create fixtures in the production database.
const literal = (value) =>
  value == null
    ? "NULL"
    : `CONVERT(0x${Buffer.from(typeof value === "object" ? JSON.stringify(value) : String(value)).toString("hex")} USING utf8mb4) COLLATE utf8mb4_bin`;
const table = (rows) =>
  "(" +
  rows
    .map(
      (row) =>
        "SELECT " +
        Object.entries(row)
          .map(([key, value]) => `${literal(value)} \`${key}\``)
          .join(","),
    )
    .join(" UNION ALL ") +
  ")";

const baseline = () => {
  const scope = {
    taskId: "task",
    subqueryId: "query",
    organizationId: "org",
    workspaceId: "ws",
    opportunityId: "op",
    mainAsin: "B0MAIN0001",
  };
  const primary = {
    source_ref: "primary-raw",
    asin: scope.mainAsin,
    title: "Handheld portable fan",
  };
  const candidate = { source_ref: "candidate", asin: "B0RIVAL001", title: "Portable handheld fan" };
  const payload = {
    version: "competitor-title-v1",
    task_id: scope.taskId,
    subquery_id: scope.subqueryId,
    scope,
    model_fingerprint: "a".repeat(64),
    input_fingerprint: "b".repeat(64),
    input: { primary, candidates: [candidate] },
    classifications: [
      {
        source_ref: candidate.source_ref,
        relation: "substitute",
        primary_excerpt: primary.title,
        candidate_excerpt: candidate.title,
        rationale: "Same handheld use",
      },
    ],
  };
  const record = (id, raw, fields) => ({
    id,
    raw_evidence_id: raw,
    provider_id: "provider",
    organization_id: "org",
    workspace_id: "ws",
    status: "active",
    payload_json: fields,
    created_at: "2026-10-17 01:00:00",
  });
  return {
    opportunity: { id: "op", organization_id: "org", workspace_id: "ws" },
    competitor: { provider_id: "provider", external_id: candidate.asin },
    tables: {
      collection_subqueries: [
        {
          id: "query",
          task_id: "task",
          organization_id: "org",
          workspace_id: "ws",
          provider_id: "provider",
          target_json: {
            projection_type: "opportunity_competitors",
            opportunity_id: "op",
            main_asin: scope.mainAsin,
          },
        },
      ],
      collection_task_evidence_links: [
        {
          collection_subquery_id: "query",
          collection_task_id: "task",
          organization_id: "org",
          workspace_id: "ws",
          normalized_record_id: "candidate",
          raw_evidence_id: "candidate-raw",
        },
      ],
      normalized_records: [
        record("candidate", "candidate-raw", {
          asin: candidate.asin,
          title: candidate.title,
          canonical_url: `https://www.amazon.com/dp/${candidate.asin}`,
        }),
        record("primary", "primary-raw", {
          asin: primary.asin,
          title: primary.title,
          canonical_url: `https://www.amazon.com/dp/${primary.asin}`,
        }),
      ],
      providers: [{ id: "provider", code: "amazon_product", status: "enabled" }],
      opportunity_evidence_links: [
        {
          opportunity_id: "op",
          organization_id: "org",
          workspace_id: "ws",
          raw_evidence_id: "primary-raw",
          created_at: "2026-10-17 01:00:00",
        },
      ],
      opportunity_events: [
        {
          id: "event-1",
          organization_id: "org",
          workspace_id: "ws",
          resource_id: "op",
          resource_type: "opportunity",
          event_type: "opportunity.competitors_classified",
          occurred_at: "2026-10-17 01:01:00",
          payload_json: payload,
        },
      ],
    },
  };
};

export const competitorRelevanceCases = [];
const add = (name, expected, mutate = () => {}) => {
  const f = baseline();
  mutate(f);
  let predicate = selectionCompetitorRelevanceSql;
  for (const [name, rows] of Object.entries(f.tables))
    predicate = predicate.replaceAll(new RegExp(`\\b${name}\\b`, "g"), table(rows));
  competitorRelevanceCases.push({
    name,
    expected,
    sql: `SELECT ${predicate} passed FROM ${table([f.opportunity])} o CROSS JOIN ${table([f.competitor])} c_sample`,
  });
};
const event = (f) => f.tables.opportunity_events[0].payload_json;
const candidate = (f) => f.tables.normalized_records[0];
add("actual original titles and substitute", 1);
add("missing classification", 0, (f) => {
  f.tables.opportunity_events[0].event_type = "unrelated";
});
for (const relation of ["different_use", "accessory", "uncertain"])
  add(relation, 0, (f) => {
    event(f).classifications[0].relation = relation;
  });
add("other array entry cannot approve this product", 0, (f) => {
  event(f).classifications[0].relation = "accessory";
  event(f).classifications.push({
    ...event(f).classifications[0],
    source_ref: "other",
    relation: "substitute",
  });
});
for (const field of ["organization_id", "workspace_id", "resource_id"])
  add("foreign event " + field, 0, (f) => {
    f.tables.opportunity_events[0][field] = "foreign";
  });
for (const field of [
  "organizationId",
  "workspaceId",
  "opportunityId",
  "taskId",
  "subqueryId",
  "mainAsin",
])
  add("foreign payload scope " + field, 0, (f) => {
    event(f).scope[field] = "foreign";
  });
for (const field of ["task_id", "subquery_id"])
  add("foreign event " + field, 0, (f) => {
    event(f)[field] = "foreign";
  });
add("new primary identity", 0, (f) => {
  f.tables.normalized_records[1].payload_json.asin = "B0MAIN0002";
  f.tables.normalized_records[1].payload_json.canonical_url =
    "https://www.amazon.com/dp/B0MAIN0002";
});
add("changed original candidate title", 0, (f) => {
  candidate(f).payload_json.title = "Stroller mounted fan";
});
add("forged input title", 0, (f) => {
  event(f).input.candidates[0].title = "other";
});
add("forged title quote", 0, (f) => {
  event(f).classifications[0].candidate_excerpt = "other";
});
add("forged primary quote", 0, (f) => {
  event(f).classifications[0].primary_excerpt = "other";
});
add("foreign evidence link", 0, (f) => {
  f.tables.collection_task_evidence_links[0].raw_evidence_id = "foreign";
});
add("foreign provider", 0, (f) => {
  candidate(f).provider_id = "foreign";
});
add("foreign Amazon URL", 0, (f) => {
  candidate(f).payload_json.canonical_url = "https://www.amazon.com/dp/B0RIVAL002";
});
add("foreign ASIN field", 0, (f) => {
  candidate(f).payload_json.asin = "B0RIVAL002";
});
add("URL identity without redundant ASIN field", 1, (f) => {
  delete candidate(f).payload_json.asin;
});
add("nested normalized fields", 1, (f) => {
  candidate(f).payload_json = { fields: candidate(f).payload_json };
});
add("unsupported audit version", 0, (f) => {
  event(f).version = "unverified";
});
add("missing model fingerprint", 0, (f) => {
  delete event(f).model_fingerprint;
});
add("invalid input fingerprint", 0, (f) => {
  event(f).input_fingerprint = "invalid";
});
add("latest rejection supersedes old substitute", 0, (f) => {
  const next = structuredClone(f.tables.opportunity_events[0]);
  next.id = "event-2";
  next.occurred_at = "2026-10-17 01:02:00";
  next.payload_json.classifications[0].relation = "different_use";
  f.tables.opportunity_events.push(next);
});
add("equal audit time uses latest event id", 0, (f) => {
  const next = structuredClone(f.tables.opportunity_events[0]);
  next.id = "event-2";
  next.payload_json.classifications[0].relation = "uncertain";
  f.tables.opportunity_events.push(next);
});

add("new discovery rejection supersedes old task approval", 0, (f) => {
  const next = structuredClone(f.tables.opportunity_events[0]);
  next.id = "event-2";
  next.occurred_at = "2026-10-17 01:02:00";
  next.payload_json.task_id = "task-2";
  next.payload_json.subquery_id = "query-2";
  next.payload_json.input.candidates[0].source_ref = "candidate-2";
  next.payload_json.classifications[0].source_ref = "candidate-2";
  next.payload_json.classifications[0].relation = "different_use";
  f.tables.opportunity_events.push(next);
});
for (const unrelated of ["primary", "candidate", "tenant"]) {
  add("new discovery for another " + unrelated + " does not hide this proof", 1, (f) => {
    const next = structuredClone(f.tables.opportunity_events[0]);
    next.id = "event-2";
    next.occurred_at = "2026-10-17 01:02:00";
    next.payload_json.task_id = "task-2";
    next.payload_json.subquery_id = "query-2";
    next.payload_json.classifications[0].relation = "different_use";
    if (unrelated === "primary") next.payload_json.input.primary.asin = "B0OTHER001";
    if (unrelated === "candidate") next.payload_json.input.candidates[0].asin = "B0OTHER001";
    if (unrelated === "tenant") next.organization_id = "another-org";
    f.tables.opportunity_events.push(next);
  });
}
