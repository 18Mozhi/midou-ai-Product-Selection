import { createHash } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { IntelligenceProductClassifier } from "./intelligence-product-association.js";
import { intelligenceInput } from "./intelligence-product-association.js";
import { normalizedProductFields } from "./automatic-selection-evaluation.js";
import {
  automaticPrimaryEvidenceSql,
  automaticPrimaryDetailEvidenceSql,
  primaryProductEvidence,
} from "./automatic-selection-evidence.js";

import {
  PRIMARY_SOURCE_SUPPORT_REVISION,
  PRIMARY_SOURCE_SUPPORT_EVENT,
} from "./primary-source-support-contract.js";
export {
  PRIMARY_SOURCE_SUPPORT_REVISION,
  PRIMARY_SOURCE_SUPPORT_EVENT,
} from "./primary-source-support-contract.js";
type Scope = { opportunityId: string; organizationId: string; workspaceId: string };
type Reader = Pool | PoolConnection;
const parse = (value: unknown): Record<string, unknown> => {
  try {
    const result = typeof value === "string" ? JSON.parse(value) : value;
    return result && typeof result === "object" && !Array.isArray(result) ? result : {};
  } catch {
    return {};
  }
};
export const primarySourceOriginSql =
  "SELECT o.source_type,e.id,e.payload_json FROM opportunities o LEFT JOIN trend_events e " +
  "ON e.resource_type='trend_topic' AND e.resource_id=o.source_ref_id " +
  "AND e.organization_id=o.organization_id AND e.workspace_id=o.workspace_id " +
  "AND e.event_type='trend.intelligence.primary_selected' " +
  "AND BINARY JSON_UNQUOTE(JSON_EXTRACT(e.payload_json,'$.opportunity_id'))=BINARY o.id " +
  "WHERE o.organization_id=? AND o.workspace_id=? AND o.id=? " +
  "ORDER BY e.occurred_at DESC,e.id DESC LIMIT 1";
export const primarySourceNewsSql =
  "SELECT n.id,n.payload_json FROM normalized_records n WHERE n.id=? AND n.organization_id=? " +
  "AND n.workspace_id=? AND n.status IN ('active','superseded') AND EXISTS " +
  "(SELECT 1 FROM trend_events e WHERE e.organization_id=n.organization_id AND e.workspace_id=n.workspace_id " +
  "AND e.event_type='trend.intelligence.associated' " +
  "AND BINARY JSON_UNQUOTE(JSON_EXTRACT(e.payload_json,'$.normalized_record_id'))=BINARY n.id " +
  "AND JSON_CONTAINS(JSON_EXTRACT(e.payload_json,'$.association.queries'),JSON_QUOTE(?))) LIMIT 1";
export const primarySourceAuditSql =
  "SELECT payload_json FROM opportunity_events WHERE organization_id=? AND workspace_id=? " +
  "AND resource_type='opportunity' AND resource_id=? AND actor_type='worker' AND event_type=? " +
  "AND BINARY JSON_UNQUOTE(JSON_EXTRACT(payload_json,'$.fingerprint'))=BINARY ? " +
  "ORDER BY occurred_at DESC,id DESC LIMIT 1";

export type PrimarySourceContext = {
  fingerprint: string;
  primary_asin: string;
  title: string;
  query: string;
  origin_event_id: string;
  intelligence_record_id: string;
  intelligence: ReturnType<typeof intelligenceInput> | null;
};
export type PrimarySourceVerdict = {
  revision: string;
  fingerprint: string;
  primary_asin: string;
  origin_event_id: string;
  intelligence_record_id: string;
  supported: boolean;
  rationale: string;
};

