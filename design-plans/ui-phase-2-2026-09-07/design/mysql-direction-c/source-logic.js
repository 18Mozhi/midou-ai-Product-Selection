window.MYSQL_LOGIC = function (value) {
  const data = { value };
  const computed = (fn) => ({
    get value() {
      return fn();
    },
  });
  const findingSeverity = (codes) => {
    const finding = data.value?.findings.find((item) => codes.includes(item.code));
    return finding?.severity ?? "ready";
  };
  const slowQueryImpact = computed(() => {
    if (!data.value) return "尚无观测";
    const severity = findingSeverity(["mysql_slow_query_warning", "mysql_slow_query_stop"]);
    if (severity === "blocked") return "已达到阻断线；高成本任务应停止";
    if (severity === "warning") return "已达到预警线；需核对索引与执行计划";
    return data.value.slow_queries.per_minute > 0
      ? "当前窗口存在慢查询增量，尚未触发门禁"
      : "当前窗口未观察到慢查询增量";
  });
  const rowLockImpact = computed(() => {
    if (!data.value) return "尚无观测";
    return data.value.io.innodb_row_lock_waits > 0
      ? `实例启动后累计 ${data.value.io.innodb_row_lock_waits} 次；需结合长事务日志判断当前影响`
      : "实例启动后未记录行锁等待";
  });
  return {
    findingSeverity,
    slowQueryImpact: slowQueryImpact.value,
    rowLockImpact: rowLockImpact.value,
  };
};
