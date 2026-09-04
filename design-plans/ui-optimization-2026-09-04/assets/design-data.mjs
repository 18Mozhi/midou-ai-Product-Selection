export const direction = {
  name: "证据罗盘",
  tagline: "让每一个信号都有来源，让每一个决定都有下一步",
  palette: [
    ["深海画布", "#071321"], ["作业层", "#0c1c30"], ["行动蓝", "#4f7cff"],
    ["实时青", "#4dd7e8"], ["可信绿", "#43d7a5"], ["待办琥珀", "#f5b84b"],
    ["风险珊瑚", "#ff6f7d"], ["阅读雾白", "#edf5ff"],
  ],
};

const raw = {
  "/": ["按当前身份进入正确工作台", "进入工作台", "切换账号", "landing", ["身份解析", "范围确认", "安全跳转"]],
  "/login": ["安全登录并快速回到上次工作", "登录", "找回密码", "auth", ["账号登录", "安全说明", "辅助入口"]],
  "/register": ["创建本地账号并完成邮箱验证", "创建账号", "返回登录", "auth", ["基本信息", "密码规则", "验证说明"]],
  "/forgot-password": ["发起不泄露账号状态的密码找回", "发送验证邮件", "返回登录", "auth", ["账号识别", "发送状态", "安全提示"]],
  "/verify-email": ["确认邮箱并明确下一步", "完成验证", "重新发送", "auth", ["验证状态", "有效期", "后续入口"]],
  "/reset-password": ["设置新密码并退出旧会话", "重置密码", "取消", "auth", ["新密码", "规则检查", "会话影响"]],
  "/security/mfa": ["完成双重验证或安全恢复", "验证并继续", "使用恢复方式", "auth", ["验证码", "备用方式", "安全解释"]],
  "/select-context": ["选择当前组织与工作区范围", "进入所选工作区", "创建我的空间", "chooser", ["组织", "工作区", "当前身份"]],
  "/onboarding": ["用三步理解信号到决策的主流程", "开始第一次选品", "跳过引导", "onboarding", ["输入信号", "查看证据", "作出决定"]],
  "/settings/theme": ["选择主题和信息密度", "保存外观", "恢复默认", "settings", ["主题预览", "密度预览", "可读性检查"]],
  "/me": ["集中管理资料、安全、通知与个人工作", "保存个人设置", "查看安全会话", "settings", ["个人资料", "安全与会话", "通知偏好"]],
  "/home": ["先处理最重要且可信的今日行动", "创建选品", "查看全部行动", "dashboard", ["优先行动", "变化雷达", "数据健康"]],
  "/work": ["按负责人和期限完成今天的任务", "新建任务", "批量处理", "queue", ["今日清单", "即将到期", "已完成"]],
  "/trends": ["从多来源信号中识别值得跟进的变化", "创建监控", "保存筛选", "explorer", ["趋势列表", "证据时间线", "监控规则"]],
  "/opportunities": ["比较机会质量并快速进入决策", "创建选品", "批量分配", "explorer", ["机会列表", "质量门槛", "决策进度"]],
  "/opportunities/start": ["提交真实输入并看到可验证的首个结果", "开始采集", "保存草稿", "wizard", ["输入类型", "采集范围", "结果时限"]],
  "/opportunities/scoring-rules": ["维护可解释、可版本化的评分规则", "新建规则", "预览评分", "rules", ["规则版本", "维度权重", "命中解释"]],
  "/opportunities/:opportunityId": ["在同一屏完成证据、利润、风险与决策", "记录决策", "创建补采任务", "detail", ["结论", "证据", "利润与风险"]],
  "/competitors": ["识别竞品变化并决定是否处理", "添加竞品", "查看监控规则", "monitor", ["竞品列表", "变化摘要", "告警队列"]],
  "/competitors/monitoring-rules": ["明确阈值、范围和告警去向", "新建监控规则", "查看竞品", "rules", ["启用规则", "阈值条件", "触发记录"]],
  "/sourcing": ["比较真实报价并补齐利润缺口", "发起找货", "对比报价", "explorer", ["供应商候选", "报价版本", "采购准备"]],
  "/sourcing/cost-rules": ["维护费用、汇率与利润计算依据", "新建费用规则", "试算利润", "rules", ["费用版本", "汇率来源", "缺失成本"]],
  "/tasks": ["查看全部任务并按状态批量处理", "新建任务", "导出当前视图", "queue", ["任务列表", "批量操作", "运行记录"]],
  "/tasks/:taskId": ["查看任务进展、负责人和完整记录", "更新任务", "添加评论", "detail", ["任务摘要", "执行时间线", "评论与审批"]],
  "/tasks/approvals": ["在充分上下文中完成高影响审批", "处理下一项", "查看已处理", "approval", ["待我审批", "我发起的", "审批记录"]],
  "/notifications": ["按优先级清理与工作相关的通知", "全部标为已读", "通知偏好", "inbox", ["待处理", "变更通知", "系统提醒"]],
  "/automations": ["把稳定规则转为受控自动化", "新建自动化", "运行测试", "rules", ["启用规则", "触发条件", "执行记录"]],
  "/reports": ["生成有范围、时间和来源说明的报表", "创建报表", "查看导出记录", "reports", ["机会分析", "趋势分析", "团队绩效"]],
  "/org-admin": ["一眼识别组织治理中的待办与风险", "刷新数据", "查看组织审计", "admin-dashboard", ["治理概览", "待办审批", "近期审计"]],
  "/org-admin/members": ["邀请、停用和分配组织成员", "邀请成员", "导出成员", "admin-list", ["成员列表", "邀请状态", "访问范围"]],
  "/org-admin/roles": ["用中文能力配置组织角色", "新建角色", "对比角色", "admin-list", ["角色列表", "能力矩阵", "影响成员"]],
  "/org-admin/workspaces": ["管理工作区及其成员范围", "新建工作区", "查看归档", "admin-list", ["工作区列表", "成员覆盖", "数据范围"]],
  "/org-admin/teams": ["维护团队结构与负责人", "新建团队", "批量调成员", "admin-list", ["团队列表", "负责人", "成员范围"]],
  "/org-admin/approvals": ["维护审批模板和生效范围", "新建审批模板", "查看审批记录", "admin-list", ["模板列表", "适用动作", "生效版本"]],
  "/org-admin/data": ["查看组织数据留存、导出与删除边界", "创建数据导出", "查看留存规则", "admin-list", ["数据范围", "导出记录", "留存策略"]],
  "/org-admin/tokens": ["安全管理组织级 Token 生命周期", "创建组织 Token", "查看使用记录", "admin-list", ["Token 列表", "权限范围", "轮换记录"]],
  "/org-admin/audit": ["按人员、动作和对象追溯组织事件", "导出审计记录", "保存筛选", "audit", ["审计事件", "风险筛选", "技术详情"]],
  "/platform-admin": ["优先处理平台运行与数据质量异常", "新建组织", "进入用户工作台", "ops-dashboard", ["运营待办", "来源健康", "系统检查"]],
  "/platform-admin/accounts": ["在一个入口管理账号与组织关系", "新建组织", "查看用户", "admin-list", ["组织", "用户", "管理员"]],
  "/platform-admin/organizations": ["搜索、筛选并管理平台组织", "新建组织", "导出组织", "admin-list", ["组织列表", "状态分布", "管理员覆盖"]],
  "/platform-admin/organizations/new": ["分步创建组织并确认首位管理员", "创建组织", "取消", "wizard", ["组织身份", "初始管理员", "影响确认"]],
  "/platform-admin/organizations/:organizationId": ["查看组织状态、范围与关键治理记录", "编辑组织", "暂停组织", "detail", ["组织概览", "管理员", "审计记录"]],
  "/platform-admin/users": ["管理普通用户状态和组织关系", "新建用户", "批量导出", "admin-list", ["用户列表", "组织关系", "安全状态"]],
  "/platform-admin/admins": ["管理平台管理员与高权限状态", "添加管理员", "查看权限对比", "admin-list", ["管理员列表", "角色分布", "最近活动"]],
  "/platform-admin/permissions": ["对比平台角色能力与影响范围", "导出权限矩阵", "查看管理员", "matrix", ["角色对比", "能力矩阵", "范围说明"]],
  "/platform-admin/providers": ["管理来源定义和启用边界", "添加来源", "查看采集程序", "ops-list", ["来源注册", "状态分布", "依赖检查"]],
  "/platform-admin/providers/adapters": ["检查采集程序版本与运行健康", "注册采集程序", "立即健康检查", "ops-list", ["程序列表", "版本兼容", "运行故障"]],
  "/platform-admin/providers/sources": ["管理热点来源的采集规则与登录要求", "管理来源规则", "查看版本回滚", "ops-list", ["来源目录", "采集配置", "登录状态"]],
  "/platform-admin/providers/sources/1688-acceptance": ["逐项核对 1688 启用前条件", "运行启用检查", "返回来源", "checklist", ["登录验证", "解析样本", "启用结论"]],
  "/platform-admin/credentials": ["管理加密凭证与浏览器档案", "新增凭证", "发起网页登录", "ops-list", ["凭证资产", "浏览器档案", "轮换到期"]],
  "/platform-admin/collection": ["定位采集任务失败并安全重放", "重放所选任务", "查看采集总览", "ops-list", ["任务队列", "失败原因", "重放记录"]],
  "/platform-admin/collection/overview": ["总览采集吞吐、积压与来源状态", "刷新观测", "查看任务", "ops-dashboard", ["队列概览", "来源吞吐", "异常分布"]],
  "/platform-admin/collection/browser-runtime": ["查看登录型浏览器采集运行状态", "恢复过期租约", "查看凭证档案", "ops-list", ["浏览器作业", "档案占用", "心跳状态"]],
  "/platform-admin/data": ["核对证据、规范化记录和数据质量", "处理质量问题", "查看原始证据", "ops-list", ["质量问题", "证据记录", "受影响字段"]],
  "/platform-admin/governance": ["管理质量规则与问题闭环", "新建治理规则", "查看待处理", "ops-list", ["规则列表", "问题队列", "执行结果"]],
  "/platform-admin/content": ["审核热点内容并保留理由", "审核下一条", "批量分配", "moderation", ["待审内容", "审核理由", "处理记录"]],
  "/platform-admin/notifications": ["创建、发布和追踪平台通知", "新建通知", "查看发送记录", "inbox", ["通知草稿", "发布记录", "触达状态"]],
  "/platform-admin/commercial": ["管理组织配额而不伪装收费能力", "调整配额", "查看变更记录", "ops-list", ["组织配额", "使用水位", "审批记录"]],
  "/platform-admin/security": ["处理高风险安全事件和密钥轮换", "处理风险事件", "运行安全检查", "ops-list", ["安全事件", "密钥轮换", "高权限操作"]],
  "/platform-admin/open-platform": ["管理开放平台申请和调用边界", "创建客户端", "查看调用记录", "ops-list", ["客户端", "授权范围", "调用审计"]],
  "/platform-admin/status": ["从业务影响开始判断系统是否健康", "刷新状态", "查看链路日志", "ops-dashboard", ["服务健康", "业务影响", "最近异常"]],
  "/platform-admin/logs": ["按关联编号串联跨服务请求", "保存查询", "导出脱敏日志", "audit", ["链路检索", "错误聚合", "技术详情"]],
  "/platform-admin/api-coverage": ["核对页面、接口与验收覆盖关系", "重新核对", "查看缺口", "matrix", ["接口覆盖", "角色覆盖", "缺口清单"]],
  "/platform-admin/operations": ["确认备份副本与隔离恢复是否有效", "运行恢复核验", "查看历史记录", "checklist", ["备份资产", "RPO / RTO", "恢复演练"]],
  "/platform-admin/releases": ["按阶段门禁推进或回滚发布", "创建发布", "查看回滚预案", "release", ["当前版本", "灰度门禁", "观察记录"]],
  "/platform-admin/topology": ["看清单机服务角色与真实依赖", "刷新拓扑", "查看服务状态", "topology", ["入口流量", "Node 后端", "Python 采集"]],
  "/platform-admin/redis": ["判断 Redis 持久化、内存与连接风险", "刷新观测", "查看恢复记录", "ops-dashboard", ["持久化", "内存水位", "连接与拒绝"]],
  "/platform-admin/mysql": ["判断 MySQL 单主性能与恢复风险", "刷新观测", "查看慢查询", "ops-dashboard", ["持久化", "查询与锁", "容量水位"]],
  "/platform-admin/files": ["判断证据与导出目录的完整性风险", "运行完整性检查", "查看恢复资产", "ops-dashboard", ["目录容量", "校验和", "隔离恢复"]],
  "/platform-admin/crawler-scheduler": ["识别采集调度积压与租约异常", "刷新调度", "查看过期租约", "ops-dashboard", ["活动租约", "来源容量", "等待时长"]],
  "/platform-admin/capacity": ["明确单机资源保护线与非承诺边界", "刷新容量", "查看压力证据", "ops-dashboard", ["CPU 与内存", "并发保护", "容量声明"]],
  "/ui-states": ["统一检查加载、空、错、无权限与恢复状态", "打开确认弹窗", "切换状态", "states", ["基础状态", "危险确认", "移动适配"]],
  "/:pathMatch(.*)*": ["从错误路径安全回到最近有效页面", "返回最近页面", "返回首页", "not-found", ["错误说明", "恢复入口", "关联编号"]],
};

