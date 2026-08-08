import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export type TrendProjectionResult = { status: 'idle' } | { status: 'succeeded' | 'succeeded_empty' | 'failed_terminal' | 'scheduled' | 'dead_letter'; job_id: string; topic_id?: string; error_code?: string; diagnostic?: string };
interface ClaimedJob { id: string; organizationId: string; workspaceId: string; normalizedRecordId: string; providerId: string; providerCode: string; rawEvidenceId: string; payload: Record<string, unknown>; actorId: string; requestId: string; traceId: string; attemptCount: number }

export function normalizeProjectedTrendTitle(value: unknown) {
  if (typeof value !== 'string' || !value.trim() || value.length > 1000) throw new TrendProjectionError('trend_title_invalid', false);
  return value.trim().normalize('NFKC').toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
}

export class TrendProjectionError extends Error {
  constructor(readonly code: string, readonly retryable: boolean) { super(code); this.name = 'TrendProjectionError'; }
}

const text = (value: unknown, code: string, maximum: number) => {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) throw new TrendProjectionError(code, false);
  return value.trim();
};
const date = (value: unknown, code: string) => { const result = new Date(text(value, code, 120)); if (!Number.isFinite(result.getTime())) throw new TrendProjectionError(code, false); return result; };
const http = (value: unknown) => { const raw = text(value, 'trend_url_invalid', 2048); let result: URL; try { result = new URL(raw); } catch { throw new TrendProjectionError('trend_url_invalid', false); } if (!['http:', 'https:'].includes(result.protocol) || result.username || result.password || result.hash) throw new TrendProjectionError('trend_url_invalid', false); return result.toString(); };

export class MySqlTrendProjectionWorker {
  constructor(private readonly pool: Pool, private readonly workerId: string, private readonly leaseSeconds: number, private readonly now: () => Date = () => new Date()) {}

  async processOnce(): Promise<TrendProjectionResult> {
    await this.enqueueMissing();
    const job = await this.claim();
    if (!job) return { status: 'idle' };
    if (job.providerCode !== 'google_news_search') { await this.finish(job, 'succeeded_empty', null); return { status: 'succeeded_empty', job_id: job.id }; }
    try {
      const topicId = await this.project(job);
      return { status: 'succeeded', job_id: job.id, topic_id: topicId };
    } catch (error) {
      const dependencyCode = typeof (error as { code?: unknown })?.code === 'string' ? `trend_projection_${(error as { code: string }).code.toLocaleLowerCase('en-US')}` : 'trend_projection_dependency_failed';
      const failure = error instanceof TrendProjectionError ? error : new TrendProjectionError(dependencyCode, true);
      const status = !failure.retryable ? 'failed_terminal' : job.attemptCount >= 4 ? 'dead_letter' : 'scheduled';
      await this.finish(job, status, failure.code);
      return { status, job_id: job.id, error_code: failure.code, ...(process.env.NODE_ENV === 'production' ? {} : { diagnostic: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }) };
    }
  }

  private async enqueueMissing() {
    const now = this.now();
    await this.pool.query("INSERT IGNORE INTO trend_projection_jobs (id,organization_id,workspace_id,normalized_record_id,status,attempt_count,available_at,lease_owner,lease_expires_at,last_error_code,request_id,trace_id,created_at,updated_at) SELECT UUID(),n.organization_id,n.workspace_id,n.id,'scheduled',0,?,NULL,NULL,NULL,n.request_id,n.trace_id,?,? FROM normalized_records n LEFT JOIN trend_projection_jobs j ON j.normalized_record_id=n.id WHERE n.status='active' AND j.id IS NULL ORDER BY n.created_at LIMIT 100", [now, now, now]);
  }

