// Synthetic process-local repository facts, served by the actual authenticated Fastify route.
export function collectionConsoleHttpFacts(input) {
  const provider = "00000000-0000-4000-8000-000000000630";
  return {
    filters: {
      organization_id: input.organizationId,
      workspace_id: input.workspaceId,
      provider_id: input.providerId,
      window: input.window,
      error_code: input.errorCode,
    },
    source_options: [{ id: provider, code: "http-rss", name: "HTTP 验证公开趋势 RSS" }],
    sources: [
      {
        id: provider,
        code: "http-rss",
        name: "HTTP 验证公开趋势 RSS",
        status: "enabled",
        owner_label: "本地验证",
        schedule_minutes: 60,
        concurrency_limit: 1,
        parser_version: "test-only",
        health_status: "ready",
        last_checked_at: "2026-08-08T12:00:00Z",
        last_latency_ms: 80,
        last_error_code: null,
        consecutive_failures: 0,
      },
    ],
    task_states: [
      { status: "running", total: 2 },
      { status: "dead_letter", total: 1 },
    ],
    quality: [{ severity: "warning", status: "open", total: 3 }],
    attempts: [],
    dead_letters: [],
    root_causes: [{ error_code: "parser_failed", total: 1, latest_at: "2026-08-08T11:00:00Z" }],
    pagination: {
      attempts: { page: input.attemptPage, page_size: 50, total: 0, total_pages: 1 },
      dead_letters: { page: input.deadLetterPage, page_size: 50, total: 0, total_pages: 1 },
    },
    links: {
      provider_registry: "/platform-admin/providers",
      task_monitor: "/platform-admin/collection",
    },
    observed_at: "2026-08-08T12:00:00Z",
  };
}
