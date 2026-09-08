(() => {
  const $ = (id) => document.getElementById(id);
  const task = window.SCOUTOPS_TASK_CONCEPT.task;
  const titles = {
    create: "新建任务",
    edit: "编辑任务",
    delete: "删除任务",
    pause: "暂停任务",
    cancel: "取消任务",
    delay: "调整任务期限",
    transfer: "转交任务",
    progress: "更新任务进度",
    "batch-pause": "确认批量暂停",
    "batch-resume": "确认批量继续",
    "batch-delay": "确认批量延期",
    "batch-transfer": "确认批量调整负责人",
    "batch-cancel": "确认批量取消",
  };
  const states = {
    loading: ["正在读取任务…", "读取完成后显示任务内容。"],
    error: ["任务服务暂不可用", "任务暂时无法读取，请重试。"],
    not_found: ["任务不存在或已删除", "当前任务无法读取。"],
    forbidden: ["无权访问任务", "当前访问范围无法读取该任务。"],
    expired: ["登录已失效", "当前登录状态无法继续读取任务。"],
    rate_limited: ["请求过于频繁", "请稍后重新加载。"],
  };
  let action, opener;
  const dialog = $("action-dialog");
  $("sample-title").textContent = task.title;
  $("sample-note").textContent = task.progress_note;
  const scenes = {
    board: "操作设计目录",
    ...titles,
    "progress-error": "进度 · 提交失败",
    "progress-busy": "进度 · 提交中",
    ...Object.fromEntries(Object.entries(states).map(([key, value]) => [key, value[0]])),
  };
  for (const [value, label] of Object.entries(scenes)) $("scene").add(new Option(label, value));
  const groups = [
    ["任务内容", ["create", "edit"]],
    ["单项操作", ["progress", "pause", "delay", "transfer"]],
    [
      "批量操作 · 选择当前样本 1 项",
      ["batch-pause", "batch-resume", "batch-delay", "batch-transfer", "batch-cancel"],
    ],
    ["结束与移除", ["cancel", "delete"]],
  ];
  for (const [title, actions] of groups) {
    const section = document.createElement("section");
    section.className = "action-group";
    const heading = document.createElement("h3");
    heading.textContent = title;
    section.append(heading);
    const row = document.createElement("div");
    for (const key of actions) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = titles[key];
      button.dataset.action = key;
      if (["cancel", "delete", "batch-cancel"].includes(key)) button.className = "danger";
      button.addEventListener("click", () => open(key, button));
      row.append(button);
    }
    section.append(row);
    $("launchers").append(section);
  }
  function field(name, label, type, required, value = "", maxLength, half = false) {
    const wrapper = document.createElement("label");
    if (half) wrapper.className = "half";
    const caption = document.createElement("span");
    caption.textContent = label;
    const hint = document.createElement("small");
    hint.textContent = required ? "必填" : "选填";
    caption.append(hint);
    const input = document.createElement(
      type === "textarea" ? "textarea" : type === "select" ? "select" : "input",
    );
    input.id = name;
    input.name = name;
    input.required = required;
    if (!["textarea", "select"].includes(type)) input.type = type;
    if (maxLength) input.maxLength = maxLength;
    if (name === "priority")
      for (const [v, text] of [
        ["low", "低"],
        ["normal", "普通"],
        ["high", "高"],
        ["critical", "紧急"],
      ])
        input.add(new Option(text, v));
    if (name === "assignee_id") {
      input.add(new Option("请选择当前工作区成员", ""));
      input.add(new Option("测试成员", task.assignee_id));
    }
    if (name === "progress_percent") {
      input.min = "0";
      input.max = "100";
      input.step = "1";
    }
    input.value = String(value);
    wrapper.append(caption, input);
    $("fields").append(wrapper);
  }
  function open(scene, trigger) {
    if (dialog.open) dialog.close();
    action = scene.startsWith("progress-") ? "progress" : scene;
    opener = trigger;
    const batch = action.startsWith("batch-");
    const kind = action.replace("batch-", "");
    const content = ["create", "edit"].includes(action);
    $("dialog-title").textContent = titles[action];
    $("dialog-description").textContent = content
      ? "填写任务内容，明确优先级与期限。"
      : action === "delete"
        ? "任务列表将不再显示该任务，但审计记录会保留。"
        : batch
          ? "影响范围会在执行前固定；不符合当前状态的任务不会被修改。"
          : "提交后会写入任务活动与审计记录，并使用当前任务版本进行冲突校验。";
    $("target").hidden = action === "create";
    $("target").textContent = task.title;
    $("fields").replaceChildren();
    $("impact").replaceChildren();
    $("impact").hidden = !batch;
    const eligible =
      kind === "pause"
        ? task.status === "in_progress"
        : kind === "resume"
          ? task.status === "paused"
          : !["completed", "cancelled"].includes(task.status);
    if (batch) {
      const dl = document.createElement("dl");
      for (const [label, count] of [
        ["已选择", 1],
        ["可执行", Number(eligible)],
        ["跳过", Number(!eligible)],
      ]) {
        const div = document.createElement("div"),
          dt = document.createElement("dt"),
          dd = document.createElement("dd");
        dt.textContent = label;
        dd.textContent = `${count} 项`;
        div.append(dt, dd);
        dl.append(div);
      }
      const note = document.createElement("small");
      note.textContent = `关联采集任务 ${Number(eligible && Boolean(task.collection_task_id))} 项 · 仅展示关联，不联动取消底层任务。`;
      $("impact").append(dl, note);
    }
    if (content) {
      field("title", "标题", "text", true, action === "edit" ? task.title : "", 200);
      field(
        "description",
        "说明",
        "textarea",
        false,
        action === "edit" ? task.description : "",
        5000,
      );
      field(
        "priority",
        "优先级",
        "select",
        false,
        action === "edit" ? task.priority : "normal",
        undefined,
        true,
      );
      field(
        "due_at",
        "截止时间",
        "datetime-local",
        false,
        action === "edit" ? "2026-08-09T18:00" : "",
        undefined,
        true,
      );
    } else {
      if (kind === "delay")
        field("due_at", "新截止时间", "datetime-local", true, batch ? "" : "2026-08-09T18:00");
      if (kind === "transfer")
        field(
          "assignee_id",
          batch ? "新负责人" : "接收成员",
          "select",
          true,
          batch ? "" : task.assignee_id,
        );
      if (kind === "progress") {
        field("progress_percent", "完成进度（0–100）", "number", true, task.progress_percent);
        field("progress_note", "本次进展说明", "textarea", true, task.progress_note, 500);
      } else if (kind !== "resume")
        field("reason", action === "delete" ? "删除原因" : "操作原因", "textarea", true, "", 500);
    }
    $("form-hint").textContent = content
      ? "未指定负责人时分配给当前用户；期限为空时明确显示“未设置”。"
      : batch && !eligible
        ? "当前样本为进行中，不能执行继续操作。可执行数为 0，确认按钮不可用。"
        : "请核对任务和操作范围。原因应能说明本次变更。";
    $("form-error").hidden = scene !== "progress-error";
    $("submit").className = ["delete", "cancel", "batch-cancel"].includes(action)
      ? "danger"
      : "primary";
    $("submit").disabled = scene === "progress-busy" || (batch && !eligible);
    $("submit").textContent =
      scene === "progress-busy"
        ? "正在提交…"
        : action === "create"
          ? "创建任务"
          : action === "edit"
            ? "保存修改"
            : action === "delete"
              ? "确认删除"
              : batch
                ? "确认执行"
                : "确认提交";
    $("cancel").textContent = content || action === "delete" ? "取消" : "返回";
    $("action-form").setAttribute("aria-busy", String(scene === "progress-busy"));
    dialog.showModal();
    $("fields").querySelector("input,select,textarea")?.focus({ preventScroll: true });
    if (!$("fields").children.length) $("cancel").focus({ preventScroll: true });
    dialog.querySelector(".dialog-scroll").scrollTop = 0;
  }
  function close() {
    dialog.close();
    opener?.focus({ preventScroll: true });
  }
  $("close").addEventListener("click", close);
  $("cancel").addEventListener("click", close);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const targets = [...dialog.querySelectorAll("button,input,select,textarea")].filter(
      (node) => !node.disabled && node.getClientRects().length,
    );
    if (event.shiftKey && document.activeElement === targets[0]) {
      event.preventDefault();
      targets.at(-1).focus();
    } else if (!event.shiftKey && document.activeElement === targets.at(-1)) {
      event.preventDefault();
      targets[0].focus();
    }
  });
  $("action-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if ($("submit").disabled) return;
    close();
    $("review-note").textContent =
      `${titles[action]}：仅演示校验与关闭，未请求 API、未写入任务或审计记录。`;
  });
  $("scene").addEventListener("change", () => {
    close();
    const scene = $("scene").value;
    const state = states[scene];
    $("board").hidden = Boolean(state);
    $("read-state").hidden = !state;
    if (state) {
      $("state-title").textContent = state[0];
      $("state-description").textContent = state[1];
      $("reload").hidden = scene === "loading";
      $("read-state").setAttribute("aria-busy", String(scene === "loading"));
    } else if (scene !== "board") open(scene, $("scene"));
  });
  $("reload").addEventListener("click", () => {
    $("review-note").textContent = "已演示重新加载入口；未请求 API，模拟状态不代表服务已恢复。";
  });
})();
