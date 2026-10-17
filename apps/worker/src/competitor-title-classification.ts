import { createHash, randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import {
  automaticPrimaryEvidenceSql,
  automaticPrimaryDetailEvidenceSql,
} from "./automatic-selection-evidence.js";
import { amazonAsin, selectIndependentCompetitors } from "./competitor-discovery-policy.js";
import { normalizedProductFields } from "./automatic-selection-evaluation.js";
import type { ClaimedCollectionTask } from "./collection-task-contracts.js";

export type CompetitorTitleCandidate = { source_ref: string; asin: string; title: string };
export type CompetitorTitleInput = {
  primary: CompetitorTitleCandidate;
  candidates: CompetitorTitleCandidate[];
};
export type CompetitorTitleRelation = {
  source_ref: string;
  relation: "substitute" | "different_use" | "accessory" | "uncertain";
  primary_excerpt: string;
  candidate_excerpt: string;
  rationale: string;
};
export interface CompetitorTitleClassifier {
  readonly model: string;
  classifyCompetitors(input: CompetitorTitleInput): Promise<CompetitorTitleRelation[]>;
}
export class CompetitorClassificationError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
const fail = (code = "competitor_classification_invalid"): never => {
  throw new CompetitorClassificationError(code);
};
const parse = (value: unknown): unknown => (typeof value === "string" ? JSON.parse(value) : value);
const fingerprint = (value: unknown) =>
  createHash("sha256")
    .update(
      JSON.stringify(value, (_key, item) =>
        item && typeof item === "object" && !Array.isArray(item)
          ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
          : item,
      ),
    )
    .digest("hex");
const nonempty = (value: unknown, max: number): value is string =>
  typeof value === "string" && Boolean(value.trim()) && value.length <= max;

export function validateCompetitorTitleRelations(
  value: unknown,
  input: CompetitorTitleInput,
): CompetitorTitleRelation[] {
  const output = value as { classifications: CompetitorTitleRelation[] };
  if (
    !output ||
    typeof output !== "object" ||
    Array.isArray(output) ||
    Object.keys(output).length !== 1 ||
    !Array.isArray(output.classifications) ||
    output.classifications.length !== input.candidates.length
  )
    return fail();
  const seen = new Set<string>();
  for (const item of output.classifications) {
    const candidate = input.candidates.find((c) => c.source_ref === item?.source_ref);
    if (
      !item ||
      !candidate ||
      seen.has(item.source_ref) ||
      Object.keys(item).length !== 5 ||
      Object.keys(item).some(
        (k) =>
          !["source_ref", "relation", "primary_excerpt", "candidate_excerpt", "rationale"].includes(
            k,
          ),
      ) ||
      !["substitute", "different_use", "accessory", "uncertain"].includes(item.relation) ||
      !nonempty(item.rationale, 800)
    )
      return fail();
    if (item.primary_excerpt !== input.primary.title || item.candidate_excerpt !== candidate.title)
      return fail();
    seen.add(item.source_ref);
  }
  return input.candidates.map((c) =>
    output.classifications.find((r) => r.source_ref === c.source_ref)!,
  );
}

/** Model output contains no generated evidence quotes: attach the exact supplied titles in code. */
export function validateCompetitorTitleOutput(value: unknown, input: CompetitorTitleInput) {
  const output = value as {
    classifications: Array<{
      source_ref: string;
      relation: CompetitorTitleRelation["relation"];
      rationale: string;
    }>;
  };
  if (
    !output ||
    typeof output !== "object" ||
    Array.isArray(output) ||
    Object.keys(output).length !== 1 ||
    !Array.isArray(output.classifications)
  )
    return fail();
  const classifications = output.classifications.map((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      Object.keys(item).length !== 3 ||
      Object.keys(item).some((k) => !["source_ref", "relation", "rationale"].includes(k))
    )
      return fail();
    const candidate = input.candidates.find((c) => c.source_ref === item.source_ref);
    if (!candidate) return fail();
    return { ...item, primary_excerpt: input.primary.title, candidate_excerpt: candidate.title };
  });
  return validateCompetitorTitleRelations({ classifications }, input);
}

