(() => {
  const d = window.OP_C_DATA,
    v = window.OP_C_VIEW,
    clone = (x) => JSON.parse(JSON.stringify(x));
  const scenes = {
    recommended: "待我采纳",
    "rule-candidates": "规则命中候选",
    "evidence-pending": "采集中",
    all: "全部机会",
    readonly: "只读全部机会",
    "setup-open": "展开五项配置",
    "setup-ready": "配置就绪不等于商品通过",
    "setup-unknown": "配置读取失败",
    "members-failed": "成员读取失败",
    "members-empty": "成员成功返回空",
    "long-name": "长名称",
    "image-failed": "图片加载失败",
    "page-two": "第二页",
    selected: "本页多选",
    "cross-page": "跨页保留选择",
    "hidden-selection": "选择均不在本页",
    "filter-open": "筛选空草稿",
    "filter-edited": "筛选未应用",
    filtered: "七项已应用",
    "empty-filtered": "筛选无结果",
    "empty-all": "全部机会为空",
    "empty-recommended": "待采纳为空",
    "empty-candidates": "规则候选为空",
    "empty-pending": "采集中为空",
    "empty-readonly": "只读空列表",
    loading: "列表加载中",
    error: "读取失败",
    expired: "登录过期",
    forbidden: "无访问权限",
    blocked: "请求受阻",
    "create-open": "创建空表单",
    "create-edited": "创建草稿",
    "create-busy": "创建提交中",
    "create-failed": "创建失败保留",
    "create-saved": "创建成功跳转提示",
    "assign-open": "指派影响预览",
    "assign-edited": "指派已填",
    "assign-busy": "指派提交中",
    "assign-failed": "指派失败",
    "assign-saved": "指派成功",
    "review-open": "复核影响预览",
    "review-edited": "复核已填",
    "review-busy": "复核提交中",
    "review-failed": "复核失败",
    "review-saved": "复核成功",
    "archive-open": "归档影响预览",
    "archive-edited": "归档已填",
    "archive-busy": "归档提交中",
    "archive-failed": "归档失败",
    "archive-saved": "归档成功",
    "erp-open": "ERP 导入",
    "erp-edited": "ERP 数量已填",
    "erp-busy": "ERP 读取导入中",
    "erp-closed-busy": "ERP 关闭仍在进行",
    "erp-login-opened": "已打开 ERP 登录页",
    "erp-login-required": "ERP 登录失效",
    "erp-helper-missing": "助手未就绪",
    "erp-file-invalid": "ERP JSON 无效",
    "erp-failed": "ERP 导入失败",
    "erp-saved": "ERP 导入返回计数",
  };
  let s,
    generation = 0,
    opener = null;
  const app = document.querySelector("#app"),
    overlay = document.querySelector("#overlay");
  const appliedExample = {
    q: "候选",
    market: "US",
    decision_status: "pending",
    coverage_status: "partial",
    blocking_reason: "evidence_insufficient",
    lifecycle_status: "validating",
    owner_id: d.manual.owner_id,
  };
  function url() {
    const q = new URLSearchParams();
    if (s.view !== "recommended") q.set("view", s.view);
    for (const [k, value] of Object.entries(s.applied)) if (value) q.set(k, value);
    if (s.page !== 1) q.set("page", s.page);
    s.url = `/opportunities${q.size ? `?${q}` : ""}`;
    const params = new URLSearchParams({
      page: String(s.page),
      page_size: "20",
      selection_view: s.view,
    });
    for (const [k, value] of Object.entries(s.applied)) if (value) params.set(k, value);
    s.lastRead = `/opportunities?${params}`;
  }
  function loadItems() {
    s.items = clone(d.rows[s.view]);
    if (Object.values(s.applied).some(Boolean)) {
      // Explicit simulated response; only the outgoing query is a source-backed contract.
      s.items = [
        {
          ...s.items[0],
          name: `${s.applied.q || "筛选"} · 隔离返回示例`,
          market: s.applied.market || s.items[0].market,
          decision_status: s.applied.decision_status || "pending",
          coverage_status: s.applied.coverage_status || "partial",
          lifecycle_status: s.applied.lifecycle_status || "validating",
          owner_id: s.applied.owner_id || d.manual.owner_id,
          blocking_reasons: s.applied.blocking_reason ? [s.applied.blocking_reason] : [],
          evidence_count: 2,
          source_count: 2,
        },
      ];
      s.total = 1;
    }
    if (s.page === 2)
      s.items = [
        {
          ...clone(d.rows.all[1]),
          id: "00000000-0000-4000-8000-000000000439",
          name: "第二页隔离候选",
        },
      ];
    s.state = "ready";
    url();
  }
  function render(focusModal = true) {
    app.innerHTML = v.main(s);
    overlay.innerHTML = v.modal(s);
    const dialog = overlay.querySelector("dialog");
    if (dialog) {
      dialog.showModal();
      dialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        close();
      });
      dialog.addEventListener("keydown", (event) => {
        if (event.key !== "Tab") return;
        const controls = [
          ...dialog.querySelectorAll(
            "button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled)",
          ),
        ].filter((el) => el.getClientRects().length);
        const first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      });
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) {
          const r = dialog.getBoundingClientRect();
          if (
            event.clientX < r.left ||
            event.clientX > r.right ||
            event.clientY < r.top ||
            event.clientY > r.bottom
          )
            close();
        }
      });
      if (focusModal)
        (
          dialog.querySelector('[role="alert"]') || dialog.querySelector("button:not(:disabled)")
        )?.focus();
    }
  }
  function close() {
    if (s.busy && s.modal !== "erp") return;
    s.modal = null;
    s.modalError = "";
    if (s.busy) s.message = "ERP 请求仍在进行；关闭弹窗不代表取消。";
    render();
    (opener ? document.querySelector(opener) : document.querySelector("#work"))?.focus();
  }
  function open(kind) {
    if (s.busy) return;
    if (kind !== "filter" && !s.canDecide) return;
    if (["assign", "review", "archive"].includes(kind)) {
      if (!v.effective(s).length || (kind === "assign" && !s.members.length)) return;
      s.reason = "";
      s.assignee = "";
      s.reasonInvalid = false;
    }
    s.modal = kind;
    s.modalError = "";
    opener = `[data-action="${kind}"]`;
    render();
  }
  function start(intent, success, failText) {
    if (s.busy) return;
    s.lastIntent = clone(intent);
    s.intents.push(clone(intent));
    s.busy = true;
    s.message = "";
    s.modalError = "";
    const ticket = generation,
      shouldFail = s.failNext;
    s.failNext = false;
    render();
    setTimeout(() => {
      if (ticket !== generation) return;
      s.busy = false;
      if (shouldFail) {
        s.failed = true;
        s.modalError = failText;
        s.message = failText;
      } else {
        s.failed = false;
        success();
      }
      render();
      if (!s.modal)
        (opener ? document.querySelector(opener) : document.querySelector("#work"))?.focus();
    }, 400);
  }
  function persist(items, source, captured, total) {
    start(
      {
        method: "POST",
        path: "/imports/erp-products",
        body: {
          items,
          source_url: source,
          captured_at: captured,
          ...(total === undefined ? {} : { total }),
        },
      },
      () => {
        s.modal = null;
        s.message = `ERP 已读取 ${items.length} 条：新增 ${items.length} 个机会、0 个亚马逊待采集竞品、0 个货源匹配任务（隔离返回示例）。原始记录作为证据，不等于确认成本。`;
        url();
      },
      "导入返回失败，不能据此断言服务器未写入。请核对结果后再重试。",
    );
  }
  function submit(event) {
    event.preventDefault();
    if (s.busy) return;
    if (s.modal === "filter") {
      s.applied = clone(s.draft);
      s.page = 1;
      loadItems();
      close();
      return;
    }
    if (s.modal === "create") {
      start(
        {
          method: "POST",
          path: "/opportunities",
          body: {
            name: s.form.name,
            market: s.form.market,
            category: s.form.category || null,
            source_topic_id: s.form.source_topic_id || null,
          },
        },
        () => {
          s.modal = null;
          s.navigation = `/opportunities/${d.manual.id}`;
          s.message = `创建返回成功；下一步前往返回 ID 的详情。图稿停留展示跳转意图，不生成评分。`;
        },
        "创建请求失败；已保留本页草稿，请核对结果后显式重试。",
      );
    } else if (s.modal === "erp") {
      s.bridgeIntent = { action: "erp.products.read", payload: { limit: Number(s.limit) } };
      if (s.bridgeError) {
        s.modalError = s.bridgeError;
        render();
        return;
      }
      persist(
        clone(d.erpFile.items),
        d.erpFile.source_url,
        new Date().toISOString(),
        d.erpFile.items.length,
      );
    } else {
      if (!s.reason.trim()) {
        s.reasonInvalid = true;
        render();
        document.querySelector('[name="reason"]').focus();
        return;
      }
      const selected = v.effective(s);
      if (!selected.length) return;
      start(
        {
          method: "POST",
          path: "/opportunities/batch",
          body: {
            action: s.modal,
            items: selected.map((item) => ({ id: item.id, expected_version: item.version })),
            reason: s.reason.trim(),
            assignee_id: s.modal === "assign" ? s.assignee : null,
          },
        },
        () => {
          s.modal = null;
          s.selected = [];
          s.message = `批量返回成功 ${selected.length} 项；下一步重新读取列表。图稿不改写机会事实。`;
          url();
        },
        "当前版本或依赖校验失败；已保留实际影响范围与原因，尚未自动重放。",
      );
    }
  }
  function resetScene(name) {
    generation++;
    s = {
      scene: name,
      view: "recommended",
      state: "ready",
      canDecide: true,
      page: 1,
      total: 1,
      selected: [],
      items: [],
      members: clone(d.members),
      memberFailure: false,
      setup: "missing",
      setupOpen: false,
      applied: clone(d.filters),
      draft: clone(d.filters),
      form: clone(d.form),
      modal: null,
      modalError: "",
      reason: "",
      assignee: "",
      limit: 200,
      busy: false,
      failed: false,
      failNext: false,
      message: "",
      navigation: null,
      lastIntent: null,
      intents: [],
      bridgeIntent: null,
      bridgeError: null,
    };
    if (name === "rule-candidates") s.view = "rule_candidates";
    else if (name === "evidence-pending") s.view = "evidence_pending";
    else if (
      ![
        "recommended",
        "setup-open",
        "setup-ready",
        "setup-unknown",
        "empty-recommended",
        "empty-candidates",
        "empty-pending",
      ].includes(name)
    )
      s.view = "all";
    s.total = d.rows[s.view].length;
    loadItems();
    if (name.startsWith("setup-")) {
      s.setupOpen = name === "setup-open";
      s.setup = name === "setup-ready" ? "ready" : name === "setup-unknown" ? "unknown" : "missing";
    }
    if (name.includes("readonly")) s.canDecide = false;
    if (name.startsWith("members-")) {
      s.members = [];
      s.memberFailure = name === "members-failed";
      s.selected = s.items.map((v) => v.id);
    }
    if (name === "long-name")
      s.items[0].name =
        "隔离长名称机会 · 用于检验中文、English 与连续型号 ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 的换行，不代表真实商品或销售事实";
    if (name === "image-failed") s.imageFailed = true;
    if (["page-two", "cross-page", "hidden-selection"].includes(name)) {
      s.page = 2;
      s.total = 21;
      loadItems();
    }
    if (name === "selected") s.selected = s.items.map((v) => v.id);
    if (name === "cross-page") s.selected = [d.manual.id, s.items[0].id];
    if (name === "hidden-selection") s.selected = d.rows.all.map((v) => v.id);
    if (name === "filter-open" || name === "filter-edited") {
      s.modal = "filter";
      if (name === "filter-edited") s.draft = clone(appliedExample);
    }
    if (name === "filtered" || name === "empty-filtered") {
      s.applied = clone(appliedExample);
      s.draft = clone(appliedExample);
      loadItems();
    }
    if (name.startsWith("empty-")) {
      if (name === "empty-recommended") s.view = "recommended";
      if (name === "empty-candidates") s.view = "rule_candidates";
      if (name === "empty-pending") s.view = "evidence_pending";
      s.state = "empty";
      s.items = [];
      s.total = 0;
    }
    if (["loading", "error", "expired", "forbidden", "blocked"].includes(name)) {
      s.state = name;
      s.items = [];
    }
    for (const kind of ["create", "assign", "review", "archive", "erp"])
      if (name.startsWith(`${kind}-`)) {
        s.modal = kind;
        opener = `[data-action="${kind}"]`;
        if (["assign", "review", "archive"].includes(kind)) s.selected = s.items.map((v) => v.id);
        if (!name.endsWith("open")) {
          s.form = clone(d.edited);
          s.reason = "  已核对当前页范围  ";
          s.assignee = d.manual.owner_id;
          if (kind === "erp") s.limit = 50;
        }
        if (name.endsWith("busy")) s.busy = true;
        if (name.endsWith("failed")) {
          s.modalError =
            kind === "erp"
              ? "导入返回失败，不确定服务器是否已写入；请先核对结果。"
              : "提交失败，草稿与影响范围已保留。";
          s.failNext = true;
        }
        if (name.endsWith("saved")) {
          s.modal = null;
          s.selected = [];
          s.message =
            kind === "erp"
              ? "ERP 已读取 1 条：新增 1 个机会、0 个待采集竞品、0 个货源匹配任务。隔离返回示例，不代表已确认成本。"
              : kind === "create"
                ? "创建返回成功；下一步导航到返回 ID 的详情。图稿不进入 P18。"
                : "批量返回成功 2 项，已清除选择；列表需要重新读取。图稿未改变持久化事实。";
        }
      }
    const erpErrors = {
      "erp-login-opened": "已打开 ERP 登录页。登录并进入商品列表后再次读取。",
      "erp-login-required": "ERP 登录状态无效，请在 ERP 页面重新登录。",
      "erp-helper-missing": "未检测到浏览器助手或 ERP 权限未授予，请先下载并加载助手。",
      "erp-file-invalid": "ERP JSON 文件格式无效；应为 list 数组或商品数组。",
    };
    if (erpErrors[name]) {
      s.modalError = erpErrors[name];
      if (name !== "erp-file-invalid") s.bridgeError = erpErrors[name];
    }
    if (name === "erp-closed-busy") {
      s.modal = null;
      s.message = "ERP 请求仍在进行；关闭弹窗不代表取消。";
    }
    url();
    render();
    document.querySelector("#scene").value = name;
  }
  document.querySelector("#scene").innerHTML = Object.entries(scenes)
    .map(([key, label]) => `<option value="${key}">${label}</option>`)
    .join("");
  document
    .querySelector("#scene")
    .addEventListener("change", (event) => resetScene(event.target.value));
  document.addEventListener("click", (event) => {
    const anchor = event.target.closest("a");
    if (anchor && !anchor.classList.contains("skip")) {
      event.preventDefault();
      s.navigation = anchor.getAttribute("href");
      s.message = `图稿导航意图：${s.navigation}；未离开当前原型。`;
      render();
      return;
    }
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled) return;
    const a = button.dataset.action;
    if (["create", "erp", "filter", "assign", "review", "archive"].includes(a)) open(a);
    else if (a === "close") close();
    else if (a.startsWith("view:")) {
      s.view = a.slice(5);
      s.page = 1;
      s.selected = [];
      if (s.view !== "all") {
        s.applied.decision_status = "";
        s.draft.decision_status = "";
      }
      s.total = d.rows[s.view].length;
      loadItems();
      render();
    } else if (a === "clear-selection") {
      s.selected = [];
      render();
    } else if (a === "prev" || a === "next") {
      s.page += a === "prev" ? -1 : 1;
      loadItems();
      render();
    } else if (a === "reset") {
      s.applied = clone(d.filters);
      s.draft = clone(d.filters);
      s.page = 1;
      loadItems();
      s.modal = null;
      render();
      document.querySelector('[data-action="filter"]').focus();
    } else if (a === "retry") {
      s.memberFailure = false;
      s.members = clone(d.members);
      loadItems();
      s.total = s.items.length;
      render();
    }
  });
  document.addEventListener("input", (event) => {
    const target = event.target,
      binding = target.dataset.bind;
    if (!binding) return;
    const [key, field] = binding.split(".");
    if (field) s[key][field] = target.value;
    else s[key] = key === "limit" ? Number(target.value) : target.value;
  });
  document.addEventListener("change", async (event) => {
    const target = event.target;
    if (target.dataset.select) {
      const id = target.dataset.select;
      s.selected = s.selected.includes(id)
        ? s.selected.filter((v) => v !== id)
        : [...s.selected, id];
      render();
      document.querySelector(`[data-select="${id}"]`)?.focus();
    }
    if (target.name === "erp-file" && target.files[0] && !s.busy) {
      try {
        const parsed = JSON.parse(await target.files[0].text());
        const items = Array.isArray(parsed) ? parsed : parsed?.list;
        if (!Array.isArray(items)) throw new Error("invalid");
        persist(items, d.erpFile.source_url, new Date().toISOString());
      } catch {
        s.modalError = "ERP JSON 文件格式无效；应为 list 数组或商品数组。";
        render();
      }
    }
  });
  document.addEventListener("submit", (event) => {
    if (event.target.id === "modal-form") submit(event);
  });
  window.OP_C = { scenes, resetScene, state: () => clone(s) };
  resetScene("recommended");
})();
