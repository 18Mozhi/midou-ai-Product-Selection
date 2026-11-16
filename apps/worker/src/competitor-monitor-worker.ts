import { randomUUID } from "node:crypto";
import {
  appendCompetitorEvent,
  appendCompetitorOutbox,
  hasLegacyCompetitorRuleScope,
} from "@scoutops/database";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { queueOwnedSelectionEvaluation } from "./account-evaluation-enqueue.js";
import { queueAutomaticSelectionEvaluation } from "./automatic-selection-evaluation-worker.js";
import { nativeCompetitorStorage } from "./competitor-storage.js";
import { nativeOpportunityStorage } from "./opportunity-storage.js";
import {
  calculationOwnersMatch,
  registerCalculationOwners,
  resolveCalculationOwnership,
  type CalculationOwnerRef,
} from "./opportunity-calculation-ownership.js";
type JobScope = { accountId: string } | { organizationId: string; workspaceId: string };
type Job = JobScope & {
  id: string;
  competitorId: string;
  snapshotId: string;
  requestId: string;
  traceId: string;
  attemptCount: number;
};
export class CompetitorMonitorError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(code);
  }
}
export class MySqlCompetitorMonitorWorker {
  constructor(
    private readonly pool: Pool,
    private readonly workerId: string,
    private readonly leaseSeconds: number,
    private readonly now = () => new Date(),
  ) {}
  async processOnce() {
    const job = await this.claim();
    if (!job) return { status: "idle" as const };
    try {
      const result = await this.compare(job);
      return { status: "succeeded" as const, job_id: job.id, ...result };
    } catch (e) {
      const error =
        e instanceof CompetitorMonitorError
          ? e
          : new CompetitorMonitorError("competitor_monitor_internal_error", true);
      const status = !error.retryable
        ? "failed_terminal"
        : job.attemptCount >= 4
          ? "dead_letter"
          : "scheduled";
      await this.finish(job, status, error.code);
      return { status, job_id: job.id, error_code: error.code };
    }
  }
  private async claim(): Promise<Job | null> {
    const c = await this.pool.getConnection(),
      now = this.now(),
      expires = new Date(now.getTime() + this.leaseSeconds * 1000);
    try {
      await c.beginTransaction();
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT * FROM competitor_snapshot_jobs WHERE status IN ('queued','retry_scheduled','leased') AND available_at<=? AND (lease_expires_at IS NULL OR lease_expires_at<=?) ORDER BY created_at,id LIMIT 1 FOR UPDATE",
        [now, now],
      );
      const r = rows[0];
      if (!r) {
        await c.commit();
        return null;
      }
      const native = await nativeCompetitorStorage(c);
      const [[parent]] = await c.query<RowDataPacket[]>(
        `SELECT ${native ? "account_id" : "organization_id,workspace_id"} FROM competitors WHERE id=?`,
        [r.competitor_id],
      );
      if (!parent) throw new Error("competitor_snapshot_jobs_parent_missing");
      await c.query(
        "UPDATE competitor_snapshot_jobs SET status='leased',attempt_count=attempt_count+1,lease_owner=?,lease_expires_at=?,updated_at=? WHERE id=?",
        [this.workerId, expires, now, r.id],
      );
      await c.commit();
      return {
        id: String(r.id),
        ...(native
          ? { accountId: String(parent.account_id) }
          : {
              organizationId: String(parent.organization_id),
              workspaceId: String(parent.workspace_id),
            }),
        competitorId: String(r.competitor_id),
        snapshotId: String(r.snapshot_id),
        requestId: String(r.request_id),
        traceId: String(r.trace_id),
        attemptCount: Number(r.attempt_count) + 1,
      };
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  private async compare(job: Job) {
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      const legacyCoordinates =
        "organizationId" in job
          ? { organizationId: job.organizationId, workspaceId: job.workspaceId }
          : {};
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT c.latest_snapshot_id,c.opportunity_id,s.* FROM competitors c JOIN competitor_snapshots s ON s.id=? AND s.competitor_id=c.id WHERE c.id=? AND " +
          ("accountId" in job ? "c.account_id=?" : "c.organization_id=? AND c.workspace_id=?") +
          " FOR UPDATE",
        [
          job.snapshotId,
          job.competitorId,
          ...("accountId" in job ? [job.accountId] : [job.organizationId, job.workspaceId]),
        ],
      );
      const current = rows[0];
      if (!current) throw new CompetitorMonitorError("competitor_snapshot_missing", false);
      const ownership = await resolveCalculationOwnership(c, job.competitorId, "competitors");
      if ("accountId" in job && ownership?.owner?.account_id !== job.accountId)
        throw new CompetitorMonitorError("competitor_snapshot_owner_mismatch", false);
      const [lease] = await c.query<RowDataPacket[]>(
        "SELECT id FROM competitor_snapshot_jobs WHERE id=? AND competitor_id=? AND snapshot_id=? " +
          "AND status='leased' AND lease_owner=? AND attempt_count=? AND lease_expires_at>? FOR UPDATE",
        [job.id, job.competitorId, job.snapshotId, this.workerId, job.attemptCount, now],
      );
      if (!lease[0]) throw new CompetitorMonitorError("competitor_snapshot_lease_lost", true);
      if (ownership) {
        if (
          !(await calculationOwnersMatch(c, ownership, [
            ["competitor_snapshot_jobs", job.id],
            ["competitor_snapshots", job.snapshotId],
            ["raw_evidence", String(current.evidence_id)],
            ...(current.opportunity_id
              ? [["opportunities", String(current.opportunity_id)] as const]
              : []),
          ]))
        )
          throw new CompetitorMonitorError("competitor_snapshot_owner_mismatch", false);
      }
      if ("accountId" in job && !(await this.snapshotEvidenceMatches(c, current, job.accountId)))
        throw new CompetitorMonitorError("competitor_snapshot_owner_mismatch", false);
      let previous: RowDataPacket | undefined;
      if (current.latest_snapshot_id && String(current.latest_snapshot_id) !== job.snapshotId) {
        const [p] = await c.query<RowDataPacket[]>(
          "SELECT * FROM competitor_snapshots WHERE id=? AND competitor_id=? LOCK IN SHARE MODE",
          [current.latest_snapshot_id, job.competitorId],
        );
        previous = p[0];
        if (
          ownership &&
          (!previous ||
            !(await calculationOwnersMatch(c, ownership, [
              ["competitor_snapshots", String(previous.id)],
              ["raw_evidence", String(previous.evidence_id)],
            ])))
        )
          throw new CompetitorMonitorError("competitor_previous_snapshot_owner_mismatch", false);
        if (
          "accountId" in job &&
          previous &&
          !(await this.snapshotEvidenceMatches(c, previous, job.accountId))
        )
          throw new CompetitorMonitorError("competitor_previous_snapshot_owner_mismatch", false);
      }
      const capturedAt = new Date(current.captured_at).getTime(),
        previousAt = previous ? new Date(previous.captured_at).getTime() : null;
      // Delayed or replayed jobs must not move the current product backwards.
      // Equal timestamps use the same deterministic ID order as evidence reads.
      if (
        String(current.latest_snapshot_id) === job.snapshotId ||
        (previous &&
          previousAt !== null &&
          (capturedAt < previousAt ||
            (capturedAt === previousAt && job.snapshotId <= String(previous.id))))
      ) {
        await this.completeLeasedJob(c, job);
        await c.commit();
        return { change_count: 0 };
      }
      const changes: Record<string, { old: string; now: string }> = {};
      const owned: CalculationOwnerRef[] = [];
      const owner = ownership?.owner;
      const nativeOpportunity =
        !!owner && !!current.opportunity_id && (await nativeOpportunityStorage(c));
      if (owner && nativeOpportunity) {
        const [[linked]] = await c.query<RowDataPacket[]>(
          "SELECT id FROM opportunities WHERE id=? AND account_id=? LOCK IN SHARE MODE",
          [current.opportunity_id, owner.account_id],
        );
        if (!linked) throw new CompetitorMonitorError("competitor_snapshot_owner_mismatch", false);
      }
      const legacyRuleScope = owner || (await hasLegacyCompetitorRuleScope(c));
      if (!legacyRuleScope && !ownership)
        throw new CompetitorMonitorError("competitor_rule_ownership_not_ready", false);
      if (previous) {
        for (const field of [
          "current_price",
          "rank_value",
          "review_count",
          "rating_value",
          "availability",
        ]) {
          const old = String(previous[field]),
            value = String(current[field]);
          if (old !== value) changes[field] = { old, now: value };
        }
      }
      for (const [field, value] of Object.entries(changes)) {
        const changeId = randomUUID(),
          impact = this.impact(field, value.old, value.now);
        await c.query(
          "INSERT INTO competitor_changes (id,competitor_id,snapshot_id,field_name,previous_value,current_value,changed_at,evidence_id,impact_explanation,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
          [
            changeId,
            job.competitorId,
            job.snapshotId,
            field,
            value.old,
            value.now,
            current.captured_at,
            current.evidence_id,
            impact,
            now,
          ],
        );
        owned.push(["competitor_changes", changeId]);
        const [rules] = !legacyRuleScope
          ? [[]]
          : await c.query<RowDataPacket[]>(
              owner
                ? "SELECT r.* FROM competitor_monitor_rules r JOIN account_owned_records ao " +
                    "ON ao.source_table='competitor_monitor_rules' AND ao.source_id=r.id " +
                    "WHERE ao.account_id=? AND r.status='enabled' AND (r.competitor_id IS NULL OR r.competitor_id=?) AND r.metric=? LOCK IN SHARE MODE"
                : "SELECT * FROM competitor_monitor_rules WHERE organization_id=? AND workspace_id=? AND status='enabled' AND (competitor_id IS NULL OR competitor_id=?) AND metric=?" +
                    (ownership
                      ? " AND NOT EXISTS (SELECT 1 FROM account_owned_records ao WHERE ao.source_table='competitor_monitor_rules' AND ao.source_id=competitor_monitor_rules.id)"
                      : ""),
              owner
                ? [owner.account_id, job.competitorId, this.metric(field)]
                : [
                    legacyCoordinates.organizationId,
                    legacyCoordinates.workspaceId,
                    job.competitorId,
                    this.metric(field),
                  ],
            );
        for (const rule of rules)
          if (this.trigger(rule, value.old, value.now)) {
            const alertId = randomUUID(),
              payload = {
                competitor_id: job.competitorId,
                change_id: changeId,
                rule_id: String(rule.id),
                field,
                previous: value.old,
                current: value.now,
                changed_at: iso(current.captured_at),
                evidence_id: String(current.evidence_id),
                impact_explanation: impact,
                ...(owner ? { account_projection_contract: 25 } : {}),
              };
            await c.query(
              "INSERT INTO competitor_alerts (id,competitor_id,change_id,rule_id,notification_status,task_status,payload_json,created_at,updated_at) VALUES (?,?,?,?,'queued','queued',?,?,?)",
              [alertId, job.competitorId, changeId, rule.id, JSON.stringify(payload), now, now],
            );
            await appendCompetitorOutbox(c, {
              id: alertId,
              ...legacyCoordinates,
              parentId: job.competitorId,
              eventType: "competitor.threshold.triggered",
              payloadJson: JSON.stringify(payload),
              createdAt: now,
            });
            owned.push(["competitor_alerts", alertId], ["competitor_outbox", alertId]);
          }
      }
      await c.query("UPDATE competitors SET latest_snapshot_id=?,updated_at=? WHERE id=?", [
        job.snapshotId,
        now,
        job.competitorId,
      ]);
      if (current.opportunity_id) {
        if (owner)
          await queueOwnedSelectionEvaluation(
            c,
            String(current.opportunity_id),
            owner.account_id,
            nativeOpportunity,
            now,
          );
        else if ("organizationId" in job)
          await queueAutomaticSelectionEvaluation(c, {
            organizationId: job.organizationId,
            workspaceId: job.workspaceId,
            opportunityId: String(current.opportunity_id),
            now,
          });
      }
      const eventId = randomUUID();
      await appendCompetitorEvent(c, {
        id: eventId,
        ...legacyCoordinates,
        parentId: job.competitorId,
        eventType: "competitor.snapshot.compared",
        actorId: this.workerId,
        payloadJson: JSON.stringify({
          snapshot_id: job.snapshotId,
          change_count: Object.keys(changes).length,
        }),
        requestId: job.requestId,
        traceId: job.traceId,
        createdAt: now,
      });
      owned.push(["competitor_events", eventId]);
      await registerCalculationOwners(c, ownership, owned);
      await this.completeLeasedJob(c, job);
      await c.commit();
      return { change_count: Object.keys(changes).length };
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  private async snapshotEvidenceMatches(
    c: PoolConnection,
    snapshot: RowDataPacket,
    accountId: string,
  ) {
    const [[raw]] = await c.query<RowDataPacket[]>(
      "SELECT id FROM raw_evidence WHERE id=? AND provider_id=? AND account_id=? LOCK IN SHARE MODE",
      [snapshot.evidence_id, snapshot.provider_id, accountId],
    );
    return Boolean(raw);
  }
  private async completeLeasedJob(c: PoolConnection, job: Job) {
    const now = this.now();
    const [result] = await c.query<ResultSetHeader>(
      "UPDATE competitor_snapshot_jobs SET status='succeeded',lease_owner=NULL,lease_expires_at=NULL,last_error_code=NULL,updated_at=? " +
        "WHERE id=? AND status='leased' AND lease_owner=? AND attempt_count=? AND lease_expires_at>?",
      [now, job.id, this.workerId, job.attemptCount, now],
    );
    if (result.affectedRows !== 1)
      throw new CompetitorMonitorError("competitor_snapshot_lease_lost", true);
  }
  private metric(field: string) {
    return field === "current_price" ? "price" : field === "rank_value" ? "rank" : field;
  }
  private trigger(r: RowDataPacket, old: string, value: string) {
    if (r.metric === "availability")
      return r.direction === "change"
        ? old !== value
        : old !== "out_of_stock" && value === "out_of_stock";
    const delta = Number(value) - Number(old),
      threshold = Number(r.threshold_value);
    if (r.direction === "increase") return delta >= threshold;
    if (r.direction === "decrease") return -delta >= threshold;
    return Math.abs(delta) >= threshold;
  }
  private impact(field: string, old: string, value: string) {
    const label: Record<string, string> = {
      current_price: "价格",
      rank_value: "排名",
      review_count: "评论数",
      rating_value: "评分",
      availability: "库存",
    };
    return `${label[field] ?? field}由 ${old} 变为 ${value}；请结合来源证据复核影响。`;
  }
  private async finish(
    job: Job,
    status: "failed_terminal" | "dead_letter" | "scheduled",
    code: string,
  ) {
    const now = this.now(),
      stored = status === "scheduled" ? "retry_scheduled" : status,
      delay = [60000, 300000, 900000][Math.min(job.attemptCount - 1, 2)]!,
      available = status === "scheduled" ? new Date(now.getTime() + delay) : now;
    await this.pool.query(
      "UPDATE competitor_snapshot_jobs SET status=?,available_at=?,lease_owner=NULL,lease_expires_at=NULL,last_error_code=?,updated_at=? " +
        "WHERE id=? AND status='leased' AND lease_owner=? AND attempt_count=? AND lease_expires_at>?",
      [stored, available, code, now, job.id, this.workerId, job.attemptCount, now],
    );
  }
}
const iso = (v: unknown) => (v instanceof Date ? v : new Date(String(v))).toISOString();
