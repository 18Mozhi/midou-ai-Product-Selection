const nodeConsole = "https://xingxing.medouai.com/#/adminDashboard";
const verification = new Set(["captcha", "blocked_captcha", "verification_required"]);
const login = new Set(["login_required", "login_expired", "session_expired", "blocked_login"]);

export function source1688OperatorAction(source: {
  code: string;
  health_status: string;
  last_error_code: string | null;
  runtime_last_error_code: string | null;
  runtime_circuit_state: "open" | "closed";
  runtime_recovery_gate_met: boolean;
}) {
  if (source.code !== "1688_search") return null;
  if (source.runtime_circuit_state === "open" && source.runtime_recovery_gate_met)
    return { title: "健康检查已通过", instruction: "到采集调度按审计流程解除 1688 熔断。",
      link: "/platform-admin/crawler-scheduler", label: "前往采集调度", external: false };
  const error = source.last_error_code ??
    (source.health_status === "ready" ? null : source.runtime_last_error_code);
  if (error && verification.has(error))
    return { title: "需要人工过验证码", instruction: "最近一次检查遇到验证码或设备验证，不等于登录失效。进入共享采集节点的「采集节点 → Cookie 维护 → 人工验证 / 登录状态」查看当前会话并亲自完成；然后回本页重跑健康检查。",
      link: nodeConsole, label: "打开星星采集节点管理", external: true };
  if (error && login.has(error))
    return { title: "需要重新登录", instruction: "最近一次检查确认节点的 1688 登录会话已失效。进入共享采集节点的「Cookie 维护 → 人工验证 / 登录状态」重新登录，再回本页重跑健康检查。",
      link: nodeConsole, label: "打开星星采集节点管理", external: true };
  if (source.runtime_circuit_state === "open")
    return { title: "暂不能判断是否需要登录或验证", instruction: "先执行健康检查。网络、限流和接口权限错误不等于验证码，不要因此重置登录状态。",
      link: null, label: null, external: false };
  return null;
}
