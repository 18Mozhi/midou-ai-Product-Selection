(() => {
  const scenes = window.IDENTITY_CASES,
    app = document.querySelector("#app"),
    picker = document.querySelector("#scene-picker");
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  let scene = scenes[0],
    timer,
    pending = false,
    events = [],
    query = "",
    selectedOrgName = "合成 · 华南选品团队";
  const busy = () =>
    pending || ["loading", "routing", "selecting", "provisioning"].includes(scene.state);
  const action = (id, label, target, style = "") =>
    `<button type="button" data-action="${id}" data-target="${target}" class="${style}" ${busy() ? "disabled" : ""}>${label}</button>`;
  const nav = (id, label, target) =>
    `<a href="#" data-action="${id}" data-route="${target}" ${busy() ? 'aria-disabled="true" tabindex="-1"' : ""}>${label}</a>`;
  function input(name, label, type = "text", options = {}) {
    const invalid =
      (scene.state === "invalid" &&
        name ===
          (scene.mode === "login"
            ? "identifier"
            : scene.mode === "reset"
              ? "password"
              : "email")) ||
      (scene.state === "mismatch" && name === "confirmPassword");
    const hint = type === "password" ? "当前界面支持12–128个字符" : options.hint || "";
    const error =
      scene.state === "mismatch"
        ? "两次输入的密码不一致，请检查确认密码。"
        : type === "email"
          ? "请输入完整的邮箱地址。"
          : "请填写符合要求的内容。";
    const autocomplete =
      type === "email"
        ? "email"
        : name === "identifier"
          ? "username"
          : name === "code"
            ? "one-time-code"
            : name === "currentPassword" || scene.mode === "login"
              ? "current-password"
              : "new-password";
    return `<label for="${name}"><strong>${label}</strong>
      <input id="${name}" name="${name}" type="${type}" autocomplete="${autocomplete}"
      ${options.required === false ? "" : "required"} ${options.min ? `minlength="${options.min}"` : type === "password" ? 'minlength="12"' : ""}
      maxlength="${options.max || (type === "password" ? 128 : 254)}"
      placeholder="${esc(options.placeholder || (type === "password" ? "输入密码" : type === "email" ? "name@company.com" : label))}"
      ${busy() ? "disabled" : ""} aria-invalid="${invalid}" aria-describedby="${name}-hint${invalid ? ` ${name}-error` : ""}" />
      <span id="${name}-hint" class="form-note">${hint}</span>
      ${invalid ? `<span id="${name}-error" class="field-error">${error}</span>` : ""}</label>`;
  }
  function notice() {
    const state = scene.state;
    const entries = {
      "success-no-route": [
        "入口尚未确定",
        "请求已返回，但没有可跳转的目标。可以继续选择组织，不把缺少落点当作已进入工作台。",
        "",
      ],
      error: [
        "操作未完成",
        scene.mode === "verify"
          ? "验证未完成。链接可能无效或已使用，请按实际返回提示处理。"
          : "本次请求被拒绝。请检查输入后重试；当前页面未确认操作成功。",
        "error",
      ],
      blocked: [
        "暂时无法连接",
        "未取得可确认的结果。请检查网络后重试，不要将此状态当作成功。",
        "error",
      ],
      rate_limited: ["请求过于频繁", "请稍后重试，并以服务端返回的操作提示为准。", "error"],
      expired: [
        "请重新登录",
        scene.pageId === "P02"
          ? "安全挑战已失效，请重新输入账号与密码。"
          : "当前会话已失效，重新登录后再继续。",
        "error",
      ],
      required: ["需要先登录", "登录后才能进入账号安全设置。", ""],
      "seed-relogin": [
        "密码已修改，请重新登录",
        "旧会话已撤销。使用新密码登录后继续绑定认证器，尚不能进入业务功能。",
        "success",
      ],
      "link-invalid": [
        "重置链接不可用",
        "链接材料缺失或服务端拒绝了该链接。请重新申请重置说明。",
        "error",
      ],
    };
    if (state === "success" && scene.mode === "forgot")
      entries.success = [
        "请求已受理",
        "如账号存在，重置邮件会进入受控投递队列。这不代表邮件已经送达。",
        "success",
      ];
    if (!entries[state]) return "";
    const [title, text, tone] = entries[state];
    return `<div class="notice ${tone}" role="status"><strong>${title}</strong><p>${text}</p>${["error", "blocked", "rate_limited"].includes(state) ? "<details><summary>查看关联信息</summary><p>请求标识：synthetic-request-identity-preview-long-id<br />链路标识：synthetic-trace-identity-preview</p><small>以上均为合成编号，不对应生产请求。</small></details>" : ""}</div>`;
  }
  function scope() {
    const context = scene.pageId === "P08",
      guide = scene.pageId === "P09",
      security = [
        "seed",
        "enroll",
        "secret",
        "recovery",
        "enabled",
        "disabled",
        "mfa-read",
      ].includes(scene.mode);
    const labels = context
      ? ["组织", "工作区", "范围就绪"]
      : guide
        ? ["信号", "协作", "判断"]
        : security
          ? ["当前密码", "认证器", "恢复码"]
          : ["账号", "身份验证", "工作范围"];
    const current = context
      ? scene.state === "selected"
        ? 2
        : scene.mode === "workspaces"
          ? 1
          : 0
      : guide
        ? scene.step - 1
        : ["secret", "challenge"].includes(scene.mode)
          ? 1
          : scene.mode === "recovery"
            ? 2
            : 0;
    return `<aside class="scope" aria-label="当前任务范围"><span class="meta">${context ? "WORK CONTEXT" : guide ? "QUICK GUIDE" : "ACCOUNT ACCESS"}</span><h2>${context ? "选择本次工作范围" : guide ? "从事实开始选品" : security ? "保护当前账号" : "连接你的工作空间"}</h2><p>${context ? "先确认组织，再选择可进入的工作区。" : guide ? "三段简短说明，随时可以跳过。" : security ? "根据当前账号要求完成设置，不提前放行业务功能。" : "使用本地账号验证身份，再进入服务端允许的范围。"}</p><ol>${labels.map((label, i) => `<li class="${current === i ? "current" : ""}" ${current === i ? 'aria-current="step"' : ""}><span>${i + 1}</span>${label}</li>`).join("")}</ol><p class="boundary">${context ? "这里只展示当前会话可见的范围。选择组织本身不写入工作区会话。" : guide ? "引导不保存进度；退出后由根入口确定实际落点。" : "没有启用的第三方登录方式不显示为可用入口。"}</p></aside>`;
  }
  function links() {
    if (scene.pageId === "P01") return "";
    if (scene.pageId === "P09") return "";
    if (scene.pageId === "P08") return "";
    const result = [];
    if (scene.mode === "login" && scene.state === "success-no-route")
      result.push(nav("ID-CONTEXT-ROUTE", "继续选择组织", "/select-context"));
    if (scene.mode !== "register")
      result.push(action("ID-SHOW-REGISTER", "创建本地账号", "p03-idle", "text"));
    if (scene.mode !== "login")
      result.push(action("ID-SHOW-LOGIN", "返回登录", "p02-idle", "text"));
    result.push(
      nav("ID-ACCOUNT-SECURITY", "查看安全会话", "/me?section=security"),
      nav("ID-MFA-ROUTE", "管理 MFA", "/security/mfa"),
    );
    return `<footer class="footer-links">${result.join("")}</footer>`;
  }
  function form(fields, label, target, id = "ID-FORM-SUBMIT", danger = false) {
    return `<form data-submit="${id}" data-next="${target}" novalidate aria-busy="${busy()}"><div class="fields">${fields}</div><button type="submit" class="${danger ? "" : "primary"}" ${busy() ? "disabled" : ""}>${busy() ? "正在处理，请稍候…" : label}</button><p class="field-error" id="local-error" role="alert"></p></form>`;
  }
  function result(title, copy, button = "", mark = "→") {
    return `<section class="result"><span class="result-mark" aria-hidden="true">${mark}</span><h2>${title}</h2><p>${copy}</p>${button}</section>`;
  }
  function identityBody() {
    const mode = scene.mode,
      state = scene.state;
    if (mode === "landing")
      return state === "loading"
        ? result(
            "正在确定你的入口",
            "正在读取允许进入的工作范围，此时不会展示推测的组织或角色。",
            "",
            "…",
          )
        : result(
            "暂时无法确定入口",
            "未取得有效的目标页面。重新检查后继续，不会把空结果当作成功。",
            action("ID-LANDING-CHECK", "重新检查", "p01-loading", "primary"),
            "!",
          );
    if (state === "routing")
      return result(
        "身份已验证，正在确认入口",
        "入口解析完成后才会进入目标页面，不提前展示工作区内容。",
        "",
        "…",
      );
    if (mode === "verify") {
      const titles = {
        missing: "检查验证邮件",
        queued: "验证邮件已进入队列",
        loading: "正在验证邮箱",
        success: "邮箱验证完成",
        error: "邮箱尚未验证",
        rate_limited: "验证暂未完成",
        blocked: "验证结果尚不确定",
      };
      return result(
        titles[state],
        state === "success"
          ? "现在可以返回登录。邮箱验证完成不代表已经登录。"
          : state === "queued"
            ? "账号尚未完成邮箱验证。邮件入队不代表已经送达，请按邮件说明继续。"
            : state === "missing"
              ? "当前页面没有验证链接材料，不会发起确认请求。请从验证邮件打开链接。"
              : "验证链接只使用一次。页面不展示链接令牌，也不提供未实现的重新发送按钮。",
        "",
        state === "success" ? "✓" : state === "loading" ? "…" : "→",
      );
    }
    if (mode === "reset" && state === "success")
      return result(
        "密码已更新",
        "请使用新密码重新登录。当前页面不会自动建立新的登录会话。",
        "",
        "✓",
      );
    if (mode === "login")
      return form(
        input("identifier", "账号（邮箱或用户名）", "text", {
          min: 2,
          hint: "使用已验证的邮箱或唯一用户名",
          placeholder: "name@company.com 或用户名",
        }) +
          input("password", "密码", "password") +
          `<div class="form-side">${action("ID-SHOW-FORGOT", "忘记密码？", "p04-idle", "text")}</div>`,
        "登录",
        "p02-routing",
      );
    if (mode === "register")
      return form(
        input("email", "邮箱", "email") +
          input("password", "密码", "password") +
          input("confirmPassword", "确认密码", "password"),
        "创建账号",
        "p03-queued",
      );
    if (mode === "forgot")
      return form(input("email", "账号邮箱", "email"), "发送重置说明", "p04-accepted");
    if (mode === "reset")
      return form(input("password", "新密码", "password"), "更新密码", "p06-success");
    if (mode === "challenge")
      return form(
        input("code", "认证器验证码或恢复码", "text", {
          min: 6,
          max: 32,
          hint: "可输入6–32个字符；恢复码不限定为纯数字",
          placeholder: "验证码或恢复码",
        }),
        "验证并登录",
        "p02-routing",
      );
    if (mode === "seed")
      return (
        `<div class="notice"><strong>首次安全设置尚未完成</strong><p>先改密并撤销当前会话，再重新登录完成认证器绑定。</p></div>` +
        form(
          input("currentPassword", "当前种子密码", "password") +
            input("newPassword", "新的长期密码", "password"),
          "修改密码并撤销当前会话",
          "p02-seed-relogin",
          "ID-SEED-PASSWORD",
        )
      );
    if (mode === "mfa-read")
      return result(
        state === "loading" ? "正在读取保护状态" : "尚无法确认保护状态",
        "未取得状态时，不显示已启用或未启用，也不开放依赖该状态的操作。",
        state === "expired" ? action("ID-SHOW-LOGIN", "返回登录", "p02-idle", "primary") : "",
        state === "loading" ? "…" : "!",
      );
    if (mode === "enroll")
      return (
        `<div class="notice"><strong>${scene.seed ? "重新登录后继续安全设置" : "认证器尚未启用"}</strong><p>验证当前密码后获取本次绑定材料。</p></div>` +
        form(
          input("currentPassword", "当前密码", "password"),
          "开始绑定认证器",
          scene.seed ? "p02-seed-secret" : "p07-secret",
          "ID-MFA-START",
        )
      );
    const material = `<div class="material"><strong>手动输入密钥</strong><code>SYNTHETIC · NOT A VALID SECRET</code><small class="meta">设计占位，不可用于真实认证器。生产材料仅在实际返回后显示。</small></div>`;
    if (mode === "secret")
      return (
        material +
        form(
          input("currentPassword", "当前密码", "password") +
            input("code", "认证器验证码", "text", {
              max: 8,
              required: false,
              hint: "当前绑定输入上限8个字符，合法性由服务端校验",
              placeholder: "输入认证器验证码",
            }),
          scene.seed ? "确认并完成安全设置" : "确认并启用",
          scene.seed ? "p02-seed-recovery" : "p07-recovery",
          "ID-MFA-CONFIRM",
        )
      );
    const disable = () =>
      `<section class="danger"><h3>停用认证器</h3><p>停用会撤销全部会话。需要当前密码以及验证码或恢复码，完成后请重新登录。</p>${form(input("currentPassword", "当前密码", "password", { required: false }) + input("code", "当前验证码或恢复码", "text", { max: 32, required: false }), "停用并撤销全部会话", "p07-disabled", "ID-MFA-DISABLE", true)}</section>`;
    if (mode === "recovery")
      return `<p class="status-text">✓ ${scene.seed ? "首次安全设置已完成" : "MFA 已启用"}</p><h2>离线保存本次恢复码</h2><p class="intro">每个代码只能使用一次。以下是不可用的设计占位；不新增复制、下载或二维码能力。</p><div class="material"><code>DEMO-NOT-VALID-A<br />DEMO-NOT-VALID-B<br />DEMO-NOT-VALID-C<br />DEMO-NOT-VALID-D</code><small class="meta">仅本次返回后显示 · 请离线保存</small></div>${scene.seed ? "" : disable()}`;
    if (mode === "enabled")
      return `<p class="status-text">✓ 认证器已启用</p><p>当前账号使用 TOTP 认证器进行第二步验证。</p>${disable()}`;
    return result(
      "MFA 已停用",
      "服务端成功返回后的提示：全部会话已撤销，请重新登录。图稿不会自行执行会话撤销。",
      "",
      "✓",
    );
  }
  const organizations = [
    { name: "合成 · 华南选品团队", slug: "sample-south", timezone: "Asia/Shanghai" },
    {
      name: "合成 · 国际商品研究与跨境供应协作工作组",
      slug: "sample-global-research",
      timezone: "Asia/Shanghai",
    },
  ];
  function contextBody() {
    const state = scene.state,
      workspace = scene.mode === "workspaces";
    if (["loading", "provisioning"].includes(state))
      return result(
        state === "loading" ? "正在读取可用范围" : "正在创建个人选品空间",
        state === "loading"
          ? "等待组织、工作区或团队读取完成，不提前显示空范围。"
          : "只创建属于本人的默认空间，不提供任意组织命名或邀请他人的入口。",
        "",
        "…",
      );
    if (["error", "forbidden", "expired"].includes(state))
      return result(
        state === "forbidden"
          ? "无权访问该组织"
          : state === "expired"
            ? "登录已过期"
            : "暂时无法加载",
        state === "expired"
          ? "重新登录后再选择组织和工作区。"
          : "返回组织列表，重新读取当前仍然可用的范围。",
        state === "expired"
          ? nav("ID-LOGIN-ROUTE", "重新登录", "/login")
          : action("ID-ORG-RELOAD", "返回组织列表", "p08-organizations", "primary"),
        "!",
      );
    if (state === "empty")
      return result(
        workspace ? "当前组织没有可用工作区" : "尚未加入可用组织",
        workspace
          ? "请联系组织管理员创建或恢复工作区。这里不能创建任意组织。"
          : "可以创建仅属于本人的“我的选品空间”和默认工作区，也可以先查看账号安全。",
        workspace
          ? action("ID-ORG-RELOAD", "返回组织列表", "p08-organizations", "primary")
          : action("ID-PERSONAL-PROVISION", "创建并进入选品空间", "provision", "primary") +
              `<div class="footer-links">${nav("ID-ACCOUNT-ROUTE", "个人中心", "/me")}${nav("ID-MFA-ROUTE", "管理 MFA", "/security/mfa")}</div>`,
      );
    if (state === "selected")
      return result(
        "工作范围已就绪",
        `${esc(selectedOrgName)} / 新品研究工作区`,
        nav(
          "ID-CONTEXT-CONTINUE",
          scene.returnTo === "/onboarding" ? "继续快速引导" : "返回原页面",
          scene.returnTo,
        ),
        "✓",
      );
    if (workspace)
      return (
        action("ID-ORG-RELOAD", "← 返回组织列表", "p08-organizations", "text") +
        `<p class="meta">当前组织：${esc(selectedOrgName)}</p><div class="choices">` +
        `<button class="choice" data-action="ID-WORKSPACE-CHOOSE" data-target="choose" ${state === "selecting" ? "disabled" : ""}><strong>新品研究工作区</strong><small>可进入 · 当前组织</small><b>${state === "selecting" ? "正在选择…" : "选择 →"}</b></button><button class="choice" disabled data-action="ID-WORKSPACE-CHOOSE"><strong>历史归档工作区</strong><small>已归档 · 不可进入</small><b>不可选择</b></button></div><p class="team-note">组织团队：0 · 当前组织尚未建立团队，不影响活动工作区的选择。</p>`
      );
    const search = state === "search-empty" ? "不存在的合成组织" : query;
    return `<label for="organization-search"><strong>搜索组织</strong><input type="search" id="organization-search" placeholder="组织名称或标识" value="${esc(search)}" autocomplete="off" /></label><div id="organization-results">${orgResults(search)}</div>`;
  }
  function orgResults(search) {
    const result = organizations.filter((o) =>
      `${o.name} ${o.slug}`.toLowerCase().includes(search.trim().toLowerCase()),
    );
    return result.length
      ? `<div class="choices">${result.map((o) => `<button class="choice" data-action="ID-ORG-CHOOSE" data-org="${esc(o.name)}" data-target="p08-workspaces"><strong>${o.name}</strong><small>${o.slug} · ${o.timezone}</small><b>选择 →</b></button>`).join("")}</div><p class="meta team-note">只在本次图稿中使用合成名称，不代表实际成员资格。</p>`
      : resultEmpty();
  }
  const resultEmpty = () =>
    result(
      "没有匹配的组织",
      "搜索结果为空，不代表没有组织成员资格。",
      action("ID-ORG-CLEAR", "清除搜索", "clear", "primary"),
    );
  const guides = [
    {
      title: "把市场变化，变成今天的行动",
      copy: "来源证据、机会判断与团队任务围绕同一个工作范围展开。",
      rows: [
        ["信号", "查看来源与新鲜度"],
        ["机会", "保留评分依据与缺失项"],
        ["行动", "进入可追踪的任务"],
      ],
    },
    {
      title: "围绕同一份证据协作",
      copy: "组织、工作区与角色决定可见范围。评论、审批和结论保留原始上下文。",
      rows: [
        ["组织", "隔离数据与成员范围"],
        ["角色", "决定最小可用权限"],
        ["审批", "保留版本与审计"],
      ],
    },
    {
      title: "先看事实，再做判断",
      copy: "AI 只做摘要、解释和缺失提示；价格、利润、资质与最终决策仍由事实和人员负责。",
      rows: [
        ["事实", "所有结论可以回到来源"],
        ["缺失", "证据不足明确显示受阻"],
        ["风险", "文字说明，不仅依赖颜色"],
      ],
    },
  ];
  function guideBody() {
    const g = guides[scene.step - 1];
    return `<nav class="step-nav" aria-label="引导步骤">${guides.map((_, i) => `<button data-action="ID-GUIDE-STEP" data-target="p09-step-${i + 1}" ${scene.step === i + 1 ? 'aria-current="step"' : ""}>第 ${i + 1} 步</button>`).join("")}</nav><h1 id="page-title" tabindex="-1">${g.title}</h1><p class="intro">${g.copy}</p><ol class="guide-points">${g.rows.map(([label, text]) => `<li><b>${label}</b><span>${text}</span></li>`).join("")}</ol><div class="guide-actions">${scene.step > 1 ? action("ID-GUIDE-PREVIOUS", "上一步", `p09-step-${scene.step - 1}`) : "<span></span>"}${scene.step < 3 ? action("ID-GUIDE-NEXT", "下一步", `p09-step-${scene.step + 1}`, "primary") : nav("ID-GUIDE-FINISH", "进入智能选品 →", "/")}</div><p class="meta team-note">第 ${scene.step} / 3 步 · 不保存完成进度，刷新按原始链接初始化。</p>`;
  }
  const headings = {
    landing: "进入智能选品",
    login: "登录智能选品",
    register: "创建本地账号",
    forgot: "找回密码",
    verify: "验证邮箱",
    reset: "设置新密码",
    challenge: "完成安全验证",
    seed: "先修改种子密码",
    "mfa-read": "多因素认证",
    enroll: "绑定认证器",
    secret: "完成认证器绑定",
    recovery: "一次性恢复码",
    enabled: "多因素认证",
    disabled: "多因素认证",
    organizations: "选择组织",
    workspaces: "选择工作区",
  };
  const intros = {
    login: "账号验证后，按允许的身份与工作范围继续。",
    register: "先创建账号，再通过邮件验证身份。",
    forgot: "输入账号邮箱，申请密码重置说明。",
    reset: "设置一个新密码；此页面只有一个密码输入框。",
    challenge: "密码已验证，请完成当前登录挑战。",
    seed: "完成全部安全步骤前，业务功能保持受限。",
    enroll: "使用当前密码开始本次绑定。",
    secret: "在认证器中手动添加密钥，然后提交验证码。",
    recovery: "只有确认启用成功后，才显示本次返回的恢复码。",
    organizations: "只显示当前账号仍为活动成员的组织。",
    workspaces: "选择本次会话使用的工作区，成功后再继续。",
  };
  function render(id, focus = false) {
    clearTimeout(timer);
    pending = false;
    scene = scenes.find((s) => s.id === id) || scenes[0];
    picker.value = scene.id;
    const root = scene.pageId === "P01",
      guide = scene.pageId === "P09";
    document.title = `${scene.pageId} ${scene.label} · C待审`;
    app.dataset.scene = scene.id;
    app.innerHTML = `<header class="top">${nav("ID-ROOT", "<span>选</span>智能选品", "/").replace('href="#"', 'class="brand" href="#"')}<span class="meta">${guide ? nav("ID-GUIDE-SKIP", "跳过引导", "/") : "账号与工作范围"}</span></header><main class="${root ? "root-layout" : "layout"}">${root ? "" : scope()}<section class="paper"><div class="content">${guide ? guideBody() : `<p class="eyebrow">${scene.pageId === "P08" ? "工作范围" : "智能选品账号"}</p><h1 id="page-title" tabindex="-1">${headings[scene.mode]}</h1><p class="intro">${intros[scene.mode] || "当前状态以实际返回结果为准。"}</p>${notice()}${scene.pageId === "P08" ? contextBody() : identityBody()}`}</div>${links()}</section></main><footer class="bottom"><span>C方向 · ${scene.pageId} · 待审核图稿</span><span>离线合成演示 · 不执行真实操作</span></footer>`;
    if (focus) document.querySelector("#page-title").focus({ preventScroll: true });
  }
  function navigate(route, id) {
    events.push({ action: id, route });
    document.querySelector("#navigation-result").textContent =
      `演示导航：${route}（未访问真实页面）`;
  }
  function delayed(target) {
    pending = true;
    const form = document.querySelector("form");
    if (form) form.setAttribute("aria-busy", "true");
    document.querySelectorAll("button,input").forEach((el) => (el.disabled = true));
    document.querySelectorAll("#app a").forEach((el) => {
      el.setAttribute("aria-disabled", "true");
      el.setAttribute("tabindex", "-1");
    });
    timer = setTimeout(() => render(target, true), 250);
  }
  app.addEventListener("click", (event) => {
    const el = event.target.closest("[data-action]");
    if (!el) return;
    event.preventDefault();
    if (el.disabled || busy() || el.getAttribute("aria-disabled") === "true") return;
    const id = el.dataset.action,
      target = el.dataset.target;
    if (el.dataset.org) selectedOrgName = el.dataset.org;
    if (el.dataset.route) return navigate(el.dataset.route, id);
    events.push({ action: id });
    if (target === "clear") {
      query = "";
      render("p08-organizations", true);
      document.querySelector("#organization-search").focus();
    } else if (target === "provision") {
      render("p08-provisioning");
      timer = setTimeout(() => navigate("/home", id), 250);
    } else if (target === "choose") {
      render("p08-selecting");
      timer = setTimeout(() => render("p08-selected", true), 250);
    } else render(target, true);
  });
  app.addEventListener("input", (event) => {
    if (event.target.id !== "organization-search") return;
    query = event.target.value;
    document.querySelector("#organization-results").innerHTML = orgResults(query);
  });
  app.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.target;
    if (form.getAttribute("aria-busy") === "true" || busy()) return;
    const fields = [...form.querySelectorAll("input")];
    const invalid = fields.find((field) => !field.checkValidity());
    const mismatch =
      scene.mode === "register" &&
      form.elements.password.value !== form.elements.confirmPassword.value;
    if (invalid || mismatch) {
      const field = invalid || form.elements.confirmPassword;
      field.setAttribute("aria-invalid", "true");
      field.setAttribute("aria-describedby", `${field.id}-hint local-error`);
      document.querySelector("#local-error").textContent = mismatch
        ? "两次输入的密码不一致。"
        : "请检查邮箱格式、必填项及密码长度。";
      field.focus();
      return;
    }
    // Never record field values or synthesize authentication tokens.
    events.push({ action: form.dataset.submit, scene: scene.id });
    delayed(form.dataset.next);
  });
  picker.innerHTML = scenes
    .map((s) => `<option value="${s.id}">${s.pageId} · ${s.label}</option>`)
    .join("");
  picker.addEventListener("change", () => render(picker.value, true));
  window.identityReview = {
    render,
    scenes,
    events: () => [...events],
    reset: () => {
      events = [];
      query = "";
    },
    current: () => scene.id,
  };
  render(new URLSearchParams(location.search).get("scene") || "p02-idle");
})();
