/* Design-only state machine. Never fetches, opens tabs, downloads, reads files or calls extensions. */
(() => {
  const D = window.CREDENTIAL_C_DATA,
    O = D.original;
  const $ = (id) => document.getElementById(id);
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const esc = (v = "") =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const kinds = {
    api_key: "接口密钥",
    account_secret: "账号密码",
    cookie_bundle: "登录状态",
    private_key: "私钥",
    browser_profile: "网页登录档案",
  };
  const scenes = {
    default: "原始夹具 · 凭证台账",
    mixed: "独立合成 · 到期与撤销",
    profiles: "只读运行档案",
    compatibility: "关联检查 · 尚缺档案",
    "compat-ready": "关联满足 · 不等于登录有效",
    columns: "桌面列设置",
    compact: "桌面紧凑表格",
    empty: "首次空数据",
    "no-assets": "仅有档案",
    "no-profiles": "仅有资产",
    "no-providers": "无来源选项",
    loading: "首次加载",
    expired: "首次401",
    forbidden: "首次403",
    blocked: "首次依赖受阻",
    error: "首次错误",
    refreshing: "刷新进行中",
    "refresh-error": "刷新失败保留整组快照",
    "asset-empty": "新建凭证 · 必填",
    "asset-filled": "新建凭证 · 可提交",
    "asset-error": "新建凭证 · 明确拒绝",
    "asset-busy": "新建凭证 · 提交中",
    "asset-unknown": "新建凭证 · 结果未知",
    rotate: "轮换 · 指定资产",
    "rotate-conflict": "轮换 · 版本冲突",
    "rotate-expiry": "轮换 · 到期语义说明",
    "rotate-revoked": "已撤销资产 · 禁用维护",
    profile: "关联运行档案 · 默认停用",
    "profile-filled": "关联运行档案 · 可提交",
    "profile-noasset": "关联运行档案 · 无候选",
    "profile-error": "关联运行档案 · 窗内失败",
    "profile-busy": "关联运行档案 · 提交中",
    login: "登录导入 · Cookie文件",
    "login-browser": "登录导入 · 浏览器助手",
    "login-archive": "登录导入 · tar.gz",
    "login-material": "登录导入 · 材料待提交",
    "login-fileerror": "登录导入 · 格式或大小错误",
    "login-domainerror": "登录导入 · 域校验拒绝",
    "login-reading": "登录导入 · 助手读取中",
    "login-helpererror": "登录导入 · 助手不可用",
    "login-savingasset": "登录导入 · 保存资产中",
    "login-savingprofile": "登录导入 · 资产已存关联中",
    "login-partial": "登录导入 · 部分成功恢复",
    "login-unknown": "登录导入 · 结果未知",
    "login-success-refresherror": "登录已保存 · 重读单独失败",
    revoke: "撤销 · 双重确认",
    "revoke-ack": "撤销 · 已签认",
    "revoke-ready": "撤销 · 可提交",
    "revoke-busy": "撤销 · 提交中",
    "revoke-conflict": "撤销 · 版本冲突",
    "compat-detail": "关联检查 · 移动详情",
    "compat-technical": "关联检查 · 来源技术详情",
    "login-no-provider": "登录导入 · 无登录型来源",
    long: "长名称与技术元数据",
    focus: "键盘焦点",
    hover: "按钮悬停",
    pressed: "按钮按下",
    tools: "审核工具面板",
  };
  let s,
    generation = 0,
    serial = 0,
    pending = null,
    returnId = "";
  const provider = (id) => s.providers.find((p) => p.id === id);
  const browserAssets = () =>
    s.assets.filter(
      (a) => a.status === "active" && ["browser_profile", "cookie_bundle"].includes(a.kind),
    );
  const loginProviders = () => s.providers.filter((p) => p.access_mode === "authenticated_browser");
  const activeAsset = () => s.assets.find((a) => a.id === s.assetId) || s.assets[0] || O.asset;
  const date = (v) =>
    v
      ? new Date(v).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }) +
        " (UTC+8)"
      : "未设置到期";
  const rows = () =>
    loginProviders().map((p) => {
      const assets = browserAssets().filter((a) => a.provider_id === p.id);
      const profiles = s.profiles.filter((v) => v.provider_id === p.id);
      const ready = profiles.some(
        (v) =>
          v.status === "active" &&
          assets.some(
            (a) => a.id === v.credential_asset_id && (!a.expires_at || a.expires_at > D.clock),
          ),
      );
      return { p, assets, profiles, ready };
    });
  const badge = (text, tone = "") => `<span class="status ${tone}">${esc(text)}</span>`;
  const note = (text, tone = "warning") =>
    text ? `<div class="notice ${tone}">${esc(text)}</div>` : "";
  const metadata = (a) =>
    `<dl class="meta"><div><dt>资产 ID</dt><dd><code>${esc(a.id)}</code></dd></div><div><dt>指纹（不可还原秘密）</dt><dd><code>${esc(a.fingerprint)}</code></dd></div><div><dt>密钥 / 资产版本</dt><dd>${esc(a.key_version)} / ${a.version}</dd></div><div><dt>最近轮换 / 元数据更新</dt><dd>${esc(date(a.rotated_at))}<br />${esc(date(a.updated_at))}</dd></div></dl>`;
  function render() {
    const focusId = document.activeElement?.id;
    const openDetails = new Set(
      [...document.querySelectorAll("#content details[open]")].map((d) => d.id),
    );
    document.querySelectorAll("[data-view]").forEach((b) => {
      if (b.dataset.view === s.view) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    $("page-title").textContent = { assets: "凭证台账", profiles: "运行档案", compat: "关联检查" }[
      s.view
    ];
    $("page-description").textContent = {
      assets: "维护资料与有效期；只显示元数据。",
      profiles: "档案引用凭证资产；此列表仅供查看。",
      compat: "核对同来源资产与档案，不检测真实登录。",
    }[s.view];
    $("provenance").textContent =
      `${s.synthetic ? "独立合成变体" : "原始 E2E 元数据夹具"} · 非实时数据 · 审核时钟 2026-09-09 12:00 UTC+8`;
    $("refresh").disabled = s.refreshing;
    $("refresh").textContent = s.refreshing ? "刷新中…" : "刷新数据";
    $("notice").innerHTML = note(s.notice, s.noticeTone || "warning");
    if (s.initial !== "ready") {
      const copy = {
        loading: ["正在读取三组元数据", "资产、运行档案、来源选项全部完成后才更新。"],
        expired: [
          "登录已失效",
          "读取返回401；本页不展示受限资料。恢复会话后再刷新，不自动重放敏感提交。",
        ],
        forbidden: ["没有凭证管理权限", "读取返回403；不展示受限资产，不提供绕过权限的入口。"],
        blocked: ["元数据读取暂时受阻", "请求超时、限流或依赖不可用。尚未取得可显示的成功快照。"],
        error: ["元数据读取未完成", "三组读取有一项失败，不把其余两组当作完整数据。"],
      }[s.initial];
      $("content").innerHTML =
        `<section class="empty"><h3>${copy[0]}</h3><p>${copy[1]}</p><button id="read-retry" ${s.initial === "loading" ? "disabled" : ""}>${s.initial === "loading" ? "请稍候" : "重新读取"}</button></section>`;
    } else if (s.view === "assets") {
      $("content").innerHTML =
        `<div class="actions work-actions"><p>active 资产 ${s.assets.filter((a) => a.status === "active").length} · 包含可能过期的资料</p><div class="actions"><button id="new-asset" class="primary" data-open="asset">新建凭证资产</button><button id="new-login" data-open="login">配置网页登录</button></div></div>` +
        (s.assets.length
          ? `<div class="surface">${s.assets
              .map((a, i) => {
                const expired = a.expires_at && a.expires_at <= D.clock;
                return `<article class="asset-row"> <div>${badge(a.status === "revoked" ? "已撤销" : expired ? "active · 已到期" : "active · 未到期", a.status === "revoked" || expired ? "warning" : "good")}<h3>${esc(a.name)}</h3><p>${esc(provider(a.provider_id)?.name || "未知来源")} / ${esc(kinds[a.kind] || "其他凭证")}</p><p>到期：${esc(date(a.expires_at))}</p></div><div class="actions"><button id="rotate-${i}" data-open="rotate" data-asset="${a.id}" ${a.status === "revoked" ? "disabled" : ""}>更新资料</button><button id="revoke-${i}" class="danger" data-open="revoke" data-asset="${a.id}" ${a.status === "revoked" ? "disabled" : ""}>撤销</button></div><details id="asset-meta-${i}"><summary>指纹、版本与时间</summary>${metadata(a)}</details></article>`;
              })
              .join("")}</div>`
          : `<section class="empty"><h3>还没有凭证资产</h3><p>从新建凭证或导入网页登录开始。来源选项存在，不代表资料已经保存。</p><button id="first-asset" class="primary" data-open="asset">创建首个凭证</button></section>`);
    } else if (s.view === "profiles") {
      $("content").innerHTML =
        `<div class="actions work-actions"><p>运行档案 ${s.profiles.length} · active 与 disabled 均计入</p><button id="new-profile" class="primary" data-open="profile">关联运行档案</button></div>` +
        (s.profiles.length
          ? `<div class="surface">${s.profiles.map((p) => `<article class="asset-row"><div>${badge(p.status === "active" ? "运行档案已启用" : "运行档案已停用")}<h3>${esc(p.name)}</h3><p>${esc(provider(p.provider_id)?.name || "未知来源")} → ${esc(s.assets.find((a) => a.id === p.credential_asset_id)?.name || "凭证引用不可用")}</p><dl class="meta"><div><dt>标识 / 浏览器</dt><dd><code>${esc(p.code)}</code> / ${esc(p.browser_family)}</dd></div><div><dt>语言 / 时区</dt><dd>${esc(p.locale)} / ${esc(p.timezone)}</dd></div><div><dt>版本 / 更新</dt><dd>${p.version} / ${esc(date(p.updated_at))}</dd></div><div><dt>引用资产 ID</dt><dd><code>${esc(p.credential_asset_id)}</code></dd></div></dl></div></article>`).join("")}</div>`
          : `<section class="empty"><h3>尚未关联运行档案</h3><p>先有同来源 active 的浏览器或 Cookie 资产，再建立运行引用。手动新建默认停用。</p></section>`);
    } else {
      const columns = ["来源", "active 浏览器类资产", "运行档案", "关联结论"];
      $("content").innerHTML =
        note("关联满足只说明元数据引用和到期条件满足，不证明真实登录、解析或来源启用。", "") +
        `<div class="actions"><button id="compat-profile" data-open="profile">关联运行档案</button><button id="compat-login" data-open="login">配置网页登录</button></div><div class="table-tools"><details id="columns"><summary>列设置</summary><fieldset><legend>至少保留一列</legend>${columns.map((c, i) => `<label class="check"><input type="checkbox" data-column="${i}" ${s.hidden.includes(i) ? "" : "checked"} ${s.hidden.length === 3 && !s.hidden.includes(i) ? "disabled" : ""} />${c}</label>`).join("")}</fieldset></details><button id="freeze" aria-pressed="${s.freeze}">${s.freeze ? "首列已冻结" : "首列未冻结"}</button><label>表格密度<select id="density"><option value="standard">标准</option><option value="compact" ${s.density === "compact" ? "selected" : ""}>紧凑</option></select></label></div><div class="table-wrap"><table class="${s.density === "compact" ? "compact" : ""}"><thead><tr>${columns.map((c, i) => `<th ${s.hidden.includes(i) ? "hidden" : ""} class="${s.freeze && i === columns.findIndex((_, n) => !s.hidden.includes(n)) ? "frozen" : ""}">${c}</th>`).join("")}</tr></thead><tbody>${rows()
          .map(
            (r) =>
              `<tr>${[
                `${esc(r.p.name)}<br /><code>${esc(r.p.code)}</code>`,
                `${esc(r.assets.map((a) => a.name).join("、") || "未配置")}<br /><small>active 资产 ${r.assets.length}</small>`,
                `${esc(r.profiles.map((p) => p.name).join("、") || "未关联")}<br /><small>档案 ${r.profiles.length}（含停用）</small>`,
                esc(
                  r.ready
                    ? "关联条件满足"
                    : r.assets.length
                      ? "待关联有效运行档案"
                      : "待配置登录资料",
                ),
              ]
                .map(
                  (c, i) =>
                    `<td ${s.hidden.includes(i) ? "hidden" : ""} class="${s.freeze && i === columns.findIndex((_, n) => !s.hidden.includes(n)) ? "frozen" : ""}">${c}</td>`,
                )
                .join("")}</tr>`,
          )
          .join("")}</tbody></table></div><div class="mobile-matrix">${rows()
          .map(
            (r, i) =>
              `<button id="compat-${i}" data-open="compat" data-provider="${r.p.id}"><strong>${esc(r.p.name)}</strong><span>${r.ready ? "关联条件满足" : r.assets.length ? "待关联有效运行档案" : "待配置登录资料"}</span><small>active 资产 ${r.assets.length} / 档案 ${r.profiles.length}</small><span>查看详情 →</span></button>`,
          )
          .join(
            "",
          )}</div>${rows().length ? "" : `<section class="empty"><h3>暂无登录型来源</h3><p>此检查只列 authenticated_browser 来源。</p></section>`}`;
    }
    for (const id of openDetails) if ($(id)) $(id).open = true;
    if (focusId && $(focusId) && !s.dialog) $(focusId).focus({ preventScroll: true });
  }
  const input = (id, label, value = "", type = "text", extra = "", help = "") =>
    `<label class="field ${id === "value" ? "full" : ""}">${label}<input id="${id}" name="${id}" type="${type}" value="${esc(value)}" ${extra} ${s.busy ? "disabled" : ""} ${help ? `aria-describedby="${id}-help"` : ""}/>${help ? `<small id="${id}-help">${help}</small>` : ""}</label>`;
  const select = (id, label, items, value, help = "") =>
    `<label class="field">${label}<select id="${id}" name="${id}" ${s.busy ? "disabled" : ""} required>${items.map(([v, t]) => `<option value="${esc(v)}" ${v === value ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>${help ? `<small>${help}</small>` : ""}</label>`;
  function dialogRender() {
    const focused = document.activeElement?.id;
    const scrollTop = $("editor").scrollTop;
    const type = s.dialog,
      a = activeAsset(),
      p = provider(s.providerId) || O.provider;
    const title = {
      asset: "新建凭证资产",
      rotate: "更新凭证资料",
      profile: "关联运行档案",
      login: "导入网页登录资料",
      revoke: "确认撤销凭证资产？",
      compat: "来源关联详情",
    }[type];
    let body = "",
      submit = "",
      hint = "仅模拟提交，不写入服务器。";
    if (type === "asset" || type === "rotate") {
      body =
        type === "rotate"
          ? `<div class="identity"><strong>${esc(a.name)}</strong><p>${esc(provider(a.provider_id)?.name || "未知来源")} / 资产版本 ${a.version}</p></div>${note("更新资料可能触发后端登录受阻任务自动重放；不是只修改名称。")}`
          : "";
      body +=
        '<div class="form-grid">' +
        (type === "asset"
          ? select(
              "provider_id",
              "所属来源 · 必填",
              s.providers.map((p) => [p.id, p.name]),
              s.form.provider_id,
            ) +
            input(
              "name",
              "名称 · 必填",
              s.form.name,
              "text",
              'required minlength="2" maxlength="160"',
            ) +
            select("kind", "凭证类型", Object.entries(kinds), s.form.kind)
          : "") +
        select(
          "encoding",
          "载荷编码",
          [
            ["utf8", "UTF-8 文本"],
            ["base64", "Base64"],
          ],
          s.form.encoding,
        ) +
        input(
          "value",
          "新的秘密资料 · 必填",
          "",
          "password",
          'required autocomplete="new-password"',
          "不提供显示明文或复制按钮；仅可输入合成测试材料。",
        ) +
        input(
          "expires_at",
          type === "rotate" ? "到期输入（当前合同待核对）" : "到期时间 · 可空",
          s.form.expires_at,
          "datetime-local",
          "",
          type === "rotate"
            ? "当前代码以 UTC 初始化、按本地保存；清空发送 null 仍保留旧到期。此稿不更改时间含义。"
            : "非空时须为未来时间；服务端最终校验。",
        ) +
        "</div>";
      submit = type === "rotate" ? "提交资料更新" : "创建凭证资产";
    } else if (type === "profile") {
      body =
        note("手动创建默认停用；不能把保存引用解释为来源已经可以采集。", "") +
        '<div class="form-grid">' +
        select(
          "credential_asset_id",
          "浏览器类资产 · 必填",
          browserAssets().map((a) => [
            a.id,
            `${a.name}${a.expires_at && a.expires_at <= D.clock ? "（已到期）" : ""}`,
          ]),
          s.form.credential_asset_id,
          "候选沿用 active 类型过滤，当前包含到期资产；实际关联检查另行排除。",
        ) +
        input(
          "code",
          "内部标识 · 必填",
          s.form.code,
          "text",
          'required pattern="[a-z0-9_]{2,80}" maxlength="80"',
          "2–80 位小写字母、数字或下划线。",
        ) +
        input(
          "name",
          "名称 · 必填",
          s.form.name,
          "text",
          'required minlength="2" maxlength="160"',
        ) +
        input(
          "locale",
          "语言 · 必填",
          s.form.locale,
          "text",
          'required pattern="[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?"',
        ) +
        input("timezone", "时区 · 必填", s.form.timezone, "text", 'required maxlength="80"') +
        select(
          "status",
          "运行档案状态",
          [
            ["disabled", "停用（默认）"],
            ["active", "启用"],
          ],
          s.form.status,
        ) +
        '</div><p class="disclaimer">provider_id 由所选资产推导；browser_family 固定 chromium。没有编辑、删除已有档案功能。</p>';
      if (!browserAssets().length)
        body = note("没有可引用的 active 浏览器类资产，请先保存资料。") + body;
      submit = "保存档案引用";
    } else if (type === "login") {
      const lp = loginProviders();
      body =
        `<ol class="steps"><li>选择明确来源与导入方式</li><li>保存凭证资产</li><li>关联并启用运行档案（非启用来源）</li></ol><div class="form-grid">` +
        select(
          "login-provider",
          "需要登录的来源",
          lp.map((p) => [p.id, p.name]),
          s.providerId,
        ) +
        select(
          "login-mode",
          "导入方式",
          [
            ["cookie_file", "Cookie 文件"],
            ["browser", "浏览器助手"],
            ["archive", "完整浏览器档案"],
          ],
          s.mode,
        ) +
        `</div><div class="identity"><strong>${esc(lp.length ? p.name : "暂无登录型来源")}</strong><p>${esc(lp.length ? p.target_url : "请先确认来源配置")}</p><button id="external" ${!lp.length || s.busy ? "disabled" : ""}>打开来源登录页 ↗</button></div>`;
      if (s.mode === "browser")
        body += `<div class="file-area"><strong>通过本站浏览器助手读取当前来源域</strong><p>此原型不发送扩展消息。真实操作需要明确授权；15 秒无响应提示助手不可用。</p><button id="helper-read" ${s.busy || !lp.length ? "disabled" : ""}>读取当前来源登录状态</button></div>`;
      else
        body += `<div class="file-area"><strong>${s.mode === "archive" ? "完整 Chromium 浏览器档案" : "Cookie 登录资料"}</strong><p>${s.mode === "archive" ? "仅 .tar.gz，最大 6,000,000 字节，转 Base64。" : "支持 .json / .txt / .cookies，最大 2,000,000 字节；JSON、storageState 或 Netscape 格式仍需服务器校验。"}</p><button id="choose-file" ${s.busy ? "disabled" : ""}>选择文件（原型不读取文件）</button></div>`;
      body += `<p class="disclaimer">${s.material ? "合成材料已就绪，仅在当前来源与窗口内有效。" : "尚无待提交材料。"} 不显示原始内容。</p><button id="helper-download" data-intent="DOWNLOAD" data-path="/browser-helper/scoutops-browser-helper.zip">下载本站浏览器助手 ZIP</button>`;
      submit = "保存资料并关联档案";
      hint = "两次独立写入；第二次失败不会回滚资产。";
    } else if (type === "revoke") {
      body =
        `<div class="identity"><strong>${esc(a.name)}</strong><p>${esc(provider(a.provider_id)?.name || "未知来源")} / 版本 ${a.version}</p></div>${note("撤销不可恢复，后续任务需要其他可用凭证；历史密文与审计仍保留。")}<label class="check"><input id="acknowledge" type="checkbox" ${s.ack ? "checked" : ""} ${s.busy ? "disabled" : ""}/>我已阅读并理解撤销影响</label>` +
        input("typed", "输入“确认撤销”", s.typed, "text", 'autocomplete="off"') +
        `<p class="disclaimer">请求使用当前 expected_version 与固定原因“平台安全管理员确认撤销”。此输入不改变原因字段。</p>`;
      submit = "确认撤销";
    } else {
      const r = rows().find((r) => r.p.id === s.providerId) || rows()[0];
      body = r
        ? `<div class="identity"><strong>${esc(r.p.name)}</strong><p>${r.ready ? "关联条件满足" : "关联尚未就绪"}</p></div><dl class="meta"><div><dt>active 浏览器类资产</dt><dd>${r.assets.length}</dd></div><div><dt>运行档案（含停用）</dt><dd>${r.profiles.length}</dd></div><div><dt>凭证资料</dt><dd>${esc(r.assets.map((a) => a.name).join("、") || "尚未配置")}</dd></div><div><dt>运行引用</dt><dd>${esc(r.profiles.map((v) => `${v.name} / ${v.status}`).join("、") || "尚未关联")}</dd></div></dl>${note("仅检查同来源、状态、引用及到期条件。真实登录、解析和来源启用尚需各自证据。", "")}`
        : note("没有匹配的登录型来源。");
      if (r)
        body += `<details id="compat-technical"><summary>技术详情</summary><code>${esc(r.p.code)}</code></details>`;
    }
    $("editor").setAttribute("role", type === "revoke" ? "alertdialog" : "dialog");
    $("editor").innerHTML =
      `<form id="edit-form"><header class="dialog-header"><div><p class="eyebrow">${type === "revoke" ? "IRREVERSIBLE ACTION" : "SCOPED OPERATION"} / P50</p><h2 id="dialog-title">${title}</h2><p id="dialog-description">合成数据审核稿；关闭窗口不代表取消已发送请求。</p></div><button id="dialog-close" type="button" aria-label="关闭当前操作">关闭</button></header><div class="dialog-body">${body}<div id="editor-notice" role="status" aria-live="polite">${note(s.dialogNotice)}</div></div><footer class="dialog-footer"><small>${hint}</small><div class="actions"><button id="cancel" type="button">${s.busy ? "离开此窗口" : "取消"}</button>${submit ? `<button id="submit" class="primary ${type === "revoke" ? "danger" : ""}" type="submit">${s.busy ? "处理中…" : submit}</button>` : ""}</div></footer></form>`;
    $("edit-form")
      .querySelectorAll("button:not([type])")
      .forEach((b) => (b.type = "button"));
    $("editor-notice").parentElement.prepend($("editor-notice"));
    $("edit-form").addEventListener("submit", (e) => {
      e.preventDefault();
      submitForm();
    });
    updateDisabled();
    if (focused && $("editor").open) $(focused)?.focus({ preventScroll: true });
    $("editor").scrollTop = scrollTop;
  }
  function updateDisabled() {
    const button = $("submit");
    if (!button) return;
    let allowed = !s.busy && !s.unknown && !s.partial;
    if (["asset", "rotate"].includes(s.dialog))
      allowed &&= Boolean($("value")?.value) && (s.dialog !== "asset" || s.providers.length > 0);
    if (s.dialog === "profile") allowed &&= browserAssets().length > 0;
    if (s.dialog === "login") allowed &&= s.material && loginProviders().length > 0;
    if (s.dialog === "revoke")
      allowed &&= Boolean($("acknowledge")?.checked && $("typed")?.value.trim() === "确认撤销");
    button.disabled = !allowed;
  }
  function open(type, id, providerId) {
    if ($("editor").open) close();
    returnId = document.activeElement?.id || "";
    generation++;
    s.dialog = type;
    s.assetId = id || s.assets[0]?.id;
    s.providerId = providerId || loginProviders()[0]?.id || "";
    s.mode = "cookie_file";
    s.material = false;
    s.busy = false;
    s.unknown = false;
    s.partial = false;
    s.dialogNotice = "";
    s.ack = false;
    s.typed = "";
    const a = activeAsset(),
      candidate = browserAssets()[0];
    s.form = {
      provider_id: s.providers[0]?.id || "",
      name: "",
      kind: "api_key",
      encoding: "utf8",
      expires_at:
        type === "rotate" && a.expires_at ? new Date(a.expires_at).toISOString().slice(0, 16) : "",
      credential_asset_id: candidate?.id || "",
      code: "",
      locale: "en-US",
      timezone: "America/Los_Angeles",
      status: "disabled",
    };
    dialogRender();
    $("editor").showModal();
    $("editor").scrollTop = 0;
    (type === "revoke"
      ? $("cancel")
      : type === "compat"
        ? $("dialog-close")
        : $("edit-form").querySelector("input:not([disabled]),select:not([disabled])") ||
          $("dialog-close")
    ).focus({ preventScroll: true });
  }
  function close() {
    if (s.busy)
      s.notice = "已离开操作窗口，不能据此认定已取消服务端请求；请核对最新元数据后再操作。";
    generation++;
    pending = null;
    s.material = false;
    s.busy = false;
    s.dialog = null;
    $("editor").close();
    $("editor").replaceChildren();
    render();
    $(returnId)?.focus({ preventScroll: true });
  }
  function begin(kind, path, body, method = "POST") {
    if (pending) return false;
    const id = ++serial;
    pending = { id, generation, kind, path, body: clone(body || {}) };
    s.intents.push({ method, path, ...(method === "POST" ? { body: clone(body) } : {}) });
    s.busy = true;
    return true;
  }
  function submitForm() {
    if (!s.dialog || $("submit")?.disabled || !$("edit-form").reportValidity()) return false;
    const f = Object.fromEntries(new FormData($("edit-form"))),
      a = activeAsset();
    let body,
      path,
      kind = s.dialog;
    if (kind === "asset" || kind === "rotate") {
      const secret_payload = { encoding: f.encoding, value: "[REDACTED: in-memory only]" };
      body =
        kind === "asset"
          ? {
              provider_id: f.provider_id,
              name: f.name,
              kind: f.kind,
              secret_payload,
              expires_at: f.expires_at ? new Date(f.expires_at).toISOString() : null,
            }
          : {
              secret_payload,
              expected_version: a.version,
              expires_at: f.expires_at ? new Date(f.expires_at).toISOString() : null,
            };
      path =
        kind === "asset"
          ? "/platform/credential-assets"
          : `/platform/credential-assets/${a.id}/rotate`;
      s.form = { ...s.form, ...f };
      delete s.form.value;
    } else if (kind === "profile") {
      const selected = browserAssets().find((a) => a.id === f.credential_asset_id);
      body = {
        provider_id: selected.provider_id,
        credential_asset_id: selected.id,
        code: f.code,
        name: f.name,
        browser_family: "chromium",
        locale: f.locale,
        timezone: f.timezone,
        status: f.status,
      };
      path = "/platform/crawler-profiles";
      s.form = { ...s.form, ...f };
    } else if (kind === "login") {
      const p = provider(s.providerId);
      kind = "login-asset";
      body = {
        provider_id: p.id,
        name: `${p.name} ${s.mode === "archive" ? "浏览器" : "Cookie"}登录档案`,
        kind: s.mode === "archive" ? "browser_profile" : "cookie_bundle",
        secret_payload: {
          encoding: s.mode === "archive" ? "base64" : "utf8",
          value: "[REDACTED: in-memory only]",
        },
        expires_at: null,
      };
      path = "/platform/credential-assets";
    } else if (kind === "revoke") {
      body = { expected_version: a.version, reason: "平台安全管理员确认撤销" };
      path = `/platform/credential-assets/${a.id}/revoke`;
    }
    if (!path || !begin(kind, path, body)) return false;
    s.dialogNotice =
      kind === "login-asset"
        ? "正在保存凭证资产；尚未建立运行档案。"
        : "请求已提交，正在等待结果。";
    dialogRender();
    return true;
  }
  function read() {
    if (pending || s.refreshing) return false;
    s.refreshing = true;
    pending = { id: ++serial, generation, kind: "read", focusId: document.activeElement?.id };
    for (const path of [
      "/platform/credential-assets",
      "/platform/crawler-profiles",
      "/platform/credential-provider-options",
    ])
      s.intents.push({ method: "GET", path });
    render();
    return true;
  }
  function complete(outcome = "success", id = pending?.id) {
    if (!pending || pending.id !== id || pending.generation !== generation) return false;
    const op = pending;
    pending = null;
    s.busy = false;
    if (op.kind === "read") {
      s.refreshing = false;
      if (outcome === "success") {
        s.initial = "ready";
        s.notice = "元数据模拟读取完成。";
        s.noticeTone = "";
        if (s.savedAsset && !s.assets.some((a) => a.id === s.savedAsset.id))
          s.assets.push(clone(s.savedAsset));
      } else s.notice = "重读失败，已保留上一次整组元数据；未把旧快照当作最新结果。";
      render();
      if (document.activeElement === document.body && op.focusId)
        $(op.focusId)?.focus({ preventScroll: true });
      return true;
    }
    if (op.kind === "material" || op.kind === "helper") {
      s.material = outcome === "success";
      s.dialogNotice = s.material
        ? "合成材料准备完成；尚未保存资产，也未验证真实登录。"
        : "材料准备失败；请检查格式、大小或助手授权。";
      dialogRender();
      return true;
    }
    if (outcome === "unknown") {
      s.unknown = true;
      s.material = false;
      s.dialogNotice =
        op.kind === "login-profile"
          ? "资产已保存；运行档案的写入结果未知。请关闭后核对元数据，不要重新导入或直接重复关联。"
          : "请求结果未知，可能已经写入。请关闭后核对元数据；禁止直接重复提交。";
    } else if (outcome !== "success") {
      s.dialogNotice = "请求被明确拒绝（合成 409 / 503）；请核对版本或输入后再提交。";
      if (op.kind === "login-profile") {
        s.material = false;
        s.partial = true;
        s.dialogNotice =
          "加密档案已保存，但运行档案未创建。请关闭此窗口并刷新数据，再点击“关联运行档案”，选择刚保存的档案继续；无需重新导入。";
      }
    } else if (op.kind === "login-asset") {
      const p = provider(op.body.provider_id),
        saved = {
          ...O.asset,
          id: "synthetic-saved-asset",
          provider_id: p.id,
          name: op.body.name,
          kind: op.body.kind,
          version: 1,
        };
      s.savedAsset = saved;
      begin("login-profile", "/platform/crawler-profiles", {
        provider_id: p.id,
        credential_asset_id: saved.id,
        code: `${
          p.code
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_|_$/g, "")
            .slice(0, 45) || "source"
        }_login_${new Date(D.clock).getTime().toString(36)}`.slice(0, 80),
        name: `${p.name} 网页采集档案`,
        browser_family: "chromium",
        locale: "zh-CN",
        timezone: "Asia/Shanghai",
        status: "active",
      });
      s.dialogNotice = "凭证资产已保存；正在关联运行档案。第二步失败不会回滚第一步。";
    } else {
      close();
      s.notice = "模拟写入已成功；来源启用与真实登录验收不在此结论内。";
      s.noticeTone = "";
      read();
      return true;
    }
    dialogRender();
    return true;
  }
  function scene(key) {
    if (!scenes[key]) throw new Error("unknown scene");
    if ($("editor").open) close();
    document.activeElement?.blur();
    $("content").replaceChildren();
    generation++;
    pending = null;
    returnId = "";
    s = {
      view: "assets",
      initial: "ready",
      assets: [clone(O.asset)],
      profiles: [clone(O.profile)],
      providers: [clone(O.provider), clone(O.secondProvider)],
      intents: [],
      notice: "",
      dialog: null,
      refreshing: false,
      hidden: [],
      freeze: true,
      density: "standard",
      synthetic: !["default", "profiles", "compatibility"].includes(key),
    };
    $("boundary").open = false;
    $("review-tools").open = key === "tools";
    window.scrollTo(0, 0);
    if (["profiles", "no-assets", "no-profiles"].includes(key)) s.view = "profiles";
    if (
      [
        "compatibility",
        "compat-ready",
        "columns",
        "compact",
        "compat-detail",
        "compat-technical",
      ].includes(key)
    )
      s.view = "compat";
    if (["empty", "no-assets"].includes(key)) s.assets = [];
    if (["empty", "no-profiles"].includes(key)) s.profiles = [];
    if (key === "no-providers" || key === "login-no-provider") s.providers = [];
    if (["loading", "expired", "forbidden", "blocked", "error"].includes(key)) s.initial = key;
    if (key === "loading" || key === "refreshing") s.refreshing = true;
    if (key === "refresh-error")
      s.notice = "读取失败，已保留上一次完整快照。最近成功读取：2026-09-09 12:00 UTC+8。";
    if (key === "compat-ready") s.profiles[0].status = "active";
    if (key === "compact") s.density = "compact";
    if (key === "mixed")
      s.assets = [
        clone(O.asset),
        { ...O.asset, id: "synthetic-expired", name: "已到期资料（合成）", expires_at: D.clock },
        { ...O.asset, id: "synthetic-revoked", name: "已撤销资料（合成）", status: "revoked" },
      ];
    if (key === "rotate-revoked") s.assets[0].status = "revoked";
    if (key === "long") {
      s.assets[0].name = "用于长中文换行验收的网页登录资料与跨市场交接记录".repeat(4);
      s.assets[0].fingerprint = "0123456789abcdef".repeat(8);
    }
    if (key === "rotate-expiry") s.assets[0].expires_at = "2026-10-09T04:00:00.000Z";
    if (key === "login-success-refresherror")
      s.notice =
        "登录资料与运行档案已保存（模拟）；随后重读失败，以下仍是上一次快照。运行档案启用不等于来源启用。";
    if (key === "profile-noasset") s.assets = [];
    render();
    let type = key.startsWith("asset-")
      ? "asset"
      : key === "rotate" || key === "rotate-conflict" || key === "rotate-expiry"
        ? "rotate"
        : key === "profile" || key.startsWith("profile-")
          ? "profile"
          : key === "login" || (key.startsWith("login-") && key !== "login-success-refresherror")
            ? "login"
            : key === "revoke" || key.startsWith("revoke-")
              ? "revoke"
              : key === "compat-detail" || key === "compat-technical"
                ? "compat"
                : null;
    if (type) {
      open(type);
      if (key.includes("filled")) {
        s.form.name = "合成审核资料";
        s.form.code = "review_profile";
      }
      if (key === "login-browser" || key === "login-reading" || key === "login-helpererror")
        s.mode = "browser";
      if (key === "login-archive") s.mode = "archive";
      if (key === "login-material") s.material = true;
      if (
        key.endsWith("busy") ||
        ["login-reading", "login-savingasset", "login-savingprofile"].includes(key)
      )
        s.busy = true;
      if (key.endsWith("unknown")) {
        s.unknown = true;
        s.dialogNotice = "请求结果未知，可能已经写入。关闭后核对数据，不直接重复提交。";
      }
      if (key.endsWith("error") || key.endsWith("conflict"))
        s.dialogNotice =
          key === "login-fileerror"
            ? "材料格式或大小不符合要求，请按当前方式重新选择。"
            : key === "login-domainerror"
              ? "服务器拒绝目标域不匹配的材料；选择正确来源后重新准备。"
              : key === "login-helpererror"
                ? "未检测到助手或未授予当前网站权限。可以改用文件；未读取真实 Cookie。"
                : "操作明确失败，当前窗口保留元数据，请核对版本或输入。";
      if (key === "login-savingasset") s.dialogNotice = "正在保存凭证资产；尚未建立运行档案。";
      if (key === "login-savingprofile")
        s.dialogNotice = "凭证资产已保存；正在创建运行档案，尚未完成。";
      if (key === "login-partial") {
        s.partial = true;
        s.dialogNotice =
          "加密档案已保存，但运行档案未创建。请关闭此窗口并刷新数据，再点击“关联运行档案”，选择刚保存的档案继续；无需重新导入。";
      }
      if (key === "revoke-ack" || key === "revoke-ready") s.ack = true;
      if (key === "revoke-ready") s.typed = "确认撤销";
      dialogRender();
      if (key === "asset-filled") $("value").value = "inert-review-material";
      updateDisabled();
      $("editor").scrollTop = 0;
      if (type === "revoke") $("cancel").focus({ preventScroll: true });
      else $("dialog-close").focus({ preventScroll: true });
    }
    if (key === "columns") $("columns").open = true;
    if (key === "compat-technical") $("compat-technical").open = true;
    if (key === "long") $("asset-meta-0").open = true;
    if (key === "focus") $("refresh").focus();
    $("scene-picker").value = key;
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button,a");
    if (!b || b.disabled) return;
    if (b.dataset.view) {
      s.view = b.dataset.view;
      render();
      return;
    }
    if (b.dataset.open) {
      open(b.dataset.open, b.dataset.asset, b.dataset.provider);
      return;
    }
    if (b.dataset.intent) {
      e.preventDefault();
      s.intents.push({ method: b.dataset.intent, path: b.dataset.path || b.getAttribute("href") });
      return;
    }
    if (b.dataset.outcome) {
      complete(b.dataset.outcome);
      return;
    }
    if (b.id === "dialog-close" || b.id === "cancel") {
      close();
      return;
    }
    if (b.id === "refresh" || b.id === "read-retry") {
      read();
      return;
    }
    if (b.id === "freeze") {
      s.freeze = !s.freeze;
      render();
      return;
    }
    if (b.id === "external") {
      s.intents.push({ method: "EXTERNAL", path: provider(s.providerId).target_url });
      return;
    }
    if (b.id === "choose-file" || b.id === "helper-read") {
      begin(
        b.id === "choose-file" ? "material" : "helper",
        b.id === "choose-file" ? "inert-file-selection" : "inert-helper-read",
        {},
        "SIMULATE",
      );
      s.material = false;
      s.dialogNotice = "正在准备合成材料；不会打开文件选择器或发送扩展消息。";
      dialogRender();
    }
  });
  document.addEventListener("input", () => updateDisabled());
  document.addEventListener("change", (e) => {
    const n = e.target;
    if (n.id === "scene-picker") {
      scene(n.value);
      return;
    }
    if (n.dataset.column !== undefined) {
      const i = Number(n.dataset.column);
      s.hidden = n.checked ? s.hidden.filter((v) => v !== i) : [...s.hidden, i];
      render();
      return;
    }
    if (n.id === "density") {
      s.density = n.value;
      render();
      return;
    }
    if (n.id === "login-provider" || n.id === "login-mode") {
      generation++;
      pending = null;
      s.material = false;
      s.busy = false;
      if (n.id === "login-provider") s.providerId = n.value;
      else s.mode = n.value;
      s.dialogNotice = "来源或方式已变化，请重新准备材料（待实施保护提案）。";
      dialogRender();
      $(n.id)?.focus();
    }
  });
  $("editor").addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  });
  $("editor").addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const controls = [
      ...$("editor").querySelectorAll(
        'button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex="0"]',
      ),
    ].filter((n) => n.getClientRects().length && getComputedStyle(n).visibility !== "hidden");
    const target =
      e.shiftKey && document.activeElement === controls[0]
        ? controls.at(-1)
        : !e.shiftKey && document.activeElement === controls.at(-1)
          ? controls[0]
          : null;
    if (target) {
      e.preventDefault();
      target.focus();
    }
  });
  $("editor").addEventListener("click", (e) => {
    if (e.target === $("editor")) {
      const r = $("editor").getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
        close();
    }
  });
  $("scene-picker").innerHTML = Object.entries(scenes)
    .map(([v, l]) => `<option value="${v}">${l}</option>`)
    .join("");
  window.CREDENTIAL_C = {
    scene,
    scenes,
    read,
    complete,
    submit: submitForm,
    open,
    close,
    state: () => clone({ ...s, pending: pending ? { id: pending.id, kind: pending.kind } : null }),
  };
  scene("default");
})();
