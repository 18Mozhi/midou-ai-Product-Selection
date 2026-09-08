const $ = (id) => document.getElementById(id);
const task = window.SCOUTOPS_TASK_CONCEPT.task;
for (const id of ["task-title", "detail-heading", "target-title"]) $(id).textContent = task.title;
for (const id of ["task-description", "detail-description"]) $(id).textContent = task.description;
$("progress-note").textContent = task.progress_note;
$("task-id").textContent = task.id;
const dialog = $("progress-dialog");
let returnFocus = null;
function closeProgress() {
  dialog.close();
  returnFocus?.focus({ preventScroll: true });
}
function openProgress(mode = "progress") {
  returnFocus = document.activeElement;
  $("progress-value").value = task.progress_percent;
  $("progress-note-input").value = task.progress_note;
  $("submit-error").hidden = mode !== "progress-error";
  $("submit-progress").disabled = mode === "progress-busy";
  $("submit-progress").textContent = mode === "progress-busy" ? "正在提交…" : "确认提交";
  dialog.setAttribute("aria-busy", String(mode === "progress-busy"));
  dialog.showModal();
  $("progress-value").focus({ preventScroll: true });
}
function renderScene(scene) {
  if (dialog.open) dialog.close();
  $("filter-disclosure").open = !matchMedia("(max-width:900px)").matches || scene === "empty";
  const detail = ["detail", "readonly", "more"].includes(scene) || scene.startsWith("progress");
  $("list-view").hidden = detail;
  $("detail-view").hidden = !detail;
  $("breadcrumb").textContent = detail ? "任务详情" : "全部任务";
  $("actions").hidden = scene === "readonly";
  $("comment-form").hidden = scene === "readonly";
  $("readonly-note").hidden = scene !== "readonly";
  document.querySelector(".create-button").hidden = scene === "readonly";
  $("more-actions").open = scene === "more";
  $("query").value = scene === "empty" ? "不存在的任务" : "";
  $("status").value = "";
  $("selected").checked = false;
  $("clear").hidden = true;
  $("batch").hidden = true;
  filter();
  if (scene.startsWith("progress")) {
    $("open-progress").focus({ preventScroll: true });
    openProgress(scene);
  }
}
function filter() {
  const query = $("query").value.trim();
  const match =
    (!$("status").value || $("status").value === task.status) &&
    `${task.title} ${task.description}`.includes(query);
  $("task-record").hidden = !match;
  $("empty").hidden = match;
  $("result").textContent = match ? "显示 1 条任务" : "没有符合条件的任务";
}
function go(scene) {
  $("scene").value = scene;
  renderScene(scene);
}
$("scene").addEventListener("change", () => renderScene($("scene").value));
$("open-detail").addEventListener("click", () => {
  go("detail");
  $("back").focus();
});
$("back").addEventListener("click", () => {
  go("list");
  $("open-detail").focus();
});
$("open-progress").addEventListener("click", () => openProgress());
$("close-progress").addEventListener("click", closeProgress);
$("cancel-progress").addEventListener("click", closeProgress);
dialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeProgress();
});
dialog.addEventListener("keydown", (event) => {
  if (event.key !== "Tab") return;
  const elements = [...dialog.querySelectorAll("button,input,textarea")].filter(
    (node) => !node.disabled,
  );
  const first = elements[0],
    last = elements.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});
$("progress-form").addEventListener("submit", (event) => {
  event.preventDefault();
  closeProgress();
  $("review-note").textContent =
    "设计演示：已完成表单校验及关闭预览；未请求 API，任务事实没有改变。";
});
$("filters").addEventListener("submit", (event) => {
  event.preventDefault();
  filter();
});
for (const id of ["reset", "empty-reset"])
  $(id).addEventListener("click", () => {
    $("query").value = "";
    $("status").value = "";
    filter();
  });
$("selected").addEventListener("change", () => {
  $("clear").hidden = !$("selected").checked;
  $("batch").hidden = !$("selected").checked;
});
$("clear").addEventListener("click", () => {
  $("selected").checked = false;
  $("clear").hidden = true;
  $("batch").hidden = true;
});
$("comment-form").addEventListener("submit", (event) => {
  event.preventDefault();
  $("review-note").textContent = "设计范围提示：评论写入仍由原 Vue/API 承担，本提案不添加活动。";
});
for (const button of document.querySelectorAll("[data-deferred]"))
  button.addEventListener("click", () => {
    $("review-note").textContent =
      `设计范围提示：${button.dataset.deferred}仅保留真实入口，独立表单在后续图稿补齐；没有执行业务操作。`;
  });
go("list");
