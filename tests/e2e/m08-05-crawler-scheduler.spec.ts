import { expect, test, type Page } from "@playwright/test";
import { expectAboveMobileNavigation, markOcclusionProbe } from "./helpers/mobile-occlusion";
const envelope = (data: unknown) => ({ data, request_id: "m08-05-e2e", trace_id: "m08-05-e2e" }),
  base = {
    state: "ready",
    topology: {
      mode: "single_host",
      worker_instances: 1,
      crawler_instances: 1,
      maximum_workers: 1,
      maximum_crawlers: 1,
    },
    leases: { active_worker: 0, active_crawler: 0, duplicate_count: 0 },
    expired_leases: {
      total: 3,
      task_count: 1,
      worker: 1,
      crawler: 1,
      provider: 1,
      oldest_expired_at: "2026-08-15T07:55:00.000Z",
    },
    active_leases: [],
    providers: [
      {
        id: "00000000-0000-4000-8000-000000000851",
        code: "google_news_search",
        configured_concurrency: 3,
        effective_concurrency: 1,
        active_leases: 0,
        queued_tasks: 3,
        longest_queue_wait_seconds: 180,
        queue_wait_p50_seconds: 45,
        queue_wait_p95_seconds: 125,
        sample_count_24h: 20,
        success_rate_basis_points_24h: 9500,
        duration_p95_ms_24h: 1800,
        circuit_state: "closed",
        circuit_failure_threshold: 5,
        consecutive_failures: 0,
        last_error_code: null,
      },
      {
        id: "00000000-0000-4000-8000-000000000852",
        code: "authorized_market",
        configured_concurrency: 1,
        effective_concurrency: 1,
        active_leases: 0,
        queued_tasks: 0,
        longest_queue_wait_seconds: 0,
        queue_wait_p50_seconds: 0,
        queue_wait_p95_seconds: 0,
        sample_count_24h: 0,
        success_rate_basis_points_24h: null,
        duration_p95_ms_24h: null,
        circuit_state: "closed",
        circuit_failure_threshold: 5,
        consecutive_failures: 0,
        last_error_code: null,
      },
    ],
    profiles: [{ id: "00000000-0000-4000-8000-000000000853", active_leases: 0 }],
    trend: [],
    resource: {
      load_basis_points: 3240,
      available_memory_mb: 6144,
      free_disk_mb: 245760,
      observed_at: "2026-08-15T08:00:00.000Z",
    },
    findings: [],
    observed_at: "2026-08-15T08:00:00.000Z",
    capacity_claim: "unverified",
  };
