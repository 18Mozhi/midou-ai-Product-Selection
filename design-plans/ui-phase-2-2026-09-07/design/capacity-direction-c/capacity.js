(() => {
  "use strict";
  const D = window.CAPACITY_DATA;
  const esc = (v) =>
    String(v ?? "未返回").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const time = (v) => (v ? new Date(v).toLocaleString("zh-CN", { hour12: false }) : "未返回");
  const pct = (v) => `${(v / 100).toFixed(2)}%`;
  const modes = { normal: "正常处理", shed_background: "后台降载", stop_new_work: "停止新增工作" };
  const states = {
    ready: "当前记录评价无告警",
    warning: "当前记录评价需要关注",
    blocked: "当前记录评价受阻",
    loading: "正在读取容量观测",
    empty: "尚无可用容量观测",
    expired: "登录已失效",
    forbidden: "没有平台运维权限",
    rate_limited: "刷新过于频繁",
    timeout: "本次容量读取超时",
    unavailable: "容量事实暂不可用",
    verifying: "签认请求等待结果（模拟）",
  };
  const scenes = {
    ...D.labels,
    loading: "首次读取",
    empty: "无容量观测",
    expired: "首次401",
    forbidden: "首次403",
    rate_limited: "首次429",
    timeout: "首次超时",
    unavailable: "首次依赖失败",
    refreshing: "保留快照读取中",
    "refresh-empty": "保留快照缺新证据",
    "refresh-timeout": "保留快照超时",
    "refresh-rate_limited": "保留快照限流",
    "refresh-unavailable": "保留快照依赖失败",
    "generic-error": "通用失败不沿用旧请求ID",
    "request-detail": "快照请求详情",
    "failure-detail": "首次失败请求详情",
    "refresh-detail": "保留失败请求详情",
    "copy-success": "快照模拟复制反馈",
    "copy-denied": "快照模拟复制拒绝",
    "failure-copy-denied": "首次错误模拟复制拒绝",
    "refresh-copy-denied": "保留错误模拟复制拒绝",
    "finding-detail": "处置技术详情",
    "degradation-detail": "降载动作全文",
    focus: "刷新键盘聚焦",
    hover: "刷新悬停",
    pressed: "刷新按下",
    confirm: "签认确认窗",
    "confirm-typed": "确认词正确",
    "confirm-wrong": "确认词错误",
    "confirm-empty": "无快照签认确认",
    "confirm-unverified": "恢复标志未核验确认",
    "confirm-stale": "陈旧记录签认确认",
    "confirm-long": "长失败事实页面的签认确认",
    verifying: "无快照签认中",
    "attest-pending": "旧快照签认中",
    "attest-success": "签认成功与新读取分开",
    "attest-rejected": "签认被拒绝",
    "attest-unknown": "签认结果未知",
    "attest-expired": "签认401清快照",
    "attest-forbidden": "签认403清快照",
    "attest-empty-failure": "无快照操作失败",
    "attest-read-failed": "签认成功随后读取失败",
    "attest-read-empty": "签认成功随后无新证据",
    "attest-read-auth": "签认成功随后401",
    "review-tools": "审核工具展开",
  };
  let current,
    sequence = 0,
    returnFocus = "",
    oldOverflow = "";
  const busy = () => !!current.pending || !!current.mutation;
  const technical = (id, value) =>
    value
      ? `<details class="technical" id="${id}"><summary>技术信息 · 请求ID</summary><code>${esc(value)}</code><button data-copy="${id}" aria-label="复制请求ID">复制请求ID</button><span class="copy-result" role="status" id="copy-${id}"></span></details>`
      : "";
  const findingTone = (d, prefix) => {
    const f = d.findings.filter((f) => f.code.startsWith(prefix));
    return f.some((f) => f.severity === "blocked") ? "阻断" : f.length ? "预警" : "未返回该项告警";
  };
  function observation(d) {
    const b = d.boundary,
      p = d.performance,
      r = d.resource;
    const stop =
      b.stop_reason === "planning_ceiling_reached"
        ? "规划上限结束"
        : b.stop_reason === "next_stage_gate_failed"
          ? "下一档未通过"
          : "未返回停止事实";
    const unusual = ![0, 5, 10, 20].includes(b.measured_concurrency);
    return `<div class="workspace"><section class="section verdict" id="boundary"><div class="eyeline"><div><span class="badge ${d.state}">${esc(d.state)}</span><h2>${states[d.state]}</h2><p>以下为服务返回的记录评价，不是本页独立签发的容量证明。</p></div><div class="observed">记录观测<br>${esc(time(d.observed_at))}</div></div><div class="claim">${b.capacity_claim === "measured_single_host_limited" ? "返回声明：实测单机有限边界" : "返回声明：容量未验证"}<small>构建身份、签名及完整档位样本未随此接口返回。</small></div><div class="boundary-grid"><div class="measurement"><h3>记录中的测量并发</h3><strong>${esc(b.measured_concurrency)}<span>并发用户</span></strong><p>${b.measured_concurrency < 5 ? "固定5档尚未形成通过边界；此数值不能作通过承诺。" : "是否可用于容量声明，应同时核对当前评价和证据归属。"}</p><p>规划 ${b.planning_users} 用户 / ${b.planning_concurrency_min}–${b.planning_concurrency_max} 并发，不是能力承诺。</p></div><dl class="stop"><div><dt>停止原因</dt><dd>${stop}</dd></div><div><dt>下一档失败</dt><dd>${b.failed_next_concurrency === null ? "未返回档位" : esc(b.failed_next_concurrency) + " 并发"}</dd></div><div><dt>失败代码</dt><dd><code>${esc(b.failed_next_code || "未返回")}</code></dd></div></dl></div>${unusual ? '<p class="note caution">返回档位不属于合同中的5/10/20。本页保留源评价，不能据此扩大容量声明。</p>' : ""}<p class="note">最新数据库记录不等于已核验当前构建；签认不会补足这一证据缺口。本稿为离线合成，未执行真实测量。</p></section>${findings(d)}<div class="columns"><section class="section" id="performance"><h2>性能记录与合同参考</h2><p class="reference">参考值来自现有单机合同，不代表接口返回了当前运行阈值。告警按服务finding显示，不在浏览器重新判门。</p><table class="performance"><thead><tr><th>指标</th><th>记录值</th><th>合同停止条件</th></tr></thead><tbody>${[
      ["核心读取P95", p.read_p95_ms + " ms", "大于300 ms", "capacity_read_latency"],
      ["核心写入P95", p.write_p95_ms + " ms", "大于600 ms", "capacity_write_latency"],
      ["错误率", pct(p.error_rate_basis_points), "达到1%", "capacity_error_rate"],
      ["异步滞后", p.async_lag_seconds + " 秒", "大于60秒", "capacity_async_lag"],
    ]
      .map(
        ([label, value, limit, prefix]) =>
          `<tr><td>${label}</td><td data-label="记录值"><strong>${esc(value)}</strong><small>${findingTone(d, prefix)}</small></td><td data-label="合同参考">${limit}</td></tr>`,
      )
      .join(
        "",
      )}</tbody></table><p class="reference">未返回请求分母、原始样本或主机完整配置，不将0值补写成100%健康。</p></section><section class="section" id="resilience"><h2>归档与隔离恢复</h2><dl class="resilience"><div><dt>加密归档标志</dt><dd class="${d.resilience.archive_verified ? "" : "bad"}">${d.resilience.archive_verified ? "已核验" : "未核验"}</dd></div><div><dt>隔离恢复标志</dt><dd class="${d.resilience.recovery_verified ? "" : "bad"}">${d.resilience.recovery_verified ? "已核验" : "未核验"}</dd></div></dl><p>签认只记录已完成的事实，不执行归档、恢复、压测或调整并发。</p><p class="note">服务先检查最新记录的两项标志，事务内另选最新已核验记录；接口未提供可锁定的观测ID。</p><button id="attest" ${busy() ? "disabled" : ""} aria-busy="${!!current.mutation}">${current.mutation ? "签认中…" : "签认恢复演练"}</button></section></div><section class="section" id="resources"><h2>单机资源记录</h2><p class="reference">展示绝对值；内存与磁盘总量未返回，不使用旧8192/262144封顶条冒充占比。归一化负载不是CPU利用率。</p><div class="resource-list">${[
      ["归一化负载", pct(r.load_basis_points), "达到85%", "capacity_host_load"],
      ["可用内存", r.available_memory_mb + " MB", "低于1024 MB", "capacity_memory"],
      ["可用磁盘", r.free_disk_mb + " MB", "低于4096 MB", "capacity_disk"],
    ]
      .map(
        ([label, value, limit, prefix]) =>
          `<section class="resource"><h3>${label}</h3><strong>${esc(value)}</strong><p>合同停止条件：${limit}</p><small>${findingTone(d, prefix)}</small></section>`,
      )
      .join("")}</div></section></div>`;
  }
  function findings(d) {
    return `<section class="section" id="findings"><div class="section-header"><h2>处置依据 <small>${d.findings.length} 项</small></h2><span class="mode">返回策略：${modes[d.degradation.mode] || esc(d.degradation.mode)}</span></div>${d.findings.map((f, i) => `<article class="finding"><span class="badge ${f.severity}">${f.severity === "blocked" ? "阻断" : "预警"}</span><div><h3>${esc(f.reason || "未返回具体原因")}</h3><p>${esc(f.action_hint)}</p><p class="owner">责任角色：${esc(f.owner_label || "未返回")}；不是已指派的个人。</p><details id="finding-${i}"><summary>查看处置技术详情</summary><code>${esc(f.code)}<br>${esc(f.owner_role_code)}</code></details></div></article>`).join("") || '<p class="empty">这条记录未返回告警，不代表已独立核验生产、恢复或容量。</p>'}<details class="degradation" id="degradation"><summary>返回降载动作（${d.degradation.actions.length}项）</summary>${d.degradation.actions.length ? `<ul>${d.degradation.actions.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>` : '<p class="empty">没有返回降载动作。</p>'}<p class="meta">只展示服务建议，不自动执行宝塔操作。</p></details></section>`;
  }
  function render() {
    const d = current.data;
    document.getElementById("app").innerHTML =
      `<header class="top"><div><strong>ScoutOps / 容量边界</strong><p>可选测量与恢复签认，分开核对</p></div><div class="scope">惠州单机 · 宝塔管理<br>无负载均衡 / 无备用服务器 / 无多节点声明</div></header><main class="shell" id="workspace" tabindex="-1"><p class="review-mark">P71 · C方向具体稿 · 离线合成数据，所有操作均为模拟</p><div class="title"><div><h1>先读证据，再记录签认</h1><p>规划不是承诺，返回状态不是独立核验。</p></div><div class="actions"><button class="primary" id="refresh" ${busy() ? "disabled" : ""} aria-busy="${!!current.pending}">${current.pending ? "读取中…" : "刷新容量事实"}</button>${!d ? `<button id="attest" ${busy() ? "disabled" : ""}>${current.mutation ? "签认中…" : "签认恢复演练"}</button>` : ""}</div></div>${current.operation ? `<section class="notice operation" id="operation" role="status"><strong>${esc(current.operation.message)}</strong><p>签认操作请求ID：<code>${esc(current.operation.requestId || "未返回")}</code>${current.operation.observedAt ? `<br>签认记录时间：${esc(time(current.operation.observedAt))}` : ""}</p><p>该结果独立于下面的读取结果；不是恢复执行或容量已验证证明。</p></section>` : ""}${d && current.failure ? `<section class="notice" id="read-failure" role="status"><strong>${states[current.failure]} · 保留旧快照</strong><p>下方仍为 ${esc(time(d.observed_at))} 的记录，本次未取得新事实。</p><button id="retry" ${busy() ? "disabled" : ""}>重新核验</button>${technical("refresh-request", current.failureId)}</section>` : ""}${d ? observation(d) : `<section class="state-panel" role="status"><h2>${states[current.state]}</h2><p>${current.state === "empty" ? "未取得可用测量记录，不用规划值填补实测。软件功能完成不等于容量实测完成。" : current.state === "loading" || current.state === "verifying" ? "正在等待模拟结果；不会自动签认或发起测量。" : "请核对权限、服务或已有证据后再试；不会自动扩大并发。"}</p>${!["loading", "verifying"].includes(current.state) ? `<button id="retry" ${busy() ? "disabled" : ""}>重新核验</button>` : ""}${technical("failure-request", current.failureId)}</section>`}<footer class="foot"><p>真实GET会记录观测和审计。本离线稿不连接接口，不执行压测、恢复、签认或运行调整。</p>${d ? technical("request", current.snapshotId) : ""}</footer><details class="review" id="review"><summary>审核工具 · 非产品功能</summary><label>切换审核场景<select id="scene">${Object.entries(
        scenes,
      )
        .map(
          ([k, label]) =>
            `<option value="${k}" ${k === current.key ? "selected" : ""}>${label}</option>`,
        )
        .join(
          "",
        )}</select></label><p>38个数据集：真实源函数的合成输入输出与独立历史E2E。动态返回值、操作结果和复制均只模拟。</p></details></main>`;
    document.getElementById("refresh").onclick = read;
    document.getElementById("retry")?.addEventListener("click", read);
    document.getElementById("attest").onclick = openConfirm;
    document.getElementById("scene").onchange = (e) => scene(e.target.value);
    document.querySelectorAll("[data-copy]").forEach((b) => {
      b.onclick = () => {
        document.getElementById("copy-" + b.dataset.copy).textContent =
          "模拟已复制；未写入系统剪贴板。";
      };
    });
  }
  function read() {
    if (busy() || current.modal) return false;
    current.pending = ++sequence;
    current.reads.push({
      id: current.pending,
      url: "/platform/operations/capacity",
      method: "GET",
    });
    current.failure = null;
    current.failureId = "";
    if (!current.data) current.state = "loading";
    render();
    return current.pending;
  }
  function completeRead(outcome = "success", id = current.pending) {
    if (!id || id !== current.pending) return false;
    current.pending = null;
    if (outcome === "success") {
      current.data = structuredClone(D.datasets.ready);
      current.snapshotId = "synthetic-read-" + id;
      current.state = current.data.state;
      current.failure = null;
    } else if (outcome === "null") {
      current.data = null;
      current.state = "empty";
      current.snapshotId = "";
    } else {
      current.failureId =
        outcome === "generic" || outcome === "timeout" ? "" : "synthetic-read-failed-" + id;
      outcome = outcome === "generic" ? "unavailable" : outcome;
      if (["expired", "forbidden"].includes(outcome)) {
        current.data = null;
        current.snapshotId = "";
        current.state = outcome;
      } else if (current.data) {
        current.failure = outcome;
      } else current.state = outcome;
    }
    render();
    return true;
  }
  function closeConfirm() {
    const d = document.getElementById("confirm");
    if (d.open) d.close();
    current.modal = null;
    document.body.style.overflow = oldOverflow;
    document.getElementById(returnFocus)?.focus();
  }
  function openConfirm() {
    if (busy() || current.modal) return false;
    returnFocus = "attest";
    oldOverflow = document.body.style.overflow;
    current.modal = {
      observedAt: current.data?.observed_at || null,
      resilience: structuredClone(current.data?.resilience || null),
      state: current.data?.state || null,
    };
    const m = current.modal;
    const dialog = document.getElementById("confirm");
    dialog.innerHTML = `<header><h2 id="confirm-title">签认归档与恢复演练？</h2></header><div class="dialog-body" id="confirm-description"><p>离线模拟，不发送签认请求。实际操作只记录已完成的归档与隔离恢复事实，不运行演练。</p><dl><div><dt>预览观测</dt><dd>${esc(time(m.observedAt))}</dd></div><div><dt>归档标志</dt><dd>${m.resilience ? (m.resilience.archive_verified ? "已核验" : "未核验") : "未知"}</dd></div><div><dt>恢复标志</dt><dd>${m.resilience ? (m.resilience.recovery_verified ? "已核验" : "未核验") : "未知"}</dd></div></dl><p class="note">预览不是锁定对象。服务先查最新记录的两项标志，事务内再选择最新已核验记录；没有提交观测ID、构建身份或完整容量评价。</p><p>不会启动服务、删除数据或改变并发。签认成功不提升容量声明，也不证明此刻完成了恢复。</p><p class="fixed-reason">固定提交原因：${esc(D.attestationBody.reason)}</p><label for="typed">输入 确认签认<input id="typed" autocomplete="off" placeholder="确认签认"></label></div><footer><button id="cancel">取消</button><button id="submit" disabled>确认签认</button></footer>`;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    document.getElementById("cancel").onclick = closeConfirm;
    document.getElementById("typed").oninput = (e) => {
      document.getElementById("submit").disabled = !window.CAPACITY_CONFIRM({
        destructive: false,
        acknowledged: false,
        confirmationText: "确认签认",
        typedText: e.target.value,
      });
    };
    document.getElementById("submit").onclick = submit;
    dialog.oncancel = (e) => {
      e.preventDefault();
      closeConfirm();
    };
    dialog.onkeydown = (e) => {
      if (e.key !== "Tab") return;
      const controls = [...dialog.querySelectorAll("input,button:not([disabled])")];
      const first = controls[0],
        last = controls.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    dialog.onmousedown = (e) => {
      const b = dialog.getBoundingClientRect();
      if (
        e.target === dialog &&
        (e.clientX < b.x || e.clientX > b.right || e.clientY < b.y || e.clientY > b.bottom)
      )
        closeConfirm();
    };
    document.getElementById("cancel").focus();
    return true;
  }
  function submit() {
    if (!current.modal || busy() || document.getElementById("submit").disabled) return false;
    current.writes.push({
      method: "POST",
      url: "/platform/operations/capacity/drills",
      body: structuredClone(D.attestationBody),
      idempotencyKey: current.idempotencyKey,
    });
    closeConfirm();
    current.mutation = ++sequence;
    current.operation = null;
    if (!current.data) current.state = "verifying";
    render();
    return true;
  }
  function completeMutation(outcome = "success") {
    if (!current.mutation) return false;
    const id = current.mutation;
    current.mutation = null;
    const text = {
      success: "模拟返回：归档与恢复事实已签认",
      rejected: "模拟返回：签认未获接受，请先核验归档与恢复事实",
      unknown: "签认结果未知，请保留当前操作，不要认为未写入",
      expired: "模拟返回：签认时登录失效",
      forbidden: "模拟返回：没有签认权限",
    };
    current.operation = {
      status: outcome,
      message: text[outcome],
      requestId: outcome === "unknown" ? "" : "synthetic-operation-" + id,
      observedAt: outcome === "success" ? D.attestationResult.observed_at : null,
    };
    if (outcome === "success") {
      current.idempotencyKey = "synthetic-key-" + ++sequence;
      read();
    } else {
      if (["expired", "forbidden"].includes(outcome)) {
        current.data = null;
        current.snapshotId = "";
        current.failureId = "";
        current.state = outcome;
      } else if (!current.data) current.state = "unavailable";
      render();
    }
    return true;
  }
  function scene(key) {
    if (!scenes[key]) throw new Error("Unknown scene " + key);
    if (current?.modal) closeConfirm();
    let dataset = D.datasets[key] || D.datasets.ready;
    if (["finding-detail", "degradation-detail"].includes(key)) dataset = D.datasets.multiple;
    if (key === "confirm-unverified") dataset = D.datasets["both-missing"];
    if (key === "confirm-stale") dataset = D.datasets.stale;
    if (key === "confirm-long") dataset = D.datasets.long;
    current = {
      key,
      data: structuredClone(dataset),
      state: dataset.state,
      snapshotId: "synthetic-snapshot-" + ++sequence,
      failure: null,
      failureId: "",
      pending: null,
      mutation: null,
      modal: null,
      operation: null,
      idempotencyKey: "synthetic-key-" + sequence,
      reads: [],
      writes: [],
    };
    render();
    if (
      [
        "loading",
        "empty",
        "expired",
        "forbidden",
        "rate_limited",
        "timeout",
        "unavailable",
        "failure-detail",
        "failure-copy-denied",
        "generic-error",
        "confirm-empty",
        "verifying",
        "attest-empty-failure",
      ].includes(key)
    ) {
      current.data = null;
      current.snapshotId = "";
      current.state = ["failure-detail", "failure-copy-denied", "generic-error"].includes(key)
        ? "unavailable"
        : ["confirm-empty", "attest-empty-failure"].includes(key)
          ? "empty"
          : key;
      current.failureId = ["loading", "generic-error", "verifying"].includes(key)
        ? ""
        : "synthetic-first-failure";
      render();
      if (key === "loading") read();
    }
    if (key === "refreshing") read();
    if (key.startsWith("refresh-") && !key.endsWith("detail") && !key.endsWith("denied")) {
      read();
      completeRead(key.slice(8));
    }
    if (["refresh-detail", "refresh-copy-denied"].includes(key)) {
      read();
      completeRead("unavailable");
    }
    if (key.startsWith("confirm")) {
      openConfirm();
      if (key === "confirm-typed" || key === "confirm-wrong") {
        const input = document.getElementById("typed");
        input.value = key === "confirm-typed" ? "确认签认" : "确认";
        input.dispatchEvent(new Event("input"));
        input.focus();
      }
    }
    if (key.startsWith("attest-") || key === "verifying") {
      openConfirm();
      const input = document.getElementById("typed");
      input.value = "确认签认";
      input.dispatchEvent(new Event("input"));
      submit();
      if (!["verifying", "attest-pending"].includes(key)) {
        let outcome = key.slice(7);
        if (key.startsWith("attest-read-") || key === "attest-success") outcome = "success";
        if (key === "attest-empty-failure") outcome = "rejected";
        completeMutation(outcome);
        if (key === "attest-read-failed") completeRead("unavailable");
        if (key === "attest-read-empty") completeRead("empty");
        if (key === "attest-read-auth") completeRead("expired");
      }
    }
    if (["request-detail", "copy-success", "copy-denied"].includes(key))
      document.getElementById("request").open = true;
    if (["failure-detail", "failure-copy-denied"].includes(key))
      document.getElementById("failure-request").open = true;
    if (["refresh-detail", "refresh-copy-denied"].includes(key))
      document.getElementById("refresh-request").open = true;
    if (key.includes("copy-")) {
      const id = key.startsWith("failure-")
        ? "failure-request"
        : key.startsWith("refresh-")
          ? "refresh-request"
          : "request";
      document.getElementById("copy-" + id).textContent = key.endsWith("denied")
        ? "模拟复制被拒绝，请选择上方完整ID手动复制。"
        : "模拟已复制；未写入系统剪贴板。";
    }
    if (key === "finding-detail") document.getElementById("finding-0").open = true;
    if (key === "degradation-detail") document.getElementById("degradation").open = true;
    if (key === "focus") document.getElementById("refresh").focus();
    if (key === "review-tools") document.getElementById("review").open = true;
    window.scrollTo(0, 0);
    return true;
  }
  window.CAPACITY_C = {
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