export function routeSpec(route) {
  const value = raw[route.path] || ["完成当前页面的核心任务", "继续", "返回", "list", ["概览", "明细", "记录"]];
  const [job, primary, secondary, kind, sections] = value;
  const administrative = route.shell === "organization_admin" || route.shell === "platform_admin";
  const status = route.path.includes("security") || route.path.includes("logs") ? "需关注" : route.path.includes("operations") ? "待核验" : "运行正常";
  return {
    ...route, job, primary, secondary, kind, sections, administrative, status,
    focus: `${route.title}的核心任务与下一步`,
    layout: layoutName(kind),
    pageAdvice: adviceFor(route, kind, primary),
  };
}

function layoutName(kind) {
  const names = {
    auth: "双区认证页", landing: "安全跳转页", chooser: "范围选择器", onboarding: "三步引导",
    settings: "分区设置页", dashboard: "行动驾驶舱", "admin-dashboard": "治理驾驶舱", "ops-dashboard": "运行驾驶舱",
    explorer: "筛选 + 主从列表", queue: "可批处理队列", detail: "摘要 + 证据页签", rules: "规则列表 + 版本侧栏",
    wizard: "分步表单", approval: "上下文审批台", inbox: "消息双栏", reports: "报表工作台", monitor: "变化监控台",
    "admin-list": "紧凑管理表", "ops-list": "可观测运维表", matrix: "能力矩阵", checklist: "门禁清单",
    moderation: "内容审核台", release: "阶段发布轨", topology: "依赖拓扑", states: "状态组件库", "not-found": "恢复型错误页",
  };
  return names[kind] || "信息工作台";
}

