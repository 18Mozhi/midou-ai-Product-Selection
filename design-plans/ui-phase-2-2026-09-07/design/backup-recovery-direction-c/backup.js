/* Offline design interaction only. No fetch, clipboard, persistence or backup execution. */
(() => {
  const D = window.BACKUP_DATA,
    $ = (s) => document.querySelector(s),
    esc = (v) =>
      String(v ?? "未记录").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
      ),
    clone = (v) => JSON.parse(JSON.stringify(v)),
    kinds = {
      mysql_full: "数据库完整备份",
      mysql_binlog: "数据库增量日志",
      evidence: "采集证据",
      export: "导出文件",
      config: "非秘密配置",
    },
    blockers = {
      backup_objective_unverified: "备份目标尚未核验",
      recovery_copy_unverified: "恢复副本尚未核验",
      isolated_restore_unverified: "隔离恢复尚未核验",
      restore_drill_stale: "恢复演练已过期",
    },
    flags = {
      isolated: "逻辑隔离",
      encrypted: "加密",
      integrity_verified: "完整性",
      permission_boundary_verified: "权限边界",
      audit_chain_verified: "审计链",
      evidence_hash_verified: "证据哈希",
    },
    columns = ["对象", "角色", "区域", "数量", "体积", "完整性", "技术信息"],
    titles = {
      loading: "正在读取备份事实",
      forbidden: "你没有平台运维权限",
      expired: "登录已失效",
      rate_limited: "刷新过于频繁",
      timeout: "备份与恢复事实读取超时",
      unavailable: "备份与恢复事实暂不可用",
    },
    stateText = {
      verified: "服务返回：已验证",
      blocked: "恢复条件尚未满足",
      stale: "恢复演练已过期",
      empty: "尚无备份记录",
    };
  const scenes = {
    verified: "同机恢复证据齐备",
    original: "原始单资产 E2E 夹具",
    empty: "尚无备份记录",
    blocked: "三项阻断",
    stale: "演练91天",
    "no-drill": "没有演练",
    "no-assets": "没有资产",
    "rpo-over": "RPO超过目标",
    "rto-over": "RTO超过目标",
    "null-measurements": "实际分钟未记录",
    "negative-measurements": "负值实际分钟",
    "no-finished-at": "演练结束时间未记录",
    "due-now": "精确到期时刻",
    "past-exact-expiry": "精确到期后半天",
    "future-drill": "未来结束时间",
    "blocked-stale": "阻断优先于过期",
    "window-no-backup": "20次运行窗口缺备份",
    "one-recovery-kind": "仅一种恢复对象",
    "bad-assets": "加密完整性均未核验",
    "zero-size": "零数量零体积",
    long: "长区域和技术代码",
    "policy-30": "30天策略",
    "policy-120": "120天展示夹具",
    "drill-isolated": "隔离未核验",
    "drill-encrypted": "演练加密未核验",
    "drill-integrity_verified": "演练完整性未核验",
    "drill-permission_boundary_verified": "权限边界未核验",
    "drill-audit_chain_verified": "审计链未核验",
    "drill-evidence_hash_verified": "证据哈希未核验",
    loading: "首次加载",
    forbidden: "首次无权限",
    expired: "首次登录过期",
    rate_limited: "首次限流",
    timeout: "首次超时",
    unavailable: "首次不可用",
    "refresh-pending": "保留快照刷新中",
    "refresh-timeout": "刷新超时保留",
    "refresh-rate_limited": "刷新限流保留",
    "refresh-unavailable": "刷新不可用保留",
    "refresh-forbidden": "刷新无权清除快照",
    "refresh-expired": "刷新登录过期清除快照",
    "detail-mysql_full": "数据库完整资产详情",
    "detail-mysql_binlog": "增量日志资产详情",
    "detail-evidence": "采集证据资产详情",
    "detail-export": "导出文件资产详情",
    "detail-config": "非秘密配置资产详情",
    "detail-long": "长字段资产详情",
    "asset-tech": "资产技术展开",
    "blocker-tech": "阻断代码展开",
    "request-tech": "请求编号展开",
    "copy-denied": "复制被拒绝反馈",
    "copy-success": "复制成功模拟反馈",
    "columns-open": "七列设置",
    "one-column": "至少保留一列",
    unfrozen: "取消首列冻结",
    compact: "紧凑密度",
    dark: "深色审核变体",
    contrast: "高对比审核变体",
    focus: "键盘焦点",
    hover: "按钮悬停",
    pressed: "按钮按下",
  };
  let S,
    seq = 0,
    returnFocus;
  const when = (v) =>
      v
        ? new Date(v).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })
        : "未记录",
    minute = (v) => (v == null ? "未记录" : `${v} min`),
    role = (v) => (v === "recovery_copy" ? "恢复副本" : "主备份"),
    fact = (v) => (v == null ? "未记录" : v ? "已核验" : "未核验"),
    reminder = (n) =>
      n == null
        ? "尚无演练证据"
        : n < 0
          ? `已到期 ${Math.abs(n)} 天`
          : n === 0
            ? "今天到期"
            : `还剩 ${n} 天到期`,
    bytes = (v) => `${(v / 1048576).toFixed(1)} MB`;
  function tech(id) {
    return `<details class="tech" id="${id}"><summary>本次读取技术详情</summary><div class="copy-row"><span>请求编号</span><code>${esc(S.requestId)}</code><button data-copy="${id}">复制</button></div><p class="copy-feedback" aria-live="polite" id="${id}-feedback">${esc(S.copied[id] || "编号是审核样例；复制仅模拟反馈。")}</p></details>`;
  }
  function assetTech(a, open = false) {
    return `<details class="row-tech" ${open ? "open" : ""}><summary>技术信息</summary><dl><dt>对象代码</dt><dd><code>${esc(a.asset_kind)}</code></dd><dt>角色代码</dt><dd><code>${esc(a.storage_role)}</code></dd><dt>最新资产时间</dt><dd>${esc(when(a.latest_created_at))}</dd><dt>加密</dt><dd>${fact(a.encrypted)}</dd></dl></details>`;
  }
  function warnings(d) {
    const out = [];
    if (d.latest_backup && d.latest_backup.actual_rpo_minutes == null)
      out.push("实际 RPO 未记录，不能从空值推断为 0 分钟。");
    if (d.latest_drill && d.latest_drill.actual_rto_minutes == null)
      out.push("实际 RTO 未记录，不能从空值推断为 0 分钟。");
    if (
      [d.latest_backup?.actual_rpo_minutes, d.latest_drill?.actual_rto_minutes].some(
        (v) => v != null && Number(v) < 0,
      )
    )
      out.push("实际分钟为负值，需核对来源记录；本稿保留服务返回结论。");
    if (d.latest_drill && !d.latest_drill.finished_at)
      out.push("演练结束时间缺失，无法读取确切有效期。");
    if (
      d.drill_expires_at &&
      Date.parse(d.observed_at) > Date.parse(d.drill_expires_at) &&
      d.state === "verified"
    )
      out.push("观测时间已超过精确到期时间，服务仍返回已验证；整天取整边界需确认。");
    if (
      d.latest_drill?.finished_at &&
      Date.parse(d.latest_drill.finished_at) > Date.parse(d.observed_at)
    )
      out.push("演练结束时间晚于本次观测时间，需核对时钟或记录。");
    if (!d.latest_backup && d.targets.length)
      out.push("近期运行窗口未返回备份，但资产查询仍有记录。资产存在不等于本页恢复条件满足。");
    return out.length
      ? `<section class="notice" id="fact-warning"><h3>结论与原始事实需要核对</h3>${out.map((t) => `<p>${esc(t)}</p>`).join("")}<p>这是待审展示提示，不重新计算服务状态、不放宽或收紧业务规则。</p></section>`
      : "";
  }
  function render() {
    const d = S.data;
    $("#app").innerHTML =
      `<div class="layout"><aside><div class="brand">SCOUTOPS <small>运维</small></div><div class="aside-title"><p class="meta">PLATFORM / 64</p><h2>恢复证据</h2><p class="meta">读取事实 · 不执行恢复</p></div><nav aria-label="本页阅读目录"><a href="#conclusion"><span>01</span>结论与证据</a><a href="#assets"><span>02</span>备份资产</a><a href="#blockers"><span>03</span>阻断项</a></nav><div class="boundary"><b>同机恢复，不是异地灾备</b><p>惠州当前主机内的独立加密副本与逻辑隔离恢复。</p><p>不覆盖整机、磁盘或机房故障。本页不读取密文、密钥或存储路径。</p></div></aside><main><header class="page-head"><div><div class="eyebrow">运行保障 / 备份与恢复</div><h1>恢复准备情况</h1><p>${esc(d ? `事实观测于 ${when(d.observed_at)}` : "等待读取授权范围内的恢复事实")}</p></div><button class="primary" id="refresh" ${S.pending ? "disabled" : ""} aria-busy="${Boolean(S.pending)}">${S.pending ? "正在刷新…" : "刷新事实"}</button></header>
    ${S.failure ? `<section class="notice" aria-live="polite"><h3>${titles[S.failure]}</h3><p>${S.failure === "timeout" ? "读取超过15秒，已停止本次请求。" : "本次刷新未完成。"}下方保留上次成功快照；观测时间没有更新。</p><button id="retry" ${S.pending ? "disabled" : ""}>重新核验</button>${tech("refresh-tech")}</section>` : ""}
    ${!d ? `<section id="conclusion" tabindex="-1" class="sheet first-state" aria-live="polite">${S.first === "loading" ? '<div class="loading-line"></div>' : '<div class="eyebrow">读取状态</div>'}<h2>${titles[S.first]}</h2><p>${S.first === "loading" ? "正在核对备份、恢复副本与最近演练的记录。" : "未展示恢复数据。请按当前状态重新登录、稍后重试或联系平台管理员。"}</p>${S.first === "expired" ? '<a id="login" href="/login">重新登录</a>' : S.first !== "forbidden" ? `<button id="retry" ${S.pending ? "disabled" : ""}>重新核验</button>` : ""}</section>` : content(d)}
    <p class="footer-note">本页读取会产生平台读取审计。当前是离线合成审核稿，没有真实 HTTP、数据库审计或恢复执行。图稿尚待用户批准。</p>${tech("request-tech")}</main></div>`;
    $("#refresh").onclick = read;
    if ($("#retry")) $("#retry").onclick = read;
    if ($("#login"))
      $("#login").onclick = (e) => {
        e.preventDefault();
        S.navigation.push("/login");
      };
    document.querySelectorAll("aside a").forEach(
      (a) =>
        (a.onclick = (e) => {
          e.preventDefault();
          const n = $(a.getAttribute("href")) || $("#conclusion");
          n.focus();
          n.scrollIntoView({ block: "start" });
        }),
    );
    document
      .querySelectorAll("[data-detail]")
      .forEach((b) => (b.onclick = () => openDetail(Number(b.dataset.detail), b)));
    document
      .querySelectorAll("[data-copy]")
      .forEach((b) => (b.onclick = () => copy(b.dataset.copy)));
    document.querySelectorAll("[data-col]").forEach(
      (b) =>
        (b.onchange = () => {
          const i = Number(b.dataset.col);
          if (S.hidden.includes(i)) S.hidden = S.hidden.filter((n) => n !== i);
          else if (S.hidden.length < 6) S.hidden.push(i);
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
  function content(d) {
    const visible = columns.map((_, i) => i).filter((i) => !S.hidden.includes(i));
    return `${warnings(d)}<section class="sheet conclusion" id="conclusion" tabindex="-1"><div><span class="state-code">恢复结论 · ${esc(d.state)}</span><h2>${stateText[d.state]}</h2><p>${d.blockers.length ? `服务列出 ${d.blockers.length} 项待满足条件` : "服务未返回阻断项"}</p></div><div class="note"><h3>只读结论，不是恢复承诺</h3><p>结合下方实际分钟、演练有效期和核验记录判断证据完整性。副本条件通过不代表五类对象全部覆盖，也不保护主机故障。</p></div></section>
    <section class="sheet" id="evidence"><div class="section-heading"><h2>目标与实际，分开核对</h2><p>RPO：最多可丢失时间 · RTO：恢复耗时</p></div><div class="comparison"><div class="cap">核对项</div><div class="cap">策略目标上限</div><div class="cap">最近记录实际</div><div class="label"><b>RPO</b><small>数据库可丢失时间</small></div><div><strong>${d.policy.rpo_minutes}</strong><small>分钟</small></div><div><strong>${esc(minute(d.latest_backup?.actual_rpo_minutes))}</strong><small>不是估算值</small></div><div class="label"><b>RTO</b><small>数据库恢复耗时</small></div><div><strong>${d.policy.rto_minutes}</strong><small>分钟</small></div><div><strong>${esc(minute(d.latest_drill?.actual_rto_minutes))}</strong><small>最近隔离演练</small></div></div>
    <dl class="facts"><div><dt>主站 / 恢复目标</dt><dd>${esc(d.policy.primary_region)} / ${esc(d.policy.recovery_region)}</dd></div><div><dt>最近备份完成</dt><dd>${esc(when(d.latest_backup?.finished_at))}</dd></div><div><dt>同机恢复副本条件</dt><dd>${fact(d.recovery_copy_verified)}</dd></div></dl><div class="drill"><h3>演练证据 · 策略有效期 ${d.policy.maximum_drill_age_days} 天</h3><dl class="facts"><div><dt>演练完成 / 距观测整天数</dt><dd>${esc(when(d.latest_drill?.finished_at))}<br>${d.drill_age_days == null ? "整天数未记录" : `${d.drill_age_days} 天`}</dd></div><div><dt>精确到期时间</dt><dd>${esc(when(d.drill_expires_at))}</dd></div><div><dt>服务返回剩余天数</dt><dd>${reminder(d.days_until_drill_expiry)}</dd></div></dl><div class="checks">${Object.entries(
      flags,
    )
      .map(
        ([k, t]) =>
          `<span class="${d.latest_drill?.[k] === false ? "bad" : ""}">${t} · ${fact(d.latest_drill?.[k])}</span>`,
      )
      .join(
        "",
      )}</div><p class="meta">有效期按返回策略展示，不代表发布资格放宽；没有结束时间不生成到期日期。</p></div></section>
    <section class="sheet" id="assets" tabindex="-1"><div class="section-heading"><h2>备份资产</h2><p>最近备份聚合的 ${d.targets.length} 个对象 / 角色 / 区域组；不是文件明细或全库资产总数。</p></div><div class="desktop"><div class="tools"><details class="columns" id="column-menu"><summary>列设置</summary><fieldset><legend>至少保留一列</legend>${columns.map((t, i) => `<label><input type="checkbox" data-col="${i}" ${S.hidden.includes(i) ? "" : "checked"} ${visible.length === 1 && visible[0] === i ? "disabled" : ""}/>${t}</label>`).join("")}</fieldset></details><button id="freeze" aria-pressed="${S.freeze}">${S.freeze ? "首列已冻结" : "首列未冻结"}</button><label>密度<select id="density"><option value="standard" ${S.density === "standard" ? "selected" : ""}>标准</option><option value="compact" ${S.density === "compact" ? "selected" : ""}>紧凑</option></select></label></div><div class="table-wrap" tabindex="0" aria-label="备份资产表格，可横向滚动"><table class="${S.density}"><thead><tr>${visible.map((i, j) => `<th class="${j === 0 && S.freeze ? "frozen" : ""}" scope="col">${columns[i]}</th>`).join("")}</tr></thead><tbody>${d.targets
      .map((a) => {
        const cells = [
          `${esc(kinds[a.asset_kind] || "其他备份对象")}<span class="meta">加密 · ${fact(a.encrypted)}</span>`,
          role(a.storage_role),
          esc(a.region),
          `${a.bundle_count} 份`,
          bytes(a.size_bytes),
          fact(a.integrity_verified),
          assetTech(a),
        ];
        return `<tr>${visible.map((i, j) => `<td class="${j === 0 && S.freeze ? "frozen" : ""}">${cells[i]}</td>`).join("")}</tr>`;
      })
      .join(
        "",
      )}</tbody></table></div></div><div class="mobile">${d.targets.map((a, i) => `<button class="asset-card" data-detail="${i}" aria-haspopup="dialog"><strong>${esc(kinds[a.asset_kind] || "其他备份对象")}</strong><span class="meta">${role(a.storage_role)} · ${esc(a.region)}</span><span class="meta">${a.bundle_count} 份 · ${bytes(a.size_bytes)} · 加密${fact(a.encrypted)} · 完整性${fact(a.integrity_verified)}</span><span class="action">查看完整详情 →</span></button>`).join("")}</div>${!d.targets.length ? '<p class="empty">没有返回资产记录。未用空列表推断备份成功。</p>' : ""}</section>
    <section class="sheet" id="blockers" tabindex="-1"><div class="section-heading"><h2>待满足的恢复条件</h2><p>处理建议来自服务；操作仍须在授权的宝塔任务中完成。</p></div>${d.blockers.map((b) => `<article class="blocker"><h3>${esc(blockers[b.code] || "恢复条件未满足")}</h3><p>${esc(b.action_hint)}</p><details><summary>查看阻断代码</summary><code>${esc(b.code)}</code></details></article>`).join("") || '<p class="empty">服务未返回阻断项。请继续核对上方证据，不据此扩大灾备能力。</p>'}</section>`;
  }
  function read() {
    if (S.pending) return;
    S.pending = ++seq;
    S.reads.push({ id: S.pending, method: "GET", path: "/platform/operations/backup-recovery" });
    S.failure = null;
    if (!S.data) S.first = "loading";
    render();
  }
  function completeRead(outcome = "success", id = S.pending) {
    if (!S.pending || id !== S.pending) return false;
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
      closeDetail();
    }
    S.copied = {};
    render();
    return true;
  }
  function copy(id) {
    S.copied[id] = S.copyDenied
      ? "复制被拒绝，请手动选取上方编号。（离线模拟）"
      : "已复制（离线模拟，未写入系统剪贴板）";
    $(`#${id}-feedback`).textContent = S.copied[id];
  }
  function openDetail(i, trigger) {
    const a = S.data.targets[i];
    returnFocus = trigger || $("#assets");
    $("#detail").innerHTML =
      `<header><div><div class="eyebrow">资产记录 · 只读</div><h2 id="detail-title">${esc(kinds[a.asset_kind] || "其他备份对象")}</h2></div><button id="close" aria-label="关闭详情">关闭</button></header><p id="detail-description">聚合资产的元数据，不包含密文、存储路径或密钥。</p><dl><div><dt>角色</dt><dd>${role(a.storage_role)}</dd></div><div><dt>区域</dt><dd>${esc(a.region)}</dd></div><div><dt>数量</dt><dd>${a.bundle_count} 份</dd></div><div><dt>体积</dt><dd>${bytes(a.size_bytes)}</dd></div><div><dt>加密</dt><dd>${fact(a.encrypted)}</dd></div><div><dt>完整性</dt><dd>${fact(a.integrity_verified)}</dd></div><div class="wide"><dt>最新资产时间</dt><dd>${esc(when(a.latest_created_at))}</dd></div></dl>${assetTech(a, S.key === "detail-long")}`;
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
    if (e.target === $("#detail")) {
      const r = e.target.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
        closeDetail();
    }
  });
  $("#detail").addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const nodes = [...$("#detail").querySelectorAll("button,summary")].filter(
        (n) => n.getClientRects().length,
      ),
      first = nodes[0],
      last = nodes.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
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
      reads: [],
      hidden: [],
      freeze: true,
      density: "standard",
      copied: {},
      copyDenied: false,
      navigation: [],
      requestId: "synthetic-review-request-64",
    };
    if (titles[key]) {
      S.data = null;
      S.first = key;
      if (key === "loading") S.pending = ++seq;
    }
    if (key.startsWith("refresh-")) {
      const outcome = key.slice(8);
      S.pending = ++seq;
      if (outcome !== "pending") completeRead(outcome);
    }
    if (key === "blocker-tech") S.data = clone(D.datasets.blocked);
    if (key === "detail-long") S.data = clone(D.datasets.long);
    if (key === "one-column") S.hidden = [0, 1, 2, 3, 4, 5];
    if (key === "unfrozen") S.freeze = false;
    if (key === "compact") S.density = "compact";
    document.body.className = ["dark", "contrast"].includes(key) ? key : "";
    render();
    $("#scene").value = key;
    $("#review-tools").open = false;
    if (key.startsWith("detail-")) {
      const kind = key.slice(7),
        i = Math.max(
          0,
          S.data.targets.findIndex((a) => a.asset_kind === kind),
        );
      openDetail(i, $(`[data-detail="${i}"]`));
    }
    if (key === "asset-tech") {
      document.querySelectorAll("tbody .row-tech")[0].open = true;
      $("#assets").scrollIntoView();
    }
    if (key === "blocker-tech") {
      document.querySelectorAll(".blocker details").forEach((d) => (d.open = true));
      $("#blockers").scrollIntoView();
    }
    if (["request-tech", "copy-denied", "copy-success"].includes(key)) {
      $("#request-tech").open = true;
      if (key.startsWith("copy-")) {
        S.copyDenied = key === "copy-denied";
        copy("request-tech");
      }
    }
    if (["columns-open", "one-column"].includes(key)) $("#column-menu").open = true;
    if (key === "focus") $("#refresh").focus();
    if (!key.startsWith("detail-") && !["blocker-tech", "asset-tech"].includes(key))
      window.scrollTo(0, 0);
  }
  $("#scene").innerHTML = Object.entries(scenes)
    .map(([k, t]) => `<option value="${k}">${t}</option>`)
    .join("");
  $("#scene").onchange = (e) => scene(e.target.value);
  window.BACKUP_C = {
    scene,
    scenes,
    state: () => clone(S),
    read,
    completeRead,
    openDetail,
    closeDetail,
  };
  scene("blocked");
})();
