(() => {
  const $ = (id) => document.getElementById(id);
  const options = [
    { id: "deep-ocean", name: "目录蓝", caption: "蓝色范围区，纯白工作面" },
    { id: "aurora-purple", name: "冷雾蓝", caption: "灰蓝目录，冷白工作面" },
    { id: "cloud-white", name: "净页白", caption: "浅色目录，蓝色动作强调" },
  ];
  const notices = [
    "主题偏好暂时无法同步，已保留当前界面主题。",
    "主题已沿用到当前后台；选择业务范围后会同步到账号偏好。",
    "正在保存主题…",
    "主题已应用到全部模块。",
    "主题保存失败，已恢复原主题，请稍后重试。",
  ];
  const scenes = [
    "member-open",
    "organization-open",
    "platform-open",
    "deep-ocean-open",
    "aurora-purple-open",
    "cloud-white-open",
    "saving",
    "saved",
    "failed-401",
    "failed-403",
    "failed-409",
    "failed-429",
    "failed-500",
    "failed-503",
    "read-failed-silent",
    "platform-local",
    "read-before-save",
    "known-race",
  ];
  let active = "deep-ocean",
    shell = "member",
    version = 1,
    outcome = "success",
    readFails = false,
    token = 0,
    busy = false;
  let requests = [],
    notice = "";
  function render() {
    $("shell-preview").dataset.palette = active;
    $("palette-name").textContent = options.find((option) => option.id === active).name;
    $("identity").textContent = {
      member: "成员界面",
      organization_admin: "组织后台",
      platform_admin: "平台后台",
    }[shell];
    $("scope-copy").textContent =
      shell === "platform_admin" ? "平台范围 · 本机沿用" : "账号偏好 · 当前组织与工作区";
    $("save-scope").textContent =
      shell === "platform_admin"
        ? "平台后台仅本机应用，不调用账号偏好保存。"
        : "选择即应用并保存；失败恢复原主题。";
    $("theme-options").innerHTML = options
      .map(
        (option) =>
          `<button class="theme-option" data-id="${option.id}" aria-pressed="${option.id === active}"><span class="swatch" aria-hidden="true"></span><span><b>${option.name}</b><small>${option.caption}</small></span><span class="selected-mark" aria-hidden="true">${option.id === active ? "✓" : ""}</span></button>`,
      )
      .join("");
    $("notice").textContent = notice;
    $("notice").hidden = !notice;
    $("theme-options")
      .querySelectorAll("button")
      .forEach((button) => button.addEventListener("click", () => choose(button.dataset.id)));
  }
  function close(returnFocus = false) {
    $("theme-panel").hidden = true;
    $("theme-toggle").setAttribute("aria-expanded", "false");
    if (returnFocus) $("theme-toggle").focus();
  }
  function open() {
    $("theme-panel").hidden = false;
    $("theme-toggle").setAttribute("aria-expanded", "true");
  }
  async function choose(id) {
    // Reviewer harness is one interaction at a time. Actual concurrent-write gap is
    // explicitly reproduced separately, not asserted fixed by this local simulation.
    if (busy) {
      $("review-context").textContent =
        "审核模拟一次保存流程；真实连续保存竞态尚未修复，请查看 known-race 场景。";
      return;
    }
    const owned = token,
      previous = active;
    if (shell === "platform_admin") {
      active = id;
      notice = notices[1];
      close(true);
      render();
      return;
    }
    busy = true;
    if (version === null) {
      requests.push({ method: "GET", path: "/me/ui-preferences" });
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (owned !== token) return;
      if (!readFails) version = 1;
    }
    active = id;
    close(true);
    notice = notices[2];
    render();
    requests.push({
      method: "PUT",
      path: "/me/ui-preferences",
      body: { theme: id, expected_version: version ?? 0 },
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (owned !== token) return;
    if (outcome === "failure") {
      active = previous;
      notice = notices[4];
    } else {
      version = (version ?? 0) + 1;
      notice = notices[3];
    }
    busy = false;
    render();
  }
  function showScene(name) {
    token++;
    busy = false;
    active = "deep-ocean";
    shell = name.startsWith("organization")
      ? "organization_admin"
      : name.startsWith("platform")
        ? "platform_admin"
        : "member";
    version = name === "read-before-save" || name === "read-failed-silent" ? null : 1;
    readFails = name === "read-failed-silent";
    outcome = name.startsWith("failed-") ? "failure" : "success";
    requests = [];
    notice = "";
    close();
    $("known-gap").hidden = name !== "known-race";
    $("review-context").textContent =
      "审核稿不保存本机或账号偏好；三种新名称与配色均待审核，兼容 ID 不变。";
    if (name.endsWith("-open")) {
      if (options.some((option) => `${option.id}-open` === name)) active = name.slice(0, -5);
      open();
    } else if (name === "saving") {
      active = "aurora-purple";
      notice = notices[2];
    } else if (name === "saved") {
      active = "aurora-purple";
      notice = notices[3];
    } else if (name.startsWith("failed-")) {
      notice = notices[4];
    } else if (name === "platform-local") {
      active = "cloud-white";
      notice = notices[1];
    } else if (["read-before-save", "read-failed-silent"].includes(name)) open();
    else if (name === "known-race") {
      notice = notices[4];
    }
    $("scene").value = name;
    render();
  }
  $("scene").innerHTML = scenes.map((name) => `<option value="${name}">${name}</option>`).join("");
  $("scene").addEventListener("change", () => showScene($("scene").value));
  $("theme-toggle").addEventListener("click", () => ($("theme-panel").hidden ? open() : close()));
  $("close-panel").addEventListener("click", () => close(true));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !$("theme-panel").hidden) {
      event.preventDefault();
      close(true);
    }
  });
  document.addEventListener("pointerdown", (event) => {
    if (!$("theme-panel").contains(event.target) && !$("theme-toggle").contains(event.target))
      close();
  });
  $("theme-panel").addEventListener("focusout", () =>
    queueMicrotask(() => {
      if (
        !$("theme-panel").contains(document.activeElement) &&
        document.activeElement !== $("theme-toggle")
      )
        close();
    }),
  );
  $("more-settings").addEventListener("click", (event) => {
    event.preventDefault();
    $("destination").textContent =
      "审核目标：/settings/theme；未跳转。原链接可达性与业务范围需真实路由验证。";
    close(true);
  });
  $("focus-sample").addEventListener("click", () => {
    $("focus-note").hidden = false;
  });
  window.THEME_DESIGN_REVIEW = { scenes, showScene, options, notices };
  window.THEME_DESIGN_DIAGNOSTICS = () => ({
    active,
    shell,
    version,
    busy,
    requests: structuredClone(requests),
    notice,
  });
  showScene("member-open");
})();
