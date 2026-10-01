import type { Ref } from "vue";

interface OpportunityWorkspaceWriteScopeOptions {
  opportunityId: () => string | undefined;
  workspaceActive: () => boolean;
  busy: Ref<boolean>;
}

export function useOpportunityWorkspaceWriteScopes(options: OpportunityWorkspaceWriteScopeOptions) {
  const { opportunityId, workspaceActive, busy } = options;
  const activeWriteCounts = new Map<string, number>();

  function writeScopeKey(targetOpportunityId = opportunityId()) {
    return targetOpportunityId ? `opportunity:${targetOpportunityId}` : "opportunity-list";
  }

  function beginScopedWrite(scopeKey: string) {
    activeWriteCounts.set(scopeKey, (activeWriteCounts.get(scopeKey) ?? 0) + 1);
    if (workspaceActive() && scopeKey === writeScopeKey()) busy.value = true;
  }

  function finishScopedWrite(scopeKey: string) {
    const remaining = Math.max(0, (activeWriteCounts.get(scopeKey) ?? 0) - 1);
    if (remaining) activeWriteCounts.set(scopeKey, remaining);
    else activeWriteCounts.delete(scopeKey);
    if (workspaceActive() && scopeKey === writeScopeKey()) busy.value = remaining > 0;
  }

  function pendingWriteCount(scopeKey = writeScopeKey()) {
    return activeWriteCounts.get(scopeKey) ?? 0;
  }

  return { writeScopeKey, beginScopedWrite, finishScopedWrite, pendingWriteCount };
}
