export type StatusServiceCode = "api" | "mysql" | "redis" | "files" | "worker" | "crawler";

export interface StatusService {
  code: StatusServiceCode;
  name: string;
  status: string;
  detail: string;
  observed_at: string | null;
  href: string;
}

interface StatusTopologyDefinition {
  code: StatusServiceCode;
  fallbackName: string;
  lane: "entry" | "shared" | "execution";
  dependencies: StatusServiceCode[];
  impact: string;
  href: string;
}

export const statusTopologyDefinitions: StatusTopologyDefinition[] = [
  {
    code: "api",
    fallbackName: "后端接口",
    lane: "entry",
    dependencies: ["mysql", "redis"],
    impact: "网页请求、平台操作与内部采集回调",
    href: "/platform-admin/topology",
  },
  {
    code: "mysql",
    fallbackName: "数据库",
    lane: "shared",
    dependencies: [],
    impact: "API 读写、异步任务与业务事实",
    href: "/platform-admin/mysql",
  },
  {
    code: "redis",
    fallbackName: "缓存与任务队列",
    lane: "shared",
    dependencies: [],
    impact: "API 就绪、队列协调、限流与实时通知",
    href: "/platform-admin/redis",
  },
  {
    code: "files",
    fallbackName: "文件存储",
    lane: "shared",
    dependencies: [],
    impact: "证据保存、报表导出与采集回执暂存",
    href: "/platform-admin/files",
  },
  {
    code: "worker",
    fallbackName: "任务处理服务",
    lane: "execution",
    dependencies: ["mysql", "redis", "files"],
    impact: "采集任务、异步投影、通知与报表导出",
    href: "/platform-admin/crawler-scheduler",
  },
  {
    code: "crawler",
    fallbackName: "网页采集服务",
    lane: "execution",
    dependencies: ["api", "worker", "files"],
    impact: "需要登录档案的网页采集子查询",
    href: "/platform-admin/crawler-scheduler",
  },
];

export const statusTopologyLaneMeta = {
  entry: ["访问入口", "接收网页和内部请求"],
  shared: ["共享依赖", "保存事实并协调运行"],
  execution: ["异步执行", "处理任务和网页采集"],
} as const;
