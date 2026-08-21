import { createHmac, timingSafeEqual } from "node:crypto";

export interface ReleaseRolloutRepository {
  read(input: {
    actorId: string;
    requestId: string;
    traceId: string;
    now: Date;
  }): Promise<{ releases: Array<Record<string, unknown>>; gates: Array<Record<string, unknown>> }>;
}

export interface ReleaseWriteProbeRepository {
  writeProbe(input: {
    releaseId: string;
    sampleId: string;
    buildSha: string;
    nonce: string;
    requestId: string;
    traceId: string;
    observedAt: Date;
  }): Promise<void>;
}

export interface ReleaseProbeSignatureInput {
  timestamp: number;
  nonce: string;
  requestId: string;
  traceId: string;
  releaseId: string;
  sampleId: string;
}

export class ReleaseProbeError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    readonly actionHint: string,
  ) {
    super(code);
    this.name = "ReleaseProbeError";
  }
}

export const releaseProbeCanonical = (input: ReleaseProbeSignatureInput) =>
  [input.timestamp, input.nonce, input.releaseId, input.sampleId].join("\n");
export const signReleaseProbe = (input: ReleaseProbeSignatureInput, signingKey: string) =>
  createHmac("sha256", signingKey).update(releaseProbeCanonical(input)).digest("hex");

export class ReleaseWriteProbeService {
  constructor(
    private readonly repository: ReleaseWriteProbeRepository,
    private readonly signingKey: string,
    private readonly buildSha: string,
    private readonly timestampToleranceSeconds: number,
    private readonly now = () => new Date(),
  ) {}

  async record(
    input: Omit<ReleaseProbeSignatureInput, "timestamp"> & {
      timestamp: unknown;
      signature: unknown;
    },
  ) {
    const timestamp = Number(input.timestamp),
      signature = String(input.signature ?? "");
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const auditId = (value: string) => uuid.test(value) || /^[a-f0-9]{32}$/i.test(value);
    if (
      !Number.isSafeInteger(timestamp) ||
      Math.abs(Math.floor(this.now().getTime() / 1000) - timestamp) > this.timestampToleranceSeconds
    )
      throw new ReleaseProbeError(
        "release_probe_timestamp_invalid",
        401,
        "同步宝塔任务时间后重新执行发布。",
      );
    if (
      ![input.nonce, input.releaseId, input.sampleId].every((value) => uuid.test(value)) ||
      ![input.requestId, input.traceId].every(auditId) ||
      !/^[a-f0-9]{64}$/i.test(signature)
    )
      throw new ReleaseProbeError(
        "release_probe_signature_invalid",
        401,
        "检查宝塔受限发布探针配置后重试。",
      );
    const expected = signReleaseProbe(
      {
        timestamp,
        nonce: input.nonce,
        requestId: input.requestId,
        traceId: input.traceId,
        releaseId: input.releaseId,
        sampleId: input.sampleId,
      },
      this.signingKey,
    );
    if (!timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex")))
      throw new ReleaseProbeError(
        "release_probe_signature_invalid",
        401,
        "检查宝塔受限发布探针配置后重试。",
      );
    await this.repository.writeProbe({
      releaseId: input.releaseId,
      sampleId: input.sampleId,
      buildSha: this.buildSha,
      nonce: input.nonce,
      requestId: input.requestId,
      traceId: input.traceId,
      observedAt: this.now(),
    });
    return { accepted: true as const, sample_id: input.sampleId, build_sha: this.buildSha };
  }
}

export interface ReleaseRolloutPolicy {
  percentages: number[];
  minimumObservationSeconds: number;
  maximumEvidenceAgeMinutes: number;
  errorRateStopPercent?: number;
  readP95StopMs?: number;
  writeP95StopMs?: number;
  asyncLagStopSeconds?: number;
  currentBuildSha?: string;
  currentAppVersion?: string;
  currentConfigFingerprint?: string;
  sourceLocalSha?: string;
  sourceRemoteSha?: string;
  sourceRemoteBranch?: string;
  sourceRepository?: string;
  sourceMigrationVersion?: string;
}

export class ReleaseRolloutService {
  constructor(
    private readonly repository: ReleaseRolloutRepository,
    private readonly policy: ReleaseRolloutPolicy,
    private readonly now = () => new Date(),
  ) {}

