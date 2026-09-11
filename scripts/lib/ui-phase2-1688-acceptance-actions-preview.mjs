import assert from "node:assert/strict";
import { previewAlibaba1688AcceptanceReadStates } from "./ui-phase2-1688-acceptance-read-states-preview.mjs";

const startAnchor = `        <section class="acceptance-1688__start" aria-labelledby="acceptance-1688-start-title">`;
const endAnchor = `

        <div class="p49-acceptance__diagnostics">`;

const actionSection = `        <section class="acceptance-1688__start p49-action" aria-labelledby="acceptance-1688-start-title">
          <header>
            <div>
              <p>03 / 受控运行</p>
              <h3 id="acceptance-1688-start-title">发起一次真实登录验收</h3>
            </div>
            <small>只创建本次人工验收；不会启用来源或加入自动调度。</small>
          </header>

          <p id="p49-run-requirements" class="p49-action__requirements">
            选择活动组织、工作区并填写验收关键词后可以提交。
          </p>

          <form @submit.prevent="scheduleAcceptanceRun">
            <label>
              <span>组织</span>
              <select
                v-model="selectedOrganizationId"
                aria-label="组织"
                :aria-describedby="scopeMessage && !selectedOrganizationId ? 'p49-scope-message' : undefined"
                :aria-invalid="scopeMessage && !selectedOrganizationId ? 'true' : undefined"
                :disabled="scopeLoading || scheduling"
                @change="loadWorkspaces"
              >
                <option value="">请选择组织</option>
                <option v-for="organization in organizations" :key="organization.id" :value="organization.id">
                  {{ organization.name }}
                </option>
              </select>
            </label>
            <label>
              <span>工作区</span>
              <select
                v-model="selectedWorkspaceId"
                aria-label="工作区"
                :aria-describedby="scopeMessage && selectedOrganizationId && !selectedWorkspaceId ? 'p49-scope-message' : undefined"
                :aria-invalid="scopeMessage && selectedOrganizationId && !selectedWorkspaceId ? 'true' : undefined"
                :disabled="scopeLoading || scheduling"
              >
                <option value="">请选择工作区</option>
                <option v-for="workspace in workspaces" :key="workspace.id" :value="workspace.id">
                  {{ workspace.name }}
                </option>
              </select>
            </label>
            <label class="acceptance-1688__query">
              <span>验收关键词</span>
              <input
                v-model="acceptanceQuery"
                type="text"
                aria-label="验收关键词"
                :aria-describedby="scopeMessage && canSchedule ? 'p49-query-help p49-submit-message' : 'p49-query-help'"
                :aria-invalid="scopeMessage && canSchedule ? 'true' : undefined"
                maxlength="200"
                autocomplete="off"
                placeholder="例如：桌面灯"
                :disabled="scheduling"
              />
              <small id="p49-query-help">关键词只用于这一次真实浏览器验收。</small>
            </label>
            <button
              class="acceptance-1688__start-button"
              type="submit"
              aria-describedby="p49-run-requirements"
              :disabled="!canSchedule"
            >
              {{ scheduling ? "提交中…" : "发起登录验收运行" }}
            </button>
          </form>

          <p v-if="scopeLoading" class="p49-action__progress" role="status" aria-live="polite">
            正在读取可用执行范围…
          </p>
          <p v-if="scheduling" class="p49-action__progress" role="status" aria-live="polite">
            正在创建一次受控验收运行，请稍候。
          </p>

          <section
            v-if="scopeMessage && !canSchedule"
            id="p49-scope-message"
            class="p49-action__feedback"
            data-kind="scope"
            role="alert"
            aria-labelledby="p49-scope-message-title"
          >
            <div>
              <span>执行范围</span>
              <strong id="p49-scope-message-title">当前还不能选择完整执行范围</strong>
              <p>{{ scopeMessage }}</p>
            </div>
            <button type="button" :disabled="scopeLoading || scheduling" @click="loadExecutionScopes">
              {{ scopeLoading ? "重新读取中…" : "重新读取执行范围" }}
            </button>
          </section>

          <section
            v-if="scopeMessage && canSchedule"
            id="p49-submit-message"
            class="p49-action__feedback"
            data-kind="submit"
            role="alert"
            aria-labelledby="p49-submit-message-title"
          >
            <div>
              <span>提交未完成</span>
              <strong id="p49-submit-message-title">本次验收没有提交</strong>
              <p>{{ scopeMessage }}</p>
            </div>
            <p>检查执行范围后，可以再次使用上方按钮提交。</p>
          </section>

          <section
            v-if="scheduledTaskId"
            class="p49-action__result"
            role="status"
            aria-live="polite"
            aria-labelledby="p49-task-created-title"
          >
            <div>
              <span>任务已创建</span>
              <strong id="p49-task-created-title">验收任务已进入队列</strong>
              <p>任务已经创建，但这不代表运行完成或来源已启用。</p>
            </div>
            <aside v-if="message" class="p49-action__result-warning">
              <strong>任务已提交，但最新检查结果没有刷新</strong>
              <p>{{ message }}</p>
            </aside>
            <details>
              <summary>查看任务编号</summary>
              <code>任务编号：{{ scheduledTaskId }}</code>
            </details>
          </section>
        </section>`;

export const acceptanceActionCopy = {
  requirements: "选择活动组织、工作区并填写验收关键词后可以提交。",
  scopeFailure: "当前还不能选择完整执行范围",
  submitFailure: "本次验收没有提交",
  taskCreated: "验收任务已进入队列",
  taskBoundary: "任务已经创建，但这不代表运行完成或来源已启用。",
  rereadFailure: "任务已提交，但最新检查结果没有刷新",
  rereadPreserved: "最新检查结果未刷新",
};

export function previewAlibaba1688AcceptanceActions(source) {
  let review = previewAlibaba1688AcceptanceReadStates(source);
  review = review
    .replace(
      ':data-tone="noticeTone"',
      ":data-tone=\"scheduledTaskId && message ? 'danger' : noticeTone\"",
    )
    .replace(
      '<span>{{ noticeTone === "danger" ? "刷新未完成" : "刷新完成" }}</span>',
      '<span>{{ scheduledTaskId && message ? "任务已提交" : noticeTone === "danger" ? "刷新未完成" : "刷新完成" }}</span>',
    )
    .replace(
      '<strong>{{ noticeTone === "danger" ? "仍显示上次读取的启用条件" : "已显示最新启用条件" }}</strong>',
      '<strong>{{ scheduledTaskId && message ? "最新检查结果未刷新" : noticeTone === "danger" ? "仍显示上次读取的启用条件" : "已显示最新启用条件" }}</strong>',
    )
    .replace(
      "<p>{{ notice }}</p>",
      '<p>{{ scheduledTaskId && message ? "验收任务已进入队列；下方仍显示提交前成功读取的启用条件。" : notice }}</p>',
    )
    .replace(
      "v-if=\"noticeTone === 'danger'\"",
      "v-if=\"noticeTone === 'danger' || (scheduledTaskId && message)\"",
    );
  const start = review.indexOf(startAnchor),
    end = review.indexOf(endAnchor, start);
  assert.ok(start >= 0 && end > start, "P49 action-section boundaries");
  assert.equal(review.indexOf(startAnchor, start + 1), -1, "one P49 action section");
  return review.slice(0, start) + actionSection + review.slice(end);
}