export type CompetitorClassificationScope = {
  taskId: string;
  subqueryId: string;
  organizationId: string;
  workspaceId: string;
  opportunityId: string;
  mainAsin: string;
};
export async function readCompetitorClassificationContext(
  db: Pick<Pool, "query">,
  scope: CompetitorClassificationScope,
) {
  const params = [scope.opportunityId, scope.organizationId, scope.workspaceId];
  const [[linked], [details], [rows]] = await Promise.all([
    db.query<RowDataPacket[]>(automaticPrimaryEvidenceSql, params),
    db.query<RowDataPacket[]>(automaticPrimaryDetailEvidenceSql, params),
    db.query<RowDataPacket[]>(
      "SELECT n.id,n.raw_evidence_id,n.provider_id,n.payload_json FROM collection_task_evidence_links l JOIN normalized_records n ON n.id=l.normalized_record_id AND n.raw_evidence_id=l.raw_evidence_id AND n.organization_id=l.organization_id AND n.workspace_id=l.workspace_id AND n.status='active' JOIN providers p ON p.id=n.provider_id AND p.code='amazon_product' AND p.status='enabled' WHERE l.collection_task_id=? AND l.collection_subquery_id=? AND l.organization_id=? AND l.workspace_id=? ORDER BY l.created_at,n.id LIMIT 100",
      [scope.taskId, scope.subqueryId, scope.organizationId, scope.workspaceId],
    ),
  ]);
  const primary =
    details[0] &&
    (!linked[0] ||
      new Date(details[0].observed_at).getTime() >= new Date(linked[0].observed_at).getTime())
      ? details[0]
      : linked[0];
  if (!primary || primary.provider_status !== "enabled") return fail("competitor_primary_missing");
  const fields = normalizedProductFields(parse(primary.payload_json));
  if (
    amazonAsin(fields, String(fields.canonical_url ?? fields.source_url ?? "")) !==
      scope.mainAsin ||
    !nonempty(fields.title, 1000)
  )
    return fail("competitor_primary_changed");
  const selected = selectIndependentCompetitors(
    rows,
    (r) => {
      const f = normalizedProductFields(parse(r.payload_json));
      return { fields: f, canonicalUrl: String(f.canonical_url ?? f.source_url ?? "") };
    },
    scope.mainAsin,
    20,
  );
  const candidates = selected.map((r) => {
    const f = normalizedProductFields(parse(r.payload_json));
    return {
      source_ref: String(r.id),
      asin: amazonAsin(f, String(f.canonical_url ?? f.source_url ?? ""))!,
      title: String(f.title),
    };
  });
  if (candidates.some((c) => !nonempty(c.title, 1000))) return fail();
  const input: CompetitorTitleInput = {
    primary: {
      source_ref: String(primary.raw_evidence_id),
      asin: scope.mainAsin,
      title: fields.title,
    },
    candidates,
  };
  const bindings = selected.map((r) => ({
    id: String(r.id),
    evidence_id: String(r.raw_evidence_id),
    provider_id: String(r.provider_id),
  }));
  return { input, fingerprint: fingerprint({ scope, input, bindings }) };
}

export class MySqlCompetitorTitleClassification {
  constructor(
    private readonly pool: Pool,
    private readonly classifier: CompetitorTitleClassifier,
    private readonly workerId: string,
  ) {}
  async classify(
    task: ClaimedCollectionTask,
    query: ClaimedCollectionTask["subqueries"][number],
    heartbeat: () => Promise<void>,
    signal?: AbortSignal,
  ) {
    if (query.target.projection_type !== "opportunity_competitors") return;
    const opportunityId = String(query.target.opportunity_id ?? ""),
      mainAsin = String(query.target.main_asin ?? "").toUpperCase();
    if (!/^[0-9a-f-]{36}$/i.test(opportunityId) || !/^[A-Z0-9]{10}$/.test(mainAsin))
      return fail("competitor_primary_missing");
    const scope = {
      taskId: task.id,
      subqueryId: query.id,
      organizationId: task.organizationId,
      workspaceId: task.workspaceId,
      opportunityId,
      mainAsin,
    };
    const before = await readCompetitorClassificationContext(this.pool, scope);
    await heartbeat();
    signal?.throwIfAborted();
    let relations: CompetitorTitleRelation[];
    try {
      relations = before.input.candidates.length
        ? validateCompetitorTitleRelations(
            { classifications: await this.classifier.classifyCompetitors(before.input) },
            before.input,
          )
        : [];
    } catch {
      return fail("competitor_model_unavailable");
    }
    await heartbeat();
    signal?.throwIfAborted();
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const tokenHash = createHash("sha256")
        .update("scoutops:collection-task-lease:v1\0")
        .update(task.leaseToken)
        .digest("hex");
      const [leases] = await c.query<RowDataPacket[]>(
        "SELECT id FROM collection_tasks WHERE id=? AND organization_id=? AND workspace_id=? AND status='running' AND lease_token_hash=UNHEX(?) AND lease_expires_at>NOW(3) FOR UPDATE",
        [task.id, task.organizationId, task.workspaceId, tokenHash],
      );
      if (!leases.length) return fail("competitor_classification_lease_lost");
      const current = await readCompetitorClassificationContext(c, scope);
      if (current.fingerprint !== before.fingerprint) return fail("competitor_evidence_changed");
      const payload = {
        version: "competitor-title-v1",
        task_id: task.id,
        subquery_id: query.id,
        model_fingerprint: fingerprint(this.classifier.model),
        input: before.input,
        scope,
        input_fingerprint: before.fingerprint,
        classifications: relations,
      };
      await c.query(
        "INSERT INTO opportunity_events (id,organization_id,workspace_id,event_type,resource_type,resource_id,actor_type,actor_id,request_id,trace_id,payload_json,occurred_at) VALUES (?,?,?,'opportunity.competitors_classified','opportunity',?,'worker',?,?,?,?,NOW(3))",
        [
          randomUUID(),
          task.organizationId,
          task.workspaceId,
          opportunityId,
          this.workerId,
          task.requestId,
          task.traceId,
          JSON.stringify(payload),
        ],
      );
      await c.commit();
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }
}
