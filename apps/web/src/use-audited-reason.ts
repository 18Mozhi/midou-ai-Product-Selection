import { computed, ref } from "vue";

export interface WorkspaceRestoreReasonContext {
  name: string;
  version?: number;
  memberCount?: number;
}

interface ReasonRequest {
  title: string;
  description: string;
  initialValue: string;
  minimumLength: number;
  workspaceRestore?: WorkspaceRestoreReasonContext;
}

export function useAuditedReason() {
  const request = ref<ReasonRequest | null>(null);
  let resolveRequest: ((value: string | null) => void) | null = null;

  const open = computed(() => request.value !== null);

  function ask(input: {
    title: string;
    description?: string;
    initialValue?: string;
    minimumLength?: number;
    workspaceRestore?: WorkspaceRestoreReasonContext;
  }) {
    if (resolveRequest) resolveRequest(null);
    request.value = {
      title: input.title,
      description: input.description ?? "原因会写入审计记录。",
      initialValue: input.initialValue ?? "",
      minimumLength: input.minimumLength ?? 2,
      ...(input.workspaceRestore ? { workspaceRestore: { ...input.workspaceRestore } } : {}),
    };
    return new Promise<string | null>((resolve) => {
      resolveRequest = resolve;
    });
  }

  function finish(value: string | null) {
    const resolve = resolveRequest;
    resolveRequest = null;
    request.value = null;
    resolve?.(value);
  }

  return {
    request,
    open,
    ask,
    submit: (value: string) => finish(value),
    cancel: () => finish(null),
  };
}