async function navigation(page: Page) {
  await page.route("**/api/v1/me/navigation?shell=platform_admin", (route) =>
    route.fulfill({
      json: envelope({
        shell: "platform_admin",
        organization_id: null,
        workspace_id: null,
        roles: [],
        capabilities: [],
        platform_roles: ["platform_operations_admin"],
        platform_capabilities: ["platform:operate"],
        guard_reason: "allowed",
      }),
    }),
  );
}
test.beforeEach(async ({ page }) => navigation(page));
test("M08-05.A07/A08/A15 desktop and 390 single-host scheduler truth", async ({ page }) => {
  await page.route("**/api/v1/platform/operations/crawler-scheduler", (route) =>
    route.fulfill({ json: envelope(base) }),
  );
  await page.goto("/platform-admin/crawler-scheduler");
  await expect(page.getByRole("heading", { level: 1, name: "采集调度核验" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "当前采集调度门满足" })).toBeVisible();
  await expect(page.getByText("当前采集调度门满足")).toBeVisible();
  await expect(page.getByText("1 / 1")).toHaveCount(2);
  await expect(page.getByText("待领取 3 · 最老 3 分钟")).toBeVisible();
  await expect(page.getByLabel("运行范围")).toHaveValue("attention");
  await expect(page.getByText("共 1 个来源")).toBeVisible();
  await expect(page.getByRole("heading", { name: "来源并发与排队" })).toBeVisible();
  await expect(page.getByText("最长等待已高于近 24 小时 P95，存在饥饿风险")).toBeVisible();
  await page.getByRole("button", { name: "回收过期租约" }).click();
  await expect(page.getByRole("heading", { name: "回收过期调度租约？" })).toBeVisible();
  await expect(page.getByText(/将回收 3 个过期槽位.*Worker 1.*Crawler 1.*来源 1/)).toBeVisible();
  await expect(page.getByText(/关联 1 个采集任务/)).toBeVisible();
  await page.getByRole("button", { name: "取消" }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(
    page.getByText("Worker 与 Python Crawler 各一个实例；来源有效并发固定为1。", { exact: true }),
  ).toBeVisible();
});
test("SC70 health link reaches the registered adapter route without running a health check", async ({
  page,
}) => {
  const methods: string[] = [];
  await page.route("**/api/v1/me/navigation?shell=platform_admin", (route) =>
    route.fulfill({
      json: envelope({
        shell: "platform_admin",
        organization_id: null,
        workspace_id: null,
        roles: [],
        capabilities: [],
        platform_roles: ["platform_operations_admin", "platform_super_admin"],
        platform_capabilities: ["platform:operate", "platform:superadmin"],
        guard_reason: "allowed",
      }),
    }),
  );
  const attention = {
    ...base,
    providers: [
      {
        ...base.providers[0],
        circuit_state: "open" as const,
        consecutive_failures: 5,
        last_error_code: "provider_probe_failed",
      },
    ],
  };
  await page.route("**/api/v1/platform/operations/crawler-scheduler", (route) =>
    route.fulfill({ json: envelope(attention) }),
  );
  await page.route("**/api/v1/platform/provider-adapters**", (route) => {
    methods.push(route.request().method());
    return route.fulfill({ json: envelope([]) });
  });

  await page.goto("/platform-admin/crawler-scheduler");
  const link = page.getByRole("link", { name: "前往来源健康" });
  await expect(link).toHaveAttribute(
    "href",
    "/platform-admin/providers/adapters?provider_id=00000000-0000-4000-8000-000000000851",
  );
  await link.click();
  await expect(page).toHaveURL(
    /\/platform-admin\/providers\/adapters\?provider_id=00000000-0000-4000-8000-000000000851$/,
  );
  await expect(
    page.getByText("健康检查只验证当前探针，不代表采集成功，也不会自动解除来源暂停。", {
      exact: true,
    }),
  ).toBeVisible();
  expect(methods).toEqual(["GET"]);
});
test("M08-05.A08/A09/A16 warning blocked empty forbidden expired rate limited and unavailable", async ({
  page,
}) => {
  let status = 200,
    response: unknown = {
      ...base,
      state: "warning",
      findings: [
        { code: "crawler_resource_warning", severity: "warning", action_hint: "持续观察。" },
      ],
    };
  await page.route("**/api/v1/platform/operations/crawler-scheduler", (route) =>
    status === 200
      ? route.fulfill({ json: envelope(response) })
      : route.fulfill({
          status,
          json: {
            error: { action_hint: "按权限或频率门恢复。" },
            request_id: "m08-05-state",
            trace_id: "m08-05-state",
          },
        }),
  );
  await page.goto("/platform-admin/crawler-scheduler");
  await expect(page.getByText("当前调度需要关注")).toBeVisible();
  response = {
    ...base,
    state: "blocked",
    findings: [
      { code: "crawler_lease_duplicate", severity: "blocked", action_hint: "通过宝塔回收。" },
    ],
  };
  await page.reload();
  await expect(page.getByText("当前采集调度门阻断")).toBeVisible();
  response = null;
  await page.reload();
  await expect(page.getByText("尚无调度观测")).toBeVisible();
  for (const [next, label] of [
    [403, "没有平台运维权限"],
    [401, "登录已失效"],
    [429, "刷新过于频繁"],
    [503, "采集调度事实暂不可用"],
  ] as const) {
    status = next;
    await page.reload();
    await expect(page.getByText(label)).toBeVisible();
  }
});

test("UI2-SC70 hidden recovering query reads real facts without starting recovery", async ({
  page,
}) => {
  const methods: string[] = [];
  await page.route("**/api/v1/platform/operations/crawler-scheduler**", (route) => {
    methods.push(route.request().method());
    return route.fulfill({ json: envelope(base) });
  });
  await page.goto("/platform-admin/crawler-scheduler?state=recovering");
  await expect(page.getByText("当前采集调度门满足", { exact: true })).toBeVisible();
  await expect(page.getByText("正在回收过期租约", { exact: true })).toHaveCount(0);
  expect(methods).toEqual(["GET"]);
});

test("M08-05 active lease links process role and collection task without exposing technical IDs by default", async ({
  page,
}) => {
  const taskId = "00000000-0000-4000-8000-000000000861";
  await page.route("**/api/v1/platform/operations/crawler-scheduler", (route) =>
    route.fulfill({
      json: envelope({
        ...base,
        active_leases: [
          {
            slot_type: "provider",
            provider_name: "Google 新闻检索",
            task_id: taskId,
            task_status: "running",
            run_id: null,
            process_role: "node_worker",
            process_ref: "worker-main",
            heartbeat_at: "2026-08-15T08:00:00.000Z",
            expires_at: "2026-08-15T08:01:00.000Z",
          },
        ],
      }),
    }),
  );
  await page.goto("/platform-admin/crawler-scheduler");
  await expect(page.getByRole("heading", { name: "活动租约与进程" })).toBeVisible();
  await expect(page.getByText("Node Worker", { exact: true })).toBeVisible();
  await expect(page.getByText("Google 新闻检索")).toBeVisible();
  await expect(page.getByText(/采集任务：执行中/)).toBeVisible();
  await expect(page.getByText(`任务 UUID ${taskId}`)).toBeHidden();
  await page.getByText("查看技术详情").click();
  await expect(page.getByText(`任务 UUID ${taskId}`)).toBeVisible();
  await expect(page.getByText("进程标识 worker-main")).toBeVisible();
});

test("M08-05 mobile bottom navigation does not cover the scheduler handoff", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/v1/platform/operations/crawler-scheduler", (route) =>
    route.fulfill({ json: envelope(base) }),
  );
  await page.goto("/platform-admin/crawler-scheduler");
  const handoff = page.locator(".crawler-scheduler footer");
  await markOcclusionProbe(handoff);
  await expectAboveMobileNavigation(page, handoff);
});

