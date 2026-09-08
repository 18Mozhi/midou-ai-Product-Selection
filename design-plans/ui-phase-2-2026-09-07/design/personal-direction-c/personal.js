(() => {
  const data = window.PERSONAL_DESIGN_DATA,
    $ = (id) => document.getElementById(id);
  const form = $("profile-form");
  const scenes = [
    "profile",
    "permissions",
    "security",
    "notifications",
    "assets",
    "profile-loading",
    "profile-error",
    "profile-partial",
    "profile-edited",
    "profile-save-failed",
    "profile-saved",
    "invalid-section",
  ];
  let current = "profile",
    state = "ready",
    profile = structuredClone(data.profile),
    lastRequest = null,
    destination = "",
    generation = 0,
    outcome = "success";
  const fill = () => {
    $("email").value = profile.email;
    $("email-status").textContent = profile.email_verified_at ? "已验证" : "尚未验证";
    $("phone-status").textContent = profile.phone_verified_at
      ? "已验证"
      : "未验证；系统不会伪造短信验证结果";
    for (const key of Object.keys(data.form))
      form.elements.namedItem(key).value =
        key === "reason" ? data.form.reason : (profile[key] ?? data.form[key]);
  };
  function notice(text = "", error = false) {
    $("notice").textContent = text;
    $("notice").hidden = !text;
    $("notice").dataset.error = String(error);
  }
  function normalize(value) {
    return typeof value === "string" && data.sections.some((item) => item.key === value)
      ? value
      : "profile";
  }
  function navigateSection(value) {
    current = normalize(value);
    $("sections")
      .querySelectorAll("a")
      .forEach((link) => {
        if (link.dataset.section === current) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });
    $("heading").textContent = data.sections.find((item) => item.key === current).label;
    $("subtitle").textContent =
      current === "profile"
        ? "维护登录身份与联系方式。"
        : "导航结构审核 · 业务工作面仍待独立实现。";
    form.hidden = current !== "profile" || state !== "ready";
    $("read-state").hidden = state === "ready";
    $("state-title").textContent = state === "loading" ? "正在读取个人中心" : "个人中心暂不可用";
    $("retry").hidden = state !== "error";
    $("deferred").hidden = current === "profile" || state !== "ready";
    $("deferred-note").textContent =
      {
        permissions: "角色、范围与可执行动作由服务端返回，本稿不放入虚构权限。",
        security: "MFA、三字段改密与设备会话撤销尚待对应操作及状态图。",
        notifications: "真实合同只有五个布尔偏好，读取失败时不能把默认值当作已确认配置。",
        assets: "关注、决策与任务需要真实样例及各自链接；失败不能伪装成空资产。",
      }[current] || "";
  }
  function refresh() {
    const owned = ++generation;
    state = "loading";
    notice();
    navigateSection(current);
    lastRequest = { method: "GET", path: "/me/profile" };
    setTimeout(() => {
      if (owned !== generation) return;
      state = "ready";
      profile = structuredClone(data.profile);
      fill();
      navigateSection(current);
    }, 400);
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const body = Object.fromEntries(
      Object.keys(data.form).map((key) => [key, form.elements.namedItem(key).value]),
    );
    body.expected_version = profile.version;
    lastRequest = { method: "PATCH", path: "/me/profile", body };
    if (outcome === "failure") {
      notice("隔离模拟：保存未完成，未写入任何数据。输入内容保留，可修改后再次尝试。", true);
      return;
    }
    profile = { ...profile, ...body, version: profile.version + 1 };
    notice(
      "个人资料已保存；用户名可用于登录，手机号变化后保持未验证状态。（隔离演示，未真实写入）",
    );
  });
  $("sections").innerHTML = data.sections
    .map(
      (item, index) =>
        `<a href="/me?section=${item.key}" data-section="${item.key}"><span class="nav-index" aria-hidden="true">0${index + 1}</span><span>${item.label}</span></a>`,
    )
    .join("");
  $("sections").append(document.querySelector(".appearance"));
  document.querySelectorAll("a[href]").forEach((link) =>
    link.addEventListener("click", (event) => {
      event.preventDefault();
      destination = link.getAttribute("href");
      $("destination").textContent = `审核目标：${destination}；未执行真实路由导航。`;
      if (
        link.dataset.section &&
        !(event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button)
      )
        navigateSection(link.dataset.section);
    }),
  );
  function showScene(name) {
    generation++;
    profile = structuredClone(data.profile);
    state = name === "profile-loading" ? "loading" : name === "profile-error" ? "error" : "ready";
    outcome = name === "profile-save-failed" ? "failure" : "success";
    lastRequest = null;
    notice();
    fill();
    navigateSection(
      data.sections.some((item) => item.key === name)
        ? name
        : name === "invalid-section"
          ? ["security", "assets"]
          : "profile",
    );
    if (name === "profile-partial") notice("个人资料已读取，另有 3 个分区暂不可用，可稍后刷新。");
    if (["profile-edited", "profile-save-failed", "profile-saved"].includes(name))
      form.elements.namedItem("display_name").value = "隔离成员新名称";
    if (name === "profile-save-failed")
      notice("隔离模拟：保存未完成，未写入任何数据。输入内容保留，可修改后再次尝试。", true);
    if (name === "profile-saved") {
      profile.display_name = "隔离成员新名称";
      profile.version = 4;
      notice(
        "个人资料已保存；用户名可用于登录，手机号变化后保持未验证状态。（隔离演示，未真实写入）",
      );
    }
    $("scene").value = name;
  }
  $("scene").innerHTML = scenes.map((name) => `<option value="${name}">${name}</option>`).join("");
  $("scene").addEventListener("change", () => showScene($("scene").value));
  $("refresh").addEventListener("click", refresh);
  $("retry").addEventListener("click", refresh);
  window.PERSONAL_DESIGN_REVIEW = { scenes, showScene, navigateSection };
  window.PERSONAL_DESIGN_DIAGNOSTICS = () => ({
    current,
    state,
    profile: structuredClone(profile),
    lastRequest: structuredClone(lastRequest),
    destination,
  });
  showScene("profile");
})();
