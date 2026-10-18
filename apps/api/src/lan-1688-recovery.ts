import type { PublicSourceRecoveryTarget } from "./public-rss-recovery.js";
import { pendingTaskRecoveryCandidatesSql } from "./pending-source-recovery-policy.js";

export const lan1688RecoveryCandidatesSql = pendingTaskRecoveryCandidatesSql("1688_search");
export const lan1688RecoveryTarget: PublicSourceRecoveryTarget = {
  candidatesSql: lan1688RecoveryCandidatesSql,
  parameters: (actorId, now, cooledAt) => [actorId, now, cooledAt, cooledAt],
  taskContext: false,
  idempotencyPrefix: "lan-1688-recovery",
};