/** Point reads only; each original record and query must belong to the same scope. */
export async function readPrimarySourceContext(reader: Reader, scope: Scope) {
  const [origins] = await reader.query<RowDataPacket[]>(primarySourceOriginSql, [
    scope.organizationId,
    scope.workspaceId,
    scope.opportunityId,
  ]);
  const origin = origins[0];
  if (!origin || origin.source_type !== "trend_topic") return null;
  const payload = parse(origin.payload_json);
  const query = typeof payload.query === "string" ? payload.query.trim() : "";
  const recordId =
    typeof payload.intelligence_source_record_id === "string"
      ? payload.intelligence_source_record_id
      : "";
  const parameters = [scope.opportunityId, scope.organizationId, scope.workspaceId];
  const [linked] = await reader.query<RowDataPacket[]>(automaticPrimaryEvidenceSql, parameters);
  const [details] = await reader.query<RowDataPacket[]>(
    automaticPrimaryDetailEvidenceSql,
    parameters,
  );
  const primary = primaryProductEvidence(linked[0], details[0]);
  const fields = normalizedProductFields(parse(primary?.payload_json));
  const asin = typeof fields.asin === "string" ? fields.asin.toUpperCase() : "";
  const title = typeof fields.title === "string" ? fields.title.trim() : "";
  const [news] =
    recordId && query
      ? await reader.query<RowDataPacket[]>(primarySourceNewsSql, [
          recordId,
          scope.organizationId,
          scope.workspaceId,
          query,
        ])
      : [[]];
  const intelligence = news[0] ? intelligenceInput(recordId, parse(news[0].payload_json)) : null;
  const identity = {
    revision: PRIMARY_SOURCE_SUPPORT_REVISION,
    opportunityId: scope.opportunityId,
    organizationId: scope.organizationId,
    workspaceId: scope.workspaceId,
    origin_event_id: typeof origin.id === "string" ? origin.id : "",
    intelligence_record_id: recordId,
    query,
    primary_asin: asin,
    title,
    intelligence,
  };
  return {
    ...identity,
    fingerprint: createHash("sha256").update(JSON.stringify(identity)).digest("hex"),
  };
}

export async function readPrimarySourceVerdict(
  reader: Reader,
  scope: Scope,
  context: PrimarySourceContext,
) {
  const [rows] = await reader.query<RowDataPacket[]>(primarySourceAuditSql, [
    scope.organizationId,
    scope.workspaceId,
    scope.opportunityId,
    PRIMARY_SOURCE_SUPPORT_EVENT,
    context.fingerprint,
  ]);
  const value = parse(rows[0]?.payload_json);
  return value.revision === PRIMARY_SOURCE_SUPPORT_REVISION &&
    value.fingerprint === context.fingerprint &&
    value.primary_asin === context.primary_asin &&
    value.origin_event_id === context.origin_event_id &&
    value.intelligence_record_id === context.intelligence_record_id &&
    typeof value.supported === "boolean" &&
    typeof value.rationale === "string"
    ? (value as PrimarySourceVerdict)
    : null;
}

/** Reuses the exact upstream causal/type classifier; no price or sales inference. */
export async function classifyPrimarySource(
  reader: Reader,
  scope: Scope,
  classifier?: Pick<IntelligenceProductClassifier, "selectPrimary">,
) {
  const context = await readPrimarySourceContext(reader, scope);
  if (!context) return null;
  const cached = await readPrimarySourceVerdict(reader, scope, context);
  if (cached) return cached;
  if (!classifier) return null;
  const valid =
    context.intelligence &&
    (context.intelligence.title.trim() || context.intelligence.summary.trim()) &&
    context.query.length <= 120 &&
    context.query &&
    context.title.length <= 1000 &&
    context.title &&
    /^[A-Z0-9]{10}$/.test(context.primary_asin);
  const selected = valid
    ? await classifier.selectPrimary(
        context.query,
        [
          {
            source_ref: "primary",
            asin: context.primary_asin,
            title: context.title,
          },
        ],
        context.intelligence!,
      )
    : null;
  return {
    revision: PRIMARY_SOURCE_SUPPORT_REVISION,
    fingerprint: context.fingerprint,
    primary_asin: context.primary_asin,
    origin_event_id: context.origin_event_id,
    intelligence_record_id: context.intelligence_record_id,
    supported: selected?.source_ref === "primary",
    rationale: selected?.rationale ?? "original_intelligence_or_primary_missing",
  } satisfies PrimarySourceVerdict;
}

/** Also called independently by the scorer and completion writer under the parent lock. */
export async function primarySourceSupportStatus(reader: Reader, scope: Scope) {
  const context = await readPrimarySourceContext(reader, scope);
  if (!context) return { applicable: false, supported: false };
  const verdict = await readPrimarySourceVerdict(reader, scope, context);
  return { applicable: true, supported: verdict?.supported === true };
}
