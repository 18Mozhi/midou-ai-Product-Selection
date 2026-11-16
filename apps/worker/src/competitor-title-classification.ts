import { appendOpportunityEvent, collectionTaskScope } from "@scoutops/database";
import { createHash, randomUUID } from "node:crypto";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import {
  primaryProductEvidence,
  readAutomaticPrimaryEvidence,
} from "./automatic-selection-evidence.js";
import {
  registerCalculationOwners,
  resolveCalculationOwnership,
} from "./opportunity-calculation-ownership.js";
import { nativeOpportunityStorage } from "./opportunity-storage.js";
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
  organizationId?: string;
  workspaceId?: string;
  accountId?: string;
  opportunityId: string;
  mainAsin: string;
};
async function classificationTaskScope(
  db: Pick<Pool, "query">,
  scope: CompetitorClassificationScope,
) {
  const ownership = await resolveCalculationOwnership(db, scope.opportunityId);
  if (ownership && !ownership.owner) return fail("competitor_primary_missing");
  const accountId = ownership?.owner?.account_id;
  const native = Boolean(accountId && (await collectionTaskScope(db)) === "account");
  if (scope.accountId && (!native || scope.accountId !== accountId))
    return fail("competitor_evidence_scope_invalid");
  return { accountId, native };
}

export async function sealedClassificationOrigin(
  db: Pick<Pool, "query">,
  opportunityId: string,
  accountId: string,
  lock = false,
) {
  const [[row]] = await db.query<RowDataPacket[]>(
    "SELECT r.legacy_org_id,r.legacy_workspace_id,r.source_id sealed_id,o.created_at>cut.created_at account_after_cutover FROM opportunities o " +
      "JOIN account_owned_records p ON p.source_table='opportunities' AND p.source_id=o.id AND p.account_id=o.account_id " +
      "JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25 " +
      "LEFT JOIN account_retirement_records r ON r.run_id=cut.source_run_id AND r.source_table='opportunities' AND r.source_id=o.id " +
      "WHERE o.id=? AND o.account_id=?" +
      (lock ? " LOCK IN SHARE MODE" : ""),
    [opportunityId, accountId],
  );
  if (row?.legacy_org_id && row.legacy_workspace_id)
    return {
      kind: "historical" as const,
      organizationId: String(row.legacy_org_id),
      workspaceId: String(row.legacy_workspace_id),
    };
  if (row?.sealed_id === null && Number(row.account_after_cutover) === 1)
    return { kind: "account" as const, accountId };
}

