(() => {
  const $ = (id) => document.getElementById(id);
  const base = window.SCOUTOPS_STATUS_DESIGN,
    definitions = window.SCOUTOPS_STATUS_TOPOLOGY;
  const scenes = {
    attention: "需核查 · Redis警告与文件过期",
    dependencies: "完整六项依赖目录",
    session: "浏览器会话 · 样本20%",
    activity: "业务汇总与管理入口",
    technical: "技术详情展开",
    "refresh-busy": "刷新中 · 保留旧观测",
    "refresh-failed": "刷新网络失败 · 保留旧观测",
    "refresh-timeout": "刷新超时 · 保留旧观测",
    recovered: "重试成功 · 依赖仍警告",
    "initial-loading": "首次读取中",
    "initial-network": "首次网络失败",
    "initial-server": "首次服务错误",
    "initial-permission": "首次权限错误",
    "initial-timeout": "首次超时 · 无成功数据",
    "missing-redis": "缺失Redis观测（边界演示）",
    "missing-all": "六项观测全缺失（边界演示）",
    "counts-empty": "采集与来源无记录（边界演示）",
    "no-warnings": "无待核查依赖（边界演示）",
    "session-reconnecting": "会话正在重连（边界演示）",
    "session-zero": "会话暂无事件（边界演示）",
  };
  const names = {
    ready: "正常",
    healthy: "正常",
    warning: "警告",
    stale: "已过期",
    unknown: "待检查",
    enabled: "启用",
    running: "运行中",
  };
  const titles = {
    attention: ["ATTENTION FIRST", "先看需要核查的依赖"],
    dependencies: ["DEPENDENCY DIRECTORY", "依赖目录"],
    session: ["THIS TAB ONLY", "浏览器会话"],
    activity: ["AGGREGATED FACTS", "业务汇总"],
  };
  const esc = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  const when = (value) =>
    value
      ? new Date(new Date(value).getTime() + 8 * 3600000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " ")
      : "—";
  const label = (status) => names[status] ?? status;
  const badge = (status) =>
    `<span class="state-label" data-state="${esc(status)}">${esc(label(status))}</span>`;
  let data,
    section = "attention",
    busy = false,
    hasData = true,
    failure = "",
    serial = 0,
    timer;
  let requests = 0;
  function stop() {
    serial += 1;
    clearTimeout(timer);
    busy = false;
  }
  function nodes() {
    return definitions.map((definition) => {
      const service = data.services.find((item) => item.code === definition.code);
      return {
        ...definition,
        name: definition.fallbackName,
        status: "unknown",
        detail: "尚无运行观测",
        observed_at: null,
        ...service,
      };
    });
  }
  function affected(code) {
    const result = new Set(),
      pending = [code];
    while (pending.length) {
      const current = pending.shift();
      for (const candidate of definitions) {
        if (result.has(candidate.code) || !candidate.dependencies.includes(current)) continue;
        result.add(candidate.code);
        pending.push(candidate.code);
      }
    }
    return [...result];
  }
  function renderFacts() {
    const all = nodes(),
      name = (code) => all.find((node) => node.code === code).name;
    const warnings = all.filter((node) => !["healthy", "ready"].includes(node.status));
    $("attention-count").textContent = `${warnings.length} 项需核查`;
    $("alerts").innerHTML =
      warnings
        .map(
          (node) =>
            `<article class="alert-row" data-code="${node.code}" data-state="${node.status}"><header class="alert-heading"><h3>${esc(node.name)}</h3>${badge(node.status)}</header><p class="sample-line">${esc(node.detail)}<br />采样 ${when(node.observed_at)}</p><p class="impact-label">如异常持续，优先核查</p><p>${esc(node.impact)}</p><p class="affected">关联服务：<b>${esc(affected(node.code).map(name).join("、") || "无下游服务")}</b></p><a class="action-link" href="${node.href}">进入处理 · ${esc(node.name)} ↗</a></article>`,
        )
        .join("") || '<p class="section-intro">当前未观测到需要核查的异常传播链。</p>';
    const lanes = {
      entry: ["访问入口", "接收网页和内部请求"],
      shared: ["共享依赖", "保存事实并协调运行"],
      execution: ["异步执行", "处理任务和网页采集"],
    };
    $("dependencies").innerHTML = Object.entries(lanes)
      .map(
        ([lane, meta]) =>
          `<section class="lane"><h3>${meta[0]}<small>${meta[1]}</small></h3>${all
            .filter((node) => node.lane === lane)
            .map(
              (node) =>
                `<article class="dependency-row" data-code="${node.code}" data-state="${node.status}"><div><h4>${esc(node.name)}</h4>${badge(node.status)}</div><div><p>${esc(node.detail)}<br />采样 ${when(node.observed_at)}</p><dl><dt>依赖</dt><dd>${esc(node.dependencies.map(name).join("、") || "基础资源")}</dd><dt>异常影响</dt><dd>${esc(node.impact)}</dd></dl></div><a class="action-link" href="${node.href}" aria-label="查看${esc(node.name)}管理页">查看 ↗</a></article>`,
            )
            .join("")}</section>`,
      )
      .join("");
    const metrics = data.metrics,
      events = metrics.connection_open_count + metrics.reconnect_count;
    $("rate").textContent =
      `${((events ? Math.round((metrics.reconnect_count * 10000) / events) : 0) / 100).toFixed(2)}%`;
    $("events").textContent = `${metrics.reconnect_count} 次重连 / ${events} 次连接事件`;
    $("polls").textContent = metrics.fallback_poll_count;
    $("reconnecting").textContent = metrics.reconnecting ? "正在自动重连" : "当前未处于重连";
    $("reconnecting").dataset.state = metrics.reconnecting ? "warning" : "ready";
    $("session-times").innerHTML = [
      ["会话开始", metrics.session_started_at],
      ["最近重连", metrics.last_reconnect_at],
      ["最近降级轮询", metrics.last_fallback_poll_at],
    ]
      .map(([key, value]) => `<div><dt>${key}</dt><dd>${when(value)}</dd></div>`)
      .join("");
    const summaryLabels = {
      api: "后端接口",
      database: "数据库",
      dashboard_reads: "15 分钟访问",
      active_organizations: "活动组织",
      active_users: "活动用户",
    };
    $("summary").innerHTML = Object.entries(data.summary)
      .map(
        ([key, value]) => `<div><dt>${summaryLabels[key]}</dt><dd>${esc(label(value))}</dd></div>`,
      )
      .join("");
    for (const key of ["collections", "sources"])
      $(key).innerHTML =
        data[key]
          .map(
            (row) =>
              `<div class="count-row"><span>${label(row.status)}</span><strong>${row.total}</strong></div>`,
          )
          .join("") ||
        `<p class="section-intro">${key === "collections" ? "当前没有采集任务状态记录。" : "当前没有来源配置记录。"}</p>`;
    $("response-time").textContent = when(data.observed_at);
  }
  function render() {
    for (const [key, title] of Object.entries(titles)) {
      $(`${key}-view`).hidden = section !== key;
      const button = document.querySelector(`[data-section="${key}"]`);
      button.setAttribute("aria-pressed", String(section === key));
      if (section === key) {
        $("section-kicker").textContent = title[0];
        $("section-title").textContent = title[1];
      }
    }
    $("refresh").disabled = busy;
    $("refresh").textContent = busy ? "刷新中…" : "刷新数据";
    $("retry").disabled = busy;
    $("retry").hidden = busy;
    $("content").hidden = !hasData;
    $("content").setAttribute("aria-busy", String(busy));
    $("unavailable").hidden = hasData;
    $("unavailable-title").textContent = busy ? "正在读取管理数据" : "管理数据暂不可用";
    $("unavailable-description").textContent = busy
      ? "尚未取得成功观测，不显示任何正常结论。"
      : "本次没有可展示的成功观测；请检查失败说明后重试。";
    $("failure").hidden = !failure;
    $("failure").textContent = failure;
    $("observation").textContent = hasData
      ? `${busy ? "刷新中 · 保留观测" : failure ? "上次成功观测" : "响应观测"} ${when(data.observed_at)}`
      : "尚无成功观测";
    renderFacts();
  }
  function errorMessage(outcome) {
    const messages = {
      network: "网络读取失败。",
      permission: "无权读取此管理数据。",
      server: "管理服务暂不可用。",
    };
    if (outcome === "timeout")
      return hasData
        ? "读取超过 15 秒，已停止本次请求并保留上次成功数据。"
        : "读取超过 15 秒，已停止本次请求。尚无成功数据可保留。";
    return `${messages[outcome]}${hasData ? " 已保留上次成功数据。" : ""}`;
  }
  function load() {
    if (busy) return;
    const current = ++serial,
      outcome = $("outcome").value;
    requests += 1;
    busy = true;
    failure = "";
    render();
    // Only an accelerated visual transition, never a production timeout test.
    timer = setTimeout(() => {
      if (current !== serial) return;
      if (outcome === "success") {
        data = { ...structuredClone(base), metrics: data.metrics };
        hasData = true;
      } else failure = errorMessage(outcome);
      busy = false;
      render();
    }, 450);
  }
  function setScene(value) {
    stop();
    data = structuredClone(base);
    section = "attention";
    hasData = true;
    failure = "";
    $("outcome").value = "success";
    $("technical").open = value === "technical";
    $("review-note").textContent =
      `审核场景：${scenes[value]}。历史隔离样本；无HTTP、无存储写入、无服务操作。`;
    if (["dependencies", "session", "activity"].includes(value)) section = value;
    if (value.startsWith("initial-")) {
      hasData = false;
      const outcome = value.slice(8);
      busy = outcome === "loading";
      if (!busy) failure = errorMessage(outcome);
    }
    if (value === "refresh-busy") busy = true;
    if (value === "refresh-failed") failure = errorMessage("network");
    if (value === "refresh-timeout") failure = errorMessage("timeout");
    if (value === "missing-redis")
      data.services = data.services.filter((node) => node.code !== "redis");
    if (value === "missing-all") {
      data.services = [];
      section = "dependencies";
    }
    if (value === "no-warnings")
      data.services.forEach((node) => {
        node.status = "ready";
      });
    if (value === "counts-empty") {
      section = "activity";
      data.collections = [];
      data.sources = [];
    }
    if (value === "session-reconnecting") {
      section = "session";
      data.metrics.reconnecting = true;
    }
    if (value === "session-zero") {
      section = "session";
      Object.assign(data.metrics, {
        connection_open_count: 0,
        reconnect_count: 0,
        fallback_poll_count: 0,
        last_reconnect_at: null,
        last_fallback_poll_at: null,
      });
    }
    render();
    window.scrollTo(0, 0);
  }
  $("scene").innerHTML = Object.entries(scenes)
    .map(([key, value]) => `<option value="${key}">${value}</option>`)
    .join("");
  $("scene").addEventListener("change", (event) => setScene(event.target.value));
  $("refresh").addEventListener("click", load);
  $("retry").addEventListener("click", load);
  $("sections").addEventListener("click", (event) => {
    const button = event.target.closest("[data-section]");
    if (!button) return;
    section = button.dataset.section;
    render();
  });
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a.action-link");
    if (!link) return;
    event.preventDefault();
    $("review-note").textContent =
      `设计演示已核对管理入口：${link.getAttribute("href")}。未导航、未发请求、未操作服务。`;
  });
  window.addEventListener("pagehide", stop);
  window.STATUS_DESIGN_DIAGNOSTICS = () => ({
    requests,
    busy,
    hasData,
    section,
    observed_at: data.observed_at,
  });
  setScene("attention");
})();
