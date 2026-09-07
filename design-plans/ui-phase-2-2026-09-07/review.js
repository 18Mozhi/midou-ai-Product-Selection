"use strict";
(() => {
  const data = window.SCOUTOPS_PHASE2;
  const byId = (id) => document.getElementById(id);
  if (!data) {
    byId("page-detail").textContent = "盘点数据未加载，请先运行生成命令。";
    return;
  }
  const storageKey = `scoutops-phase2-review:${data.fingerprint}`;
  let notes = [];
  let selectedPage = data.pages[0].id;
  let target = "";
  let returnFocus = null;
  let controlPage = 0;
  const pageSize = 20;
  const kindLabels = {
    control: "按钮 / 链接",
    "form-event": "表单事件",
    "event-binding": "组件 / 元素事件",
    "dialog-definition": "弹窗定义",
    "dialog-component-call": "弹窗调用",
    "dialog-script-call": "脚本弹窗触发",
  };
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function button(text, handler) {
    const node = element("button", text);
    node.type = "button";
    node.addEventListener("click", handler);
    return node;
  }
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    notes = Array.isArray(stored)
      ? stored.filter(
          (item) =>
            item &&
            typeof item.target === "string" &&
            typeof item.body === "string" &&
            typeof item.reviewer === "string" &&
            ["needs-change", "question"].includes(item.decision),
        )
      : [];
  } catch {
    byId("storage-status").textContent = "本地草稿存储不可用，意见会留在当前页面，请及时导出。";
  }
  byId("revision").textContent =
    `源码 ${data.sourceRevision.slice(0, 12)} / 清单 ${data.fingerprint.slice(0, 12)}`;
  for (const [value, label] of [
    [data.counts.routes, "路由条目"],
    [data.counts.controls, "控件 / 事件候选 · 未验收"],
    [data.counts.dialogs, "弹窗定义 / 调用候选"],
    [0, "用户验收通过"],
  ]) {
    const count = element("div", undefined, "count");
    count.append(element("strong", String(value)), element("span", label));
    byId("counts").append(count);
  }
  byId("legacy-status").textContent =
    `旧清单共 ${data.counts.legacyButtons + data.counts.legacyDialogs} 项，${data.counts.legacySourceMatches} 项与历史源码特征对应，${data.legacyUnresolved.length} 项仍需定位迁移。源码对应不是业务去向审核通过。另有 ${data.counts.unmappedCandidates} 个候选尚未建立路由关联。`;
  function openNote(id, trigger) {
    target = id;
    returnFocus = trigger;
    byId("note-target").textContent = id;
    byId("note-body").value = "";
    byId("note-dialog").showModal();
    byId("reviewer").focus();
  }
  byId("cancel-note").addEventListener("click", () => byId("note-dialog").close());
  byId("note-dialog").addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const fields = [
      ...byId("note-dialog").querySelectorAll("input, select, textarea, button"),
    ].filter((node) => !node.disabled && node.getClientRects().length);
    const first = fields[0],
      last = fields.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });
  byId("note-dialog").addEventListener("close", () => {
    if (returnFocus?.isConnected) returnFocus.focus();
    else byId("page-detail").focus();
  });
  byId("note-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const reviewer = byId("reviewer").value.trim(),
      body = byId("note-body").value.trim();
    if (!reviewer || !body) return;
    notes.push({
      target,
      reviewer,
      body,
      decision: byId("decision").value,
      fingerprint: data.fingerprint,
      createdAt: new Date().toISOString(),
    });
    try {
      localStorage.setItem(storageKey, JSON.stringify(notes));
      byId("storage-status").textContent = `当前版本已保存 ${notes.length} 条批注，请导出归档。`;
    } catch {
      byId("storage-status").textContent = "批注已保留在内存，但无法写入浏览器存储；关闭前请导出。";
    }
    byId("note-dialog").close();
    renderPage();
    byId("page-detail").focus();
  });
  byId("export-notes").addEventListener("click", () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            schemaVersion: 1,
            sourceFingerprint: data.fingerprint,
            exportedAt: new Date().toISOString(),
            notes,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const link = element("a");
    link.href = url;
    link.download = "review-decisions.json";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  function renderList() {
    const term = byId("page-search").value.trim().toLowerCase();
    const batch = byId("batch-filter").value,
      acceptance = byId("acceptance-filter").value;
    const visible = data.pages.filter(
      (page) =>
        (!batch || page.batch === batch) &&
        (!acceptance || page.acceptance === acceptance) &&
        `${page.id} ${page.title} ${page.path}`.toLowerCase().includes(term),
    );
    if (visible.length && !visible.some((page) => page.id === selectedPage))
      selectedPage = visible[0].id;
    byId("page-list").replaceChildren();
    byId("filter-status").textContent =
      `显示 ${visible.length} / ${data.pages.length} 条路由。所有设计和生产证据仍待逐项交付。`;
    for (const page of visible) {
      const entry = button("", () => {
        selectedPage = page.id;
        renderList();
        if (matchMedia("(max-width: 640px)").matches) byId("page-detail").focus();
      });
      entry.className = "page-entry";
      if (selectedPage === page.id) entry.setAttribute("aria-current", "page");
      const title = element("span");
      title.append(element("b", page.title), element("small", `${page.batch} · 待设计 / 待验收`));
      entry.append(element("span", page.id, "mono"), title);
      byId("page-list").append(entry);
    }
    if (!visible.length) {
      byId("page-detail").replaceChildren(
        element("h2", "没有匹配页面"),
        element("p", "请修改关键词或工作包筛选。"),
      );
      return;
    }
    renderPage();
  }
  function renderPage() {
    const page = data.pages.find((item) => item.id === selectedPage);
    const panel = byId("page-detail");
    panel.replaceChildren();
    controlPage = 0;
    const heading = element("div", undefined, "detail-heading"),
      title = element("div");
    title.append(
      element("p", `${page.id} / ${page.batch} / 待盘点确认`, "eyebrow"),
      element("h2", page.title),
    );
    const comment = button("记录页面意见", () => openNote(page.id, comment));
    heading.append(title, comment);
    panel.append(
      heading,
      element("p", page.path, "mono path"),
      element("p", `实现入口：${page.component}`, "mono path"),
    );
    const directions = element("div", undefined, "direction-grid");
    for (const [label, content] of [
      ["桌面 / 1440", page.desktopDirection],
      ["移动 / 390", page.mobileDirection],
    ]) {
      const section = element("section");
      section.append(element("h3", label), element("p", content));
      directions.append(section);
    }
    panel.append(directions, element("h3", "独立验收重点"), element("p", page.acceptanceSteps));
    const evidence = element("div", undefined, "evidence");
    for (const label of [
      "设计图 · 未交付",
      "真实 Vue · 未验收",
      page.acceptance === "internal" ? "生产不可达 · 待验证" : "生产证据 · 未交付",
      "用户审核 · 待进行",
    ])
      evidence.append(element("span", label));
    panel.append(evidence);
    for (const note of notes.filter((item) => item.target === page.id))
      panel.append(
        element(
          "p",
          `${note.reviewer} · ${note.decision === "question" ? "需澄清" : "需修改"}\n${note.body}`,
          "review-note",
        ),
      );
    const tools = element("div", undefined, "control-tools");
    const label = element("label", "查找该页候选动作"),
      search = element("input");
    search.type = "search";
    search.placeholder = "名称、处理函数或组件";
    search.id = "control-search";
    label.append(search);
    const kindLabel = element("label", "候选类型"),
      select = element("select");
    select.id = "control-kind";
    const all = element("option", "全部类型");
    all.value = "";
    select.append(all);
    for (const [value, text] of Object.entries(kindLabels)) {
      const option = element("option", text);
      option.value = value;
      select.append(option);
    }
    kindLabel.append(select);
    tools.append(label, kindLabel);
    const status = element("p", undefined, "meta");
    status.id = "control-status";
    status.setAttribute("role", "status");
    const list = element("div");
    list.id = "control-list";
    const pager = element("div", undefined, "pager");
    pager.id = "control-pager";
    panel.append(tools, status, list, pager);
    for (const input of [search, select])
      input.addEventListener("input", () => {
        controlPage = 0;
        renderControls();
      });
    renderControls();
  }
  function renderControls() {
    const term = byId("control-search").value.trim().toLowerCase(),
      kind = byId("control-kind").value;
    const matches = data.candidates.filter(
      (item) =>
        item.routes.includes(selectedPage) &&
        (!kind || item.kind === kind) &&
        `${item.label} ${item.file} ${JSON.stringify(item.events)}`.toLowerCase().includes(term),
    );
    byId("control-status").textContent =
      `${matches.length} 个源码候选，含共享组件的关联上界；均未判定业务覆盖通过。`;
    const list = byId("control-list");
    list.replaceChildren();
    for (const item of matches.slice(controlPage * pageSize, (controlPage + 1) * pageSize)) {
      const details = element("details", undefined, "candidate");
      const summary = element(
        "summary",
        `${kindLabels[item.kind]} · ${item.label.slice(0, 160) || "名称需运行时核实"}`,
      );
      const source = element("a", `${item.file}:${item.line}`, "source");
      source.href = `../../${item.file}#L${item.line}`;
      details.append(
        summary,
        source,
        element(
          "pre",
          JSON.stringify(
            {
              candidateId: item.id,
              handlers: item.events,
              conditions: item.conditions,
              legacyIds: item.legacy,
            },
            null,
            2,
          ),
        ),
      );
      if (item.label.length > 160) details.append(element("p", item.label));
      const comment = button("记录此候选意见", () => openNote(item.id, comment));
      details.append(comment);
      for (const note of notes.filter((note) => note.target === item.id))
        details.append(element("p", `${note.reviewer}：${note.body}`, "review-note"));
      list.append(details);
    }
    const previous = button("上一页", () => {
      controlPage--;
      renderControls();
    });
    previous.disabled = controlPage === 0;
    const next = button("下一页", () => {
      controlPage++;
      renderControls();
    });
    next.disabled = (controlPage + 1) * pageSize >= matches.length;
    byId("control-pager").replaceChildren(
      previous,
      element(
        "span",
        `${matches.length ? controlPage + 1 : 0} / ${Math.ceil(matches.length / pageSize)}`,
        "meta",
      ),
      next,
    );
  }
  for (const id of ["page-search", "batch-filter", "acceptance-filter"])
    byId(id).addEventListener("input", renderList);
  renderList();
  for (const item of data.candidates.filter((candidate) => !candidate.routes.length)) {
    const details = element("details", undefined, "candidate");
    details.append(
      element(
        "summary",
        `${item.file.split("/").at(-1)}:${item.line} · ${item.label.slice(0, 70)}`,
      ),
    );
    details.append(
      element(
        "p",
        item.scope === "development-query-view"
          ? "源码分类：DEV query 入口；生产不可达测试待执行。"
          : "源码分类：未找到显式渲染消费方，暂不删除；打包glob和运行时入口需进一步核实。",
      ),
    );
    details.append(
      element(
        "pre",
        JSON.stringify(
          { candidateId: item.id, handlers: item.events, conditions: item.conditions },
          null,
          2,
        ),
      ),
    );
    const comment = button("记录此候选意见", () => openNote(item.id, comment));
    details.append(comment);
    byId("unmapped-list").append(details);
  }
})();