function adviceFor(route, kind, primary) {
  const shellAdvice = route.shell === "platform_admin"
    ? "技术标识默认折叠，先显示业务影响、状态和负责人。"
    : route.shell === "organization_admin"
      ? "保留当前组织上下文，危险操作必须展示影响成员与范围。"
      : route.shell === "member"
        ? "保持当前组织与工作区可见，首屏只保留一个主行动。"
        : "辅助入口降级，主流程在 5 秒内可识别。";
  const kindAdvice = ["detail", "audit", "ops-list"].includes(kind)
    ? "采用主摘要、证据轨与按需展开的技术详情，降低来回跳转。"
    : ["dashboard", "admin-dashboard", "ops-dashboard"].includes(kind)
      ? "用异常优先的行动带替代等权指标卡墙，空状态说明下一步。"
      : ["rules", "settings", "wizard"].includes(kind)
        ? "表单按决定顺序分组，变更前后差异与失败恢复保持在当前上下文。"
        : "筛选、列表和批量操作形成固定三段结构，长内容始终可展开查看。";
  return [
    `主按钮“${primary}”固定为本页唯一高强调操作，其余降为描边或文字按钮。`,
    kindAdvice,
    shellAdvice,
  ];
}

export const shells = {
  member: ["今日行动", "今日工作", "热点趋势", "选品机会", "竞品监控", "供应链与利润", "任务中心", "审批中心", "通知中心"],
  organization_admin: ["治理概览", "成员与邀请", "角色与权限", "工作区管理", "团队管理", "审批模板", "组织数据", "组织令牌", "组织审计"],
  platform_admin: ["平台概览", "账号与组织", "热点来源", "采集任务", "全量数据", "规则与自动化", "内容管理", "通知管理", "系统状态", "高级运维"],
  account: ["个人资料", "安全与会话", "通知偏好", "我的关注", "我的任务"],
};

