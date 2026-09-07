window.addEventListener("DOMContentLoaded", () => {
  const data = window.SCOUTOPS_DIRECTION_REVIEW;
  const $ = (id) => document.getElementById(id);
  const labels = {
    tasks: "任务列表与详情",
    rules: "评分规则",
    roles: "组织权限",
    status: "系统状态与恢复",
    controls: "按钮六态",
    accounts: "用户管理",
  };
  const directions = { focus: "A · 专注工位", brief: "B · 工作简报", clear: "C · 清晰目录" };
  const states = {
    list: "任务列表",
    detail: "对象详情",
    progress: "进度弹窗",
    overview: "目录总览",
    create: "新建表单",
    "create-middle": "新建表单 · 中段",
    "create-bottom": "新建表单 · 底部",
    preview: "影响预览",
    submit: "提交原因",
    "submit-feedback": "提交预演反馈",
    grants: "资源授权",
    grant: "新增授权",
    "grant-bottom": "授权表单 · 底部",
    revoke: "撤销原因",
    "refresh-failed": "刷新失败",
    "refresh-recovered": "读取恢复",
    "six-states": "四类按钮 × 六态",
    directory: "用户目录",
    "create-error": "创建失败",
    reason: "操作原因",
    password: "强制改密",
    membership: "加入组织",
    empty: "无搜索结果",
    "detail-access": "详情 · 访问管理",
  };
  const notes = {
    tasks: "对照任务信息顺序和详情关系；原型仅用一条任务，不能用更少数据推断效率提高。",
    rules: "比较规则目录、权重与阈值、预览和提交的阅读顺序；不改变计算和审批规则。",
    roles: "比较角色矩阵与资源授权的分区；角色能力不是可随意勾选修改的开关。",
    status: "比较异常优先级、观测时间和恢复路径；读取恢复不代表依赖故障已修复。",
    controls: "按钮板是带标签的视觉六态示意，不代表全站每个业务按钮已通过测试。",
    accounts:
      "C 仅覆盖 P43。身份与组织访问分区、独立授权弹窗是待审提议；不能与 A/B 其他页面当同页比较。",
  };
  function options(id, values, names) {
    const previous = $(id).value;
    $(id).replaceChildren(...values.map((value) => new Option(names[value] || value, value)));
    if (values.includes(previous)) $(id).value = previous;
  }
  options("surface", Object.keys(labels), labels);
  $("surface").value = "accounts";
  if (matchMedia("(max-width: 800px)").matches) $("viewport").value = "390";
  $("version").textContent = `${data.version} · ${data.fingerprint.slice(0, 12)}`;
  for (const source of data.sources) {
    const li = document.createElement("li");
    li.textContent = `${source.label}：${source.changes.length ? "来源变化，待重新核对：" + source.changes.join("；") : "所列来源哈希一致"}。图片与原记录哈希一致，仍未获用户批准。`;
    $("source-status").append(li);
  }
  let renderId = 0;
  let selected;
  function setImage(id, record, title, currentId) {
    const img = $(id + "-image");
    const link = $(id + "-original");
    img.hidden = link.hidden = !record;
    if (!record) {
      img.removeAttribute("src");
      link.removeAttribute("href");
      return;
    }
    img.alt = title;
    img.dataset.width = String(record.width);
    img.onload = () => {
      if (currentId === renderId && id === "new")
        $("image-status").textContent = `${title} · 已加载 / 待审核`;
    };
    img.onerror = () => {
      if (currentId === renderId)
        $("image-status").textContent = `${title} · 图片读取失败，请勿据此审核`;
    };
    img.src = record.file;
    link.href = record.file;
  }
  function render() {
    selected = data.shots.find(
      (shot) =>
        shot.surface === $("surface").value &&
        shot.direction === $("direction").value &&
        shot.state === $("scene").value &&
        shot.width === Number($("viewport").value),
    );
    if (!selected) throw new Error("Missing review scene");
    const title = `${labels[selected.surface]} · ${directions[selected.direction]} · ${states[selected.state]} · ${selected.width}px`;
    const currentId = ++renderId;
    $("comparison-note").textContent = notes[selected.surface];
    $("image-status").textContent = `${title} · 正在加载`;
    setImage("new", selected, title + "；独立研究图，非生产", currentId);
    setImage(
      "old",
      selected.baseline,
      "历史 Vue · " + title + "对应场景；隔离数据，非当前生产",
      currentId,
    );
    $("old-missing").hidden = Boolean(selected.baseline);
    const source = data.sources.find((item) => item.id === selected.source);
    $("new-evidence").textContent =
      `${selected.pageId} · 采图 ${selected.capturedAt} · ${source.changes.length ? "来源变化，待复核" : "所列来源一致，仍待审核"} · SHA256 ${selected.sha256}`;
    $("old-evidence").textContent = selected.baseline
      ? `历史采图 ${selected.baseline.capturedAt} · 原提交 ${selected.baseline.revision} · 只作结构对照，不证明当前版本通过`
      : "未匹配历史图；不计为缺失业务能力，也不算完成验收。";
    $("reply-label").hidden = true;
    $("reply").value = "";
    $("feedback-status").textContent = "";
    $("decision").value = "";
    $("notes").value = "";
  }
  function surfaceChanged() {
    const shots = data.shots.filter((shot) => shot.surface === $("surface").value);
    options("direction", [...new Set(shots.map((shot) => shot.direction))], directions);
    options("scene", [...new Set(shots.map((shot) => shot.state))], states);
    render();
  }
  $("review-controls").addEventListener("submit", (event) => event.preventDefault());
  $("surface").addEventListener("change", surfaceChanged);
  for (const id of ["direction", "scene", "viewport"]) $(id).addEventListener("change", render);
  $("feedback-form").addEventListener("submit", (event) => {
    event.preventDefault();
    $("reply").value =
      `审核版本：${data.version} / ${data.fingerprint}\n当前图：${selected.pageId} / ${directions[selected.direction]} / ${states[selected.state]} / ${selected.width}px\n意见：${$("decision").value}\n补充：${$("notes").value.trim() || "无"}\n仅方向意见；不代表全站逐页签收、业务规则批准或生产发布授权。`;
    $("reply-label").hidden = false;
    $("reply").focus();
    $("reply").select();
    $("feedback-status").textContent = "回复文本已生成，尚未发送或保存。请复制后回复当前任务。";
  });
  surfaceChanged();
});
