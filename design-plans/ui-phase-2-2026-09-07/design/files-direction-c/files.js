(() => {
  "use strict";
  const D = window.FILES_DATA,
    L = window.FILES_LOGIC(),
    esc = (v) =>
      String(v ?? "未记录").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
      ),
    bytes = (n) =>
      n >= 1099511627776
        ? (n / 1099511627776).toFixed(2) + " TiB"
        : n >= 1073741824
          ? (n / 1073741824).toFixed(2) + " GiB"
          : n >= 1048576
            ? (n / 1048576).toFixed(2) + " MiB"
            : n >= 1024
              ? (n / 1024).toFixed(2) + " KiB"
              : n + " B",
    time = (v) => (v ? new Date(v).toLocaleString("zh-CN", { hour12: false }) : "未记录"),
    states = {
      ready: "本机文件判门满足",
      warning: "本次文件观测存在预警",
      blocked: "本次文件判门阻断",
      loading: "正在读取文件证据",
      empty: "尚无文件观测",
      expired: "登录已失效",
      forbidden: "没有平台运维权限",
      rate_limited: "刷新过于频繁",
      timeout: "本次文件读取超时",
      unavailable: "文件运行事实暂不可用",
      recovering: "恢复文案预览",
    },
    names = {
      file_root_unavailable: "目录可用性或数量未满足",
      file_root_publicly_exposed: "受控根落入静态目录",
      shared_storage_unexpected: "发现非预期共享存储",
      backup_server_unexpected: "发现非预期备用服务器",
      file_checksum_mismatch: "样本校验不一致",
      file_missing: "样本路径无效或读取失败",
      file_recovery_unverified: "同机恢复证据未满足",
      file_recovery_drill_stale: "演练证据过期",
      file_capacity_stop: "文件系统水位达到停止线",
      file_capacity_warning: "文件系统水位达到预警线",
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
      refreshing: "旧快照刷新中",
      "refresh-timeout": "旧快照读取超时",
      "refresh-rate_limited": "旧快照限流",
      "refresh-unavailable": "旧快照依赖失败",
      "generic-error": "无请求ID异常",
      "request-detail": "成功请求ID披露",
      "failure-detail": "首次错误ID披露",
      "refresh-detail": "旧快照错误ID披露",
      "copy-success": "模拟复制成功",
      "copy-denied": "成功ID复制拒绝",
      "failure-copy-denied": "首次错误ID复制拒绝",
      "refresh-copy-denied": "旧快照错误ID复制拒绝",
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
  function directory(r, i) {
    const known = r.available && r.total_bytes > 0,
      ratioValid = r.usage_basis_points >= 0 && r.usage_basis_points <= 10000,
      measured = known && ratioValid,
      title = L.rootLabel(r.kind) || r.kind,
      purpose = L.rootPurpose(r.kind) || "源返回目录";
    return `<article class="directory" id="directory-${i}" data-kind="${esc(r.kind)}"><header><div><h3>${esc(title)}</h3><p>${esc(purpose)}</p></div><strong class="${r.available && r.writable ? "ready" : "blocked"}">${!r.available ? "访问或容量探测失败" : !r.writable ? "不可写" : "可读写"}</strong></header><div class="root-evidence"><section><h4>所在文件系统</h4><strong class="watermark">${!known ? "未取得有效容量" : !ratioValid ? "比例异常" : L.percent(r.usage_basis_points)}</strong>${measured ? `<progress aria-label="${esc(title)}所在文件系统已用比例" aria-valuetext="${L.percent(r.usage_basis_points)}" value="${r.usage_basis_points}" max="10000"></progress><p>${bytes(r.used_bytes)} 已用 / ${bytes(r.total_bytes)} 总量</p>` : `<p class="note caution">源比例 ${L.percent(r.usage_basis_points)}；${!known ? "失败/未知约定，不是实测满额。" : "可用空间超过总量，已用字节归0但源比例为负；请核对观测。"} 原值已用 ${bytes(r.used_bytes)} / 总量 ${bytes(r.total_bytes)}。</p>`}<small>不是此目录的递归体积。比例封顶100%，不提供物理盘标识。</small></section><section class="index-facts"><h4>活动资产索引</h4>${r.kind === "temp" ? `<strong>不建立持久索引</strong><p>源返回文件数 ${esc(r.active_files)}、索引体积 ${bytes(r.indexed_bytes)}。</p><small>这里的0不表示临时目录为空；不参与本次哈希抽样。</small>` : `<dl><div><dt>活动文件</dt><dd>${esc(r.active_files)} 个</dd></div><div><dt>索引体积</dt><dd>${bytes(r.indexed_bytes)}</dd></div></dl><small>${r.kind === "evidence" ? "来自活动证据索引。" : "来自成功且未过期的导出索引。"} 索引值不证明文件当前可读。</small>`}</section></div></article>`;
  }
  function integrity(d) {
    const v = d.integrity;
    return `<section class="integrity" id="integrity"><header><h2>本次文件抽样</h2><p>证据优先，剩余名额才读取有效导出；临时目录不参与。</p></header><div class="sample-total"><span>纳入的样本</span><strong>${esc(v.sampled_files)} <small>个</small></strong></div><dl class="sample-counts">${[
      ["匹配", v.verified_files, "ready"],
      ["不一致", v.mismatch_files, v.mismatch_files > 0 ? "blocked" : ""],
      ["缺失 / 读取失败", v.missing_files, v.missing_files > 0 ? "blocked" : ""],
    ]
      .map(([k, n, c]) => `<div><dt>${k}</dt><dd class="${c}">${esc(n)}</dd></div>`)
      .join(
        "",
      )}</dl><p class="note ${v.sampled_files === 0 ? "caution" : ""}" id="sample-boundary">${v.sampled_files === 0 ? "本次未抽到文件，不能计算通过率，也不代表没有活动资产。" : "匹配数只描述本次样本，不是全库完整性通过率。"} 总体状态仍使用源返回值。</p><p class="meta">按最近更新/id顺序取活动证据，再补有hash的有效导出。API未返回本次配置上限或分类样本数，不能假设随机覆盖或固定20个。</p></section>`;
  }
  function recovery(d) {
    const r = d.recovery;
    return `<section class="recovery" id="recovery"><header><h2>同机恢复证据</h2><p>不代表整机、磁盘、机房或异地灾备。</p></header><strong class="recovery-status ${r.status === "verified" ? "ready" : r.status === "stale" ? "warning" : "blocked"}">${esc({ verified: "探针恢复条件满足", stale: "恢复演练证据过期", blocked: "恢复证据未满足", empty: "未返回恢复记录" }[r.status] || r.status)}</strong><small>源状态：${esc(r.status)}</small><dl><div><dt>加密同机副本</dt><dd>${r.encrypted_same_host_copy ? "条件满足" : "未满足"}</dd></div><div><dt>隔离恢复证据</dt><dd>${r.isolated_restore_verified ? "条件满足" : "未满足"}</dd></div><div><dt>演练距今</dt><dd>${r.drill_age_days == null ? "未记录" : esc(r.drill_age_days) + " 天"}</dd></div></dl><p class="note">最近20条中寻找备份和演练，要求同备份的evidence/export加密完整副本及隔离、权限、审计与证据核验。没有返回每份记录的时间、文件或原始证明。</p><p class="meta">年龄未来归0并保留两位小数；90天与stale可并存。文件演练过期为预警，不照搬MySQL阻断规则；探针与运行policy均参与判断。${r.drill_age_days == null ? " 年龄未知不填0，也不改写源状态。" : ""}</p></section>`;
  }
  function render() {
    const d = current.data;
    document.getElementById("app").innerHTML =
      `<header class="context"><div class="context-inner"><div><strong>ScoutOps / 文件运行</strong><p>证据、导出与临时目录，各自观测、分别核对</p></div><div class="boundary">惠州同机 · 宝塔受管<br>不使用共享存储或备用服务器</div></div></header><main id="workspace" tabindex="-1"><p class="review-label">P69 · C方向具体稿 · 离线合成样例，非生产观测</p><header class="header"><div><h1>文件存储核验</h1><p>文件系统水位、资产索引与恢复证据分开阅读。</p></div><button class="primary" id="refresh" aria-busy="${!!current.pending}" ${current.pending ? "disabled" : ""}>${current.pending ? "正在读取…" : "刷新文件事实"}</button></header>${d && current.failure ? `<section class="notice" role="status"><strong>${esc(states[current.failure])} · 保留旧快照</strong><p>仍显示 ${esc(time(d.observed_at))} 的成功结果。浏览器15秒、授权后API默认14秒超时；signal传到探针/哈希流及事务检查，不保证运行中的SQL即时中止。</p><button id="retry">重新核验</button>${technical("refresh-request", current.requestId)}</section>` : ""}<div class="paper">${d ? `<section class="verdict"><div><span class="pill ${d.state}">${esc(d.state)}</span><h2 class="${d.state}">${esc(states[d.state])}</h2><p>返回 ${d.findings.length} 项发现；不替代全量文件或生产验收。</p></div><div class="observation"><strong>观测时间</strong><p>${esc(time(d.observed_at))}</p></div></section>${d.findings.length ? `<section class="findings" id="findings"><h2>需要核对的发现</h2>${d.findings.map((f) => `<article class="finding" data-severity="${f.severity}"><strong>${esc(names[f.code] || f.code)}</strong> <span class="pill ${f.severity}">${f.severity === "blocked" ? "阻断" : "预警"}</span><p>${esc(f.action_hint)}</p><code>${esc(f.code)}</code></article>`).join("")}<p class="meta">源建议仅供人工核对，此页不执行清理、停任务、隔离或恢复。</p></section>` : ""}<div class="evidence-grid"><section class="directories" id="directories"><header><h2>受控目录的双重口径</h2><p>文件系统水位不等于索引体积。三个根可能同盘，不能相加当总盘用量。</p></header>${d.directories.length ? d.directories.map(directory).join("") : '<p class="note caution">未返回目录记录；不补造三条正常水位。</p>'}<p class="note">总体容量判门使用最高水位，而非三者合计。API未返回实际阈值或每根严重级别，水位条仅表示读数，不跟随无关异常全部变红。</p></section><aside class="side-evidence">${integrity(d)}${recovery(d)}</aside></div><section class="boundary-facts" id="boundary-facts"><h2>部署边界与当前证据</h2><p>返回固定标记：组织隔离=true、公网访问=false、共享存储=false、备用服务器=false；不是独立实时扫描结果。若findings报告静态根暴露或非预期存储，不用固定标记覆盖异常。</p><p class="meta">探针检查路径包含关系，不等于检查全部Nginx alias、ACL、符号链接或实际公网访问。当前历史manifest只列证据与导出，不能冒称已完成第三个临时根的本次生产验证；本稿不改manifest或生产证据。</p></section>` : `<section class="failure" role="status"><h2>${esc(states[current.status])}</h2><p>${current.status === "recovering" ? "这是前端枚举的离线预览，当前服务没有返回recovering；本页没有启动恢复作业。" : current.status === "loading" ? "读取中不显示成功容量或校验数字。" : "当前没有可用快照，请核对登录或服务状态后重新读取。"} </p>${["loading", "recovering"].includes(current.status) ? "" : current.status === "expired" ? '<a id="login" href="/login">重新登录</a>' : '<button id="retry">重新核验</button>'}${["loading", "recovering"].includes(current.status) ? "" : technical("failure-request", current.requestId)}</section>`}</div>${d ? `<footer class="footer"><p class="meta">离线稿不读写业务文件。真实GET会写观测、查看与平台审计；清理、备份、恢复仍由宝塔管理。</p>${technical("request", "synthetic-success-request")}</footer>` : ""}<details class="review" id="review-tools"><summary>审核工具 · 非产品功能</summary><label for="scene">选择目录、样本、恢复或控件状态</label><select id="scene">${Object.entries(
        scenes,
      )
        .map(
          ([k, v]) =>
            `<option value="${k}" ${k === current.key ? "selected" : ""}>${esc(v)}</option>`,
        )
        .join(
          "",
        )}</select><p class="meta">无业务弹窗、文件列表、下载、删除或恢复执行按钮。复制仅模拟。</p></details></main>`;
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
    current.reads.push({ id: current.pending, path: "/platform/operations/files" });
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
  window.FILES_C = { scenes, scene, read, completeRead, state: () => structuredClone(current) };
  scene("ready");
})();