  private async claim(): Promise<ClaimedJob | null> {
    const c = await this.pool.getConnection(), now = this.now(), expires = new Date(now.getTime() + this.leaseSeconds * 1000);
    try {
      await c.beginTransaction();
      const [jobs] = await c.query<RowDataPacket[]>("SELECT * FROM trend_projection_jobs WHERE (status='scheduled' AND available_at<=?) OR (status='leased' AND lease_expires_at<=?) ORDER BY available_at,id LIMIT 1 FOR UPDATE", [now, now]);
      if (!jobs[0]) { await c.commit(); return null; }
      const row = jobs[0];
      await c.query("UPDATE trend_projection_jobs SET status='leased',attempt_count=attempt_count+1,lease_owner=?,lease_expires_at=?,updated_at=? WHERE id=?", [this.workerId, expires, now, row.id]);
      const [records] = await c.query<RowDataPacket[]>('SELECT n.organization_id,n.workspace_id,n.provider_id,n.raw_evidence_id,n.payload_json,n.created_by,n.request_id,n.trace_id,p.code provider_code FROM normalized_records n JOIN providers p ON p.id=n.provider_id WHERE n.id=? AND n.organization_id=? AND n.workspace_id=? LIMIT 1', [row.normalized_record_id, row.organization_id, row.workspace_id]);
      if (!records[0]) throw new TrendProjectionError('trend_projection_record_missing', false);
      const record = records[0];
      await c.commit();
      return { id: String(row.id), organizationId: String(row.organization_id), workspaceId: String(row.workspace_id), normalizedRecordId: String(row.normalized_record_id), providerId: String(record.provider_id), providerCode: String(record.provider_code), rawEvidenceId: String(record.raw_evidence_id), payload: typeof record.payload_json === 'string' ? JSON.parse(record.payload_json) : record.payload_json, actorId: String(record.created_by), requestId: String(record.request_id), traceId: String(record.trace_id), attemptCount: Number(row.attempt_count) + 1 };
    } catch (error) { await c.rollback(); throw error; } finally { c.release(); }
  }

