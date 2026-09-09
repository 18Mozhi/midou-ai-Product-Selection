(() => {
  "use strict";
  const D = window.REDIS_DATA,
    esc = (v) =>
      String(v ?? "未记录").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
      ),
    time = (v) => (v ? new Date(v).toLocaleString("zh-CN", { hour12: false }) : "未记录"),
    bytes = (n) =>
      n == null
        ? "未记录"
        : n >= 1073741824
          ? (n / 1073741824).toFixed(2) + " GiB"
          : n >= 1048576
            ? (n / 1048576).toFixed(2) + " MiB"
            : n >= 1024
              ? (n / 1024).toFixed(2) + " KiB"
              : n + " B",
    percent = (n) => (n / 100).toFixed(2) + "%",
    states = {
      ready: "当前韧性门满足",
      warning: "资源已触发预警",
      blocked: "当前韧性门阻断",
      loading: "正在读取Redis观测",
      empty: "尚无Redis观测",
      expired: "登录已失效",
      forbidden: "没有平台运维权限",
      rate_limited: "刷新过于频繁",
      timeout: "本次读取超时",
      unavailable: "运行事实暂不可用",
      recovering: "恢复核验文案预览",
    },
    names = {
      redis_unavailable: "未取得Redis运行观测",
      redis_loading: "实例正在加载持久化数据",
      redis_aof_disabled: "AOF未启用",
      redis_rdb_disabled: "RDB规则未启用",
      redis_aof_write_failed: "AOF写入状态未通过",
      redis_rdb_save_failed: "RDB保存状态未通过",
      redis_memory_unbounded: "内存上限未设置",
      redis_eviction_policy_invalid: "淘汰策略不符合边界",
      redis_connections_unbounded: "连接上限未设置",
      redis_memory_stop: "内存达到停止线",
      redis_memory_warning: "内存达到预警线",
      redis_connections_stop: "连接达到停止线",
      redis_connections_warning: "连接达到预警线",
      redis_connections_rejected: "累计拒绝连接非零",
      redis_keys_evicted: "累计键淘汰非零",
    },
    scenes = {
      ...D.labels,
      loading: "首次加载",
      empty: "空响应",
      expired: "首次401",
      forbidden: "首次403",
      rate_limited: "首次429",
      timeout: "首次15秒超时",
      unavailable: "首次读取失败",
      recovering: "仅UI恢复文案 · 未发起恢复",
      refreshing: "旧快照刷新中",
      "refresh-timeout": "旧快照超时保留",
      "refresh-rate_limited": "旧快照限流保留",
      "refresh-unavailable": "旧快照失败保留",
      "generic-error": "异常无请求ID",
      "request-detail": "成功请求ID披露",
      "failure-detail": "首次错误请求ID披露",
      "refresh-detail": "旧快照失败请求ID披露",
      "copy-success": "成功请求ID模拟复制",
      "copy-denied": "成功请求ID复制拒绝",
      "failure-copy-denied": "首次错误复制拒绝",
      "refresh-copy-denied": "保留快照错误复制拒绝",
      focus: "刷新键盘焦点",
      hover: "刷新悬停",
      pressed: "刷新按下",
      "review-tools": "审核工具",
    };
  let current,
    sequence = 0;
  const technical = (id, value) =>
      value
        ? `<details class="technical" id="${id}"><summary>技术信息 · 请求ID</summary><code>${esc(value)}</code><button data-copy="${id}" aria-label="复制请求ID">复制请求ID</button><span role="status" class="copy-result" id="copy-${id}"></span></details>`
        : "",
    finding = (d) =>
      d.findings
        .map(
          (f) =>
            `<article class="finding" data-severity="${esc(f.severity)}"><strong>${esc(names[f.code] || f.code)}</strong> <span class="pill ${f.severity}">${f.severity === "blocked" ? "阻断" : "预警"}</span><p>${esc(f.action_hint)}</p><code>${esc(f.code)}</code></article>`,
        )
        .join("");
  function resource(title, used, max, ratio, unit, unknown) {
    const bounded = max > 0,
      fmt = unit === "bytes" ? bytes : esc,
      prefix = unit === "bytes" ? "redis_memory_" : "redis_connections_",
      level = current.data.findings.some((f) => f.code === prefix + "stop")
        ? "blocked"
        : current.data.findings.some((f) => f.code === prefix + "warning")
          ? "warning"
          : "ready";
    return `<article class="resource"><h3>${title}</h3><strong>${unknown ? "未取得观测" : !bounded ? "未设置上限" : percent(ratio)}</strong><p>${unknown ? "原始响应为失败占位，不能作为实测零值。" : `${fmt(used)} / ${fmt(max)}`}</p>${!unknown && bounded ? `<div class="meter" data-level="${level}" role="meter" aria-label="${title}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${ratio / 100}" aria-valuetext="${esc(percent(ratio))}"><span style="width:${Math.max(0, Math.min(100, ratio / 100))}%"></span></div>` : ""}<small>${unknown ? `占位原值：${used} / ${max}；比例约定 ${percent(ratio)}` : !bounded ? `已用 ${fmt(used)}；返回比例 ${percent(ratio)} 为无上限约定，不是实测满额。` : used > max ? "原始用量已超过上限；服务比例封顶100%，请看完整数值。" : "比例来自服务计算；不是容量承诺。"}</small></article>`;
  }
  function samplePanel(d, L) {
    const s = d.keyspace_sample,
      emptyText =
        s.status === "partial" && s.measured_keys === 0
          ? "所有可归类键测量失败；不能据此判断没有业务键。"
          : s.unavailable_reason === "command_unsupported"
            ? "当前客户端不支持受限SCAN与MEMORY USAGE。"
            : s.unavailable_reason === "scan_failed"
              ? "本次采样失败，无法判断键空间组成。"
              : s.status === "empty"
                ? "本次扫描范围没有可归类键，不代表全库为空。"
                : "没有可展示的采样分组。";
    return `<section class="section" id="sample"><header><div><h2>有界键空间采样</h2><p>只比较成功测得的字节，不是总Redis内存占比或访问频率。</p></div><span class="pill ${s.status === "partial" ? "warning" : ""}">${esc(L.sampleStatusLabel[s.status])}</span></header><dl class="sample-stats">${[
      ["已扫描去重键", s.scanned_keys],
      ["成功测量", s.measured_keys],
      ["忽略 / 测量失败", `${s.ignored_keys} / ${s.failed_measurements}`],
      ["成功测得字节", bytes(s.total_sampled_bytes)],
    ]
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`)
      .join(
        "",
      )}</dl><p class="meta">采样上限 ${s.sample_limit} 个键；${s.truncated ? "已截断，仍有未覆盖范围" : "本次未标记截断"}。扫描COUNT32为提示，最多32轮；测量每批最多16。</p>${s.status === "partial" && s.measured_keys > 0 ? `<p class="note caution">测量失败 ${s.failed_measurements} 项；${s.measured_keys ? "以下分组仅覆盖测量成功部分，不替代完整键空间。" : emptyText}</p>` : ""}${s.hotspots.length ? `<div class="hotspots">${s.hotspots.map((h) => `<article class="hotspot"><div><strong>${esc(L.purposeLabel[h.purpose])} / ${esc(L.resourceLabel[h.resource])}</strong><small>${h.sampled_keys} 个成功测量键</small></div><div><b>${bytes(h.sampled_bytes)}</b><small>采样字节</small></div><div><b>${s.total_sampled_bytes ? percent(h.sampled_share_basis_points) : "无可计算占比"}</b><small>${s.total_sampled_bytes ? "成功测得字节的占比" : "分母为0；原始占比0"}</small></div>${s.total_sampled_bytes ? `<div class="meter" aria-hidden="true"><span style="width:${Math.max(0, Math.min(100, h.sampled_share_basis_points / 100))}%"></span></div>` : ""}</article>`).join("")}</div>` : `<p class="sample-empty empty">${emptyText}</p>`}<p class="note">只显示用途与资源类别，不返回键名、组织、工作区、载荷或连接信息。采样是否成功，不直接改变总体韧性判门。</p></section>`;
  }
  function render() {
    const d = current.data,
      L = window.REDIS_LOGIC(d),
      unknown = d?.findings.some((f) => f.code === "redis_unavailable"),
      risk = L.risk;
    document.getElementById("app").innerHTML =
      `<header class="context"><div><strong>ScoutOps / Redis运行</strong><p>协调数据的运行观测与持久化证据</p></div><div class="boundary"><span>惠州单机</span><span>宝塔管理</span><span>MySQL仍是业务事实源</span></div></header><main id="workspace" tabindex="-1"><p class="review-label">P67 · C方向具体审核稿 · 全部为隔离样例</p><header class="header"><div><h1>Redis运行核验</h1><p>区分当前观测、配置目标与采样结果。</p></div><button id="refresh" class="primary" aria-busy="${!!current.pending}" ${current.pending ? "disabled" : ""}>${current.pending ? "正在读取…" : "刷新运行观测"}</button></header>${current.failure && d ? `<section class="notice" role="status"><strong>${esc(states[current.failure])} · 保留旧快照</strong><p>下方仍为 ${esc(time(d.observed_at))} 的结果，不代表本次读取成功。浏览器15秒中止不保证后台审计或探针已停止。</p><button id="retry">重新核验</button>${technical("refresh-request", current.requestId)}</section>` : ""}<div class="paper">${
        d
          ? `<section class="verdict"><div><span class="pill ${d.state}">${esc(d.state)}</span><h2 class="${d.state}">${esc(states[d.state])}</h2><p>源服务结论：${d.findings.length} 项发现；不等于恢复演练、所有任务或高可用已验证。</p></div><div class="origin"><strong>观测时间</strong><p>${esc(time(d.observed_at))}</p><p>单实例 / 容量能力未验证</p></div></section>${d.findings.length ? `<section class="section" id="findings"><h2>需要核对的发现</h2>${finding(d)}<p class="meta">以上为源服务行动提示，此页不会自动执行停任务、恢复、改配置或重启。</p></section>` : ""}<div class="body-grid"><div class="observations"><section class="section"><header><div><h2>资源与累计计数</h2><p>用量、上限、累计错误分开阅读。</p></div></header><div class="resources">${resource("内存使用", d.memory.used_bytes, d.memory.max_bytes, d.memory.usage_basis_points, "bytes", unknown)}${resource("连接使用", d.connections.connected, d.connections.maximum, d.connections.usage_basis_points, "count", unknown)}</div><dl class="counters">${[
              ["累计拒绝连接", d.connections.rejected],
              ["累计淘汰键", d.evicted_keys],
              ["实例运行秒数", d.uptime_seconds],
            ]
              .map(
                ([k, v]) =>
                  `<div><dt>${k}</dt><dd>${unknown ? "未取得观测" : esc(v)}</dd>${unknown ? `<small>失败占位原值 ${v}</small>` : ""}</div>`,
              )
              .join(
                "",
              )}</dl><p class="meta">${unknown ? "运行期未测得，不显示已稳定运行0天。" : `实例运行 ${d.uptime_seconds} 秒；按天向下取整为 ${Math.floor(d.uptime_seconds / 86400)} 天。拒绝/淘汰是累计值，不是本次新增。`}</p><div class="note ${risk.level === "ready" ? "" : "caution"}" id="local-risk"><strong>界面键淘汰风险提示</strong><p>${unknown ? "探针未取得观测，无法独立判断当前淘汰风险。" : esc(risk.text)}</p><small>此提示的内存阈值为80%；总体判门使用运行policy，其阈值未随此接口返回，不能混用。</small></div></section><section class="section"><header><div><h2>持久化观测</h2><p>已启用和最近写入/保存结果是不同证据。</p></div></header><div class="persistence">${[
              [
                "AOF",
                d.persistence.aof_enabled,
                d.persistence.aof_last_write_status,
                "写入状态（可能回退重写结果）",
              ],
              [
                "RDB",
                d.persistence.rdb_enabled,
                d.persistence.rdb_last_save_status,
                "最近保存状态",
              ],
            ]
              .map(
                ([k, on, status, label]) =>
                  `<div class="row"><strong>${k}</strong><div>${unknown ? "未取得观测" : on ? "已启用" : "未启用"}<small>${unknown ? `占位 enabled=${on}` : "CONFIG GET观测"}</small></div><div>${esc(status)}<small>${label}</small></div></div>`,
              )
              .join(
                "",
              )}</div><p class="note">AOF everysec 是既有部署目标；当前探针没有读取 appendfsync，不能标记为本次实测通过。此接口也不提供恢复演练证据。</p></section></div><aside class="policy"><h2>边界与未覆盖项</h2><p>这些是现有部署合同和接口边界，不是新一轮在线验证。</p><dl><div><dt>内存淘汰策略 / 实际返回</dt><dd><code>${esc(d.max_memory_policy)}</code></dd></div><div><dt>持久化目标</dt><dd>AOF everysec + RDB规则</dd></div><div><dt>固定拓扑边界</dt><dd>single_instance<br>Sentinel=false<br>Cluster=false</dd></div><div><dt>能力声明</dt><dd>不宣称副本、备用服务器或容量承诺</dd></div><div><dt>当前GET未覆盖</dt><dd>appendfsync、bind、protected-mode、真实恢复演练</dd></div></dl><p>重启、配置、恢复只能由宝塔管理。本审核稿没有运维执行入口。</p></aside></div>${samplePanel(d, L)}${!d.findings.length ? '<section class="section" id="findings"><h2>当前返回未列出告警或阻断</h2><p class="empty">只代表此服务判门的发现为空，不推定所有缓存、队列或实时消息功能已实测可用。</p></section>' : ""}`
          : `<section class="failure" role="status"><h2>${esc(states[current.status])}</h2><p>${current.status === "recovering" ? "这只是旧前端枚举的设计预览；服务没有返回恢复状态，此页未启动恢复作业。" : current.status === "loading" ? "等待观测返回，不补画正常数据。" : "没有可用快照；核对登录或服务状态后再读取。"}</p>${["loading", "recovering"].includes(current.status) ? "" : current.status === "expired" ? '<a id="login" href="/login">重新登录</a>' : '<button id="retry">重新核验</button>'}${["loading", "recovering"].includes(current.status) ? "" : technical("failure-request", current.requestId)}</section>`
      }</div>${d ? `<footer class="footer"><p class="meta">离线合成数据，无Redis/MySQL请求。真实GET会写观测、查看与平台审计。</p>${technical("request", "synthetic-success-request")}</footer>` : ""}<details class="review" id="review-tools"><summary>审核工具 · 非产品功能</summary><label for="scene">选择观测、采样或控件状态</label><select id="scene">${Object.entries(
        scenes,
      )
        .map(
          ([k, v]) =>
            `<option value="${k}" ${k === current.key ? "selected" : ""}>${esc(v)}</option>`,
        )
        .join(
          "",
        )}</select><p class="meta">没有业务弹窗、筛选或恢复按钮。原生技术详情支持键盘，复制仅模拟。</p></details></main>`;
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
    current.reads.push({ id: current.pending, path: "/platform/operations/redis" });
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
  window.REDIS_C = { scenes, scene, read, completeRead, state: () => structuredClone(current) };
  scene("ready");
})();