  async read(input: { actorId: string; requestId: string; traceId: string }) {
    const observedAt = this.now(),
      result = await this.repository.read({ ...input, now: observedAt }),
      historicalLatest = result.releases[0] ?? null;
    const currentBuildSha =
      this.policy.currentBuildSha ?? String(historicalLatest?.build_sha ?? "");
    const latest = result.releases.find((release) => release.build_sha === currentBuildSha) ?? null;
    const gates = latest ? result.gates.filter((gate) => gate.release_id === latest.id) : [];
    const rollback = gates.find(
      (gate) => gate.gate_kind === "rollback" && gate.status === "rolled_back",
    );
    const stopped = gates.find(
      (gate) => gate.gate_kind === "automatic_stop" && gate.status === "stopped",
    );
    const required = this.policy.percentages.map((percent) =>
      gates.find((gate) => gate.gate_kind === `canary_${percent}`),
    );
    const thresholds = {
      errorRateStopPercent: this.policy.errorRateStopPercent ?? 1,
      readP95StopMs: this.policy.readP95StopMs ?? 300,
      writeP95StopMs: this.policy.writeP95StopMs ?? 600,
      asyncLagStopSeconds: this.policy.asyncLagStopSeconds ?? 60,
    };
    const finiteMetric = (value: unknown) =>
      value !== null && value !== undefined && Number.isFinite(Number(value));
    const gatePassed = (gate: Record<string, unknown> | undefined) =>
      Boolean(
        gate &&
        gate.status === "passed" &&
        Number(gate.observe_seconds) >= this.policy.minimumObservationSeconds &&
        Number(gate.traffic_percent) > 0 &&
        Number(gate.sample_count) > 0 &&
        [
          gate.error_rate_percent,
          gate.read_p95_ms,
          gate.write_p95_ms,
          gate.async_lag_seconds,
        ].every(finiteMetric) &&
        Number(gate.error_rate_percent) < thresholds.errorRateStopPercent &&
        Number(gate.read_p95_ms) <= thresholds.readP95StopMs &&
        Number(gate.write_p95_ms) <= thresholds.writeP95StopMs &&
        Number(gate.async_lag_seconds) <= thresholds.asyncLagStopSeconds,
      );
    const allPassed =
      required.length === this.policy.percentages.length && required.every(gatePassed);
    const lastFinished = required
      .map((gate) => (gate?.finished_at ? Date.parse(String(gate.finished_at)) : Number.NaN))
      .filter(Number.isFinite)
      .sort((a, b) => b - a)[0];
    const stale =
      allPassed &&
      lastFinished !== undefined &&
      Number.isFinite(lastFinished) &&
      observedAt.getTime() - lastFinished > this.policy.maximumEvidenceAgeMinutes * 60_000;
    const identityAligned =
      Boolean(latest) &&
      (!this.policy.currentAppVersion || latest?.app_version === this.policy.currentAppVersion) &&
      (!this.policy.currentConfigFingerprint ||
        latest?.config_fingerprint === this.policy.currentConfigFingerprint) &&
      (!this.policy.sourceMigrationVersion ||
        latest?.migration_version === this.policy.sourceMigrationVersion);
    const sourceAligned = [this.policy.sourceLocalSha, this.policy.sourceRemoteSha]
      .filter(Boolean)
      .every((sha) => sha === currentBuildSha);
    const state = !historicalLatest
      ? "empty"
      : !latest || !identityAligned || !sourceAligned
        ? "blocked"
        : rollback || latest.status === "rolled_back"
          ? "rolled_back"
          : stopped || latest.status === "failed"
            ? "stopped"
            : latest.status === "healthy" && allPassed
              ? stale
                ? "stale"
                : "verified"
              : "blocked";
    return {
      state,
      policy: {
        percentages: this.policy.percentages,
        minimum_observation_seconds: this.policy.minimumObservationSeconds,
        maximum_evidence_age_minutes: this.policy.maximumEvidenceAgeMinutes,
        error_rate_stop_percent: thresholds.errorRateStopPercent,
        read_p95_stop_ms: thresholds.readP95StopMs,
        write_p95_stop_ms: thresholds.writeP95StopMs,
        async_lag_stop_seconds: thresholds.asyncLagStopSeconds,
      },
      latest_release: latest,
      latest_historical_release: historicalLatest,
      versions: {
        local: { build_sha: this.policy.sourceLocalSha ?? currentBuildSha },
        remote: {
          build_sha: this.policy.sourceRemoteSha ?? currentBuildSha,
          branch: this.policy.sourceRemoteBranch ?? null,
          repository: this.policy.sourceRepository ?? null,
        },
        production: {
          build_sha: currentBuildSha,
          app_version: this.policy.currentAppVersion ?? latest?.app_version ?? null,
          config_fingerprint:
            this.policy.currentConfigFingerprint ?? latest?.config_fingerprint ?? null,
          migration_version:
            this.policy.sourceMigrationVersion ?? latest?.migration_version ?? null,
        },
      },
      gates: gates.map(({ metadata: _metadata, ...gate }) => gate),
      automatic_stop_verified: Boolean(stopped),
      rollback_verified: Boolean(rollback),
      blockers: [
        ...(!historicalLatest || latest
          ? []
          : [
              {
                code: "current_release_evidence_missing",
                action_hint: "现有发布证据属于旧 SHA，必须由宝塔为当前运行版本重新签发。",
              },
            ]),
        ...(!latest || identityAligned
          ? []
          : [
              {
                code: "release_identity_mismatch",
                action_hint: "当前版本、配置指纹与发布证据不同源，禁止标记健康。",
              },
            ]),
        ...(sourceAligned
          ? []
          : [
              {
                code: "release_source_mismatch",
                action_hint: "发布任务记录的本地、远端与生产 SHA 不一致，禁止继续发布。",
              },
            ]),
        ...(!latest
          ? []
          : allPassed
            ? []
            : [
                {
                  code: "rollout_gates_incomplete",
                  action_hint: "由宝塔发布任务依次完成 5%、25%、100% 观察门并记录实际指标。",
                },
              ]),
        ...(!stale
          ? []
          : [
              {
                code: "rollout_evidence_stale",
                action_hint: "发布观察证据已过期，请由宝塔重新核验当前版本。",
              },
            ]),
      ],
      observed_at: observedAt.toISOString(),
    };
  }
}