test("M08-05 refresh is single-flight and keeps the last verified snapshot on failure", async ({
  page,
}) => {
  let reads = 0;
  await page.route("**/api/v1/platform/operations/crawler-scheduler", async (route) => {
    reads += 1;
    if (reads === 1) await route.fulfill({ json: envelope(base) });
    else
      await route.fulfill({
        status: 503,
        json: {
          error: {
            code: "crawler_scheduler_dependency_unavailable",
            action_hint: "在宝塔检查 Node API 与 MySQL 后重新核验。",
          },
          request_id: "m08-05-refresh-failed",
          trace_id: "m08-05-refresh-failed",
        },
      });
  });
  await page.goto("/platform-admin/crawler-scheduler");
  const refresh = page.getByRole("button", { name: "刷新运行事实" });
  await refresh.click();
  await expect(page.getByRole("button", { name: "正在刷新…" })).toBeDisabled();
  await expect(page.getByText("当前采集调度门满足")).toBeVisible();
  await expect(page.getByText("刷新未完成")).toBeVisible();
  await expect(page.getByText(/已保留上次成功的采集调度事实/)).toBeVisible();
  expect(reads).toBe(4);
});

test("P70 cancels an interrupted read while cached away and resumes it once", async ({ page }) => {
  let calls = 0;
  let releaseInterruptedRead: (() => void) | undefined;
  let cancelledRead = false;
  page.on("requestfailed", (request) => {
    if (request.url().includes("/api/v1/platform/operations/crawler-scheduler"))
      cancelledRead = true;
  });
  await page.route("**/api/v1/platform/operations/crawler-scheduler", async (route) => {
    calls += 1;
    if (calls === 1) {
      await new Promise<void>((resolve) => (releaseInterruptedRead = resolve));
      try {
        await route.fulfill({ json: envelope(base) });
      } catch {
        // The browser has already cancelled this deactivated page's read.
      }
      return;
    }
    await route.fulfill({ json: envelope(base) });
  });
  await page.route("**/api/v1/platform/operations/topology", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: { code: "topology_fixture_unavailable", action_hint: "本地隔离页面。" },
        request_id: "p70-topology-navigation",
        trace_id: "p70-topology-navigation",
      },
    }),
  );

  try {
    await page.goto("/platform-admin/crawler-scheduler");
    await expect.poll(() => calls).toBe(1);

    const operationsNav = page.getByRole("navigation", { name: "系统运维二级导航" });
    await operationsNav.getByRole("link", { name: "服务拓扑" }).click();
    await expect(page).toHaveURL(/\/platform-admin\/topology$/);
    await expect.poll(() => cancelledRead).toBe(true);

    await page.goBack();
    await expect(page).toHaveURL(/\/platform-admin\/crawler-scheduler$/);
    await expect(page.getByRole("heading", { name: "当前采集调度门满足" })).toBeVisible();
    expect(calls).toBe(2);

    await operationsNav.getByRole("link", { name: "服务拓扑" }).click();
    await expect(page).toHaveURL(/\/platform-admin\/topology$/);
    await page.goBack();
    await expect(page.getByRole("heading", { name: "当前采集调度门满足" })).toBeVisible();
    expect(calls).toBe(2);
  } finally {
    releaseInterruptedRead?.();
  }
});

