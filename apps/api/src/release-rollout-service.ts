export interface ReleaseRolloutRepository {
  read(input: { actorId: string; requestId: string; traceId: string; now: Date }): Promise<{ releases: Array<Record<string, unknown>>; gates: Array<Record<string, unknown>> }>;
}

export interface ReleaseRolloutPolicy {
  percentages: number[];
  minimumObservationSeconds: number;
  maximumEvidenceAgeMinutes: number;
  errorRateStopPercent?: number;
  readP95StopMs?: number;
  writeP95StopMs?: number;
  asyncLagStopSeconds?: number;
}

export class ReleaseRolloutService {
  constructor(private readonly repository: ReleaseRolloutRepository, private readonly policy: ReleaseRolloutPolicy, private readonly now = () => new Date()) {}

  async read(input: { actorId: string; requestId: string; traceId: string }) {
    const observedAt = this.now(), result = await this.repository.read({ ...input, now: observedAt }), latest = result.releases[0] ?? null;
    const gates = latest ? result.gates.filter((gate) => gate.release_id === latest.id) : [];
    const rollback = gates.find((gate) => gate.gate_kind === "rollback" && gate.status === "rolled_back");
    const stopped = gates.find((gate) => gate.gate_kind === "automatic_stop" && gate.status === "stopped");
    const required = this.policy.percentages.map((percent) => gates.find((gate) => gate.gate_kind === `canary_${percent}`));
    const thresholds = {
      errorRateStopPercent: this.policy.errorRateStopPercent ?? 1,
      readP95StopMs: this.policy.readP95StopMs ?? 300,
      writeP95StopMs: this.policy.writeP95StopMs ?? 600,
      asyncLagStopSeconds: this.policy.asyncLagStopSeconds ?? 60,
    };
    const finiteMetric = (value: unknown) => value !== null && value !== undefined && Number.isFinite(Number(value));
    const gatePassed = (gate: Record<string, unknown> | undefined) => Boolean(gate
      && gate.status === "passed"
      && Number(gate.observe_seconds) >= this.policy.minimumObservationSeconds
      && Number(gate.traffic_percent) > 0
      && Number(gate.sample_count) > 0
      && [gate.error_rate_percent, gate.read_p95_ms, gate.write_p95_ms, gate.async_lag_seconds].every(finiteMetric)
      && Number(gate.error_rate_percent) < thresholds.errorRateStopPercent
      && Number(gate.read_p95_ms) <= thresholds.readP95StopMs
      && Number(gate.write_p95_ms) <= thresholds.writeP95StopMs
      && Number(gate.async_lag_seconds) <= thresholds.asyncLagStopSeconds);
    const allPassed = required.length === this.policy.percentages.length && required.every(gatePassed);
    const lastFinished = required.map((gate) => gate?.finished_at ? Date.parse(String(gate.finished_at)) : Number.NaN).filter(Number.isFinite).sort((a, b) => b - a)[0];
    const stale = allPassed && lastFinished !== undefined && Number.isFinite(lastFinished) && observedAt.getTime() - lastFinished > this.policy.maximumEvidenceAgeMinutes * 60_000;
    const state = !latest ? "empty" : rollback || latest.status === "rolled_back" ? "rolled_back" : stopped || latest.status === "failed" ? "stopped" : latest.status === "healthy" && allPassed ? stale ? "stale" : "verified" : "blocked";
    return {
      state,
      policy: { percentages: this.policy.percentages, minimum_observation_seconds: this.policy.minimumObservationSeconds, maximum_evidence_age_minutes: this.policy.maximumEvidenceAgeMinutes, error_rate_stop_percent: thresholds.errorRateStopPercent, read_p95_stop_ms: thresholds.readP95StopMs, write_p95_stop_ms: thresholds.writeP95StopMs, async_lag_stop_seconds: thresholds.asyncLagStopSeconds },
      latest_release: latest,
      gates: gates.map(({ metadata: _metadata, ...gate }) => gate),
      automatic_stop_verified: Boolean(stopped),
      rollback_verified: Boolean(rollback),
      blockers: [
        ...(!latest ? [] : allPassed ? [] : [{ code: "rollout_gates_incomplete", action_hint: "由宝塔发布任务依次完成 5%、25%、100% 观察门并记录实际指标。" }]),
        ...(!stale ? [] : [{ code: "rollout_evidence_stale", action_hint: "发布观察证据已过期，请由宝塔重新核验当前版本。" }]),
      ],
      observed_at: observedAt.toISOString(),
    };
  }
}
