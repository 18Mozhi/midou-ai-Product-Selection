window.COVERAGE_LABELS = {
  outcomeName: (value) =>
    ({
      success: "成功",
      empty: "空结果",
      blocked: "受阻",
      unauthenticated: "未登录受阻",
      unauthorized: "越权拒绝",
      not_run: "未执行",
    })[value] ?? value,
  sourceName: (value) => value.replaceAll("_", " · "),
  dimensionName: (value) =>
    ({
      normal: "正常请求",
      authorization: "鉴权拒绝",
      parameters: "参数校验",
      idempotency: "幂等/并发",
      fault: "故障注入",
    })[value] ?? value,
  evidenceStatusName: (value) =>
    ({ passed: "通过", failed: "失败", not_run: "未执行", not_applicable: "不适用" })[value] ??
    value,
};
