"use strict";
(() => {
  const data = window.SCOUTOPS_PHASE2;
  const current = window.SCOUTOPS_PHASE2_EVIDENCE;
  const recent = window.SCOUTOPS_PHASE2_RECENT_MATERIALS?.materials ?? [];
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
    `历史候选基线 ${data.sourceRevision.slice(0, 12)} / 草稿清单 ${data.fingerprint.slice(0, 12)}`;
  for (const [value, label] of [
    [data.counts.routes, "路由条目"],
    [current?.summary.packages ?? "—", "C 图册索引 · 非完整页数"],
    [
      new Set([
        ...(current?.pages.filter((page) => page.actualVue.length).map((page) => page.id) ?? []),
        ...recent.map((item) => item.page),
      ]).size,
      "已登记 Vue 对照的页面 · 非验收",
    ],
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
      `显示 ${visible.length} / ${data.pages.length} 条路由。图稿、真实 Vue 与生产验收分别核对。`;
    for (const page of visible) {
      const entry = button("", () => {
        selectedPage = page.id;
        renderList();
        if (matchMedia("(max-width: 640px)").matches) byId("page-detail").focus();
      });
      entry.className = "page-entry";
      if (selectedPage === page.id) entry.setAttribute("aria-current", "page");
      const title = element("span");
      const related = current?.pages.find((item) => item.id === page.id);
      title.append(
        element("b", page.title),
        element(
          "small",
          `${page.batch} · ${related ? `${related.packages.length} 个关联图册` : "图册索引未加载"} / 待验收`,
        ),
      );
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
  function evidenceLink(label, href) {
    const link = element("a", `${label} ↗`, "text-link");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener";
    return link;
  }
  function renderCurrentEvidence(page, panel) {
    const related = current?.pages.find((item) => item.id === page.id);
    panel.append(element("h3", "当前 C 方向审核材料"));
    if (!related) {
      panel.append(
        element(
          "p",
          "当前图册索引未加载；请运行审核入口生成命令。不可据此判断设计尚未交付。",
          "notice",
        ),
      );
      return;
    }
    panel.append(evidenceLink("逐页范围与剩余项", related.spec));
    const grid = element("div", undefined, "review-comparison");
    const proposals = element("section", undefined, "proposal-materials");
    proposals.append(
      element("h4", "01 / 设计图与交互预览"),
      element(
        "p",
        "以下为关联包，可能包含其他页面或仅覆盖分区。先读范围，再选场景；不按图片数累计完成度。",
        "meta",
      ),
    );
    for (const id of related.packages) {
      const item = current.packages[id];
      const card = element("div", undefined, "material-card");
      card.append(
        element("h5", id),
        element("p", `${item.screenshots} 张包内图 · 待具体审核`, "meta"),
        evidenceLink("图册与范围说明", item.readme),
      );
      if (item.prototype) card.append(evidenceLink("打开图册 / 预览入口", item.prototype));
      if (item.gallery) card.append(evidenceLink("打开状态截图图册", item.gallery));
      card.append(evidenceLink("源与截图清单", item.evidence));
      proposals.append(card);
    }
    const implementation = element("section", undefined, "vue-materials");
    implementation.append(
      element("h4", "02 / 真实 Vue 对照"),
      element(
        "p",
        "含动作登记与补充审核图。源码状态为索引生成时核对结果，不是实时验收；本地样例不代表真实后端或生产。",
        "meta",
      ),
    );
    const recentItems = recent
      .filter((item) => item.page === page.id)
      .sort(
        (a, b) =>
          Number(a.sourceStatus !== "source-matched-at-index-build") -
          Number(b.sourceStatus !== "source-matched-at-index-build"),
      );
    if (!related.actualVue.length && !recentItems.length)
      implementation.append(
        element("p", "本入口尚未登记该页的真实 Vue 对照；不据此断言该页没有实现。", "notice"),
      );
    for (const item of recentItems) {
      const card = element("div", undefined, "material-card recent-material");
      card.dataset.materialId = item.id;
      const historical = item.sourceStatus !== "source-matched-at-index-build";
      card.append(
        element("h5", item.title),
        element(
          "p",
          historical
            ? `历史对照图 · ${item.sourceDifferences.length} 处来源与当前源码不同，请先读差异`
            : "登记时源码一致 · 非整页或生产验收",
          "notice",
        ),
        element("p", item.scope),
        element(
          "p",
          `证据版本 ${item.manifestSha256.slice(0, 12)} · 图包共 ${item.packetImages} 张（含对照/其他场景）`,
          "meta",
        ),
      );
      if (historical) {
        const differences = element("details", undefined, "material-differences");
        differences.append(element("summary", "查看来源差异（不自动否定原批准）"));
        const list = element("ul");
        for (const difference of item.sourceDifferences)
          list.append(
            element(
              "li",
              `${difference.file}${difference.actual === null ? " · 当前文件缺失" : " · 当前内容已变化"}`,
            ),
          );
        differences.append(list);
        card.append(differences);
      }
      const previews = element("details", undefined, "material-previews");
      previews.append(element("summary", `展开 ${item.previews.length} 张指定区域图`));
      for (const preview of item.previews) {
        const figure = element("figure");
        const img = element("img");
        img.src = preview.file;
        img.alt = `${page.id} ${item.title} · ${preview.label} · 本地对照图`;
        img.loading = "lazy";
        figure.append(
          img,
          element("figcaption", preview.label),
          evidenceLink("打开原尺寸图片", preview.file),
        );
        previews.append(figure);
      }
      const noteTarget = `${page.id}/${item.id}@${item.manifestSha256}`;
      const comment = button("记录这组图的意见", () => openNote(noteTarget, comment));
      card.append(
        previews,
        evidenceLink(item.galleryLabel ?? "完整实施图册", item.gallery),
        evidenceLink("实施范围与剩余项", item.report),
        evidenceLink("原始证据清单", item.evidence),
        comment,
      );
      for (const note of notes.filter((entry) => entry.target === noteTarget))
        card.append(element("p", `${note.reviewer}：${note.body}`, "review-note"));
      implementation.append(card);
    }
    for (const item of related.actualVue) {
      const card = element("div", undefined, "material-card");
      card.append(
        element(
          "h5",
          item.key === "actualVueFieldEvidence" ? "字段、焦点与密度" : "布局与代表控件状态",
        ),
        element("p", "本地真实 Vue / 具体状态待审核", "meta"),
        evidenceLink("打开真实界面图册", item.gallery),
        evidenceLink("覆盖与剩余项", item.readme),
        evidenceLink("验证证据", item.evidence),
      );
      implementation.append(card);
    }
    grid.append(proposals, implementation);
    panel.append(grid);
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
    renderCurrentEvidence(page, panel);
    const directions = element("div", undefined, "direction-grid");
    for (const [label, content] of [
      ["桌面 / 1440", page.desktopDirection],
      ["移动 / 390", page.mobileDirection],
    ]) {
      const section = element("section");
      section.append(element("h3", label), element("p", content));
      directions.append(section);
    }
    const baseline = element("details", undefined, "historical-research");
    baseline.append(element("summary", "历史计划方向（当前稿以以上图册为准）"), directions);
    panel.append(baseline, element("h3", "独立验收重点"), element("p", page.acceptanceSteps));
    const evidence = element("div", undefined, "evidence");
    for (const label of [
      "设计图 · 关联不等于全页完成",
      "真实 Vue · 未验收",
      page.acceptance === "internal" ? "生产不可达 · 待验证" : "生产证据 · 未交付",
      "用户审核 · 全页尚未通过",
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
    panel.append(
      element("h3", "历史源码候选 / 按钮与弹窗定位"),
      element(
        "p",
        "以下沿用原清单和批注身份，不是最新业务动作分母；当前语义与状态以逐页规格、图册及动作审核为准。",
        "meta",
      ),
      tools,
      status,
      list,
      pager,
    );
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
      `${matches.length} 个历史源码候选，含共享组件的关联上界；文件行号可能已变化，均未判定业务覆盖通过。`;
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
