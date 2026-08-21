import { computed, ref } from "vue";

interface ReasonRequest {
  title: string;
  description: string;
  initialValue: string;
  minimumLength: number;
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
  }) {
    if (resolveRequest) resolveRequest(null);
    request.value = {
      title: input.title,
      description: input.description ?? "原因会写入审计记录。",
      initialValue: input.initialValue ?? "",
      minimumLength: input.minimumLength ?? 2,
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
