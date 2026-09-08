window.NOTIFICATION_C_DATA = {
  version: "NOTIFICATION-C-r1",
  list: {
    data: [
      {
        id: "00000000-0000-4000-8000-000000000931",
        category: "approval",
        severity: "warning",
        title: "审批状态更新",
        body: "approval.overdue 已产生新的可审计事件。",
        resource_type: "approval_request",
        resource_id: "00000000-0000-4000-8000-000000000932",
        root_cause_key: "approval.overdue:approval_request:00000000-0000-4000-8000-000000000932",
        workflow_status: "open",
        action_route: "/tasks/approvals?approval=00000000-0000-4000-8000-000000000932",
        group_count: 3,
        read_at: "2026-08-08T10:01:00.000Z",
        version: 1,
        created_at: "2026-08-08T10:00:00.000Z",
      },
    ],
    request_id: "m05-03-e2e",
    trace_id: "m05-03-trace",
    meta: {
      page: 1,
      page_size: 100,
      total: 1,
    },
  },
  summary: {
    total: 3,
    unread: 0,
    task: 1,
    approval: 2,
    competitor: 0,
    system: 0,
    open: 3,
    in_progress: 0,
    closed: 0,
  },
  preferences: {
    in_app_enabled: true,
    email_enabled: false,
    task_enabled: true,
    approval_enabled: true,
    competitor_enabled: true,
    version: 1,
  },
  contracts: {
    read: {
      url: "/notifications/00000000-0000-4000-8000-000000000931/actions",
      method: "POST",
      body: {
        action: "read",
        expected_version: 1,
      },
    },
    start: {
      url: "/notifications/00000000-0000-4000-8000-000000000931/actions",
      method: "POST",
      body: {
        action: "start",
        expected_version: 1,
      },
    },
    close: {
      url: "/notifications/00000000-0000-4000-8000-000000000931/actions",
      method: "POST",
      body: {
        action: "close",
        expected_version: 1,
      },
    },
    reopen: {
      url: "/notifications/00000000-0000-4000-8000-000000000931/actions",
      method: "POST",
      body: {
        action: "reopen",
        expected_version: 1,
      },
    },
    markAll: {
      url: "/notifications/actions",
      method: "POST",
    },
    preferences: {
      url: "/me/notification-preferences",
      method: "PUT",
      body: {
        in_app_enabled: true,
        email_enabled: false,
        task_enabled: true,
        approval_enabled: true,
        competitor_enabled: true,
        version: 1,
        expected_version: 1,
      },
    },
  },
  routeCases: {
    category: {
      category: "task",
      status: "open",
      context: "review",
    },
    workflow: {
      category: "approval",
      status: "in_progress",
      context: "review",
    },
    unread: {
      category: "approval",
      status: "open",
      context: "review",
      unread: "1",
    },
    page: {
      category: "approval",
      status: "open",
      page: "3",
      context: "review",
    },
  },
  sourceRoutes: [
    {
      target: "/tasks/approvals?approval=00000000-0000-4000-8000-000000000932",
      allowed: true,
      route: "/tasks/approvals?approval=00000000-0000-4000-8000-000000000932&from=undefined",
    },
    {
      target: "/tasks/example",
      allowed: true,
      route: "/tasks/example?from=undefined",
    },
    {
      target: "",
      allowed: false,
      route: "/notifications",
    },
    {
      target: "//outside.invalid",
      allowed: false,
      route: "/notifications",
    },
    {
      target: "https://outside.invalid",
      allowed: false,
      route: "/notifications",
    },
  ],
  displayBody: "审批状态已变化，请查看关联记录。",
  realtime: {
    opens: 1,
    fallback: 1,
    loads: 2,
    cursor: "43",
  },
  boundary:
    "P26离线设计。原始夹具为列表1组/同根因3条，汇总任务1审批2，分页meta为100而Vue请求20；不把独立响应拼成真实数据库快照。扩展状态明确标合成，写入只记意图。源码VM、SQL构造和原型检查不代表真实Vue/API/MySQL/SSE或生产验收。",
};