test("P70 defers the existing post-write read when recovery finishes while cached away", async ({
  page,
}) => {
  let reads = 0;
  let recoveryStarted: (() => void) | undefined;
  let releaseRecovery: (() => void) | undefined;
  const posts: Array<{ body: unknown; idempotencyKey: string | undefined }> = [];
  page.on("requestfinished", (request) => {
    if (request.url().includes("/api/v1/platform/operations/crawler-scheduler/recover-expired"))
      recoveryStarted?.();
  });
  await page.route("**/api/v1/platform/operations/crawler-scheduler", (route) => {
    reads += 1;
    return route.fulfill({ json: envelope(base) });
  });
  await page.route(
    "**/api/v1/platform/operations/crawler-scheduler/recover-expired",
    async (route) => {
      posts.push({
        body: route.request().postDataJSON(),
        idempotencyKey: route.request().headers()["idempotency-key"],
      });
      await new Promise<void>((resolve) => (releaseRecovery = resolve));
      await route.fulfill({ json: envelope({ recovered: 0 }) });
    },
  );
  await page.route("**/api/v1/platform/operations/topology", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: { code: "topology_fixture_unavailable", action_hint: "本地隔离页面。" },
        request_id: "p70-topology-navigation",
        trace_id: "p70-topology-navigation",
      },
    }),
  );

  try {
    await page.goto("/platform-admin/crawler-scheduler");
    await expect(page.getByRole("heading", { name: "当前采集调度门满足" })).toBeVisible();
    await page.getByRole("button", { name: "回收过期租约" }).click();
    const dialog = page.getByRole("alertdialog", { name: "回收过期调度租约？" });
    await dialog.getByRole("textbox", { name: "输入 确认回收 继续" }).fill("确认回收");
    await dialog.getByRole("button", { name: "确认回收" }).click();
    await expect.poll(() => posts.length).toBe(1);

    const operationsNav = page.getByRole("navigation", { name: "系统运维二级导航" });
    await operationsNav.getByRole("link", { name: "服务拓扑" }).click();
    await expect(page).toHaveURL(/\/platform-admin\/topology$/);
    let postFinished: (() => void) | undefined;
    const finished = new Promise<void>((resolve) => (postFinished = resolve));
    recoveryStarted = () => postFinished?.();
    releaseRecovery?.();
    await finished;
    await expect.poll(() => reads).toBe(1);

    await page.goBack();
    await expect(page.getByRole("heading", { name: "当前采集调度门满足" })).toBeVisible();
    await expect(page.getByText("已回收 0 个过期调度槽位")).toBeVisible();
    expect(reads).toBe(2);
    expect(posts).toHaveLength(1);
    expect(posts[0]).toEqual({ body: {}, idempotencyKey: expect.any(String) });
  } finally {
    releaseRecovery?.();
  }
});

test("M08-05 recovery success remains visible when the follow-up read fails", async ({ page }) => {
  let reads = 0,
    recoveryCalls = 0;
  await page.route("**/api/v1/platform/operations/crawler-scheduler", async (route) => {
    reads += 1;
    if (reads === 1) await route.fulfill({ json: envelope(base) });
    else
      await route.fulfill({
        status: 503,
        json: {
          error: { action_hint: "重新核验调度事实。" },
          request_id: "m08-05-after-recovery",
          trace_id: "m08-05-after-recovery",
        },
      });
  });
  await page.route(
    "**/api/v1/platform/operations/crawler-scheduler/recover-expired",
    async (route) => {
      recoveryCalls += 1;
      await route.fulfill({ json: envelope({ recovered: 3 }) });
    },
  );
  await page.goto("/platform-admin/crawler-scheduler");
  await page.getByRole("button", { name: "回收过期租约" }).click();
  await page.getByRole("textbox", { name: "输入 确认回收 继续" }).fill("确认回收");
  await page.getByRole("button", { name: "确认回收" }).click();
  await expect(page.getByText("已回收 3 个过期调度槽位")).toBeVisible();
  await expect(page.getByText("刷新未完成")).toBeVisible();
  await expect(page.getByText("当前采集调度门满足")).toBeVisible();
  expect(recoveryCalls).toBe(1);
});

