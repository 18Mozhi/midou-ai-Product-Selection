window.WORK_C_DATA = {
  version: "WORK-C-r1",
  list: {
    data: [
      {
        id: "00000000-0000-4000-8000-000000000801",
        title: "核验便携净水杯供应商报价",
        description: "对照原始证据确认 MOQ 与交期",
        status: "in_progress",
        priority: "high",
        assignee_id: "00000000-0000-4000-8000-000000000802",
        source_type: "sourcing_purchase",
        source_ref_id: "00000000-0000-4000-8000-000000000803",
        progress_percent: 35,
        progress_note: "已完成亚马逊竞品初筛",
        due_at: "2026-08-09T10:00:00.000Z",
        completed_at: null,
        sla_status: "due_soon",
        version: 2,
        created_by: "00000000-0000-4000-8000-000000000802",
        created_at: "2026-08-08T09:00:00.000Z",
        updated_at: "2026-08-08T10:00:00.000Z",
      },
      {
        id: "00000000-0000-4000-8000-000000000807",
        title: "补齐竞品价格证据",
        description: "对照原始证据确认 MOQ 与交期",
        status: "todo",
        priority: "normal",
        assignee_id: "00000000-0000-4000-8000-000000000802",
        source_type: "sourcing_purchase",
        source_ref_id: "00000000-0000-4000-8000-000000000803",
        progress_percent: 35,
        progress_note: "已完成亚马逊竞品初筛",
        due_at: null,
        completed_at: null,
        sla_status: "not_set",
        version: 1,
        created_by: "00000000-0000-4000-8000-000000000802",
        created_at: "2026-08-08T09:00:00.000Z",
        updated_at: "2026-08-08T10:00:00.000Z",
      },
    ],
    request_id: "m05-01-e2e",
    trace_id: "m05-01-trace",
    meta: {
      page: 1,
      page_size: 10,
      total: 2,
    },
  },
  summary: {
    todo: 2,
    in_progress: 1,
    paused: 0,
    completed: 4,
    cancelled: 0,
    overdue: 1,
  },
  members: [
    {
      id: "00000000-0000-4000-8000-000000000802",
      label: "测试成员",
    },
  ],
  workspace: "跨境新品工作区",
  eligibility: {
    pause: ["in_progress"],
    resume: ["paused"],
    delay: ["todo", "in_progress", "paused"],
    transfer: ["todo", "in_progress", "paused"],
    cancel: ["todo", "in_progress", "paused"],
  },
  contracts: {
    create: {
      url: "/tasks",
      method: "POST",
      body: {
        title: "复核供应商交期",
        description: "核对原始证据",
        priority: "normal",
        due_at: null,
      },
    },
    delete: {
      url: "/tasks/00000000-0000-4000-8000-000000000801",
      method: "DELETE",
      body: {
        expected_version: 2,
        reason: "核验后调整",
      },
    },
    pause: {
      url: "/tasks/00000000-0000-4000-8000-000000000801/actions",
      method: "POST",
      body: {
        action: "pause",
        expected_version: 2,
        reason: "核验后调整",
      },
    },
    resume: {
      url: "/tasks/00000000-0000-4000-8000-000000000801/actions",
      method: "POST",
      body: {
        action: "resume",
        expected_version: 2,
      },
    },
    delay: {
      url: "/tasks/00000000-0000-4000-8000-000000000801/actions",
      method: "POST",
      body: {
        action: "delay",
        expected_version: 2,
        reason: "核验后调整",
        due_at: "2026-08-10T10:00:00.000Z",
      },
    },
    transfer: {
      url: "/tasks/00000000-0000-4000-8000-000000000801/actions",
      method: "POST",
      body: {
        action: "transfer",
        expected_version: 2,
        reason: "核验后调整",
        assignee_id: "00000000-0000-4000-8000-000000000802",
      },
    },
    cancel: {
      url: "/tasks/00000000-0000-4000-8000-000000000801/actions",
      method: "POST",
      body: {
        action: "cancel",
        expected_version: 2,
        reason: "核验后调整",
      },
    },
  },
  routeCases: {
    setStatus: {
      navigation: [
        {
          query: {
            status: "paused",
            query: "报价",
            sort: "updated_desc",
            context: "review",
            create: "1",
            title: "draft",
            description: "draft",
          },
        },
      ],
      selection: [],
    },
    applyFilters: {
      navigation: [
        {
          query: {
            status: "todo",
            query: "证据",
            sort: "due_asc",
            context: "review",
            create: "1",
            title: "draft",
            description: "draft",
          },
        },
      ],
      selection: [],
    },
    resetFilters: {
      navigation: [
        {
          query: {
            context: "review",
            create: "1",
            title: "draft",
            description: "draft",
          },
        },
      ],
      selection: [],
    },
    setPage: {
      navigation: [
        {
          query: {
            status: "todo",
            query: "报价",
            sort: "updated_desc",
            page: "3",
            context: "review",
            create: "1",
            title: "draft",
            description: "draft",
          },
        },
      ],
      selection: [],
    },
    clearQuickCreate: {
      navigation: [
        {
          query: {
            status: "todo",
            query: "报价",
            sort: "updated_desc",
            page: "2",
            context: "review",
          },
        },
      ],
      selection: ["old"],
    },
  },
  boundary:
    "离线P13设计；两条任务与汇总7来自独立测试响应，不是一致数据库快照。扩展状态为明确合成布局样例；写入只记录意图，未请求API。源码VM和SQL构造检查不等于Vue、真实数据库或生产验收。",
};
