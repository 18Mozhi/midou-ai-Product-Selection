(() => {
  "use strict";
  const D = window.TOPOLOGY_DATA,
    esc = (v) =>
      String(v ?? "未记录").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
      ),
    time = (v) => (v ? new Date(v).toLocaleString("zh-CN", { hour12: false }) : "未记录"),
    value = (v) => (v == null ? "未记录" : typeof v === "boolean" ? (v ? "是" : "否") : v),
    facts = (rows) =>
      `<dl class="facts">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(value(v))}</dd></div>`).join("")}</dl>`,
    disclosure = (id, title, html) =>
      `<details class="details" id="${id}"><summary>${esc(title)}</summary>${html}</details>`,
    stateLabels = {
      ready: "单机运行门满足",
      empty: "尚无API节点",
      blocked: "单机运行条件未满足",
      stale: "运行证据已失去时效",
      loading: "正在读取运行证据",
      expired: "登录已失效",
      forbidden: "没有平台运维权限",
      rate_limited: "刷新过于频繁",
      timeout: "本次读取超时",
      unavailable: "运行状态暂不可用",
    },
    blockers = {
      runtime_nodes_empty: "未观察到API节点",
      api_node_missing: "预期API节点缺失",
      api_host_identity_mismatch: "API主机身份不匹配",
      api_heartbeat_stale: "API心跳过期",
      api_unavailable: "API状态不可用",
      backend_supervisor_degraded: "后端监督器异常",
    },
    scenes = {
      ...D.labels,
      all: "展开全部19队列",
      "restart-detail": "重启时间与差值明细",
      "process-detail": "进程最近失败披露",
      "snapshot-detail": "快照发布错误披露",
      "alert-detail": "告警技术与精确业务对象",
      "blocker-detail": "阻断实际代码披露",
      "request-detail": "成功请求ID披露",
      "copy-success": "请求ID模拟复制成功",
      "copy-denied": "请求ID模拟复制被拒绝",
      loading: "首次读取加载中",
      refreshing: "保留旧快照刷新中",
      expired: "首次401登录失效",
      forbidden: "首次403无权限",
      rate_limited: "首次429限流",
      timeout: "首次15秒超时",
      unavailable: "首次读取不可用",
      "refresh-rate_limited": "旧快照刷新限流",
      "refresh-timeout": "旧快照刷新超时",
      "refresh-unavailable": "旧快照刷新失败",
      "failure-copy": "首次错误请求ID",
      "refresh-copy": "保留快照失败请求ID",
      "failure-copy-denied": "首次错误请求ID复制被拒绝",
      "refresh-copy-denied": "保留快照错误请求ID复制被拒绝",
      focus: "刷新键盘焦点",
      hover: "刷新悬停",
      pressed: "刷新按下",
      "review-tools": "审核场景选择器",
    };
  D.datasets.ready.worker_scheduler.queues.forEach(
    (q, i) => (scenes["policy-" + i] = "策略披露 · " + q.name),
  );
  let current,
    sequence = 0;
  const technical = (id, request) =>
    disclosure(
      id,
      "技术信息 · 请求ID",
      `<code>${esc(request)}</code><button class="copy" data-copy="${id}" aria-label="复制请求ID">复制请求ID</button><span class="copy-result" id="copy-${id}" role="status"></span>`,
    );
  function nodePanel(d) {
    return `<section id="nodes" tabindex="-1" class="section"><header class="section-head"><div><h2><span class="number">01</span>节点与监督进程</h2><p>节点心跳、进程状态分别保留来源；不把页面读取时间当成进程采样时间。</p></div></header><div class="architecture"><aside class="entry"><strong>宝塔网站入口</strong><small>单上游反向代理</small><span class="arrow" aria-hidden="true">↓</span><strong>本机 API</strong><small>部署合同，非实时连通图</small></aside><div>${
      d.nodes.length
        ? d.nodes
            .map(
              (n) =>
                `<article class="node"><h3>${esc(n.node_id)} <span class="pill">${esc(n.status)}</span></h3>${facts(
                  [
                    ["主机", n.host_id],
                    ["角色 / 区域", `${n.role} / ${n.region ?? "未记录"} / ${n.zone ?? "未记录"}`],
                    ["最后心跳", time(n.last_heartbeat_at)],
                    ["应用版本", n.version],
                    ["完整构建SHA", n.build_sha],
                  ],
                )}${Date.parse(n.last_heartbeat_at) > Date.parse(d.observed_at) ? '<p class="note caution">心跳时间在未来；源服务仍可能ready，请核对时钟。这里不修改判门。</p>' : ""}</article>`,
            )
            .join("")
        : '<p class="empty">没有返回预期API节点；不补画绿色实例。</p>'
    }<div class="meta">监督器 PID：${esc(d.supervisor_pid)} · 原始进程快照时间未单独返回</div>${
      d.processes.length
        ? d.processes
            .map(
              (p, i) =>
                `<article class="process"><div><strong>${esc(p.name)}</strong><span class="pill">${esc(p.status)}</span></div>${facts(
                  [
                    ["PID", p.pid],
                    ["累计重启", p.restart_count],
                    ["就绪时间", time(p.ready_at)],
                    ["熔断至", time(p.circuit_open_until)],
                  ],
                )}${p.last_failure ? disclosure("process-" + i, "最近失败详情", `<code>${esc(p.last_failure)}</code>`) : ""}</article>`,
            )
            .join("")
        : '<p class="empty">未取得监督进程快照，不代表进程已停止。</p>'
    }</div></div>${disclosure("restart-details", "重启观测明细 · " + d.restart_trend.length + "条", `<p class="note">历史查询为24小时最多600条，读取时再追加当前样本。五分钟桶由授权查看写入；无人查看时不承诺连续采样。首次、计数下降的增量为0；下降另标重置。</p>${d.restart_trend.map((r) => `<div class="history-row"><span>${esc(time(r.observed_at))}<br>${esc(r.process_name)} · ${esc(r.status)}</span><span>累计 ${esc(r.restart_count)}</span><span>增量 ${esc(r.restart_delta)}</span><span>${r.counter_reset ? "计数已重置" : "未重置"}</span></div>`).join("") || '<p class="empty">没有重启观测记录</p>'}`)}<p class="note">同机边界：API、Worker、Crawler、MySQL、Redis、存储由宝塔管理。此接口不返回各依赖独立连通状态，不从单机合同推定健康。</p></section>`;
  }
  function healthPanel(d, L) {
    const h = d.health_probes;
    return `<section id="health" tabindex="-1" class="section"><header class="section-head"><div><h2><span class="number">02</span>连续探测摘要</h2><p>端点结果与页面运行门分开；失败和超时耗时也进入分位数。</p></div></header>${
      h
        ? `<p class="meta">摘要状态 ${esc(h.status)} · 汇总时间 ${esc(time(h.observed_at))}<br>窗口 ${esc(h.window_minutes)}分钟 / 周期 ${esc(h.interval_ms)}ms / 超时 ${esc(h.timeout_ms)}ms / 保留 ${esc(h.retention_hours)}小时</p><div class="health-grid">${
            h.endpoints
              .map(
                (e) =>
                  `<article class="probe"><h3>${esc(L.healthEndpointLabels[e.endpoint] || e.endpoint)}</h3><code>/health/${esc(e.endpoint)}</code><strong class="ratio${e.sample_count && e.last_outcome !== "succeeded" ? " danger" : ""}">${e.sample_count ? esc(e.availability_basis_points / 100) + "%" : "无样本"}</strong><small>${e.sample_count ? "窗口成功比例 · 非全链健康率" : "接口约定值0，不是实测0%可用"}</small>${facts(
                    [
                      ["样本 / 成功", `${e.sample_count} / ${e.success_count}`],
                      ["HTTP错误", e.http_error_count],
                      ["超时 / 连接失败", `${e.timeout_count} / ${e.network_error_count}`],
                      ["P50 (ms)", e.latency_p50_ms],
                      ["P95 (ms)", e.latency_p95_ms],
                      ["P99 (ms)", e.latency_p99_ms],
                      ["最大耗时 (ms)", e.latency_max_ms],
                      ["最后HTTP状态", e.last_status_code],
                    ],
                  )}<footer>${esc(L.healthOutcomeLabels[e.last_outcome] || "未记录结果")}<br>最后样本 ${esc(time(e.last_observed_at))}</footer></article>`,
              )
              .join("") || '<p class="empty">摘要读取不可用，没有端点数据；不补零值图。</p>'
          }</div>`
        : '<p class="empty">没有配置/返回健康探测摘要。未观测不等于正常。</p>'
    }</section>`;
  }
  function queuePanel(d, L) {
    const w = d.worker_scheduler,
      visible = current.all ? L.queues : L.exceptional;
    return `<section id="queues" tabindex="-1" class="section"><header class="section-head"><div><h2><span class="number">03</span>Worker队列</h2><p>${w ? `快照 ${esc(time(w.observed_at))} · 状态 ${esc(w.status)}` : "未取得Worker快照"}</p></div>${w ? `<button id="toggle" aria-expanded="${current.all}">${current.all ? "只看运行与异常" : `查看全部队列 (${L.queues.length})`}</button>` : ""}</header>${
      w
        ? `<dl class="scheduler-summary">${[
            ["运行 / 并发配额", `${w.active_runs} / ${w.max_concurrency}`],
            ["到期队列", w.due_queue_count],
            ["近一分钟完成 / 失败", `${w.completed_last_minute} / ${w.failed_last_minute}`],
            ["近一分钟失败率", `${w.failure_rate_percent}%`],
            ["最大队列延迟 (ms)", w.max_queue_delay_ms],
            ["疑似卡死运行", w.suspected_stuck_runs],
            ["背压", value(w.backpressure)],
            ["快照发布失败累计", w.snapshot_publish_failed_total],
          ]
            .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
            .join(
              "",
            )}</dl>${w.last_snapshot_error ? disclosure("snapshot-error", "调度快照发布错误", `<code>${esc(w.last_snapshot_error)}</code><p class="note">这是观测写入失败，不等于业务任务结果写入失败。</p>`) : ""}<p class="meta">显示 ${visible.length} / ${L.queues.length} · 老化中 ${L.queues.filter((q) => q.due && q.aging_boost > 0).length} · 饥饿风险 ${L.queues.filter((q) => q.starvation_risk).length} · 切换只影响本地展示</p>${
            visible
              .map((q) => {
                const i = L.queues.findIndex((x) => x.name === q.name),
                  status =
                    q.circuit_state === "open"
                      ? "熔断中"
                      : q.suspected_stuck
                        ? "疑似卡死"
                        : q.running
                          ? "运行中"
                          : q.due
                            ? "等待调度"
                            : "空闲";
                return `<article class="queue" data-queue="${esc(q.name)}"><div class="queue-head"><div><h3>${esc(L.queueLabels[q.name] || q.name)}</h3><code>${esc(q.name)}</code></div><div><strong class="${q.circuit_state === "open" || q.suspected_stuck ? "danger" : ""}">${status}</strong><small>延迟 ${esc(q.queue_delay_ms)}ms</small></div><div><strong>优先级 ${esc(q.priority)} → ${esc(q.effective_priority)}</strong><small>${q.starvation_risk ? "老化到顶 · 饥饿风险" : q.running && !q.due ? "运行中 · 非等待老化" : q.due ? `老化提升 ${value(q.aging_boost)}` : "空闲 · 不累计老化"}</small></div></div>${disclosure(
                  "policy-" + i,
                  "查看隔离策略与运行记录",
                  facts([
                    ["并发配额 / 活跃", `${value(q.max_concurrency)} / ${value(q.active_runs)}`],
                    ["超时 (ms)", q.timeout_ms],
                    ["最大调度重试", q.max_retries],
                    ["老化间隔 (ms)", q.aging_interval_ms],
                    ["最大老化提升", q.maximum_aging_boost],
                    ["最长运行 (ms)", q.longest_running_ms],
                    ["连续失败", q.consecutive_failures],
                    ["失败累计", q.failed_total],
                    ["超时累计", q.timed_out_total],
                    ["重试累计", q.retry_total],
                    ["延后累计", q.deferred_total],
                    ["熔断至", time(q.circuit_open_until)],
                    ["最近失败", time(q.last_failed_at)],
                    ["最近业务结果", time(q.last_result_at)],
                    ["结果状态", q.last_result_status],
                    ["结果错误码", q.last_result_error_code],
                  ]),
                )}</article>`;
              })
              .join("") ||
            '<p class="empty">当前没有运行或异常队列。可查看全部空闲队列及其策略。</p>'
          }`
        : '<p class="empty">没有调度数据，不从API心跳推定Worker正常。</p>'
    }</section>`;
  }
  function alertPanel(d, L) {
    return `<section id="alerts" tabindex="-1" class="section"><header class="section-head"><div><h2><span class="number">04</span>告警与阻断证据</h2><p>保留原始严重级别、发生时间与来源代码；不新增处置动作。</p></div></header>${(
      d.alerts || []
    )
      .map(
        (a, i) =>
          `<article class="alert" data-severity="${esc(a.severity)}"><h3>${esc(L.alertLabels[a.code] || a.code)} <span class="pill">${a.severity === "critical" ? "严重" : "警告"}</span></h3><p>${esc(a.actionHint)}</p><small>发生于 ${esc(time(a.occurred_at))}</small><p>队列：${a.queues.map((q) => esc(L.queueLabels[q] || q)).join("、") || "未关联"}</p>${a.business_objects.map((o) => `<div>${o.href ? `<a data-navigation href="${esc(o.href)}">${esc(o.label)}</a>` : `<strong>${esc(o.label)} · 无导航地址</strong>`}<code>${esc(o.id)}</code></div>`).join("")}${disclosure(
            "alert-" + i,
            "技术证据",
            facts([
              ["告警代码", a.code],
              ["根因代码", a.root_cause_code],
              ["队列原始代码", a.queues.join(", ") || null],
            ]),
          )}</article>`,
      )
      .join(
        "",
      )}${d.blockers.map((b, i) => `<article class="alert" data-severity="critical"><h3>${esc(blockers[b.code] || b.code)} <span class="pill">阻断项</span></h3><p>${esc(b.actionHint)}</p>${disclosure("blocker-" + i, "实际阻断代码", `<code>${esc(b.code)}</code>`)}</article>`).join("")}${!d.alerts?.length && !d.blockers.length ? '<p class="empty">当前返回中没有告警或阻断项。该结论不替代外部监测或容量验证。</p>' : ""}</section>`;
  }
  function render() {
    const d = current.data,
      L = window.TOPOLOGY_LOGIC(d),
      failure = current.failure;
    document.getElementById("app").innerHTML =
      `<div class="shell"><aside class="context"><div class="brand">ScoutOps / 运行台</div><p class="eyebrow">PLATFORM OPERATIONS</p><h2>单机运行证据</h2><p>先定位异常，再核对来源。<br>每个状态都有自己的时钟。</p><nav class="page-nav" aria-label="本页目录">${[
        ["nodes", "节点与进程"],
        ["health", "探测摘要"],
        ["queues", "任务队列"],
        ["alerts", "告警与阻断"],
      ]
        .map(([id, label], i) => `<a href="#${id}"><span>0${i + 1}</span>${label}</a>`)
        .join(
          "",
        )}</nav><div class="boundary"><strong>惠州 · 单主机合同</strong><p>无负载均衡<br>无备用服务器<br>容量能力：未验证</p><small>静态部署边界，不是在线健康认证。</small></div></aside><main class="workspace" id="workspace" tabindex="-1"><div class="topbar"><span>平台运维 / 服务拓扑</span><span class="pill">C-r1 · 合成数据审核稿</span></div><header class="header"><div><h1>服务拓扑</h1><p>节点、进程、探测与队列，四份证据并列核验。</p></div><button id="refresh" class="primary" ${current.pending ? "disabled" : ""} aria-busy="${!!current.pending}">${current.pending ? "正在读取…" : "刷新运行证据"}</button></header>${failure && d ? `<div class="notice" role="status"><strong>${esc(stateLabels[failure])} · 保留旧快照</strong><p>下方仍是 ${esc(time(d.observed_at))} 的成功结果，不能当作本次读取成功。15秒仅为浏览器等待边界，不保证服务审计停止。</p><button id="retry">重新读取</button>${technical("refresh-request", "synthetic-current-failure")}</div>` : ""}<div class="paper">${d ? `<div class="verdict"><div><span class="eyebrow">源服务状态 / ${esc(d.state)}</span><strong class="${d.state === "ready" ? "" : "danger"}">${esc(stateLabels[d.state])}</strong><p>结论时间 ${esc(time(d.observed_at))} · 有效API ${esc(d.active_api_instances)} · 过期节点 ${esc(d.stale_node_count)}</p></div><div class="counts"><strong class="${d.alerts?.some((a) => a.severity === "critical") ? "danger" : "warn"}">${d.alerts?.length || 0} 告警 / ${d.blockers.length} 阻断</strong><small>ready不等于所有服务健康</small></div></div>${current.key === "original" ? '<p class="note caution">原始历史E2E夹具：摘要计数与两条队列不是完整调度账，未重算成自洽生产事实。</p>' : ""}${nodePanel(d)}${healthPanel(d, L)}${queuePanel(d, L)}${alertPanel(d, L)}` : `<section class="failure" role="status"><span class="eyebrow">读取状态 / ${esc(current.status)}</span><h2>${esc(stateLabels[current.status])}</h2><p>${current.status === "loading" ? "正在请求运行证据；不提前显示正常节点。" : "本次没有可用快照。不会补画健康状态或修改后台服务。"}</p>${current.status === "loading" ? "" : current.status === "expired" ? '<a data-navigation id="login" href="/login">重新登录</a>' : '<button id="retry">重新读取</button>'}${current.status === "loading" ? "" : technical("failure-request", "synthetic-first-failure")}</section>`}</div>${d ? `<footer class="footer"><p class="meta">所有数据均为隔离样例。真实GET会写查看审计及进程观测；此原型不发送请求。</p>${technical("request", "synthetic-success-request")}</footer>` : ""}<details id="review-tools" class="review"><summary>审核工具 · 非产品功能</summary><label for="scene">选择页面、状态或控件场景</label><select id="scene">${Object.entries(
        scenes,
      )
        .map(
          ([k, t]) =>
            `<option value="${k}" ${k === current.key ? "selected" : ""}>${esc(t)}</option>`,
        )
        .join(
          "",
        )}</select><p class="meta">无业务弹窗。所有展开均为原生详情；复制与跳转仅记录模拟结果。</p></details></main></div>`;
    const count = document.querySelector(".counts strong");
    if (count && !d.alerts?.length && !d.blockers.length) count.className = "";
    if (count && d.blockers.length) count.className = "danger";
    document.getElementById("refresh").onclick = read;
    document.getElementById("retry")?.addEventListener("click", read);
    document.getElementById("toggle")?.addEventListener("click", () => {
      current.all = !current.all;
      render();
      document.getElementById("toggle").focus();
    });
    document.getElementById("scene").onchange = (e) => scene(e.target.value);
    document
      .querySelectorAll("[data-copy]")
      .forEach((b) => (b.onclick = () => copy(b.dataset.copy)));
    document.querySelectorAll("[data-navigation]").forEach(
      (a) =>
        (a.onclick = (e) => {
          e.preventDefault();
          current.navigation.push(a.getAttribute("href"));
        }),
    );
    document.querySelectorAll(".page-nav a").forEach(
      (a) =>
        (a.onclick = (e) => {
          e.preventDefault();
          const t = document.querySelector(a.getAttribute("href"));
          if (t) {
            t.focus();
            t.scrollIntoView();
          }
        }),
    );
  }
  function copy(id) {
    document.getElementById("copy-" + id).textContent = current.copyDenied
      ? "复制被拒绝，请选中请求ID手动复制。"
      : "模拟已复制；未写入系统剪贴板。";
  }
  function read() {
    if (current.pending) return;
    current.pending = ++sequence;
    current.reads.push({ id: current.pending, path: "/platform/operations/topology" });
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
    } else if (current.data && !["expired", "forbidden"].includes(outcome))
      current.failure = outcome;
    else {
      current.data = null;
      current.status = outcome;
    }
    render();
    return true;
  }
  function scene(key) {
    if (!(key in scenes)) throw new Error("Unknown scene " + key);
    const base =
      {
        "restart-detail": "restart-reset",
        "process-detail": "restart-loop",
        "snapshot-detail": "publish-failed",
        "alert-detail": "business",
        "blocker-detail": "host",
      }[key] || (D.datasets[key] ? key : "ready");
    current = {
      key,
      data: structuredClone(D.datasets[base]),
      status: "ready",
      failure: null,
      pending: null,
      all: key === "all" || key.startsWith("policy-"),
      reads: [],
      navigation: [],
      copyDenied: key.endsWith("copy-denied"),
    };
    ++sequence;
    if (
      [
        "loading",
        "expired",
        "forbidden",
        "rate_limited",
        "timeout",
        "unavailable",
        "failure-copy",
        "failure-copy-denied",
      ].includes(key)
    ) {
      current.data = null;
      current.status = key.startsWith("failure-copy") ? "unavailable" : key;
    }
    if (key.startsWith("refresh-") && !key.startsWith("refresh-copy"))
      current.failure = key.slice(8);
    if (key.startsWith("refresh-copy")) current.failure = "unavailable";
    if (["loading", "refreshing"].includes(key)) current.pending = ++sequence;
    render();
    const open =
      {
        "restart-detail": "restart-details",
        "process-detail": "process-1",
        "snapshot-detail": "snapshot-error",
        "alert-detail": "alert-0",
        "blocker-detail": "blocker-0",
        "request-detail": "request",
        "copy-success": "request",
        "copy-denied": "request",
        "failure-copy": "failure-request",
        "refresh-copy": "refresh-request",
        "failure-copy-denied": "failure-request",
        "refresh-copy-denied": "refresh-request",
        "review-tools": "review-tools",
      }[key] || (key.startsWith("policy-") ? key : null);
    if (open) document.getElementById(open).open = true;
    if (["copy-success", "copy-denied"].includes(key)) copy("request");
    if (["failure-copy-denied", "refresh-copy-denied"].includes(key)) copy(open);
    if (key === "focus") document.getElementById("refresh").focus();
    window.scrollTo(0, 0);
  }
  window.TOPOLOGY_C = { scenes, scene, read, completeRead, state: () => structuredClone(current) };
  scene("ready");
})();
