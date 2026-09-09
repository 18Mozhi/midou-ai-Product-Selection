/* Offline proposal. No HTTP, production probes, persistence or system clipboard. */
(() => {
  const D = window.RELEASE_DATA,
    L = window.RELEASE_LOGIC,
    $ = (s) => document.querySelector(s),
    clone = (v) => JSON.parse(JSON.stringify(v)),
    esc = (v) =>
      String(v ?? "未记录").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
      ),
    stateText = {
      verified: "服务结论：观察门已通过",
      blocked: "服务结论：条件未满足",
      stale: "服务结论：证据已过期",
      stopped: "服务结论：已停止",
      rolled_back: "服务结论：已回滚",
      empty: "尚无发布记录",
    },
    statusText = {
      healthy: "健康",
      pending: "待观察",
      passed: "已通过",
      failed: "失败",
      stopped: "已停止",
      rolled_back: "已回滚",
    },
    blockerText = {
      rollout_gates_incomplete: "发布观察门未完成",
      rollout_evidence_stale: "发布观察证据已过期",
      current_release_evidence_missing: "当前版本缺少匹配证据",
      release_identity_mismatch: "版本、迁移或配置不同源",
      release_source_mismatch: "部署捕获SHA不一致",
    },
    errorText = {
      loading: "正在读取发布事实",
      forbidden: "你没有平台运维权限",
      expired: "登录已失效",
      rate_limited: "刷新过于频繁",
      timeout: "发布事实读取超时",
      unavailable: "发布事实暂不可用",
    },
    columns = ["阶段与观察记录", "服务错误率", "读取P95", "写入P95", "异步延迟", "技术信息"],
    when = (v) =>
      v
        ? new Date(v).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })
        : "未记录",
    metric = (v, u) =>
      v == null ? "未记录" : Number.isFinite(Number(v)) ? `${v}${u}` : `无效值：${v}`,
    duration = (v) =>
      v == null || !Number.isFinite(Number(v))
        ? "未记录"
        : Number(v) < 1000
          ? `${v} ms`
          : `${(v / 1000).toFixed(1)} 秒`,
    status = (v) => statusText[v] || "尚无状态";
  const scenes = {
    ...D.labels,
    loading: "首次加载",
    forbidden: "无运维权限",
    expired: "登录已失效",
    rate_limited: "首次限流",
    timeout: "首次超时",
    unavailable: "首次不可用",
    "refresh-pending": "保留快照刷新中",
    "refresh-timeout": "刷新超时保留",
    "refresh-rate_limited": "刷新限流保留",
    "refresh-unavailable": "刷新不可用保留",
    "refresh-forbidden": "刷新无权清快照",
    "refresh-expired": "刷新过期清快照",
    superadmin: "超管接口覆盖入口",
    "detail-5": "5%门完整详情",
    "detail-25": "25%门完整详情",
    "detail-100": "100%门完整详情",
    "detail-missing": "空指标门详情",
    "detail-long": "长技术代码详情",
    "gate-tech": "桌面门技术展开",
    "blocker-tech": "服务原始建议展开",
    "identity-tech": "完整配置和来源披露",
    "request-tech": "请求编号展开",
    "copy-success": "版本复制成功模拟",
    "copy-denied": "版本复制拒绝反馈",
    "request-copy-denied": "请求复制拒绝反馈",
    "columns-open": "六列设置",
    "one-column": "只保留一列",
    unfrozen: "取消首列冻结",
    compact: "紧凑指标表",
    dark: "深色审图变体",
    contrast: "高对比审图变体",
    focus: "键盘焦点",
    hover: "按钮悬停",
    pressed: "按钮按下",
    "review-tools": "审核场景工具",
  };
  let S,
    seq = 0,
    returnFocus;
  function copyUI(key, value) {
    const label = {
      "production-sha": "生产运行SHA",
      "local-sha": "本地构建SHA",
      "remote-sha": "远端分支SHA",
      request: "本次请求编号",
      "refresh-request": "刷新请求编号",
    }[key];
    return `<div class="copy-line"><code>${esc(value || "未记录")}</code><button data-copy="${key}" ${!value ? "disabled" : ""} aria-label="复制${label}">复制</button></div><p class="copy-feedback" id="copy-${key}" aria-live="polite">${esc(S.copied[key] || "")}</p>`;
  }
  function requestTech(id) {
    return `<details class="request-tech" id="${id}"><summary>本次读取技术详情</summary><p class="meta">请求编号；合成审核值</p>${copyUI(id, S.requestId)}</details>`;
  }
  function gateTech(g, open = false) {
    return `<details class="gate-tech" ${open ? "open" : ""}><summary>技术详情</summary><dl>${[
      ["门禁ID", g.id],
      ["门禁类型", g.gate_kind],
      ["发布ID", g.release_id],
      ["原始状态", g.status],
      ["失败代码", g.failure_code],
      ["请求编号", g.request_id],
      ["链路编号", g.trace_id],
    ]
      .map(([k, v]) => `<div><dt>${k}</dt><dd><code>${esc(v)}</code></dd></div>`)
      .join("")}</dl></details>`;
  }
  function warnings(d) {
    const out = [];
    if (
      d.latest_release &&
      d.gates.filter((g) => g.gate_kind.startsWith("canary_")).some((g) => !g.finished_at)
    )
      out.push("部分观察门未记录完成时间，不能据此推断完整的证据有效期。");
    if (d.gates.some((g) => g.finished_at && Date.parse(g.finished_at) > Date.parse(d.observed_at)))
      out.push("门完成时间晚于观测时间，请核对来源时间；本稿保留服务结论。");
    if (
      d.gates.some((g) =>
        [g.error_rate_percent, g.read_p95_ms, g.write_p95_ms, g.async_lag_seconds].some(
          (v) => v != null && Number(v) < 0,
        ),
      )
    )
      out.push("存在负数实测指标，需核对原始记录；不在展示层修改判定。");
    if (
      d.policy.percentages.some((p) => {
        const g = d.gates.find((g) => g.gate_kind === `canary_${p}`);
        return g && Number(g.traffic_percent) !== p;
      })
    )
      out.push("实际流量百分比与门类型标签不一致。两项都保留，不替换来源值。");
    if (
      d.gates.some((g) => g.gate_kind === "rollback" && g.status === "rolled_back") &&
      !d.rollback_verified
    )
      out.push("返回回滚门与rollback_verified标记不一致；本场景保留原始夹具差异。");
    return out.length
      ? `<section class="notice" id="fact-warning"><h3>证据字段需要核对</h3>${out.map((t) => `<p>${t}</p>`).join("")}</section>`
      : "";
  }
  function identity(d) {
    const v = d.versions,
      prod = v.production,
      shaValues = [v.local.build_sha, v.remote.build_sha, prod.build_sha],
      same = shaValues.every(Boolean) && new Set(shaValues).size === 1;
    return `<section class="sheet" id="identity" tabindex="-1"><div class="sheet-header"><div><h2>运行版本与证据对照</h2><p>观测于 ${when(d.observed_at)}；不是刷新时的实时Git查询。</p></div><div class="verdict">${stateText[d.state]}<small>返回状态：${esc(d.state)}</small></div></div><div class="identity"><section><h3>生产运行身份</h3><code class="running-sha">${esc(prod.build_sha || "未记录SHA")}</code><dl class="pair"><div><dt>应用版本</dt><dd>${esc(prod.app_version)}</dd></div><div><dt>迁移版本</dt><dd>${esc(prod.migration_version)}</dd></div></dl><details class="fingerprint" id="identity-tech"><summary>完整版本与配置指纹</summary><p class="meta">运行SHA</p>${copyUI("production-sha", prod.build_sha)}<p class="meta">配置指纹（非秘密配置标识）</p><code>${esc(prod.config_fingerprint)}</code></details></section><section><h3>部署时捕获的来源</h3><div class="source-row"><strong>本地构建输入</strong>${copyUI("local-sha", v.local.build_sha)}</div><div class="source-row"><strong>远端分支输入</strong>${copyUI("remote-sha", v.remote.build_sha)}<dl><div><dt>仓库</dt><dd>${esc(v.remote.repository)}</dd></div><div><dt>分支</dt><dd>${esc(v.remote.branch)}</dd></div></dl></div></section></div><div class="comparison-note"><b>${same ? "三个返回SHA文本相同" : shaValues.every(Boolean) ? "返回SHA文本不一致" : "返回SHA信息不足"}</b><p>来源字段可由配置或服务回退为运行SHA。相同文本不是三方独立核验，当前接口未提供来源凭据，不能据此宣称版本已完整验收。</p></div><div class="record-match"><h3>匹配当前SHA的发布记录</h3>${d.latest_release ? `<dl><div><dt>记录状态</dt><dd>${status(d.latest_release.status)}</dd></div><div><dt>完成时间</dt><dd>${when(d.latest_release.finished_at)}</dd></div><div><dt>记录编号</dt><dd><code>${esc(d.latest_release.id)}</code></dd></div></dl><details><summary>核对记录中的身份字段</summary><dl><div><dt>应用版本</dt><dd>${esc(d.latest_release.app_version)}</dd></div><div><dt>迁移版本</dt><dd>${esc(d.latest_release.migration_version)}</dd></div><div><dt>配置指纹</dt><dd><code>${esc(d.latest_release.config_fingerprint)}</code></dd></div></dl></details>` : '<p class="empty">最近10条查询窗口内没有匹配当前SHA的发布记录。旧版本的历史记录不能替代当前版本证据。</p>'}</div></section>`;
  }
  function gateTable(d) {
    const rows = d.gates.filter((g) => g.gate_kind.startsWith("canary_")),
      visible = columns.map((_, i) => i).filter((i) => !S.hidden.includes(i)),
      p = d.policy;
    const threshold = [
      "记录值，不是当前分流配置",
      `< ${p.error_rate_stop_percent}%`,
      `≤ ${p.read_p95_stop_ms} ms`,
      `≤ ${p.write_p95_stop_ms} ms`,
      `≤ ${p.async_lag_stop_seconds} s`,
      "完整来源标识",
    ];
    return `<section class="sheet" id="gates" tabindex="-1"><div class="sheet-header"><div><h2>匹配版本的历史观察证据</h2><p>以下为历史门记录；当前固定目录、单后端部署不执行这套分流流程。</p></div><span class="meta">最低观察 ${p.minimum_observation_seconds} 秒<br>证据时效 ${p.maximum_evidence_age_minutes} 分钟</span></div><div class="gate-strip">${p.percentages
      .map((percent) => {
        const g = d.gates.find((g) => g.gate_kind === `canary_${percent}`);
        return `<div class="stage"><strong>${percent}%</strong><span>${g ? `原始状态：${status(g.status)}` : "未返回该门"}</span><span>${g ? (L.gatePassed(g, p) ? "门指标条件满足" : "门指标条件未满足") : "不以缺失记录代替0"}</span><small>${g ? `记录观察 ${metric(g.observe_seconds, " 秒")}，样本 ${metric(g.sample_count, " 个")}` : "等待匹配记录"}</small></div>`;
      })
      .join(
        "",
      )}</div><p class="meta">单门条件不是当前发布验收；重复类型只以首个匹配门参与服务required判定，表格保留全部返回门。</p><div class="thresholds"><b>服务判定阈值</b><span>错误率 &lt; ${p.error_rate_stop_percent}%</span><span>读取P95 ≤ ${p.read_p95_stop_ms} ms</span><span>写入P95 ≤ ${p.write_p95_stop_ms} ms</span><span>异步延迟 ≤ ${p.async_lag_stop_seconds} s</span></div><div class="desktop"><div class="tools"><details class="column-menu" id="column-menu"><summary>列设置</summary><fieldset><legend>至少保留一列</legend>${columns.map((c, i) => `<label><input type="checkbox" data-col="${i}" ${S.hidden.includes(i) ? "" : "checked"} ${visible.length === 1 && visible[0] === i ? "disabled" : ""}/>${c}</label>`).join("")}</fieldset></details><button id="freeze" aria-pressed="${S.freeze}">${S.freeze ? "首列已冻结" : "首列未冻结"}</button><label>密度<select id="density"><option value="standard" ${S.density === "standard" ? "selected" : ""}>标准</option><option value="compact" ${S.density === "compact" ? "selected" : ""}>紧凑</option></select></label></div><div class="table-wrap" tabindex="0" aria-label="门禁指标表格，可横向滚动"><table class="${S.density}"><thead><tr>${visible.map((i, j) => `<th scope="col" class="${j === 0 && S.freeze ? "frozen" : ""}">${columns[i]}<small>${esc(threshold[i])}</small></th>`).join("")}</tr></thead><tbody>${rows
      .map((g) => {
        const cells = [
          `<strong>${esc(g.gate_kind.replace("canary_", ""))}%门</strong><span>实际流量 ${metric(g.traffic_percent, "%")}</span><span class="meta">${status(g.status)}；${metric(g.observe_seconds, " 秒")} / ${metric(g.sample_count, " 个")}</span>`,
          metric(g.error_rate_percent, "%"),
          metric(g.read_p95_ms, " ms"),
          metric(g.write_p95_ms, " ms"),
          metric(g.async_lag_seconds, " s"),
          gateTech(g),
        ];
        return `<tr>${visible.map((i, j) => `<td class="${j === 0 && S.freeze ? "frozen" : ""}">${cells[i]}</td>`).join("")}</tr>`;
      })
      .join(
        "",
      )}</tbody></table></div></div><div class="mobile">${rows.map((g) => `<button class="gate-card" data-detail="${esc(g.id)}" aria-haspopup="dialog"><strong>${esc(g.gate_kind.replace("canary_", ""))}%观察门</strong><span>${status(g.status)}；实际流量 ${metric(g.traffic_percent, "%")}</span><span>错误率 ${metric(g.error_rate_percent, "%")}</span><small>读取 ${metric(g.read_p95_ms, " ms")}；写入 ${metric(g.write_p95_ms, " ms")}</small><span class="detail-link">查看指标与完整来源</span></button>`).join("")}</div>${!rows.length ? '<p class="empty">没有匹配当前SHA的观察门指标。历史版本记录不提供当前门数据。</p>' : ""}</section>`;
  }
  function actions(d) {
    return `<section class="sheet"><div class="sheet-header"><div><h2>历史动作与最近记录</h2><p>只展示结果和计时，不启动动作，也不证明此刻的流量去向。</p></div></div>${[
      "migration",
      "rollback",
    ]
      .map((kind) => {
        const g = d.gates.find((g) => g.gate_kind === kind);
        return `<article class="action-row"><header><h3>${kind === "migration" ? "迁移记录" : "回滚记录"}</h3><strong>${duration(g?.duration_ms)}</strong></header><p>${g ? status(g.status) : "未返回动作门"}；未知耗时不按0替代。</p><dl><div><dt>开始时间</dt><dd>${when(g?.started_at)}</dd></div><div><dt>结束时间</dt><dd>${when(g?.finished_at)}</dd></div><div><dt>门记录编号</dt><dd><code>${esc(g?.id)}</code></dd></div></dl></article>`;
      })
      .join(
        "",
      )}<div class="comparison-note"><p>自动停止门证据：${d.automatic_stop_verified ? "服务标记存在" : "服务未标记存在"}；回滚门证据：${d.rollback_verified ? "服务标记存在" : "服务未标记存在"}。</p><p>停止/回滚的整体状态也可来自发布记录状态，不能自动等同对应动作门已核验。</p></div><div class="history"><h3>最近一条历史发布记录</h3>${d.latest_historical_release ? `<dl><div><dt>记录编号</dt><dd><code>${esc(d.latest_historical_release.id)}</code></dd></div><div><dt>与匹配记录的关系</dt><dd>${d.latest_release?.id === d.latest_historical_release.id ? "同一条记录" : "不同记录；不混用门指标"}</dd></div><div class="wide"><dt>历史构建SHA</dt><dd><code>${esc(d.latest_historical_release.build_sha)}</code></dd></div><div><dt>完成时间</dt><dd>${when(d.latest_historical_release.finished_at)}</dd></div><div><dt>记录状态</dt><dd>${status(d.latest_historical_release.status)}</dd></div></dl>` : '<p class="empty">未返回历史发布记录。</p>'}</div></section>`;
  }
  function render() {
    const d = S.data;
    $("#app").innerHTML =
      `<header class="masthead"><div><div class="brand">ScoutOps / 平台运维</div><h1>发布证据</h1><p>当前版本与历史记录分开核对。本页只读；发布与回滚不在这里执行。</p></div><div class="head-tools"><button id="refresh" ${S.pending ? "disabled" : ""} aria-busy="${Boolean(S.pending)}">${S.pending ? "正在刷新…" : "刷新发布事实"}</button>${S.superadmin ? '<a id="coverage" href="/platform-admin/api-coverage">查看接口覆盖证据</a>' : ""}</div></header><nav class="page-nav" aria-label="本页目录"><a href="#identity">当前版本</a><a href="#gates">历史观察</a><a href="#blockers">阻断说明</a></nav><main>${S.failure ? `<section class="notice" aria-live="polite"><h3>${errorText[S.failure]}</h3><p>${S.failure === "timeout" ? "15秒读取边界已停止本次等待。" : "本次读取未完成。"}下方保留上次成功快照，观测时间未更新。</p><button id="retry">重新核验</button>${requestTech("refresh-request")}</section>` : ""}${d ? `${warnings(d)}${identity(d)}${gateTable(d)}${actions(d)}<section class="sheet" id="blockers" tabindex="-1"><div class="sheet-header"><div><h2>服务返回的阻断说明</h2><p>原始建议包含历史流程描述，不作为当前部署操作指令。</p></div></div>${d.blockers.map((b) => `<article class="blocker"><h3>${esc(blockerText[b.code] || "发布条件未满足")}</h3><p>核对版本归属、来源字段或历史观察事实。当前生产仍使用固定目录单后端部署。</p><details><summary>查看原始代码与服务建议</summary><code>${esc(b.code)}</code><p>${esc(b.action_hint)}</p><p class="meta">以上为服务原文；不据此启用历史双槽分流或写探针。</p></details></article>`).join("") || '<p class="empty">服务未返回阻断项；这不是独立来源证据或生产健康验收。</p>'}</section>` : `<section class="sheet first-state" id="identity" tabindex="-1" aria-live="polite">${S.first === "loading" ? '<div class="busy-line"></div>' : ""}<h2>${errorText[S.first]}</h2><p>${S.first === "loading" ? "读取当前版本身份及匹配的历史证据。" : "未展示受保护的发布数据。请按状态恢复会话、稍后重试或联系管理员。"}</p>${S.first === "expired" ? '<a id="login" href="/login">重新登录</a>' : S.first !== "forbidden" ? `<button id="retry" ${S.pending ? "disabled" : ""}>重新核验</button>` : ""}</section>`}<p class="footer-note">当前合同：固定目录 / 单宝塔Node后端。历史渐进观察不代表现行部署能力。本审核稿没有真实HTTP、读取审计或发布操作。</p>${requestTech("request")}</main>`;
    $("#refresh").onclick = read;
    if (d) $(".verdict").dataset.state = d.state;
    if ($("#retry")) $("#retry").onclick = read;
    for (const id of ["coverage", "login"])
      if ($("#" + id))
        $("#" + id).onclick = (e) => {
          e.preventDefault();
          S.navigation.push(e.currentTarget.getAttribute("href"));
        };
    document.querySelectorAll(".page-nav a").forEach(
      (a) =>
        (a.onclick = (e) => {
          e.preventDefault();
          const n = $(a.getAttribute("href")) || $("#identity");
          n.focus();
          n.scrollIntoView({ block: "start" });
        }),
    );
    document
      .querySelectorAll("[data-copy]")
      .forEach((b) => (b.onclick = () => copy(b.dataset.copy)));
    document
      .querySelectorAll("[data-detail]")
      .forEach((b) => (b.onclick = () => openDetail(b.dataset.detail, b)));
    document.querySelectorAll("[data-col]").forEach(
      (b) =>
        (b.onchange = () => {
          const i = Number(b.dataset.col);
          if (S.hidden.includes(i)) S.hidden = S.hidden.filter((n) => n !== i);
          else if (S.hidden.length < 5) S.hidden.push(i);
          render();
          $("#column-menu").open = true;
          $(`[data-col="${i}"]`).focus();
        }),
    );
    if ($("#freeze"))
      $("#freeze").onclick = () => {
        S.freeze = !S.freeze;
        render();
        $("#freeze").focus();
      };
    if ($("#density"))
      $("#density").onchange = (e) => {
        S.density = e.target.value;
        render();
        $("#density").focus();
      };
  }
  function read() {
    if (S.pending) return;
    S.pending = ++seq;
    S.reads.push({ id: S.pending, method: "GET", path: "/platform/operations/releases" });
    S.failure = null;
    if (!S.data) S.first = "loading";
    closeDetail();
    render();
  }
  function completeRead(outcome = "success", id = S.pending) {
    if (!S.pending || S.pending !== id) return false;
    S.pending = null;
    S.requestId = `synthetic-read-${id}`;
    if (outcome === "success") {
      S.data = clone(D.datasets.verified);
      S.first = null;
      S.failure = null;
    } else if (S.data && !["expired", "forbidden"].includes(outcome)) S.failure = outcome;
    else {
      S.data = null;
      S.first = outcome;
    }
    S.copied = {};
    closeDetail();
    render();
    return true;
  }
  function copy(key) {
    S.copied[key] = S.copyDenied
      ? "复制被拒绝，请手动选取完整值。（离线模拟）"
      : "已复制（离线模拟，未写入系统剪贴板）";
    $("#copy-" + key).textContent = S.copied[key];
  }
  function openDetail(id, trigger) {
    const g = S.data.gates.find((g) => g.id === id),
      p = S.data.policy;
    returnFocus = trigger || $("#gates");
    $("#detail").innerHTML =
      `<header><div><h2 id="detail-title">${esc(g.gate_kind.replace("canary_", ""))}%观察门</h2></div><button id="close" aria-label="关闭详情">关闭</button></header><p id="detail-description">只读历史门；实测、原始状态与条件判断分别展示。</p><dl class="field-list">${[
        ["原始观察状态", status(g.status)],
        ["门指标条件", L.gatePassed(g, p) ? "满足记录条件，不等于整次发布通过" : "未满足记录条件"],
        ["实际流量", metric(g.traffic_percent, "%")],
        [
          "记录观察时长 / 样本",
          `${metric(g.observe_seconds, " 秒")} / ${metric(g.sample_count, " 个")}`,
        ],
        [`服务错误率（< ${p.error_rate_stop_percent}%）`, metric(g.error_rate_percent, "%")],
        [`读取P95（≤ ${p.read_p95_stop_ms} ms）`, metric(g.read_p95_ms, " ms")],
        [`写入P95（≤ ${p.write_p95_stop_ms} ms）`, metric(g.write_p95_ms, " ms")],
        [`异步延迟（≤ ${p.async_lag_stop_seconds} s）`, metric(g.async_lag_seconds, " s")],
        ["开始时间", when(g.started_at)],
        ["完成时间", when(g.finished_at)],
        ["起止间隔（服务计算）", duration(g.duration_ms)],
      ]
        .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
        .join("")}</dl>${gateTech(g, S.key === "detail-long")}`;
    $("#detail").showModal();
    $("#detail").scrollTop = 0;
    $("#close").onclick = closeDetail;
    $("#close").focus();
  }
  function closeDetail() {
    if ($("#detail").open) {
      $("#detail").close();
      if (returnFocus?.isConnected) returnFocus.focus();
    }
  }
  $("#detail").addEventListener("cancel", (e) => {
    e.preventDefault();
    closeDetail();
  });
  $("#detail").addEventListener("click", (e) => {
    if (e.target !== $("#detail")) return;
    const r = e.target.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
      closeDetail();
  });
  $("#detail").addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const ns = [...$("#detail").querySelectorAll("button,summary")].filter(
        (n) => n.getClientRects().length,
      ),
      f = ns[0],
      l = ns.at(-1);
    if (e.shiftKey && document.activeElement === f) {
      e.preventDefault();
      l.focus();
    } else if (!e.shiftKey && document.activeElement === l) {
      e.preventDefault();
      f.focus();
    }
  });
  function scene(key) {
    if (!scenes[key]) throw new Error("Unknown scene " + key);
    closeDetail();
    ++seq;
    S = {
      key,
      data: clone(D.datasets[key] || D.datasets.verified),
      first: null,
      failure: null,
      pending: null,
      superadmin: key === "superadmin",
      reads: [],
      navigation: [],
      hidden: [],
      freeze: true,
      density: "standard",
      copied: {},
      copyDenied: false,
      requestId: "synthetic-release-read-65",
    };
    if (errorText[key]) {
      S.data = null;
      S.first = key;
      if (key === "loading") S.pending = ++seq;
    }
    if (key.startsWith("refresh-")) {
      S.pending = ++seq;
      if (key !== "refresh-pending") completeRead(key.slice(8));
    }
    if (key === "detail-long") S.data = clone(D.datasets.long);
    if (key === "detail-missing") S.data = clone(D.datasets["missing-metric"]);
    if (key === "blocker-tech") S.data = clone(D.datasets["missing-gate"]);
    if (key === "one-column") S.hidden = [0, 1, 2, 3, 4];
    if (key === "unfrozen") S.freeze = false;
    if (key === "compact") S.density = "compact";
    document.body.className = ["dark", "contrast"].includes(key) ? key : "";
    render();
    $("#scene").value = key;
    $("#review-tools").open = key === "review-tools";
    if (key.startsWith("detail-")) {
      const percent = Number(key.slice(7)) || 5,
        g = S.data.gates.find((g) => g.gate_kind === `canary_${percent}`);
      openDetail(g.id, $(`[data-detail="${g.id}"]`));
    }
    if (key === "gate-tech") document.querySelector("tbody .gate-tech").open = true;
    if (key === "blocker-tech")
      document.querySelectorAll(".blocker details").forEach((n) => (n.open = true));
    if (["identity-tech", "copy-success", "copy-denied"].includes(key)) {
      $("#identity-tech").open = true;
      if (key.startsWith("copy-")) {
        S.copyDenied = key === "copy-denied";
        copy("production-sha");
      }
    }
    if (["request-tech", "request-copy-denied"].includes(key)) {
      document.querySelector("#request").open = true;
      if (key === "request-copy-denied") {
        S.copyDenied = true;
        copy("request");
      }
    }
    if (["columns-open", "one-column"].includes(key)) $("#column-menu").open = true;
    if (key === "focus") $("#refresh").focus();
    if (!key.startsWith("detail-")) window.scrollTo(0, 0);
  }
  $("#scene").innerHTML = Object.entries(scenes)
    .map(([k, t]) => `<option value="${k}">${esc(t)}</option>`)
    .join("");
  $("#scene").onchange = (e) => scene(e.target.value);
  window.RELEASE_C = {
    scenes,
    scene,
    state: () => clone(S),
    read,
    completeRead,
    openDetail,
    closeDetail,
  };
  scene("current-missing");
})();