export const dialogVariants = [
  ["confirm", "高影响确认", "暂停组织", "确认后该组织成员将无法继续进入工作区，现有任务不会被删除。", "输入组织名称以继续"],
  ["reason", "审计理由", "记录变更理由", "说明为什么进行这次变更，理由将进入组织审计记录。", "至少输入 10 个字"],
  ["wizard", "创建向导", "创建新组织", "分三步确认组织身份、首位管理员和影响范围。", "第 2 步，共 3 步"],
  ["filter", "移动筛选抽屉", "筛选机会", "当前筛选只作用于本组织和当前工作区。", "已选择 3 个条件"],
  ["detail", "记录详情", "数据质量问题", "将业务影响置顶，技术标识收进可展开区域。", "最近观测 2 分钟前"],
  ["preview", "规则预览", "评分变化预览", "提交前比较当前版本与新版本的命中差异。", "影响 18 个机会"],
  ["task", "任务创建", "创建补采任务", "保留机会和证据上下文，只补充负责人、期限和说明。", "来源已自动带入"],
  ["source", "来源配置", "编辑采集配置", "频率、超时、重试和启用状态分组呈现，保存前展示差异。", "版本 7 → 8"],
  ["credential", "敏感输入", "新增加密凭证", "明文仅用于本次提交，保存后不再回显。", "需要二次确认"],
  ["message", "消息编辑", "发布平台通知", "先预览受众、渠道和发送时间，再进入最终确认。", "预计触达 1,248 人"],
];
