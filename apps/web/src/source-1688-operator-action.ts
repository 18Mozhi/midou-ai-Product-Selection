const nodeConsole = "https://xingxing.medouai.com/#/adminDashboard";
const verification = new Set(["captcha", "blocked_captcha", "verification_required"]);
const login = new Set(["login_required", "login_expired", "session_expired", "blocked_login"]);

export function source1688OperatorAction(source: {
  code: string;
  health_status: string;
  last_error_code: string | null;
  last_checked_at: string | null;
  runtime_last_error_code: string | null;
  runtime_circuit_opened_at: string | null;
  runtime_circuit_state: "open" | "closed";
  runtime_recovery_gate_met: boolean;
}) {
  if (source.code !== "1688_search") return null;
  if (source.runtime_circuit_state === "open" && source.runtime_recovery_gate_met)
    return { title: "健康检查已通过", instruction: "到采集调度按审计流程解除 1688 熔断。",
      link: "/platform-admin/crawler-scheduler", label: "前往采集调度", external: false };
  const circuitOpen = source.runtime_circuit_state === "open";
  const checkedAt = Date.parse(source.last_checked_at ?? "");
  const openedAt = Date.parse(source.runtime_circuit_opened_at ?? "");
  // An earlier healthy probe cannot hide a later circuit failure.
  const currentProbeFailure = source.health_status !== "ready" && source.last_error_code && Number.isFinite(checkedAt) &&
    (!circuitOpen || (Number.isFinite(openedAt) && checkedAt >= openedAt));
  const fromRuntime = circuitOpen && !currentProbeFailure;
  const error = fromRuntime ? source.runtime_last_error_code : currentProbeFailure ? source.last_error_code : null;
  const origin = fromRuntime ? "本次熔断的采集任务" : "最近一次健康检查";
  if (error && verification.has(error))
    return { title: "需要人工过验证码", instruction: `${origin}遇到验证码或设备验证，不等于登录失效。进入共享采集节点的「采集节点 → Cookie 维护 → 人工验证 / 登录状态」查看当前会话并亲自完成；然后回本页重跑健康检查。`,
      link: nodeConsole, label: "打开星星采集节点管理", external: true };
  if (error && login.has(error))
    return { title: "需要重新登录", instruction: `${origin}遇到节点的 1688 登录会话失效。进入共享采集节点的「Cookie 维护 → 人工验证 / 登录状态」重新登录，再回本页重跑健康检查。`,
      link: nodeConsole, label: "打开星星采集节点管理", external: true };
  if (circuitOpen && error === "rate_limited")
    return { title: fromRuntime ? "采集因限流暂停" : "最近检查遇到限流", instruction: `${origin}未提示验证码或登录失效。先不要继续点检查或重登；等待限流解除后，在本页重跑健康检查。`,
      link: null, label: null, external: false };
  if (circuitOpen && error && ["network_error", "timeout", "dependency_unavailable"].includes(error))
    return { title: fromRuntime ? "采集因连接异常暂停" : "最近检查未能连接采集服务", instruction: `${origin}未确认验证码或登录状态。先确认共享节点和采集服务可用，再在本页重跑健康检查；不要据此重置登录。`,
      link: null, label: null, external: false };
  if (source.runtime_circuit_state === "open")
    return { title: "暂不能判断是否需要登录或验证", instruction: "先执行健康检查。网络、限流和接口权限错误不等于验证码，不要因此重置登录状态。",
      link: null, label: null, external: false };
  return null;
}