function fingerprintScope(scope: CompetitorClassificationScope) {
  if (!scope.accountId) return scope;
  const { taskId, subqueryId, accountId, opportunityId, mainAsin } = scope;
  return { taskId, subqueryId, accountId, opportunityId, mainAsin };
}
export async function readCompetitorClassificationContext(
  db: Pick<Pool, "query">,
  scope: CompetitorClassificationScope,
) {
  const { accountId, native } = await classificationTaskScope(db, scope);
  const ownerProof = (table: string, id: string) =>
    `EXISTS (SELECT 1 FROM account_owned_records own WHERE own.source_table='${table}' AND own.source_id=${id} AND own.account_id=link_owner.account_id)`;
  if (accountId) {
    const [parents] = await db.query<RowDataPacket[]>(
      "SELECT q.id FROM collection_tasks t JOIN collection_subqueries q ON q.task_id=t.id " +
        "JOIN account_owned_records link_owner ON link_owner.source_table='collection_tasks' AND link_owner.source_id=t.id " +
        "WHERE t.id=? AND q.id=? AND " +
        (native
          ? "t.account_id=link_owner.account_id "
          : "t.organization_id=? AND t.workspace_id=? ") +
        "AND link_owner.account_id=? AND " +
        ownerProof("collection_subqueries", "q.id"),
      [
        scope.taskId,
        scope.subqueryId,
        ...(native ? [] : [scope.organizationId, scope.workspaceId]),
        accountId,
      ],
    );
    if (!parents[0]) return fail("competitor_evidence_scope_invalid");
  }
  const [{ linked, detail }, [rows]] = await Promise.all([
    readAutomaticPrimaryEvidence(db, {
      ...scope,
      organizationId: scope.organizationId ?? "",
      workspaceId: scope.workspaceId ?? "",
      ...(accountId ? { accountId } : {}),
    }),
    db.query<RowDataPacket[]>(
      "SELECT n.id,n.raw_evidence_id,n.provider_id,n.payload_json FROM collection_task_evidence_links l " +
        "JOIN collection_tasks link_task ON link_task.id=l.collection_task_id " +
        "JOIN normalized_records n ON n.id=l.normalized_record_id AND n.raw_evidence_id=l.raw_evidence_id AND n.provider_id=l.provider_id AND n.status='active' " +
        (accountId
          ? "JOIN collection_subqueries q ON q.id=l.collection_subquery_id AND q.task_id=link_task.id AND q.provider_id=l.provider_id " +
            "JOIN raw_evidence e ON e.id=n.raw_evidence_id AND e.provider_id=n.provider_id " +
            "JOIN collection_tasks origin ON origin.id=e.collection_task_id AND " +
            (native
              ? "origin.account_id=link_task.account_id AND n.account_id=link_task.account_id AND e.account_id=link_task.account_id "
              : "origin.organization_id=link_task.organization_id AND origin.workspace_id=link_task.workspace_id ") +
            "JOIN account_owned_records link_owner ON link_owner.source_table='collection_tasks' AND link_owner.source_id=link_task.id "
          : "AND n.organization_id=link_task.organization_id AND n.workspace_id=link_task.workspace_id ") +
        "JOIN providers p ON p.id=n.provider_id AND p.code='amazon_product' AND p.status='enabled' " +
        "WHERE l.collection_task_id=? AND l.collection_subquery_id=? AND " +
        (native
          ? "link_task.account_id=link_owner.account_id "
          : "link_task.organization_id=? AND link_task.workspace_id=? ") +
        (accountId
          ? "AND link_owner.account_id=? AND " +
            [
              ownerProof("collection_subqueries", "q.id"),
              ownerProof("collection_task_evidence_links", "l.id"),
              ownerProof("collection_tasks", "origin.id"),
              ownerProof("normalized_records", "n.id"),
              ownerProof("raw_evidence", "e.id"),
            ].join(" AND ") +
            " "
          : "") +
        "ORDER BY l.created_at,n.id LIMIT 100",
      [
        scope.taskId,
        scope.subqueryId,
        ...(native ? [] : [scope.organizationId, scope.workspaceId]),
        ...(accountId ? [accountId] : []),
      ],
    ),
  ]);
  const primary = primaryProductEvidence(linked, detail);
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
  return { input, fingerprint: fingerprint({ scope: fingerprintScope(scope), input, bindings }) };
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
    const scope: CompetitorClassificationScope = {
      taskId: task.id,
      subqueryId: query.id,
      organizationId: task.organizationId,
      workspaceId: task.workspaceId,
      opportunityId,
      mainAsin,
    };
    const { accountId, native } = await classificationTaskScope(this.pool, scope);
    const accountParent =
      native && Boolean(accountId) && (await nativeOpportunityStorage(this.pool));
    if (native) {
      if (task.accountId !== accountId) return fail("competitor_evidence_scope_invalid");
      if (accountParent && accountId) {
        // Legacy coordinates here reproduce an immutable evidence fingerprint;
        // the native parent and ledger account are the authorization.
        const origin = await sealedClassificationOrigin(this.pool, opportunityId, accountId);
        if (!origin) return fail("competitor_primary_missing");
        if (origin.kind === "account") scope.accountId = origin.accountId;
        else {
          scope.organizationId = origin.organizationId;
          scope.workspaceId = origin.workspaceId;
        }
      } else {
        const [[parent]] = await this.pool.query<RowDataPacket[]>(
          "SELECT o.organization_id,o.workspace_id FROM opportunities o " +
            "JOIN account_owned_records p ON p.source_table='opportunities' AND p.source_id=o.id " +
            "WHERE o.id=? AND p.account_id=?",
          [opportunityId, accountId],
        );
        if (!parent?.organization_id || !parent.workspace_id)
          return fail("competitor_primary_missing");
        scope.organizationId = String(parent.organization_id);
        scope.workspaceId = String(parent.workspace_id);
      }
    }
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
        "SELECT id FROM collection_tasks WHERE id=? AND " +
          (native ? "account_id=? " : "organization_id=? AND workspace_id=? ") +
          "AND status='running' AND lease_token_hash=UNHEX(?) AND lease_expires_at>NOW(3) FOR UPDATE",
        [task.id, ...(native ? [accountId] : [scope.organizationId, scope.workspaceId]), tokenHash],
      );
      if (!leases.length) return fail("competitor_classification_lease_lost");
      if (native) {
        const currentScope = await classificationTaskScope(c, scope);
        if (!currentScope.native || currentScope.accountId !== accountId)
          return fail("competitor_evidence_scope_invalid");
      }
      const current = await readCompetitorClassificationContext(c, scope);
      if (current.fingerprint !== before.fingerprint) return fail("competitor_evidence_changed");
      const payload = {
        version: "competitor-title-v1",
        task_id: task.id,
        subquery_id: query.id,
        model_fingerprint: fingerprint(this.classifier.model),
        input: before.input,
        scope: fingerprintScope(scope),
        input_fingerprint: before.fingerprint,
        classifications: relations,
      };
      const eventId = randomUUID();
      if (accountParent && accountId) {
        const origin = await sealedClassificationOrigin(c, opportunityId, accountId, true);
        const owner = await resolveCalculationOwnership(c, opportunityId);
        const sameOrigin =
          origin?.kind === "account"
            ? origin.accountId === scope.accountId
            : origin?.kind === "historical" &&
              !scope.accountId &&
              origin.organizationId === scope.organizationId &&
              origin.workspaceId === scope.workspaceId;
        if (!sameOrigin || owner?.owner?.account_id !== accountId)
          return fail("competitor_evidence_changed");
        const [written] = await c.query<ResultSetHeader>(
          "INSERT INTO opportunity_events (id,event_type,resource_type,resource_id,actor_type,actor_id,request_id,trace_id,payload_json,occurred_at) " +
            "SELECT ?,'opportunity.competitors_classified','opportunity',o.id,'worker',?,?,?,?,NOW(3) FROM opportunities o " +
            "JOIN account_owned_records p ON p.source_table='opportunities' AND p.source_id=o.id AND o.account_id=p.account_id " +
            "WHERE o.id=? AND o.account_id=?",
          [
            eventId,
            this.workerId,
            task.requestId,
            task.traceId,
            JSON.stringify(payload),
            opportunityId,
            accountId,
          ],
        );
        if (written.affectedRows !== 1) return fail("competitor_evidence_changed");
        await registerCalculationOwners(c, owner, [["opportunity_events", eventId]]);
      } else
        await appendOpportunityEvent(c, {
          id: eventId,
          organizationId: scope.organizationId ?? "",
          workspaceId: scope.workspaceId ?? "",
          eventType: "opportunity.competitors_classified",
          resourceType: "opportunity",
          resourceId: opportunityId,
          actorType: "worker",
          actorId: this.workerId,
          requestId: task.requestId,
          traceId: task.traceId,
          payloadJson: JSON.stringify(payload),
          occurredAt: "database_now",
        });
      await c.commit();
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }
}
