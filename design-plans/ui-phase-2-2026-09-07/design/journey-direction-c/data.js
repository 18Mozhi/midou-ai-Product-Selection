window.JOURNEY_C_DATA = {
  version: "JOURNEY-C-r1",
  sample: {
    id: "00000000-0000-4000-8000-000000007601",
    organization_id: "00000000-0000-4000-8000-000000007602",
    workspace_id: "00000000-0000-4000-8000-000000007603",
    input_kind: "keyword",
    input_value: "portable blender",
    provider_code: "google_news_search",
    task_id: "00000000-0000-4000-8000-000000007604",
    task_status: "succeeded",
    state: "result_ready",
    coverage_status: "partial",
    available_result_count: 2,
    results: [
      {
        raw_evidence_id: "00000000-0000-4000-8000-000000007611",
        title: "隔离候选 1",
        publisher: "隔离来源",
        canonical_url: "https://example.test/candidate-1",
        observed_at: "2026-08-10T12:00:00.000Z",
        topic_id: null,
      },
      {
        raw_evidence_id: "00000000-0000-4000-8000-000000007612",
        title: "隔离候选 2",
        publisher: "隔离来源",
        canonical_url: "https://example.test/candidate-2",
        observed_at: "2026-08-10T12:00:00.000Z",
        topic_id: "00000000-0000-4000-8000-000000007620",
      },
    ],
    first_result: null,
    blocked_reason: null,
    blocked_owner: null,
    blocked_next_step: null,
    timeline: [
      {
        stage: "queued",
        status: "completed",
        occurred_at: "2026-08-10T12:00:00.000Z",
      },
      {
        stage: "collecting",
        status: "completed",
        occurred_at: "2026-08-10T12:00:00.000Z",
      },
      {
        stage: "parsing",
        status: "completed",
        occurred_at: "2026-08-10T12:00:00.000Z",
      },
      {
        stage: "decision",
        status: "active",
        occurred_at: "2026-08-10T12:00:00.000Z",
      },
    ],
    decision: null,
    opportunity_id: null,
    verification_task_id: null,
    accepted_at: "2026-08-10T12:00:00.000Z",
    terminal_at: "2026-08-10T12:00:00.000Z",
    decided_at: null,
    elapsed_ms: 12000,
    deadline_ms: 180000,
    within_deadline: true,
    request_id: "ui2-journey-request",
    trace_id: "ui2-journey-trace",
  },
  defaults: {
    form: {
      input_kind: "keyword",
      input_value: "",
    },
    decision: {
      action: "observe",
      reason: "",
    },
  },
  values: {
    keyword: " portable blender ",
    asin: "b012345678",
    product_url: "https://example.test/product",
  },
  createIntents: {
    keyword: {
      path: "/selection-journeys",
      method: "POST",
      body: {
        input_kind: "keyword",
        input_value: " portable blender ",
      },
    },
    asin: {
      path: "/selection-journeys",
      method: "POST",
      body: {
        input_kind: "asin",
        input_value: "b012345678",
      },
    },
    product_url: {
      path: "/selection-journeys",
      method: "POST",
      body: {
        input_kind: "product_url",
        input_value: "https://example.test/product",
      },
    },
  },
  decisionIntents: {
    adopt: {
      path: "/selection-journeys/00000000-0000-4000-8000-000000007601/decisions",
      method: "POST",
      body: {
        action: "adopt",
        reason: "  核对来源后继续验证  ",
        selected_raw_evidence_id: "00000000-0000-4000-8000-000000007612",
      },
    },
    observe: {
      path: "/selection-journeys/00000000-0000-4000-8000-000000007601/decisions",
      method: "POST",
      body: {
        action: "observe",
        reason: "  核对来源后继续验证  ",
        selected_raw_evidence_id: null,
      },
    },
    reject: {
      path: "/selection-journeys/00000000-0000-4000-8000-000000007601/decisions",
      method: "POST",
      body: {
        action: "reject",
        reason: "  核对来源后继续验证  ",
        selected_raw_evidence_id: null,
      },
    },
  },
  taskTerminal: [
    "succeeded",
    "succeeded_empty",
    "completed_with_warnings",
    "failed_terminal",
    "dead_letter",
    "blocked_login",
    "blocked_captcha",
    "blocked_robots",
    "permission_denied",
  ],
  urlErrors: [
    {
      input_value: "http://example.test/product",
      code: "selection_product_url_invalid",
      status: 400,
      hint: "输入不含账号、密码或片段的 HTTPS 商品链接。",
    },
    {
      input_value: "https://example.test/product#fragment",
      code: "selection_product_url_invalid",
      status: 400,
      hint: "输入不含账号、密码或片段的 HTTPS 商品链接。",
    },
    {
      input_value: "https://user@example.test/product",
      code: "selection_product_url_invalid",
      status: 400,
      hint: "输入不含账号、密码或片段的 HTTPS 商品链接。",
    },
  ],
  knownGaps: {
    decideSuccessState: "error",
    resetReason: "旧旅程原因",
    adoption:
      "Current repository directly writes adopted; P18 five-gate contract conflicts. Awaiting user decision; prototype adoption is explicitly unavailable pending that decision.",
    sourceFixed: false,
  },
  boundary:
    "Historical isolated UI2-J fixture. Source functions executed in VM; no actual Vue, backend calls, storage, database or production acceptance.",
};