  private async project(job: ClaimedJob) {
    const title = text(job.payload.title, 'trend_title_invalid', 1000), normalizedTitle = normalizeProjectedTrendTitle(title), publisher = text(job.payload.publisher, 'trend_publisher_invalid', 300), canonicalUrl = http(job.payload.canonical_url), publishedAt = date(job.payload.published_at, 'trend_published_at_invalid'), observedAt = date(job.payload.observed_at, 'trend_observed_at_invalid');
    const topicKey = createHash('sha256').update(normalizedTitle).digest('hex'), now = this.now(), c = await this.pool.getConnection(); let stage = 'begin';
    try {
      await c.beginTransaction();
      stage = 'topic_lookup';
      const [topics] = await c.query<RowDataPacket[]>('SELECT id FROM trend_topics WHERE organization_id=? AND workspace_id=? AND topic_key=? FOR UPDATE', [job.organizationId, job.workspaceId, topicKey]);
      const topicId = topics[0] ? String(topics[0].id) : randomUUID();
      if (!topics[0]) { stage = 'topic_insert'; await c.query("INSERT INTO trend_topics (id,organization_id,workspace_id,topic_key,title,category,market,language,status,signal_count,source_count,heat_value,heat_unit,momentum_percent,confidence_score,confidence_status,first_seen_at,last_seen_at,source_fresh_at,version,created_by,created_at,updated_at) VALUES (?,?,?,?,?,NULL,'US','en-US','active',0,0,0,'signals',NULL,NULL,'insufficient_data',?,?,?,1,?,?,?)", [topicId, job.organizationId, job.workspaceId, topicKey, title, publishedAt, publishedAt, observedAt, job.actorId, now, now]); }
      stage = 'signal_insert';
      const [insert] = await c.query<ResultSetHeader>('INSERT IGNORE INTO trend_signals (id,organization_id,workspace_id,topic_id,normalized_record_id,raw_evidence_id,provider_id,title,publisher,canonical_url,published_at,observed_at,request_id,trace_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [randomUUID(), job.organizationId, job.workspaceId, topicId, job.normalizedRecordId, job.rawEvidenceId, job.providerId, title, publisher, canonicalUrl, publishedAt, observedAt, job.requestId, job.traceId, now]);
      if (insert.affectedRows) {
        stage = 'topic_aggregate';
        await c.query("UPDATE trend_topics t SET signal_count=(SELECT COUNT(*) FROM trend_signals s WHERE s.topic_id=t.id),source_count=(SELECT COUNT(DISTINCT provider_id) FROM trend_signals s WHERE s.topic_id=t.id),heat_value=(SELECT COUNT(*) FROM trend_signals s WHERE s.topic_id=t.id),first_seen_at=(SELECT MIN(published_at) FROM trend_signals s WHERE s.topic_id=t.id),last_seen_at=(SELECT MAX(published_at) FROM trend_signals s WHERE s.topic_id=t.id),source_fresh_at=GREATEST(source_fresh_at,?),version=version+1,updated_at=? WHERE t.id=?", [observedAt, now, topicId]);
        stage = 'keyword_insert';
        await c.query("INSERT IGNORE INTO trend_topic_keywords (id,organization_id,workspace_id,topic_id,keyword,keyword_type,language,market,created_at) VALUES (?,?,?,?,?,'primary','en-US','US',?)", [randomUUID(), job.organizationId, job.workspaceId, topicId, normalizedTitle.slice(0, 300), now]);
        stage = 'event_insert';
        await this.event(c, job, 'trend.topic.projected', 'trend_topic', topicId, { normalized_record_id: job.normalizedRecordId, heat_unit: 'signals' });
      }
      stage = 'job_complete';
      await c.query("UPDATE trend_projection_jobs SET status='succeeded',lease_owner=NULL,lease_expires_at=NULL,last_error_code=NULL,updated_at=? WHERE id=? AND status='leased' AND lease_owner=?", [now, job.id, this.workerId]);
      await c.commit(); return topicId;
    } catch (error) { await c.rollback(); if (error instanceof TrendProjectionError) throw error; const wrapped = new Error(`${stage}: ${error instanceof Error ? error.message : 'unknown'}`) as Error & { code?: string }; const code = (error as { code?: string })?.code; if (code) wrapped.code = code; throw wrapped; } finally { c.release(); }
  }

  private async finish(job: ClaimedJob, status: 'succeeded_empty' | 'failed_terminal' | 'scheduled' | 'dead_letter', errorCode: string | null) {
    const now = this.now(), retryDelays = [60_000, 300_000, 900_000] as const, available = status === 'scheduled' ? new Date(now.getTime() + retryDelays[Math.min(job.attemptCount - 1, 2)]!) : now;
    await this.pool.query('UPDATE trend_projection_jobs SET status=?,available_at=?,lease_owner=NULL,lease_expires_at=NULL,last_error_code=?,updated_at=? WHERE id=? AND lease_owner=?', [status, available, errorCode, now, job.id, this.workerId]);
  }

  private async event(c: PoolConnection, job: ClaimedJob, eventType: string, resourceType: string, resourceId: string, payload: unknown) {
    const now = this.now(), eventId = randomUUID();
    await c.query("INSERT INTO trend_events (id,organization_id,workspace_id,event_type,resource_type,resource_id,actor_type,actor_id,request_id,trace_id,payload_json,occurred_at) VALUES (?,?,?,?,?,?,'worker',?,?,?,?,?)", [eventId, job.organizationId, job.workspaceId, eventType, resourceType, resourceId, this.workerId, job.requestId, job.traceId, JSON.stringify(payload), now]);
    await c.query("INSERT INTO trend_outbox (id,organization_id,workspace_id,event_type,resource_type,resource_id,payload_json,status,attempt_count,available_at,request_id,trace_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'queued',0,?,?,?,?,?)", [eventId, job.organizationId, job.workspaceId, eventType, resourceType, resourceId, JSON.stringify(payload), now, job.requestId, job.traceId, now, now]);
  }
}
