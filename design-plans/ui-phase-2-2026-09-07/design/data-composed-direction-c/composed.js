(() => {
  const hosts = Object.fromEntries(
    ["records", "quality"].map((k) => [k, document.getElementById(`${k}-pane`)]),
  );
  const roots = {},
    controls = {},
    initialUrl = new URL(location.href);
  let active = "records",
    recordsUrl = new URL(initialUrl.pathname, initialUrl),
    resetting = false;
  function publishUrl() {
    const u = active === "records" ? recordsUrl : new URL(initialUrl.pathname, initialUrl);
    if (active === "quality") {
      u.searchParams.set("view", "quality");
      const page = controls.quality.state().page;
      if (page > 1) u.searchParams.set("quality_page", String(page));
    }
    if (location.href !== u.href) history.replaceState(null, "", u);
  }
  const recordHistory = {
    replaceState: (_state, _unused, url) => {
      recordsUrl = new URL(url, initialUrl);
      if (active === "records" && !resetting) publishUrl();
    },
  };
  for (const key of ["records", "quality"]) {
    const root = hosts[key].attachShadow({ mode: "open" });
    roots[key] = root;
    root.innerHTML = `<link rel="stylesheet" href="${key}-scoped.css"><link rel="stylesheet" href="component-overrides.css"><div data-component-body>${window.DATA_COMPOSED_TEMPLATES[key]}</div>`;
    const body = root.querySelector("[data-component-body]");
    const scopedDocument = {
      querySelector: (s) => root.querySelector(s),
      querySelectorAll: (s) => root.querySelectorAll(s),
      getElementById: (s) => root.getElementById(s),
      get activeElement() {
        return root.activeElement || body;
      },
      body,
    };
    window[`DATA_COMPOSED_MOUNT_${key.toUpperCase()}`](
      scopedDocument,
      recordHistory,
      initialUrl,
      () => {},
    );
    controls[key] = window[`DATA_${key.toUpperCase()}_C`];
    // The legacy handoff is not a business view in the composed proposal.
    if (key === "records") {
      root.getElementById("view-quality").onclick = () => select("quality");
      const option = root.querySelector('option[value="quality-handoff"]');
      option?.remove();
    }
    root.addEventListener("click", (event) => {
      if (event.target.closest?.('a[href="../data-records-direction-c/index.html"]')) {
        event.preventDefault();
        select("records");
      }
    });
    new MutationObserver(() => {
      if (!resetting) sync();
    }).observe(body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["open"],
    });
  }
  function sync() {
    if (!controls.quality) return;
    const quality = controls.quality.state();
    const modal = roots.quality.querySelector("dialog[open]");
    const existing = roots.quality.getElementById("composed-outcome");
    if (modal && quality.pending && ["write", "download"].includes(quality.pending.kind)) {
      if (!existing) {
        const review = document.createElement("details");
        review.id = "composed-outcome";
        review.innerHTML = "<summary>审核工具：返回模拟结果（非业务操作）</summary>";
        const pending = quality.pending;
        const outcomes =
          pending.kind === "write"
            ? [
                ["success", "模拟写入与读取反馈"],
                ["read-failed", "模拟写成功后读取失败"],
                ["conflict", "模拟整批冲突"],
                ["unknown", "模拟结果未知"],
              ]
            : [
                ["success", "模拟签发完成（未下载）"],
                ["error", "模拟签发拒绝"],
                ["unknown", "模拟签发结果未知"],
              ];
        for (const [outcome, label] of outcomes) {
          const button = document.createElement("button");
          button.textContent = label;
          button.dataset.composedOutcome = outcome;
          button.onclick = () => {
            controls.quality.complete(outcome, pending.token);
            sync();
            roots.quality.getElementById("close-dialog")?.focus();
          };
          review.append(button);
        }
        modal.append(review);
      }
    } else existing?.remove();
    const pending = [];
    for (const key of ["records", "quality"]) {
      const s = controls[key].state();
      if (s.pending)
        pending.push(`${key === "records" ? "近期记录" : "证据与质量"}：有模拟请求待返回`);
      if (key === "records" && s.unknown)
        pending.push("近期记录：导出结果未知，请核对，未自动重发");
    }
    const label = pending.join("；");
    const note = document.getElementById("continuity");
    if (note.textContent !== label) note.textContent = label;
    const p = controls[active].state().pending;
    document.getElementById("finish-read").disabled = !p || !["read", "page"].includes(p.kind);
    publishUrl();
  }
  function select(key) {
    if (!(key in hosts)) throw Error("Unknown workspace");
    if (Object.values(roots).some((r) => r.querySelector("dialog[open]"))) return false;
    active = key;
    for (const name of Object.keys(hosts)) {
      hosts[name].hidden = name !== key;
      hosts[name].inert = name !== key;
      const button = document.querySelector(`[data-view="${name}"]`);
      if (name === key) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
    sync();
    return true;
  }
  const scenes = Object.fromEntries(
    Object.entries(controls).flatMap(([key, c]) =>
      Object.entries(c.scenes)
        .filter(([s]) => s !== "quality-handoff")
        .map(([s, label]) => [
          `${key}:${s}`,
          `${key === "records" ? "近期记录" : "证据质量"} / ${label}`,
        ]),
    ),
  );
  function scene(value) {
    if (!(value in scenes)) throw Error("Unknown composed scene");
    resetting = true;
    try {
      controls.records.scene("default");
      controls.quality.scene("default");
      const [key, name] = value.split(":");
      select(key);
      controls[key].scene(name);
      document.getElementById("combined-scene").value = value;
    } finally {
      resetting = false;
    }
    scrollTo(0, 0);
    sync();
  }
  document
    .querySelectorAll("[data-view]")
    .forEach((button) => (button.onclick = () => select(button.dataset.view)));
  const picker = document.getElementById("combined-scene");
  for (const [value, label] of Object.entries(scenes)) picker.add(new Option(label, value));
  picker.onchange = () => scene(picker.value);
  document.getElementById("finish-read").onclick = () => {
    const c = controls[active],
      p = c.state().pending;
    if (p && ["read", "page"].includes(p.kind)) c.complete("error");
    sync();
  };
  window.DATA_COMPOSED_C = { select, scene, scenes, roots, controls, active: () => active, sync };
  scene("records:default");
})();
