(() => {
  "use strict";
  const D = window.MYSQL_DATA,
    esc = (v) =>
      String(v ?? "未记录").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
      ),
    time = (v) => (v ? new Date(v).toLocaleString("zh-CN", { hour12: false }) : "未记录"),
    bytes = (n) =>
      n >= 1073741824
        ? (n / 1073741824).toFixed(2) + " GiB"
        : n >= 1048576
          ? (n / 1048576).toFixed(2) + " MiB"
          : n >= 1024
            ? (n / 1024).toFixed(2) + " KiB"
            : n + " B",
    percent = (n) => (n / 100).toFixed(2) + "%",
    states = {
      ready: "当前单主韧性门满足",
      warning: "当前观测存在预警",
      blocked: "当前单主韧性门阻断",
      loading: "正在读取MySQL证据",
      empty: "尚无MySQL观测",
      expired: "登录已失效",
      forbidden: "没有平台运维权限",
      rate_limited: "刷新过于频繁",
      timeout: "本次读取超时",
      unavailable: "MySQL运行事实暂不可用",
      recovering: "恢复文案预览 · 未启动作业",
    },
    names = {
      mysql_unavailable: "未取得数据库运行观测",
      mysql_version_incompatible: "版本不符合5.7合同",
      mysql_primary_read_only: "主库处于只读状态",
      mysql_binlog_disabled: "二进制日志未启用",
      mysql_binlog_format_invalid: "日志格式不符合ROW",
      mysql_product_database_binlog_excluded: "业务数据库被排除在binlog之外",
      mysql_flush_contract_invalid: "事务日志刷盘合同不符",
      mysql_sync_binlog_invalid: "二进制日志同步合同不符",
      mysql_master_status_unavailable: "主状态不可用",
      mysql_replica_unexpected: "发现非预期副本",
      mysql_connections_unbounded: "连接上限未设置",
      mysql_connections_stop: "连接达到停止线",
      mysql_connections_warning: "连接达到预警线",
      mysql_data_capacity_unknown: "数据文件系统容量未知",
      mysql_data_capacity_stop: "数据盘达到停止线",
      mysql_data_capacity_warning: "数据盘达到预警线",
      mysql_slow_query_stop: "慢查询速率达到停止线",
      mysql_slow_query_warning: "慢查询速率达到预警线",
      mysql_buffer_pool_hit_warning: "累计缓冲命中率偏低",
      mysql_innodb_log_waits: "累计日志等待非零",
      mysql_row_lock_waits: "累计行锁等待非零",
      mysql_recovery_unverified: "恢复证据尚未满足",
      mysql_recovery_stale: "恢复证据时效未满足",
      mysql_rpo_exceeded: "RPO超限或未记录",
      mysql_rto_exceeded: "RTO超限或未记录",
    },
    scenes = {
      ...D.labels,
      loading: "首次加载",
      empty: "空响应",
      expired: "首次401",
      forbidden: "首次403",
      rate_limited: "首次429",
      timeout: "首次15秒超时",
      unavailable: "首次依赖失败",
      recovering: "仅UI恢复文案",
      refreshing: "保留旧快照刷新中",
      "refresh-timeout": "旧快照读取超时",
      "refresh-rate_limited": "旧快照读取限流",
      "refresh-unavailable": "旧快照读取失败",
      "generic-error": "无请求ID的异常",
      "request-detail": "成功请求ID披露",
      "failure-detail": "首次错误请求ID披露",
      "refresh-detail": "保留快照错误请求ID披露",
      "copy-success": "模拟复制成功",
      "copy-denied": "成功请求ID复制拒绝",
      "failure-copy-denied": "首次错误ID复制拒绝",
      "refresh-copy-denied": "保留快照错误ID复制拒绝",
      focus: "刷新键盘焦点",
      hover: "刷新悬停",
      pressed: "刷新按下",
      "review-tools": "审核场景选择器",
    };
  let current,
    sequence = 0;
  const technical = (id, v) =>
    v
      ? `<details class="technical" id="${id}"><summary>技术信息 · 请求ID</summary><code>${esc(v)}</code><button data-copy="${id}" aria-label="复制请求ID">复制请求ID</button><span role="status" class="copy-result" id="copy-${id}"></span></details>`
      : "";
  function resource(title, used, max, ratio, prefix, isBytes, L) {
    const unknown = current.data.findings.some((f) => f.code === "mysql_unavailable"),
      missing = max <= 0,
      fmt = isBytes ? bytes : esc,
      level = L.findingSeverity([prefix + "_warning", prefix + "_stop"]);
    return `<article class="resource"><h3>${title}</h3><strong>${unknown ? "未取得观测" : missing ? "上限 / 容量未知" : percent(ratio)}</strong><p>${fmt(used)} / ${fmt(max)}</p>${!unknown && !missing ? `<div class="meter" data-level="${level}" role="meter" aria-label="${title}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${ratio / 100}" aria-valuetext="${percent(ratio)}"><span style="width:${Math.min(100, Math.max(0, ratio / 100))}%"></span></div>` : ""}<small>${missing ? `接口比例 ${percent(ratio)} 为未知上限约定，不是实测满额。` : used > max ? "源比例封顶100%；原始用量大于总量，请核对观测。" : isBytes ? "数据目录所在文件系统，不等于数据库表体积。" : "已连接为瞬时计数，不是查询吞吐量。"}</small></article>`;
  }
  function recovery(d) {
    const r = d.recovery,
      label =
        {
          verified: "探针恢复条件满足",
          stale: "演练证据已过期",
          blocked: "探针恢复证据不足",
          empty: "未返回有效恢复记录",
        }[r.status] || r.status;
    return `<aside class="recovery" id="recovery"><header><h2>同机恢复证据</h2><p>与运行资源独立核对，不是高可用或异地容灾。</p></header><div class="recovery-state"><strong class="${r.status === "verified" ? "ready" : "blocked"}">${esc(label)}</strong><small>源状态：${esc(r.status)}；仍需与总体findings对照。</small></div><dl>${[
      ["RPO", "最多可丢失时间", r.actual_rpo_minutes, "分钟"],
      ["RTO", "实际恢复耗时", r.actual_rto_minutes, "分钟"],
      ["演练距今", "源返回的年龄", r.drill_age_days, "天"],
    ]
      .map(
        ([k, ex, v, u]) =>
          `<div><dt>${k}<br>${ex}</dt><dd class="${v != null && v < 0 ? "danger" : ""}">${v == null ? "未记录" : esc(v)}<small>${v == null ? "未知不填0" : u}</small></dd></div>`,
      )
      .join(
        "",
      )}</dl>${[r.actual_rpo_minutes, r.actual_rto_minutes].some((v) => v != null && v < 0) ? '<p class="note caution" id="negative-warning">原始恢复值为负，不能解释为可信恢复耗时；保留源状态与数字，待核对业务证据。</p>' : ""}<p class="note">探针先按15分钟RPO、240分钟RTO和90天判断；运行policy还会再次检查。当前DTO未返回运行阈值，不能视为只有一个可调门。</p><p class="meta">演练年龄小于0归零、保留两位小数；状态可能依据取整前年龄。90.00天与stale可同时出现。</p><p class="note">只从最近20条备份/演练中找记录，核对同一备份的mysql_full、mysql_binlog恢复副本及加密、完整性、隔离、权限与审计证据。此页不发起备份或恢复。</p></aside>`;
  }
  function runtime(d, L) {
    return `<div class="runtime"><section class="section"><header><h2>资源观测</h2><p>连接和文件系统各自按对应finding显示，不随无关阻断一起变红。</p></header><div class="resources">${resource("连接使用", d.connections.connected, d.connections.maximum, d.connections.usage_basis_points, "mysql_connections", false, L)}${resource("数据盘使用", d.storage.used_bytes, d.storage.total_bytes, d.storage.usage_basis_points, "mysql_data_capacity", true, L)}</div></section><section class="section" id="performance"><header><h2>速率、累计与瞬时</h2><p>不同口径分开，不组合成一个“当前性能分数”。</p></header><article class="measurement"><header><h3>慢查询近似速率</h3><strong>${esc(d.slow_queries.per_minute)} 次/分钟</strong></header><p>有上次观测：累计非负增量 ÷ 至少一分钟的观测间隔；无上次观测：启动以来累计 ÷ 运行分钟。此接口未返回本次采用哪种分母。</p><small>慢查询阈值：${esc(d.slow_queries.long_query_time_seconds)} 秒。${L.findingSeverity(["mysql_slow_query_warning", "mysql_slow_query_stop"]) === "ready" ? "没有返回速率预警/阻断项；不等于本分钟全量查询统计。" : esc(L.slowQueryImpact)}</small></article><article class="measurement"><header><h3>累计缓冲池命中</h3><strong>${percent(d.io.buffer_pool_hit_rate_basis_points)}</strong></header><p>数据 ${bytes(d.io.buffer_pool_data_bytes)} / 缓冲池 ${bytes(d.io.buffer_pool_bytes)}</p><small>来自启动以来reads/requests；零requests默认返回100%，DTO未提供分母，不能确认100%一定来自实际命中。</small></article><article class="measurement"><header><h3>行锁等待</h3><strong>${esc(d.io.innodb_row_lock_waits)} 次累计</strong></header><p>${esc(L.rowLockImpact)}</p></article><article class="measurement"><header><h3>日志等待</h3><strong>${esc(d.io.innodb_log_waits)} 次累计</strong></header><p>累计等待不能直接表示当前磁盘延迟。</p></article><article class="measurement"><header><h3>运行线程</h3><strong>${esc(d.connections.running)} 个</strong></header><p>当前状态计数，不是活动用户数或系统容量。</p></article></section></div>`;
  }
  function render() {
    const d = current.data,
      L = window.MYSQL_LOGIC(d);
    document.getElementById("app").innerHTML =
      `<header class="context"><div class="context-inner"><div><strong>ScoutOps / 数据库运行</strong><p>MySQL 5.7 单主合同，当前版本值不随此DTO返回</p></div><div class="boundary">惠州同机 · 宝塔受管<br>不新增副本、负载均衡或备用服务器</div></div></header><main id="workspace" tabindex="-1"><p class="review-label">P68 · C方向具体稿 · 隔离样例，不是生产观测</p><header class="header"><div><h1>MySQL运行核验</h1><p>运行条件与恢复证据，同时核对、分别判断。</p></div><button class="primary" id="refresh" aria-busy="${!!current.pending}" ${current.pending ? "disabled" : ""}>${current.pending ? "正在读取…" : "刷新运行证据"}</button></header>${d && current.failure ? `<section class="notice" role="status"><strong>${esc(states[current.failure])} · 保留旧快照</strong><p>下方仍为 ${esc(time(d.observed_at))} 的成功读取结果。浏览器15秒、授权后API默认14秒竞争超时；probe不接收signal，不能宣称运行中的SQL已立即停止。</p><button id="retry">重新核验</button>${technical("refresh-request", current.requestId)}</section>` : ""}<div class="paper">${
        d
          ? `<section class="verdict"><div><span class="pill ${d.state}">${esc(d.state)}</span><h2 class="${d.state}">${esc(states[d.state])}</h2><p>返回 ${d.findings.length} 项发现；ready不替代真实恢复与生产验收。</p></div><div class="observation"><strong>观测时间</strong><p>${esc(time(d.observed_at))}</p></div></section>${d.findings.length ? `<section class="findings" id="findings"><h2>当前发现</h2>${d.findings.map((f) => `<article class="finding" data-severity="${f.severity}"><strong>${esc(names[f.code] || f.code)}</strong> <span class="pill ${f.severity}">${f.severity === "blocked" ? "阻断" : "预警"}</span><p>${esc(f.action_hint)}</p><code>${esc(f.code)}</code></article>`).join("")}<p class="meta">源提示仅供人工核对，不会执行停任务、调优、迁移或恢复。部分提示含固定目标值，不能替代实际运行policy。</p></section>` : ""}<div class="evidence-grid">${runtime(d, L)}${recovery(d)}</div><section class="section durability" id="durability"><header><h2>持久化实际值与单主合同</h2><p>目标用于对照，不是可编辑配置表。</p></header><div class="contract-row contract-head"><div>核对项</div><div>当前返回</div><div>合同目标</div></div>${[
              ["二进制日志", d.durability.log_bin_enabled ? "已启用" : "未启用", "启用"],
              ["binlog_format", d.durability.binlog_format, "ROW"],
              ["innodb_flush_log_at_trx_commit", d.durability.innodb_flush_log_at_trx_commit, 2],
              ["sync_binlog", d.durability.sync_binlog, 1],
            ]
              .map(
                ([k, v, target]) =>
                  `<div class="contract-row"><div><code>${esc(k)}</code></div><div><small>返回：</small>${esc(v)}</div><div><small>目标：</small>${esc(target)}</div></div>`,
              )
              .join(
                "",
              )}<p class="note">single_primary=true、replica_enabled=false、backup_server_used=false 是固定返回边界；若findings包含非预期副本或只读主库，不用这些标记覆盖异常。此接口不返回版本实值、主机、账号、目录、binlog文件或SQL。</p></section>`
          : `<section class="failure" role="status"><h2>${esc(states[current.status])}</h2><p>${current.status === "recovering" ? "这是旧前端枚举的离线预览。当前服务没有返回recovering，此页没有启动恢复作业。" : current.status === "loading" ? "读取中不显示成功指标。" : "本次没有可用快照，核对登录或服务状态后重新读取。"}</p>${["loading", "recovering"].includes(current.status) ? "" : current.status === "expired" ? '<a id="login" href="/login">重新登录</a>' : '<button id="retry">重新核验</button>'}${["loading", "recovering"].includes(current.status) ? "" : technical("failure-request", current.requestId)}</section>`
      }</div>${d ? `<footer class="footer"><p class="meta">离线合成数据，不连接MySQL。真实GET写观测、查看与平台审计；配置、重启、备份与恢复仍由宝塔管理。</p>${technical("request", "synthetic-success-request")}</footer>` : ""}<details class="review" id="review-tools"><summary>审核工具 · 非产品功能</summary><label for="scene">选择观测、恢复或控件状态</label><select id="scene">${Object.entries(
        scenes,
      )
        .map(
          ([k, v]) =>
            `<option value="${k}" ${k === current.key ? "selected" : ""}>${esc(v)}</option>`,
        )
        .join(
          "",
        )}</select><p class="meta">没有业务弹窗、SQL输入、配置保存或恢复执行按钮。复制仅模拟。</p></details></main>`;
    document.getElementById("refresh").onclick = read;
    document.getElementById("retry")?.addEventListener("click", read);
    document.getElementById("login")?.addEventListener("click", (e) => {
      e.preventDefault();
      current.navigation.push("/login");
    });
    document
      .querySelectorAll("[data-copy]")
      .forEach((b) => (b.onclick = () => copy(b.dataset.copy)));
    document.getElementById("scene").onchange = (e) => scene(e.target.value);
  }
  function copy(id) {
    document.getElementById("copy-" + id).textContent = current.denied
      ? "复制被拒绝，请选中请求ID手动复制。"
      : "模拟已复制；未写入系统剪贴板。";
  }
  function read() {
    if (current.pending) return;
    current.pending = ++sequence;
    current.reads.push({ id: current.pending, path: "/platform/operations/mysql" });
    current.failure = null;
    if (!current.data) current.status = "loading";
    render();
  }
  function completeRead(outcome = "success", id = current.pending) {
    if (!current.pending || id !== current.pending) return false;
    current.pending = null;
    if (outcome === "success") {
      current.data = structuredClone(D.datasets.ready);
      current.status = "ready";
      current.failure = null;
    } else if (outcome === "empty") {
      current.data = null;
      current.status = "empty";
    } else if (current.data && !["expired", "forbidden"].includes(outcome))
      current.failure = outcome;
    else {
      current.data = null;
      current.status = outcome;
    }
    current.requestId = "synthetic-current-read";
    render();
    return true;
  }
  function scene(key) {
    if (!(key in scenes)) throw new Error("Unknown scene " + key);
    ++sequence;
    current = {
      key,
      data: structuredClone(D.datasets[key] || D.datasets.ready),
      status: "ready",
      failure: null,
      pending: null,
      reads: [],
      navigation: [],
      denied: key.endsWith("denied"),
      requestId: "synthetic-current-read",
    };
    if (
      [
        "loading",
        "empty",
        "expired",
        "forbidden",
        "rate_limited",
        "timeout",
        "unavailable",
        "recovering",
        "failure-detail",
        "failure-copy-denied",
        "generic-error",
      ].includes(key)
    ) {
      current.data = null;
      current.status = key.startsWith("failure-") || key === "generic-error" ? "unavailable" : key;
    }
    if (key === "generic-error") current.requestId = "";
    if (["refresh-timeout", "refresh-rate_limited", "refresh-unavailable"].includes(key))
      current.failure = key.slice(8);
    if (["refresh-detail", "refresh-copy-denied"].includes(key)) current.failure = "unavailable";
    if (["loading", "refreshing"].includes(key)) current.pending = ++sequence;
    render();
    const open = {
      "request-detail": "request",
      "copy-success": "request",
      "copy-denied": "request",
      "failure-detail": "failure-request",
      "failure-copy-denied": "failure-request",
      "refresh-detail": "refresh-request",
      "refresh-copy-denied": "refresh-request",
      "review-tools": "review-tools",
    }[key];
    if (open) document.getElementById(open).open = true;
    if (key.includes("copy-")) copy(open);
    if (key === "focus") document.getElementById("refresh").focus();
    window.scrollTo(0, 0);
  }
  window.MYSQL_C = { scenes, scene, read, completeRead, state: () => structuredClone(current) };
  scene("ready");
})();
