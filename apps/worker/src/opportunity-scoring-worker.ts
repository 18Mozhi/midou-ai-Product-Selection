import { appendOpportunityEvent } from "@scoutops/database";
import { appendOpportunityOutbox } from "@scoutops/database";
import { recordSelectionPipelineCompletion } from "./selection-pipeline-completion.js";
import { primarySourceSupportStatus } from "./primary-source-support.js";
import { hasLegacyScoreRuleScope } from "./score-rule-scope.js";
import { nativeOpportunityStorage } from "./opportunity-storage.js";
import {
  calculationOwnersMatch,
  readCalculationOpportunityForClaim,
  registerCalculationOwners,
  resolveCalculationOwnership,
  type CalculationOwnership,
  type CalculationOwnerRef,
} from "./opportunity-calculation-ownership.js";
import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import {
  calculateScoreProjection,
  type ScoreProjectionDimension,
  type ScoreProjectionInput,
} from "@scoutops/contracts";
type Job = {
  id: string;
  organizationId: string;
  workspaceId: string;
  opportunityId: string;
  ruleId: string;
  triggerTaskId: string | null;
  requestId: string;
  traceId: string;
  attemptCount: number;
};
export type ScoringWorkerResult =
  | { status: "idle" }
  | {
      status:
        "succeeded" | "completed_with_warnings" | "failed_terminal" | "scheduled" | "dead_letter";
      job_id: string;
      opportunity_id?: string;
      coverage_percent?: number;
      error_code?: string;
    };
export class OpportunityScoringError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(code);
    this.name = "OpportunityScoringError";
  }
}
const parse = <T>(value: unknown): T =>
  typeof value === "string" ? (JSON.parse(value) as T) : (value as T);
export const hasBlockingQualityRegression = (rows: unknown[]) =>
  rows.some((row) => {
    const value = row as { reconciliation_status?: unknown; critical_issue_count?: unknown };
    return (
      String(value.reconciliation_status ?? "") === "failed" ||
      Number(value.critical_issue_count ?? 0) > 0
    );
  });
