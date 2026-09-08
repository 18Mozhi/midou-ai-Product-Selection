window.RECOVERY_C_DATA = {
  version: "RECOVERY-C-r1",
  kinds: ["loading", "empty", "error", "forbidden", "expired", "blocked", "recovery", "not_found"],
  copy: {
    loading: {
      eyebrow: "LOADING",
      title: "正在读取真实数据",
      description: "请求完成前不显示旧数据或推测结果。",
      primary: "请稍候",
    },
    empty: {
      eyebrow: "EMPTY",
      title: "这里还没有内容",
      description: "当前范围内没有结果；可调整条件或执行明确的首次操作。",
      primary: "开始创建",
      secondary: "调整筛选",
    },
    error: {
      eyebrow: "ERROR",
      title: "操作未完成",
      description: "请求失败且没有写入成功；请按提示重试。",
      primary: "重新尝试",
      secondary: "返回上一页",
    },
    forbidden: {
      eyebrow: "PERMISSION",
      title: "你没有此项权限",
      description: "服务端已拒绝访问；页面不会展示受限数据。",
      primary: "返回工作台",
      secondary: "申请权限",
    },
    expired: {
      eyebrow: "SESSION",
      title: "登录已失效",
      description: "重新登录后再继续，未提交的敏感操作不会自动重放。",
      primary: "重新登录",
    },
    blocked: {
      eyebrow: "BLOCKED",
      title: "依赖暂时受阻",
      description: "请求因限流、超时或依赖不可用而停止；不会伪装为成功。",
      primary: "稍后重试",
      secondary: "查看影响",
    },
    recovery: {
      eyebrow: "RECOVERED",
      title: "服务已恢复",
      description: "最新检查已通过；后续数据仍以服务端时间和来源为准。",
      primary: "继续",
    },
    not_found: {
      eyebrow: "404 / LOST IN SIGNAL",
      title: "没有找到这个页面",
      description: "地址可能已变更，或该入口不属于当前角色。",
      primary: "返回今日行动",
      secondary: "返回上一页",
    },
  },
  labels: {
    loading: "加载",
    empty: "空结果",
    error: "错误",
    forbidden: "无权限",
    expired: "已过期",
    blocked: "受阻",
    recovery: "已恢复",
    not_found: "404",
  },
  actions: {
    loading: {},
    empty: {
      primary: {
        kind: "empty",
        message: "已触发首次操作示例；展示页没有业务接口，因此未执行写入。",
        navigation: [],
      },
      secondary: {
        kind: "empty",
        message: "已触发调整筛选示例；展示页没有真实筛选条件。",
        navigation: [],
      },
    },
    error: {
      primary: {
        kind: "recovery",
        message: "已触发重试示例并进入恢复状态；没有调用业务接口。",
        navigation: [
          {
            query: {
              state: "recovery",
              context: "review",
            },
          },
        ],
      },
      secondary: {
        kind: "empty",
        message: "已返回空结果示例。",
        navigation: [
          {
            query: {
              state: "empty",
              context: "review",
            },
          },
        ],
      },
    },
    forbidden: {
      primary: {
        kind: "forbidden",
        message: "",
        navigation: ["/home"],
      },
      secondary: {
        kind: "forbidden",
        message: "权限申请必须由所属业务页发起；展示页不会伪造申请成功。",
        navigation: [],
      },
    },
    expired: {
      primary: {
        kind: "expired",
        message: "",
        navigation: ["/login"],
      },
    },
    blocked: {
      primary: {
        kind: "recovery",
        message: "已触发重试示例并进入恢复状态；没有调用业务接口。",
        navigation: [
          {
            query: {
              state: "recovery",
              context: "review",
            },
          },
        ],
      },
      secondary: {
        kind: "blocked",
        message: "影响范围：当前请求因限流、超时或依赖不可用而停止，没有写入成功。",
        navigation: [],
      },
    },
    recovery: {
      primary: {
        kind: "empty",
        message: "已从恢复状态继续到空结果示例。",
        navigation: [
          {
            query: {
              state: "empty",
              context: "review",
            },
          },
        ],
      },
    },
    not_found: {
      primary: {
        kind: "not_found",
        message: "",
        navigation: ["/home"],
      },
      secondary: {
        kind: "not_found",
        message: "",
        navigation: ["/home"],
      },
    },
  },
  selfReturn: {
    kind: "empty",
    message: "最近有效页面就是当前展示页，已返回空结果示例。",
    navigation: [
      {
        query: {
          state: "empty",
          context: "review",
        },
      },
    ],
  },
  selectCases: [
    {
      value: "error",
      initial: false,
      navigation: [],
    },
    {
      value: "empty",
      initial: false,
      navigation: [
        {
          query: {
            state: "error",
            context: "review",
          },
        },
      ],
    },
    {
      value: ["error", "blocked"],
      initial: false,
      navigation: [
        {
          query: {
            state: "error",
            context: "review",
          },
        },
      ],
    },
    {
      value: "error",
      initial: true,
      navigation: [],
    },
  ],
  confirmations: [
    {
      acknowledged: false,
      typedText: "",
      enabled: false,
    },
    {
      acknowledged: true,
      typedText: "",
      enabled: false,
    },
    {
      acknowledged: false,
      typedText: "确认撤销",
      enabled: false,
    },
    {
      acknowledged: true,
      typedText: "确认删除",
      enabled: false,
    },
    {
      acknowledged: true,
      typedText: "  确认撤销  ",
      enabled: true,
    },
  ],
  correlations: [
    {
      input: "m02-04-request",
      output: "m02-04-request",
    },
    {
      input: "m02-04-trace",
      output: "m02-04-trace",
    },
    {
      input:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      output:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    },
    {
      input:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      output: "",
    },
    {
      input: "<script>",
      output: "",
    },
    {
      input: "token=value",
      output: "",
    },
    {
      input: null,
      output: "",
    },
  ],
  notFound: {
    home: {
      input: {
        stored: null,
        path: "/catalog/deleted-entry",
      },
      requestedPath: "/catalog/deleted-entry",
      recent: {
        fullPath: "/home",
        path: "/home",
        title: "今日行动",
      },
      distinct: false,
    },
    recent: {
      input: {
        stored: "/tasks?status=active&filter=qa-only",
        path: "/unknown/recent-return",
      },
      requestedPath: "/unknown/recent-return",
      recent: {
        fullPath: "/tasks?status=active&filter=qa-only",
        path: "/tasks",
        title: "全部任务",
      },
      distinct: true,
    },
    "home-query": {
      input: {
        stored: "/home?section=review",
        path: "/unknown/home-query",
      },
      requestedPath: "/unknown/home-query",
      recent: {
        fullPath: "/home?section=review",
        path: "/home",
        title: "今日行动",
      },
      distinct: false,
    },
    retired: {
      input: {
        stored: "/retired/module?filter=stale",
        path: "/unknown/retired-return",
      },
      requestedPath: "/unknown/retired-return",
      recent: {
        fullPath: "/home",
        path: "/home",
        title: "今日行动",
      },
      distinct: false,
    },
    external: {
      input: {
        stored: "https://example.invalid/private",
        path: "/unknown/external",
      },
      requestedPath: "/unknown/external",
      recent: {
        fullPath: "/home",
        path: "/home",
        title: "今日行动",
      },
      distinct: false,
    },
    protocol: {
      input: {
        stored: "//example.invalid/private",
        path: "/unknown/protocol",
      },
      requestedPath: "/unknown/protocol",
      recent: {
        fullPath: "/home",
        path: "/home",
        title: "今日行动",
      },
      distinct: false,
    },
    "storage-error": {
      input: {
        stored: null,
        path: "/unknown/storage",
        storageError: true,
      },
      requestedPath: "/unknown/storage",
      recent: {
        fullPath: "/home",
        path: "/home",
        title: "今日行动",
      },
      distinct: false,
    },
    long: {
      input: {
        stored: "/tasks?status=active",
        path: "/missing/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      },
      requestedPath:
        "/missing/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx…",
      recent: {
        fullPath: "/tasks?status=active",
        path: "/tasks",
        title: "全部任务",
      },
      distinct: true,
    },
    "internal-unavailable": {
      input: {
        stored: "/ui-states?state=blocked",
        path: "/ui-states",
      },
      requestedPath: "/ui-states",
      recent: {
        fullPath: "/home",
        path: "/home",
        title: "今日行动",
      },
      distinct: false,
    },
  },
  knownGaps: {
    genericErrorClaimsNoSuccessfulWrite: "请求失败且没有写入成功；请按提示重试。",
    notFoundStateMentionsRole: "地址可能已变更，或该入口不属于当前角色。",
    sourceFixed: false,
  },
  boundary:
    "P72 internal-dev and P73 standalone design proposals. Actual source helpers executed in VM; actual Vue Router memory resolver uses production-filtered source route catalog, no router guards or production HTTP/bundle evidence. Inert storage proves only tested inputs. Browser prototype records navigation intents only and never reads or writes real navigation memory or business APIs.",
};