test("P70 recovery POST 401/403 clears the protected snapshot and keeps the access result", async ({
  page,
}) => {
  let postStatus = 401;
  const providerId = base.providers[0].id;
  await page.route("**/api/v1/platform/operations/crawler-scheduler**", async (route) => {
    if (route.request().method() === "POST")
      return route.fulfill({
        status: postStatus,
        json: {
          error: {
            code: postStatus === 401 ? "session_expired" : "platform_forbidden",
            action_hint: "请重新核验当前账号权限。",
          },
          request_id: `p70-access-${postStatus}`,
          trace_id: `p70-access-${postStatus}`,
        },
      });
    return route.fulfill({
      json: envelope({
        ...base,
        providers: [
          {
            ...base.providers[0],
            circuit_state: "open",
            consecutive_failures: 5,
            last_error_code: "provider_probe_failed",
          },
          base.providers[1],
        ],
      }),
    });
  });

  for (const statusCode of [401, 403]) {
    for (const flow of ["expired", "provider"] as const) {
      postStatus = statusCode;
      await page.goto("/platform-admin/crawler-scheduler");
      await expect(page.getByText("当前采集调度门满足", { exact: true })).toBeVisible();
      if (flow === "expired") {
        await page.getByRole("button", { name: "回收过期租约" }).click();
        const dialog = page.getByRole("alertdialog", { name: "回收过期调度租约？" });
        await dialog.getByRole("textbox", { name: "输入 确认回收 继续" }).fill("确认回收");
        await dialog.getByRole("button", { name: "确认回收" }).click();
      } else {
        await page.getByRole("button", { name: "解除熔断" }).click();
        const dialog = page.getByRole("alertdialog", { name: "解除该来源的运行熔断？" });
        await dialog.getByRole("textbox", { name: "输入 确认解除 继续" }).fill("确认解除");
        await dialog.getByRole("button", { name: "确认解除" }).click();
      }
      await expect(page.getByText("当前采集调度门满足", { exact: true })).toHaveCount(0);
      await expect(page.getByText("请重新核验当前账号权限。")).toBeVisible();
      await expect(
        page.getByText(statusCode === 401 ? "登录已失效" : "没有平台运维权限", { exact: true }),
      ).toBeVisible();
      await expect(page.getByText(providerId)).toHaveCount(0);
    }
  }
});

test("SC70 provider recovery confirmation identifies the exact source before its existing write", async ({
  page,
}) => {
  const providerId = base.providers[0].id;
  let recovered = false;
  const posts: Array<{ body: unknown; idempotencyKey: string | undefined }> = [];
  await page.route("**/api/v1/platform/operations/crawler-scheduler**", async (route) => {
    if (route.request().method() === "POST") {
      posts.push({
        body: route.request().postDataJSON(),
        idempotencyKey: route.request().headers()["idempotency-key"],
      });
      recovered = true;
      return route.fulfill({
        json: envelope({ provider_id: providerId, recovered: true }),
      });
    }
    return route.fulfill({
      json: envelope({
        ...base,
        providers: [
          {
            ...base.providers[0],
            circuit_state: (recovered ? "closed" : "open") as "closed" | "open",
            consecutive_failures: recovered ? 0 : 5,
            last_error_code: recovered ? null : "provider_probe_failed",
          },
        ],
      }),
    });
  });

  await page.goto("/platform-admin/crawler-scheduler");
  await page.getByRole("button", { name: "解除熔断" }).click();
  const dialog = page.getByRole("alertdialog", { name: "解除该来源的运行熔断？" });
  await expect(dialog).toContainText("来源：google_news_search");
  await expect(dialog).toContainText(providerId);
  await page.getByRole("button", { name: "取消" }).click();
  await expect(dialog).toHaveCount(0);
  expect(posts).toHaveLength(0);

  await page.getByRole("button", { name: "解除熔断" }).click();
  const reopenedDialog = page.getByRole("alertdialog", { name: "解除该来源的运行熔断？" });
  await reopenedDialog.getByRole("textbox", { name: "输入 确认解除 继续" }).fill("确认解除");
  await reopenedDialog.getByRole("button", { name: "确认解除" }).click();
  await expect(page.getByText("已解除 google_news_search 的来源级熔断")).toBeVisible();
  await expect(reopenedDialog).toHaveCount(0);
  expect(posts).toHaveLength(1);
  expect(posts[0]).toEqual({ body: {}, idempotencyKey: expect.any(String) });
  expect(posts[0]?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/i);
});
