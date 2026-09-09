(() => {
  "use strict";
  const D = window.SCHEDULER_DATA,
    esc = (v) =>
      String(v ?? "未记录").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
      ),
    time = (v) => (v ? new Date(v).toLocaleString("zh-CN", { hour12: false }) : "未记录"),
    states = {
      ready: "当前调度判门满足",
      warning: "当前调度需要关注",
      blocked: "当前调度判门阻断",
      loading: "正在读取调度证据",
      empty: "尚无调度观测",
      expired: "登录已失效",
      forbidden: "没有平台运维权限",
      rate_limited: "刷新过于频繁",
      timeout: "本次读取超时",
      unavailable: "调度事实暂不可用",
      recovering: "回收请求等待结果（模拟）",
    },
    names = {
      crawler_worker_count_exceeded: "Worker实例数量不符",
      crawler_process_count_exceeded: "Crawler实例数量不符",
      crawler_global_concurrency_exceeded: "全局槽位超限",
      crawler_lease_duplicate: "租约或档案独占异常",
      crawler_provider_quota_exceeded: "来源配额超限",
      crawler_provider_circuit_open: "来源处于熔断",
      crawler_resource_observation_stale: "资源观测过期或时间异常",
      crawler_resource_stop: "资源达到停止线",
      crawler_resource_warning: "资源接近停止线",
      crawler_completion_spool_missing: "没有回执水位",
      crawler_completion_spool_stale: "回执观测过期或时间异常",
      crawler_completion_spool_disk_stop: "回执磁盘触线",
      crawler_completion_spool_capacity_stop: "回执容量触线",
      crawler_completion_spool_capacity_warning: "回执容量预警",
      crawler_completion_spool_retention_warning: "回执达到保留期",
      crawler_completion_spool_quarantine_pending: "隔离回执待审阅",
    },
    scenes = {
      ...D.labels,
      loading: "首次加载",
      empty: "空响应",
      expired: "首次401",
      forbidden: "首次403",
      rate_limited: "首次429",
      timeout: "首次读取超时",
      unavailable: "首次依赖失败",
      refreshing: "旧快照刷新中",
      "refresh-timeout": "旧快照超时",
      "refresh-rate_limited": "旧快照限流",
      "refresh-unavailable": "旧快照失败",
      "generic-error": "错误无请求ID",
      "request-detail": "成功请求详情",
      "failure-detail": "首次错误详情",
      "refresh-detail": "旧快照错误详情",
      "copy-success": "模拟复制成功",
      "copy-denied": "成功ID复制拒绝",
      "failure-copy-denied": "首次错误ID复制拒绝",
      "refresh-copy-denied": "旧快照错误ID复制拒绝",
      focus: "刷新键盘焦点",
      hover: "刷新悬停",
      pressed: "刷新按下",
      "review-tools": "审核场景选择器",
      "filter-all": "全部来源",
      "filter-open": "已熔断范围",
      "filter-queued": "有排队范围",
      "search-hit": "来源代码搜索",
      "search-none": "搜索无结果",
      "page-two": "来源第二页",
      "page-three": "来源第三页",
      "last-error": "最近失败展开",
      "lease-detail": "租约技术详情展开",
      "expired-confirm": "回收影响确认",
      "expired-typed": "回收确认词正确",
      "expired-wrong": "回收确认词错误",
      "expired-zero-confirm": "零过期快照确认",
      "expired-unknown-confirm": "无快照影响未知确认",
      "provider-confirm": "来源身份确认",
      "provider-typed": "来源确认词正确",
      "provider-wrong": "来源确认词错误",
      "provider-long-confirm": "长来源身份确认",
      "expired-pending": "回收请求处理中",
      "provider-pending": "来源恢复处理中",
      recovering: "无快照回收中",
      "expired-success": "回收成功与新读取分离",
      "expired-zero-result": "回收0槽位结果",
      "provider-success": "来源恢复成功",
      "provider-zero-result": "来源无需恢复",
      "expired-unknown": "回收结果未知",
      "provider-unknown": "来源结果未知",
      "expired-rejected": "回收请求拒绝",
      "provider-rejected": "健康证据不足拒绝",
      "expired-auth": "回收权限失效",
      "provider-auth": "来源恢复权限失效",
      "expired-read-failed": "回收成功随后读取失败",
      "provider-read-failed": "来源恢复成功随后读取失败",
    };
  let current,
    sequence = 0,
    returnFocus = "",
    oldOverflow = "";
  const logical = () =>
      window.SCHEDULER_LOGIC(current.data, current.query, current.filter, current.page),
    busy = () => !!current.pending || !!current.mutation,
    technical = (id, v) =>
      v
        ? `<details class="technical" id="${id}"><summary>技术信息 · 请求ID</summary><code>${esc(v)}</code><button data-copy="${id}" aria-label="复制请求ID">复制请求ID</button><span class="copy-result" role="status" id="copy-${id}"></span></details>`
        : "";
  function provider(p, index, L) {
    const risk =
      p.queued_tasks === 0
        ? "当前无排队"
        : p.sample_count_24h === 0 || p.queue_wait_p95_seconds <= 0
          ? "当前比较依据不足"
          : p.longest_queue_wait_seconds > p.queue_wait_p95_seconds
            ? "最长等待高于返回P95，需关注"
            : "最长等待未超过返回P95";
    return `<article class="provider" data-id="${p.id}"><header><h3>${esc(p.code)}</h3><span class="pill ${p.circuit_state === "open" ? "warning" : "ready"}">${p.circuit_state === "open" ? "已熔断" : "未熔断"}</span></header><div class="provider-grid"><section><h4>活动 / 有效并发</h4><strong>${p.active_leases} / ${p.effective_concurrency}</strong>${p.effective_concurrency > 0 && p.active_leases <= p.effective_concurrency ? `<progress aria-label="${esc(p.code)}活动来源槽位" aria-valuetext="${p.active_leases} / ${p.effective_concurrency}" value="${p.active_leases}" max="${p.effective_concurrency}"></progress>` : '<p class="note caution">有效上限或活动数量异常，保留原值。</p>'}<small>来源配置 ${p.configured_concurrency}；单机合同上限1</small></section><section><h4>当前到期待领取</h4><strong>${p.queued_tasks} 个</strong><p>最长 ${esc(L.duration(p.longest_queue_wait_seconds))}</p><small>${risk}</small></section><section><h4>等待与完成样本</h4><p>P50 ${esc(L.duration(p.queue_wait_p50_seconds))}<br>P95 ${esc(L.duration(p.queue_wait_p95_seconds))}</p><p>完成样本 ${p.sample_count_24h}；成功率 ${esc(L.rate(p.success_rate_basis_points_24h))}<br>耗时P95 ${esc(L.milliseconds(p.duration_p95_ms_24h))}</p></section></div><div class="provider-actions"><small>连续失败 ${p.consecutive_failures} / ${p.circuit_failure_threshold}</small>${p.circuit_state === "open" ? `<a data-health="${p.id}" href="/platform-admin/provider-adapters?provider_id=${p.id}">前往来源健康</a><button data-provider="${p.id}" id="provider-action-${index}" ${busy() ? "disabled" : ""}>解除熔断</button>` : ""}</div>${p.last_error_code ? `<details class="last-error" id="provider-error-${index}"><summary>最近失败</summary><code>${esc(p.last_error_code)}</code></details>` : ""}</article>`;
  }
  function monitoring(d, L) {
    const r = d.resource,
      s = d.receipt_spool;
    return `<div class="monitoring"><section class="section" id="resources"><h2>资源与进程观测</h2><p class="meta">非Linux的1/1是开发占位；当前DTO不包含平台来源，不能仅凭数字判断真实进程已核对。</p><dl>${[
      ["Worker实例", `${d.topology.worker_instances} / ${d.topology.maximum_workers}`],
      ["Crawler实例", `${d.topology.crawler_instances} / ${d.topology.maximum_crawlers}`],
      ["活动Worker槽位", d.leases.active_worker],
      ["活动Crawler槽位", d.leases.active_crawler],
      ["负载/核数", (r.load_basis_points / 100).toFixed(1) + "%"],
      ["可用内存", r.available_memory_mb + " MB"],
      ["文件系统可用", r.free_disk_mb + " MB"],
      ["资源观测", time(r.observed_at)],
    ]
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`)
      .join(
        "",
      )}</dl><p class="meta">负载不是CPU利用率。资源及进程各自参与判门，不用某个数字覆盖总状态。</p></section><section class="section" id="receipts"><h2>完成回执水位</h2>${
      s
        ? `<p class="meta">观测 ${esc(time(s.observed_at))}</p><dl>${[
            ["待回写", `${s.pending_count} 个 / ${L.bytes(s.pending_bytes)}`],
            ["隔离待审阅", `${s.quarantined_count} 个 / ${L.bytes(s.quarantined_bytes)}`],
            [
              "最老待回写",
              s.oldest_pending_at
                ? time(s.oldest_pending_at)
                : s.pending_count > 0
                  ? "未记录时间（有待回写）"
                  : "未记录时间 / 无待回写计数",
            ],
            ["保留期", s.retention_days + " 天"],
            [
              "目录字节 / 上限",
              L.bytes(s.pending_bytes + s.quarantined_bytes) + " / " + L.bytes(s.max_bytes),
            ],
            ["磁盘可用 / 停止线", s.free_disk_mb + " / " + s.minimum_free_disk_mb + " MB"],
          ]
            .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`)
            .join("")}</dl>`
        : '<p class="note caution">未返回回执水位。这里不补造0或成功记录；请结合调度发现核对。</p>'
    }<p class="note">保留期到期只告警，不自动删除。本页不查看回执内容，也不提供清理、重放或文件下载。</p></section></div>`;
  }
  function render() {
    const d = current.data,
      L = logical();
    current.page = L.page;
    document.getElementById("app").innerHTML =
      `<header class="context"><div class="context-inner"><div><strong>ScoutOps / 采集调度</strong><p>Worker领取业务任务，Python Crawler处理浏览器作业</p></div><div class="boundary">惠州单机 · 宝塔受管<br>来源并发1，档案独占1</div></div></header><main id="workspace" tabindex="-1"><p class="review-label">P70 · C方向具体稿 · 离线合成数据，所有写操作均为模拟</p><header class="header"><div><h1>来源处理与运行证据</h1><p>先核对当前来源，再确认限定范围的恢复操作。</p></div><div class="actions"><button class="primary" id="refresh" ${busy() ? "disabled" : ""} aria-busy="${!!current.pending}">${current.pending ? "正在读取…" : "刷新运行事实"}</button><button id="recover-expired" ${busy() ? "disabled" : ""}>回收过期租约</button></div></header>${current.operation ? `<section class="operation notice" role="status"><strong>${esc(current.operation.message)}</strong><p>对象 ${esc(current.operation.target)}；操作请求ID ${esc(current.operation.requestId)}。${current.operation.status === "unknown" ? "结果未确认；从原操作入口人工重试将复用该对象的幂等键。" : "此消息独立于后续运行快照，不等于任务已重跑或恢复已全站验收。"}</p></section>` : ""}${d && current.failure ? `<section class="notice" role="status"><strong>${esc(states[current.failure])} · 保留旧快照</strong><p>下方仍为 ${esc(time(d.observed_at))} 的成功结果。</p><button id="retry" ${busy() ? "disabled" : ""}>重新核验</button>${technical("refresh-request", current.requestId)}</section>` : ""}<div class="paper">${
        d
          ? `<section class="verdict"><div><span class="pill ${d.state}">${d.state}</span><h2 class="${d.state}">${esc(states[d.state])}</h2><p>返回 ${d.findings.length} 项发现；不是全部任务运行成功证明。</p></div><div class="observation"><strong>调度观测</strong><p>${esc(time(d.observed_at))}</p></div></section>${d.findings.length ? `<section class="findings" id="findings">${d.findings.map((f) => `<article class="finding" data-severity="${f.severity}"><strong>${esc(names[f.code] || f.code)}</strong><span class="pill ${f.severity}">${f.severity === "blocked" ? "阻断" : "预警"}</span><p>${esc(f.action_hint)}</p><code>${esc(f.code)}</code></article>`).join("")}<p class="meta">源提示只供核对，不自动触发停任务、服务重启或配置变更。运行路径以当前宝塔约束为准。</p></section>` : ""}<div class="work-grid"><section class="sources"><header><h2>来源并发与排队</h2><p>仅当前启用来源；本地筛选不改变全来源摘要。</p></header><div class="queue-summary" id="queue-summary"><span>各来源排队合计 <b>${L.summary.queued}</b></span><span>最长等待 <b>${esc(L.duration(L.summary.oldest))}</b></span><span>源算法风险计数 <b>${L.summary.starvationRisks}</b></span></div><p class="meta">一个任务可能属于多个来源，合计不是全站去重任务数。等待分位来自当前等待子查询；完成样本用于成功率和耗时，最多5000条混合样本，不是完整历史等待基线。</p><div class="filters"><label>搜索来源<input id="query" type="search" value="${esc(current.query)}" placeholder="输入来源代码"></label><label>运行范围<select id="filter">${Object.entries(
              { attention: "需要关注", open: "已熔断", queued: "有排队任务", all: "全部来源" },
            )
              .map(
                ([k, v]) =>
                  `<option value="${k}" ${current.filter === k ? "selected" : ""}>${v}</option>`,
              )
              .join(
                "",
              )}</select></label></div><p class="result-count">当前匹配 ${L.total} / 已启用 ${d.providers.length}</p><div id="providers">${L.providers.map((p, i) => provider(p, i, L)).join("") || `<p class="empty">${!d.providers.length ? "当前没有启用来源。" : "当前筛选没有匹配来源。"}</p>`}</div>${L.pages > 1 ? `<nav class="pagination" aria-label="来源列表分页"><button id="previous" ${L.page <= 1 ? "disabled" : ""}>上一页</button><span>${L.page} / ${L.pages} 页，每页12个</span><button id="next" ${L.page >= L.pages ? "disabled" : ""}>下一页</button></nav>` : ""}</section><aside class="lease-snapshot" id="lease-snapshot"><h2>过期槽位快照</h2><p class="meta">观测 ${esc(time(d.observed_at))}，不是提交时的最终清单。</p><dl>${[
              ["过期槽位", d.expired_leases.total],
              ["关联任务", d.expired_leases.task_count],
              [
                "Worker / Crawler / 来源",
                `${d.expired_leases.worker} / ${d.expired_leases.crawler} / ${d.expired_leases.provider}`,
              ],
              ["最早到期", time(d.expired_leases.oldest_expired_at)],
              ["重复租约", d.leases.duplicate_count],
            ]
              .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`)
              .join(
                "",
              )}</dl><p class="note">提交时按服务器当前时间重新筛选，只回收过期调度槽位；不删除任务历史、档案租约或回执。</p><h2 class="subheading">活动档案</h2><p>${d.profiles.length} 个配置为active的档案，未必被占用。</p>${d.profiles.map((p) => `<p class="profile"><code>${esc(p.id)}</code><br>占用 ${p.active_leases} / 独占上限1</p>`).join("")}</aside></div>${monitoring(d, L)}<section class="section" id="leases"><h2>租约与任务关联</h2><p class="meta">当前返回 ${d.active_leases.length} 个槽位，查询最多100条；逻辑角色不是实时OS进程鉴定。</p>${d.active_leases.map((a, i) => `<article class="association"><strong>${a.process_role === "node_worker" ? "Node Worker" : "Python Crawler"} / ${esc(a.provider_name || "全局槽位")}</strong><p>任务状态 ${esc(a.task_status || "未关联")}；心跳 ${esc(time(a.heartbeat_at))}<br>到期 ${esc(time(a.expires_at))}</p><details id="lease-${i}"><summary>查看技术详情</summary><code>任务 ${esc(a.task_id || "未关联")}<br>运行 ${esc(a.run_id || "未关联")}<br>进程 ${esc(a.process_ref)}<br>槽位 ${esc(a.slot_type)}</code></details></article>`).join("") || '<p class="empty">没有返回活动关联。</p>'}</section><section class="section" id="trend"><h2>近24小时浏览器运行桶</h2><p class="meta">总数包括尚未终态的运行；不是每小时完成吞吐。空小时不补0。</p>${d.trend.length ? `<div class="table-wrap"><table><thead><tr><th>小时桶</th><th>运行总数</th><th>成功</th><th>失败</th><th>失败/总数</th></tr></thead><tbody>${d.trend.map((t) => `<tr><td>${esc(time(t.bucket_at))}</td><td>${t.total}</td><td>${t.succeeded}</td><td>${t.failed}</td><td>${esc(L.rate(t.failure_rate_basis_points))}</td></tr>`).join("")}</tbody></table></div>` : '<p class="empty">没有返回小时桶样本。</p>'}</section>`
          : `<section class="failure" role="status"><h2>${esc(states[current.status])}</h2><p>${current.status === "recovering" ? "模拟POST尚未返回，不等于租约已经回收。" : "没有可用快照，未展示成功数字；可重新核验。"}</p>${["loading", "recovering"].includes(current.status) ? "" : '<button id="retry">重新核验</button>'}${["loading", "recovering"].includes(current.status) ? "" : technical("failure-request", current.requestId)}</section>`
      }</div>${d ? `<footer class="footer"><p class="meta">真实GET会写观测与审计。此离线稿不发HTTP；操作与读取独立反馈、统一忙碌锁是待审提案。</p>${technical("request", current.successRequestId)}</footer>` : ""}<details class="review" id="review-tools"><summary>审核工具 · 非产品功能</summary><label for="scene">场景</label><select id="scene">${Object.entries(
        scenes,
      )
        .map(
          ([k, v]) =>
            `<option value="${k}" ${current.key === k ? "selected" : ""}>${esc(v)}</option>`,
        )
        .join("")}</select></details></main>`;
    document.getElementById("refresh").onclick = read;
    document.getElementById("retry")?.addEventListener("click", read);
    document.getElementById("recover-expired").onclick = () => openConfirm("expired");
    document.getElementById("query")?.addEventListener("input", (e) => {
      const pos = e.target.selectionStart;
      current.query = e.target.value;
      current.page = 1;
      render();
      const el = document.getElementById("query");
      el.focus();
      if (el.type !== "search") el.setSelectionRange(pos, pos);
    });
    document.getElementById("filter")?.addEventListener("change", (e) => {
      current.filter = e.target.value;
      current.page = 1;
      render();
    });
    document.getElementById("previous")?.addEventListener("click", () => {
      current.page--;
      render();
    });
    document.getElementById("next")?.addEventListener("click", () => {
      current.page++;
      render();
    });
    document
      .querySelectorAll("[data-provider]")
      .forEach((b) => (b.onclick = () => openConfirm("provider", b.dataset.provider)));
    document.querySelectorAll("[data-health]").forEach(
      (a) =>
        (a.onclick = (e) => {
          e.preventDefault();
          current.navigation.push(a.getAttribute("href"));
        }),
    );
    document
      .querySelectorAll("[data-copy]")
      .forEach((b) => (b.onclick = () => copy(b.dataset.copy)));
    document.getElementById("scene").onchange = (e) => scene(e.target.value);
  }
  function copy(id) {
    document.getElementById("copy-" + id).textContent = current.denied
      ? "复制被拒绝，请手动选择请求ID。"
      : "模拟已复制；未写入系统剪贴板。";
  }
  function read() {
    if (busy() || current.modal) return false;
    current.pending = ++sequence;
    current.reads.push({ id: current.pending, path: "/platform/operations/crawler-scheduler" });
    current.failure = null;
    if (!current.data) current.status = "loading";
    render();
    return true;
  }
  function completeRead(outcome = "success", id = current.pending) {
    if (!current.pending || id !== current.pending) return false;
    current.pending = null;
    if (outcome === "success") {
      current.data = structuredClone(D.datasets.ready);
      current.status = current.data.state;
      current.failure = null;
      current.successRequestId = "synthetic-read-success";
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
  function openConfirm(type, id) {
    if (busy() || current.modal) return false;
    const p = type === "provider" ? current.data?.providers.find((p) => p.id === id) : null;
    if (type === "provider" && (!p || p.circuit_state !== "open")) return false;
    returnFocus = document.activeElement?.id || "recover-expired";
    oldOverflow = document.body.style.overflow;
    current.modal = {
      type,
      provider: p ? structuredClone(p) : null,
      preview: structuredClone(current.data?.expired_leases ?? null),
      observedAt: current.data?.observed_at ?? null,
    };
    const m = current.modal,
      phrase = type === "expired" ? "确认回收" : "确认解除",
      dialog = document.getElementById("confirm");
    dialog.innerHTML = `<header><h2 id="confirm-title">${type === "expired" ? "回收过期调度槽位？" : "解除指定来源的熔断？"}</h2></header><div class="dialog-body" id="confirm-description"><p>离线模拟，不会发送恢复请求。</p>${p ? `<h3>${esc(p.code)}</h3><code>${esc(p.id)}</code><p>只处理此来源。实际服务要求来源enabled，且open时最新健康ready、检查时间严格晚于熔断时间；本页不发起健康检查。</p>` : `<h3>影响范围</h3><p>${m.preview ? `快照记录 ${m.preview.total} 个过期槽位，关联 ${m.preview.task_count} 个任务；Worker ${m.preview.worker} / Crawler ${m.preview.crawler} / 来源 ${m.preview.provider}。最早到期 ${esc(time(m.preview.oldest_expired_at))}。` : "尚无观测，影响数量未知；不能解释为0个。"}</p><p>提交时由服务端按当前时间重新筛选。只回收过期调度槽位，不改变任务历史、任务状态或档案租约。</p>`}<p class="note">预览观测 ${esc(time(m.observedAt))}。快照不能锁定最终影响；0也不保证提交时仍为0。</p><label for="typed">输入 ${phrase}<input id="typed" autocomplete="off" placeholder="${phrase}"></label></div><footer><button id="cancel">取消</button><button id="submit" disabled>${phrase}</button></footer>`;
    const previewNote = dialog.querySelector(".note");
    previewNote.textContent = `预览观测 ${time(m.observedAt)}。${p ? "只针对上述来源；当前状态及是否可解除，以服务端提交时核验结果为准。" : "快照不能锁定最终影响；0也不保证提交时仍为0。"}`;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    document.getElementById("cancel").onclick = closeConfirm;
    document.getElementById("typed").oninput = () => {
      document.getElementById("submit").disabled = !window.SCHEDULER_CONFIRM({
        destructive: false,
        acknowledged: false,
        confirmationText: phrase,
        typedText: document.getElementById("typed").value,
      });
    };
    document.getElementById("submit").onclick = submit;
    document.getElementById("cancel").focus();
    return true;
  }
  function closeConfirm() {
    const d = document.getElementById("confirm");
    d.close();
    current.modal = null;
    document.body.style.overflow = oldOverflow;
    document.getElementById(returnFocus)?.focus();
  }
  function submit() {
    if (!current.modal || document.getElementById("submit").disabled) return false;
    const m = structuredClone(current.modal),
      target = m.type === "expired" ? "expired" : m.provider.id;
    current.keys[target] ??= "synthetic-key-" + ++sequence;
    const request = {
      id: ++sequence,
      type: m.type,
      target,
      code: m.provider?.code || "过期调度槽位",
      path:
        m.type === "expired"
          ? "/platform/operations/crawler-scheduler/recover-expired"
          : `/platform/operations/crawler-scheduler/providers/${target}/recover`,
      method: "POST",
      body: {},
      idempotencyKey: current.keys[target],
    };
    closeConfirm();
    current.mutation = request;
    current.writes.push(request);
    current.operation = {
      status: "pending",
      target: request.code,
      requestId: "synthetic-operation-" + request.id,
      message: "模拟恢复请求等待结果",
    };
    if (!current.data) current.status = "recovering";
    render();
    return true;
  }
  function completeMutation(outcome = "success") {
    const m = current.mutation;
    if (!m) return false;
    current.mutation = null;
    const ok = ["success", "zero"].includes(outcome);
    if (outcome !== "unknown") delete current.keys[m.target];
    current.operation = {
      status: ok ? "success" : outcome === "unknown" ? "unknown" : "error",
      target: m.code,
      requestId: "synthetic-operation-" + m.id,
      message: ok
        ? m.type === "expired"
          ? `模拟返回：回收 ${outcome === "zero" ? 0 : D.recoveryResults["expired-success"].recovered} 个过期槽位`
          : outcome === "zero"
            ? `模拟返回：${m.code} 当前无需恢复`
            : `模拟返回：已解除 ${m.code} 来源熔断`
        : outcome === "unknown"
          ? "恢复结果暂时无法确认"
          : outcome === "auth"
            ? "恢复请求因身份或权限失效被拒绝"
            : "恢复请求被拒绝，请核对来源启用与健康证据",
    };
    if (outcome === "auth") {
      current.data = null;
      current.status = "expired";
      current.requestId = current.operation.requestId;
    }
    if (ok) read();
    else render();
    return true;
  }
  function scene(key) {
    if (!(key in scenes)) throw new Error("Unknown scene " + key);
    if (current?.modal) closeConfirm();
    ++sequence;
    current = {
      key,
      data: structuredClone(D.datasets[key] || D.datasets.ready),
      status: "ready",
      failure: null,
      pending: null,
      mutation: null,
      modal: null,
      operation: null,
      keys: {},
      writes: [],
      reads: [],
      navigation: [],
      query: "",
      filter: "attention",
      page: 1,
      denied: key.endsWith("denied"),
      requestId: "synthetic-current-read",
      successRequestId: "synthetic-success-request",
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
        "generic-error",
        "failure-detail",
        "failure-copy-denied",
        "expired-unknown-confirm",
        "recovering",
      ].includes(key)
    ) {
      current.data = null;
      current.status =
        key.startsWith("failure") || key === "generic-error"
          ? "unavailable"
          : key === "expired-unknown-confirm" || key === "recovering"
            ? "empty"
            : key;
    }
    if (key === "generic-error") current.requestId = "";
    if (key.startsWith("refresh-"))
      current.failure =
        key === "refresh-timeout"
          ? "timeout"
          : key === "refresh-rate_limited"
            ? "rate_limited"
            : "unavailable";
    if (["loading", "refreshing"].includes(key)) current.pending = ++sequence;
    if (key.startsWith("filter-") || key.startsWith("page-") || key.startsWith("search-"))
      current.data = structuredClone(D.datasets.many);
    if (key === "filter-all") current.filter = "all";
    if (key === "filter-open") current.filter = "open";
    if (key === "filter-queued") current.filter = "queued";
    if (key === "search-hit") current.query = "SOURCE_24";
    if (key === "search-none") current.query = "not-present";
    if (key === "page-two") current.page = 2;
    if (key === "page-three") current.page = 3;
    if ((!D.datasets[key] && key.startsWith("provider-")) || key === "last-error")
      current.data = structuredClone(D.datasets.circuit);
    if (key === "provider-long-confirm")
      current.data.providers[0].code = "synthetic_selected_source_".repeat(15);
    if (key === "expired-zero-confirm") current.data = structuredClone(D.datasets["expired-zero"]);
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
      "last-error": "provider-error-0",
      "lease-detail": "lease-0",
    }[key];
    if (open) document.getElementById(open).open = true;
    if (key.includes("copy-")) copy(open);
    if (key === "focus") document.getElementById("refresh").focus();
    if (
      /^(expired|provider)-(confirm|typed|wrong|zero-confirm|unknown-confirm|long-confirm|pending|success|zero-result|unknown|rejected|auth|read-failed)$/.test(
        key,
      ) ||
      key === "recovering"
    ) {
      const type = key.startsWith("provider") ? "provider" : "expired";
      openConfirm(type, type === "provider" ? current.data.providers[0].id : null);
      if (!key.endsWith("confirm")) {
        const typed = document.getElementById("typed");
        typed.value = key.endsWith("wrong")
          ? "错误确认词"
          : type === "expired"
            ? "确认回收"
            : "确认解除";
        typed.dispatchEvent(new Event("input"));
        if (!key.endsWith("wrong") && !key.endsWith("typed")) {
          submit();
          if (!key.endsWith("pending") && key !== "recovering") {
            completeMutation(
              key.endsWith("unknown")
                ? "unknown"
                : key.endsWith("rejected")
                  ? "rejected"
                  : key.endsWith("auth")
                    ? "auth"
                    : key.endsWith("zero-result")
                      ? "zero"
                      : "success",
            );
            if (current.pending)
              completeRead(key.endsWith("read-failed") ? "unavailable" : "success");
          }
        }
      }
    }
    window.scrollTo(0, 0);
  }
  const dialog = document.getElementById("confirm");
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeConfirm();
  });
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
        closeConfirm();
    }
  });
  dialog.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const items = [...dialog.querySelectorAll("button:not([disabled]),input")],
      first = items[0],
      last = items.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
  window.SCHEDULER_C = {
    scenes,
    scene,
    read,
    completeRead,
    openConfirm,
    closeConfirm,
    submit,
    completeMutation,
    state: () => structuredClone(current),
  };
  scene("ready");
})();