export class MySqlOpportunityScoringWorker {
  constructor(
    private readonly pool: Pool,
    private readonly workerId: string,
    private readonly leaseSeconds: number,
    private readonly now: () => Date = () => new Date(),
  ) {}
  async processOnce(): Promise<ScoringWorkerResult> {
    const job = await this.claim();
    if (!job) return { status: "idle" };
    try {
      const result = await this.calculate(job);
      return {
        status: result.complete ? "succeeded" : "completed_with_warnings",
        job_id: job.id,
        opportunity_id: job.opportunityId,
        coverage_percent: result.coverage,
      };
    } catch (error) {
      const wrapped =
          error instanceof OpportunityScoringError
            ? error
            : new OpportunityScoringError(
                `opportunity_scoring_${String((error as { code?: string }).code ?? "dependency_failed").toLowerCase()}`,
                true,
              ),
        status = !wrapped.retryable
          ? "failed_terminal"
          : job.attemptCount >= 4
            ? "dead_letter"
            : "scheduled";
      await this.finish(job, status, wrapped.code);
      return {
        status,
        job_id: job.id,
        opportunity_id: job.opportunityId,
        error_code: wrapped.code,
      };
    }
  }
  private async claim() {
    const c = await this.pool.getConnection(),
      now = this.now(),
      expires = new Date(now.getTime() + this.leaseSeconds * 1000);
    try {
      await c.beginTransaction();
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT * FROM opportunity_score_jobs WHERE (status IN ('queued','retry_scheduled') AND available_at<=?) OR (status='leased' AND lease_expires_at<=?) ORDER BY available_at,id LIMIT 1 FOR UPDATE",
        [now, now],
      );
      const row = rows[0];
      if (!row) {
        await c.commit();
        return null;
      }
      const { organizationId, workspaceId } = await readCalculationOpportunityForClaim(
        c,
        String(row.opportunity_id),
        "calculation_job_opportunity_missing",
      );
      await c.query(
        "UPDATE opportunity_score_jobs SET status='leased',attempt_count=attempt_count+1,lease_owner=?,lease_expires_at=?,updated_at=? WHERE id=?",
        [this.workerId, expires, now, row.id],
      );
      await c.commit();
      return {
        id: String(row.id),
        organizationId,
        workspaceId,
        opportunityId: String(row.opportunity_id),
        ruleId: String(row.score_rule_id),
        triggerTaskId: row.trigger_task_id == null ? null : String(row.trigger_task_id),
        requestId: String(row.request_id),
        traceId: String(row.trace_id),
        attemptCount: Number(row.attempt_count) + 1,
      } as Job;
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }
  private async calculate(job: Job) {
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      const ownership = await resolveCalculationOwnership(c, job.opportunityId);
      const accountOwner = ownership?.owner;
      const scopeFilter = accountOwner ? "" : " AND organization_id=? AND workspace_id=?";
      const scopeArgs = accountOwner ? [] : [job.organizationId, job.workspaceId];
      const legacyRule = await hasLegacyScoreRuleScope(c);
      if (!accountOwner && !legacyRule)
        throw new OpportunityScoringError("score_rule_unavailable", false);
      const ruleScope = accountOwner && !legacyRule ? " AND account_id=?" : scopeFilter;
      const ruleArgs = accountOwner && !legacyRule ? [accountOwner.account_id] : scopeArgs;
      const nativeOpportunity = accountOwner && (await nativeOpportunityStorage(c));
      const [rules] = await c.query<RowDataPacket[]>(
        "SELECT version_code,dimensions_json,thresholds_json FROM score_rules WHERE id=?" +
          ruleScope +
          " AND status IN ('active','retired','rolled_back') FOR UPDATE",
        [job.ruleId, ...ruleArgs],
      );
      const rule = rules[0];
      if (!rule) throw new OpportunityScoringError("score_rule_unavailable", false);
      const [opportunities] = await c.query<RowDataPacket[]>(
        "SELECT id,owner_id FROM opportunities WHERE id=?" +
          (nativeOpportunity ? " AND account_id=?" : scopeFilter) +
          " FOR UPDATE",
        [job.opportunityId, ...(nativeOpportunity ? [accountOwner.account_id] : scopeArgs)],
      );
      if (!opportunities[0]) throw new OpportunityScoringError("opportunity_scope_missing", false);
      if (ownership) {
        const [lease] = await c.query<RowDataPacket[]>(
          "SELECT id FROM opportunity_score_jobs WHERE id=? AND opportunity_id=? AND score_rule_id=? " +
            "AND trigger_task_id <=> ? AND status='leased' AND lease_owner=? AND attempt_count=? AND lease_expires_at>UTC_TIMESTAMP(3) FOR UPDATE",
          [
            job.id,
            job.opportunityId,
            job.ruleId,
            job.triggerTaskId,
            this.workerId,
            job.attemptCount,
          ],
        );
        if (!lease[0]) throw new OpportunityScoringError("opportunity_score_lease_lost", true);
        if (
          !(await calculationOwnersMatch(
            c,
            ownership,
            [["opportunity_score_jobs", job.id]],
            true,
          )) ||
          !(await calculationOwnersMatch(c, ownership, [
            ["score_rules", job.ruleId],
            ...(job.triggerTaskId ? [["tasks", job.triggerTaskId] as const] : []),
          ]))
        )
          throw new OpportunityScoringError("opportunity_score_owner_mismatch", false);
      }
      const sourceSupport = await primarySourceSupportStatus(
        c,
        accountOwner ? { ...job, accountId: accountOwner.account_id } : job,
      );
      const [inputs] = await c.query<RowDataPacket[]>(
        "SELECT * FROM opportunity_score_inputs WHERE opportunity_id=? AND is_current=1",
        [job.opportunityId],
      );
      const evidenceIds = [
        ...new Set(inputs.flatMap((item) => parse<string[]>(item.evidence_ids_json ?? "[]"))),
      ];
      if (
        !(await calculationOwnersMatch(
          c,
          ownership,
          inputs.map((row) => ["opportunity_score_inputs", String(row.id)]),
          true,
        )) ||
        !(await calculationOwnersMatch(
          c,
          ownership,
          evidenceIds.map((id) => ["raw_evidence", id]),
        ))
      )
        throw new OpportunityScoringError("opportunity_score_input_owner_mismatch", false);
      if (evidenceIds.length) {
        const placeholders = evidenceIds.map(() => "?").join(","),
          reconciliationScope = accountOwner
            ? "EXISTS (SELECT 1 FROM account_owned_records ro WHERE ro.source_table='reconciliation_runs' " +
              "AND ro.source_id=r.id AND ro.account_id=?)"
            : "r.organization_id=e.organization_id AND r.workspace_id=e.workspace_id",
          // A critical issue attached to this exact evidence must not be hidden by its old workspace.
          issueScope = accountOwner
            ? ""
            : "i.organization_id=e.organization_id AND i.workspace_id=e.workspace_id AND ",
          [qualityRows] = await c.query<RowDataPacket[]>(
            `SELECT e.id evidence_id,
              (SELECT r.status FROM reconciliation_runs r
               WHERE ${reconciliationScope}
                 AND r.provider_id=e.provider_id AND r.parser_version=e.parser_version
               ORDER BY r.window_ended_at DESC,r.id DESC LIMIT 1) reconciliation_status,
              (SELECT COUNT(*) FROM data_quality_issues i
               WHERE ${issueScope}i.raw_evidence_id=e.id AND i.status='open' AND i.severity='critical') critical_issue_count
             FROM raw_evidence e
             WHERE ${accountOwner ? "" : "e.organization_id=? AND e.workspace_id=? AND "}e.id IN (${placeholders})`,
            accountOwner
              ? [accountOwner.account_id, ...evidenceIds]
              : [...scopeArgs, ...evidenceIds],
          );
        if (
          (accountOwner && qualityRows.length !== evidenceIds.length) ||
          hasBlockingQualityRegression(qualityRows)
        )
          throw new OpportunityScoringError("score_blocked_by_data_quality_regression", false);
      }
      const dimensions = parse<ScoreProjectionDimension[]>(rule.dimensions_json),
        thresholds = parse<{ recommend_min: number; observe_min: number }>(rule.thresholds_json),
        normalizedInputs: ScoreProjectionInput[] = inputs.map((item) => ({
          id: String(item.id),
          input_version: Number(item.input_version),
          dimension_code: String(item.dimension_code),
          evidence_group: item.evidence_group,
          score_value: item.score_value == null ? null : Number(item.score_value),
          evidence_ids: parse<string[]>(item.evidence_ids_json),
          missing_fields: parse<string[]>(item.missing_fields_json),
        })),
        projection = calculateScoreProjection(dimensions, thresholds, normalizedInputs),
        overall = projection.overall_score,
        coverage = projection.coverage_percent,
        recommendation =
          sourceSupport.applicable && !sourceSupport.supported
            ? "insufficient_data"
            : projection.recommendation_status,
        complete = projection.complete_core_evidence,
        available = projection.components.filter((item) => item.usable),
        byCode = new Map(normalizedInputs.map((item) => [item.dimension_code, item])),
        runId = randomUUID(),
        missing = projection.missing_fields,
        status = overall == null ? "insufficient_data" : "calculated";
      await c.query(
        "INSERT INTO opportunity_score_runs (id,opportunity_id,score_rule_id,rule_version_code,status,overall_score,coverage_percent,confidence_score,recommendation_status,missing_fields_json,input_snapshot_json,request_id,trace_id,scored_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
          runId,
          job.opportunityId,
          job.ruleId,
          rule.version_code,
          status,
          overall,
          coverage,
          overall == null ? null : coverage,
          recommendation,
          JSON.stringify(missing),
          JSON.stringify(
            available.map((item) => {
              const input = byCode.get(item.dimension_code)!;
              return {
                input_id: String(input.id),
                input_version: Number(input.input_version),
                dimension_code: item.dimension_code,
              };
            }),
          ),
          job.requestId,
          job.traceId,
          now,
        ],
      );
      const owned: CalculationOwnerRef[] = [["opportunity_score_runs", runId]];
      for (const item of projection.components) {
        const id = randomUUID();
        await c.query(
          "INSERT INTO opportunity_score_components (id,score_run_id,dimension_code,weight_percent,input_score,weighted_score,evidence_ids_json,missing_fields_json) VALUES (?,?,?,?,?,?,?,?)",
          [
            id,
            runId,
            item.dimension_code,
            item.weight_percent,
            item.usable ? item.input_score : null,
            item.weighted_score,
            JSON.stringify(item.evidence_ids),
            JSON.stringify(item.usable ? [] : item.missing_fields),
          ],
        );
        owned.push(["opportunity_score_components", id]);
      }
      await registerCalculationOwners(c, ownership, owned);
      const trend = available.find((item) => item.dimension_code === "market_demand"),
        competition = available.find((item) => item.dimension_code === "competition"),
        coverageStatus = complete ? "complete" : coverage >= 50 ? "partial" : "insufficient";
      await c.query(
        "UPDATE opportunities SET overall_score=?,trend_score=?,competition_score=?," +
          "recommendation_status=?,confidence_status=?,confidence_score=?,coverage_status=?," +
          "score_rule_version=?,scored_at=?,lifecycle_entered_at=IF(lifecycle_status IN " +
          "('candidate','validating'),?,lifecycle_entered_at),lifecycle_status=IF(" +
          "lifecycle_status IN ('candidate','validating'),'ready',lifecycle_status)," +
          "version=version+1,updated_at=? WHERE id=?" +
          scopeFilter,
        [
          overall,
          trend?.input_score ?? null,
          competition?.input_score ?? null,
          recommendation,
          overall == null ? "insufficient_data" : "measured",
          overall == null ? null : coverage,
          coverageStatus,
          rule.version_code,
          now,
          now,
          now,
          job.opportunityId,
          ...scopeArgs,
        ],
      );
      await c.query(
        "UPDATE opportunity_score_jobs SET status=?,lease_owner=NULL,lease_expires_at=NULL,last_error_code=NULL,updated_at=? WHERE id=? AND lease_owner=?",
        [complete ? "succeeded" : "completed_with_warnings", now, job.id, this.workerId],
      );
      await this.event(
        c,
        job,
        "opportunity.score.calculated",
        {
          score_run_id: runId,
          rule_version_code: String(rule.version_code),
          status,
          overall_score: overall,
          coverage_percent: coverage,
          recommendation_status: recommendation,
          missing_fields: missing,
        },
        now,
        ownership,
      );
      await recordSelectionPipelineCompletion(c, job, this.workerId, now, ownership);
      if (job.triggerTaskId) {
        const accountId = ownership?.owner?.account_id;
        const [tasks] = await c.query<RowDataPacket[]>(
            accountId
              ? "SELECT t.assignee_id FROM tasks t JOIN account_owned_records o " +
                  "ON o.source_table='tasks' AND o.source_id=t.id WHERE t.id=? AND o.account_id=? " +
                  "AND t.source_ref_id=? AND t.source_type='evidence_completion' " +
                  "AND t.status='completed' AND t.deleted_at IS NULL LIMIT 1"
              : "SELECT assignee_id FROM tasks WHERE id=? AND organization_id=? AND workspace_id=? " +
                  "AND source_type='evidence_completion' AND status='completed' LIMIT 1",
            accountId
              ? [job.triggerTaskId, accountId, job.opportunityId]
              : [job.triggerTaskId, job.organizationId, job.workspaceId],
          ),
          recipientId =
            ownership?.owner?.account_id ?? opportunities[0]?.owner_id ?? tasks[0]?.assignee_id;
        if (tasks[0] && recipientId) {
          const id = randomUUID();
          const [columns] = await c.query<RowDataPacket[]>(
            "SHOW COLUMNS FROM outbox_events WHERE Field IN ('organization_id','workspace_id')",
          );
          const legacy = columns.length === 2;
          if ((!legacy && columns.length !== 0) || (!legacy && !accountId))
            throw new OpportunityScoringError("score_redecision_outbox_scope_incomplete", false);
          await c.query(
            `INSERT INTO outbox_events (id,${legacy ? "organization_id,workspace_id," : ""}event_type,schema_version,` +
              "payload_json,status,attempt_count,available_at,request_id,trace_id,created_at," +
              `updated_at,version) VALUES (?,${legacy ? "?,?," : ""}'task.evidence_completion.redecision_ready',1,` +
              "?,'pending',0,?,?,?,?,?,1)",
            [
              id,
              ...(legacy ? [job.organizationId || null, job.workspaceId || null] : []),
              JSON.stringify({
                recipient_id: String(recipientId),
                resource_type: "opportunity",
                resource_id: job.opportunityId,
                opportunity_id: job.opportunityId,
                trigger_task_id: job.triggerTaskId,
                score_run_id: runId,
                ...(accountId ? { account_projection_contract: 25 } : {}),
                recommendation_status: recommendation,
                title: "机会可重新决策",
              }),
              now,
              job.requestId,
              job.traceId,
              now,
              now,
            ],
          );
          await registerCalculationOwners(c, ownership, [["outbox_events", id]]);
        }
      }
      await c.commit();
      return { coverage, complete };
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }
  private async finish(
    job: Job,
    status: "failed_terminal" | "scheduled" | "dead_letter",
    errorCode: string,
  ) {
    const now = this.now(),
      delays = [60000, 300000, 900000],
      stored = status === "scheduled" ? "retry_scheduled" : status,
      available =
        status === "scheduled"
          ? new Date(now.getTime() + delays[Math.min(job.attemptCount - 1, 2)]!)
          : now;
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const [settled] = await c.query<ResultSetHeader>(
        "UPDATE opportunity_score_jobs SET status=?,available_at=?,lease_owner=NULL,lease_expires_at=NULL,last_error_code=?,updated_at=? WHERE id=? AND lease_owner=? " +
          "AND status='leased' AND attempt_count=? AND lease_expires_at>UTC_TIMESTAMP(3)",
        [stored, available, errorCode, now, job.id, this.workerId, job.attemptCount],
      );
      if (settled.affectedRows === 1 && errorCode === "score_blocked_by_data_quality_regression")
        await this.event(
          c,
          job,
          "opportunity.score.blocked_by_data_quality",
          { job_id: job.id, error_code: errorCode },
          now,
          await resolveCalculationOwnership(c, job.opportunityId),
        );
      await c.commit();
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }
  private async event(
    c: PoolConnection,
    job: Job,
    eventType: string,
    payload: unknown,
    now: Date,
    ownership: CalculationOwnership = null,
  ) {
    const eventId = randomUUID();
    await appendOpportunityEvent(c, {
      id: eventId,
      organizationId: job.organizationId,
      workspaceId: job.workspaceId,
      eventType,
      resourceType: "opportunity",
      resourceId: job.opportunityId,
      actorType: "worker",
      actorId: this.workerId,
      requestId: job.requestId,
      traceId: job.traceId,
      payloadJson: JSON.stringify(payload),
      occurredAt: now,
    });
    await appendOpportunityOutbox(c, {
      id: eventId,
      eventId,
      organizationId: job.organizationId,
      workspaceId: job.workspaceId,
      eventType,
      resourceType: "opportunity",
      resourceId: job.opportunityId,
      payloadJson: JSON.stringify(payload),
      createdAt: now,
      requestId: job.requestId,
      traceId: job.traceId,
    });
    await registerCalculationOwners(c, ownership, [
      ["opportunity_events", eventId],
      ["opportunity_outbox", eventId],
    ]);
  }
}
