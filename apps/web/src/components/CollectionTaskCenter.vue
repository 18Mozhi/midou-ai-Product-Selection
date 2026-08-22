<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ApiClientError, createApiClient } from "../api-client";
import UiStatePanel from "./UiStatePanel.vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import ResponsiveDataView from "./ResponsiveDataView.vue";
import "../collection-tasks.css";
import "../collection-task-detail.css";

type ViewState = "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
interface Task {
  id: string;
  organization_id: string;
  workspace_id: string;
  request_id: string;
  status: string;
  coverage_status: string | null;
  priority: string;
  attempt_count: number;
  available_at: string;
  successful_subquery_count: number;
  failed_subquery_count: number;
  blocked_subquery_count: number;
  available_result_count: number;
  missing_fields: string[];
  last_error_code: string | null;
  updated_at: string;
}
interface Detail {
  task: Task;
  subqueries: Array<{
    id: string;
    provider_name: string;
    is_required: boolean;
    status: string;
    available_result_count: number;
    missing_fields: string[];
    error_code: string | null;
    result_kind: "empty_success" | "no_new_content" | "parse_failed" | null;
    robots_decision: {
      decision_version: string;
      allowed: boolean;
      decision_basis: string;
      robots_url: string;
      robots_http_status: number;
      matched_user_agent: string | null;
      matched_rule: {
        directive: "allow" | "disallow";
        pattern_preview: string;
        pattern_sha256: string;
        truncated: boolean;
      } | null;
    } | null;
    retryable: boolean;
    started_at: string | null;
    finished_at: string | null;
  }>;
  attempts: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  dead_letter: Record<string, unknown> | null;
}

const props = defineProps<{ apiBaseUrl: string }>();
const request = createApiClient(props.apiBaseUrl);
const state = ref<ViewState>("loading"),
  tasks = ref<Task[]>([]),
  detail = ref<Detail | null>(null),
  requestId = ref(""),
  status = ref("all"),
  query = ref(""),
  page = ref(1),
  total = ref(0),
  detailLoading = ref(false),
  confirming = ref(false),
  replayReason = ref(""),
  notice = ref(""),
  saving = ref(false);
const filtered = computed(() =>
  tasks.value.filter(
    (item) =>
      !query.value ||
      [item.id, item.organization_id, item.workspace_id, item.last_error_code].some((value) =>
        value?.toLowerCase().includes(query.value.toLowerCase()),
      ),
  ),
);
const metrics = computed(() => ({
  active: tasks.value.filter((item) =>
    [
      "scheduled",
      "queued",
      "leased",
      "running",
      "parsing",
      "validating",
      "persisted",
      "retry_scheduled",
      "rate_limited",
    ].includes(item.status),
  ).length,
  warnings: tasks.value.filter((item) => item.status === "completed_with_warnings").length,
  blocked: tasks.value.filter(
    (item) =>
      item.status.startsWith("blocked_") ||
      item.status === "dead_letter" ||
      item.status === "failed_terminal",
  ).length,
  evidence: tasks.value.reduce((sum, item) => sum + item.available_result_count, 0),
}));
const failure = (code: number): ViewState =>
  code === 401
    ? "expired"
    : code === 403
      ? "forbidden"
      : [408, 425, 429, 502, 503, 504].includes(code)
        ? "blocked"
        : "error";
const time = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
const cell = (value: unknown) =>
  value == null ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value);
const label = (value: string | null) =>
  value
    ? ({
        scheduled: "待调度",
        queued: "已排队",
        leased: "已租约",
        running: "执行中",
        parsing: "解析中",
        validating: "校验中",
        persisted: "已持久化",
        retry_scheduled: "等待重试",
        blocked_login: "登录受阻",
        blocked_captcha: "验证码受阻",
        blocked_robots: "网站规则限制",
        rate_limited: "限流等待",
        succeeded: "成功",
        succeeded_empty: "无可用结果",
        completed_with_warnings: "部分完成",
        failed_terminal: "终止失败",
        dead_letter: "死信",
        manually_replayed: "已人工重放",
        automatically_replayed: "凭证续期后已自动重放",
        complete: "完整",
        partial: "部分",
        insufficient: "不足",
      }[value] ?? value)
    : "待计算";
const subqueryRetryText = (task: Task, retryable: boolean) => {
  if (!retryable) return "该错误不自动重试";
  if (!["retry_scheduled", "rate_limited"].includes(task.status)) return "尚未安排下次重试";
  return `下次重试 ${time(task.available_at)}（任务级调度）`;
};
const resultKindText = (value: Detail["subqueries"][number]["result_kind"]) =>
  value === "empty_success"
    ? "空成功：来源响应有效，但没有可解析条目"
    : value === "no_new_content"
      ? "无新内容：本次结果均已存在，未重复写入"
      : value === "parse_failed"
        ? "解析失败：来源载荷未通过当前解析合同"
        : "";
const robotsDecisionText = (value: NonNullable<Detail["subqueries"][number]["robots_decision"]>) =>
  value.matched_rule
    ? `${value.allowed ? "允许" : "禁止"} · ${value.matched_rule.directive === "allow" ? "Allow" : "Disallow"} ${value.matched_rule.pattern_preview}${value.matched_rule.truncated ? "…" : ""}`
    : value.decision_basis === "missing_robots"
      ? "允许 · 来源未提供 robots.txt"
      : value.decision_basis === "http_status"
        ? `禁止 · robots.txt 返回 HTTP ${value.robots_http_status}`
        : "允许 · 没有命中限制规则";
const subqueryDurationText = (startedAt: string | null, finishedAt: string | null) => {
  if (!startedAt) return "尚未开始";
  if (!finishedAt) return `执行中 · ${time(startedAt)} 开始`;
  const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(durationMs) || durationMs < 0) return "耗时不可用";
  const seconds = Math.round(durationMs / 1000);
  if (seconds < 60) return `耗时 ${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `耗时 ${minutes} 分 ${remainingSeconds} 秒`;
};
const recoveryAction = computed(() => {
  const task = detail.value?.task;
  if (!task) return null;
  if (task.status === "dead_letter")
    return {
      kind: "replay" as const,
      label: "填写原因并重放",
      description: "确认来源恢复后创建新任务；原任务和全部尝试记录保留。",
    };
  if (["blocked_login", "blocked_captcha"].includes(task.status))
    return {
      kind: "link" as const,
      to: "/platform-admin/credentials",
      label: "检查网页登录",
      description: "更新或验证受控浏览器档案后，再回到任务查看恢复结果。",
    };
  if (task.status === "blocked_robots" || task.last_error_code === "source_changed")
    return {
      kind: "link" as const,
      to: "/platform-admin/providers/sources",
      label: "检查来源设置",
      description: "核对来源规则、页面变化和当前启用状态。",
    };
  if (["failed_terminal", "completed_with_warnings"].includes(task.status))
    return {
      kind: "link" as const,
      to: "/platform-admin/collection/overview",
      label: "查看根因与来源健康",
      description: "按真实错误根因继续下钻，不覆盖当前失败记录。",
    };
  return null;
});
async function load() {
  state.value = "loading";
  notice.value = "";
  const params = new URLSearchParams({
    page: String(page.value),
    page_size: "50",
  });
  if (status.value !== "all") params.set("status", status.value);
  try {
    const response = await request<Task[]>(`/platform/collection/tasks?${params}`);
    requestId.value = response.request_id;
    tasks.value = response.data ?? [];
    total.value = (response.meta as { total?: number } | undefined)?.total ?? tasks.value.length;
    state.value = tasks.value.length ? "ready" : "empty";
  } catch (error) {
    const apiError = error instanceof ApiClientError ? error : null;
    requestId.value = apiError?.requestId ?? "";
    state.value = apiError ? failure(apiError.status) : "blocked";
  }
}
async function openTask(id: string) {
  detailLoading.value = true;
  try {
    const response = await request<Detail>(`/platform/collection/tasks/${id}`);
    requestId.value = response.request_id;
    detail.value = response.data;
  } catch (error) {
    const apiError = error instanceof ApiClientError ? error : null;
    requestId.value = apiError?.requestId ?? requestId.value;
    notice.value = apiError?.actionHint ?? "任务详情依赖暂不可用";
  } finally {
    detailLoading.value = false;
  }
}
async function replay() {
  if (!detail.value) return;
  saving.value = true;
  try {
    const response = await request<Detail>(
      `/platform/collection/tasks/${detail.value.task.id}/replay`,
      { method: "POST", body: { reason: replayReason.value.trim() } },
    );
    requestId.value = response.request_id;
    const successNotice = `已创建重放任务 ${response.data.task.id.slice(0, 8)}…，原任务与全部尝试记录已保留。`;
    detail.value = response.data;
    replayReason.value = "";
    await load();
    notice.value = successNotice;
  } catch (error) {
    const apiError = error instanceof ApiClientError ? error : null;
    requestId.value = apiError?.requestId ?? requestId.value;
    notice.value = apiError?.actionHint ?? "依赖不可用，未执行重放";
  } finally {
    saving.value = false;
    confirming.value = false;
  }
}
onMounted(async () => {
  await load();
  const taskId = new URLSearchParams(window.location.search).get("task");
  if (taskId && /^[0-9a-f-]{36}$/i.test(taskId)) await openTask(taskId);
});
</script>

<template>
  <section class="collection-task-center" aria-labelledby="collection-task-title">
    <header class="collection-task-title">
      <div>
        <p>平台采集任务中心</p>
        <h2 id="collection-task-title">采集任务监控</h2>
        <span>集中查看任务进度、来源覆盖、失败原因和重试记录；每个任务都可以展开详情。</span>
      </div>
      <RouterLink to="/platform-admin/collection/browser-runtime">浏览器运行时</RouterLink>
    </header>
    <UiStatePanel v-if="state !== 'ready'" :kind="state" :request-id="requestId" @primary="load" />
    <template v-else>
      <div class="collection-task-metrics">
        <article>
          <small>处理中</small><strong>{{ metrics.active }}</strong
          ><span>排队、执行与重试</span>
        </article>
        <article>
          <small>部分完成</small><strong>{{ metrics.warnings }}</strong
          ><span>仍有可用证据</span>
        </article>
        <article>
          <small>受阻 / 死信</small><strong>{{ metrics.blocked }}</strong
          ><span>不会绕过来源限制</span>
        </article>
        <article>
          <small>可用结果</small><strong>{{ metrics.evidence }}</strong
          ><span>当前页合计</span>
        </article>
      </div>
      <section class="collection-task-table-card">
        <header>
          <div>
            <h3>任务队列</h3>
            <span>{{ notice || `共 ${total} 个任务；覆盖不足不会自动给出推荐结论。` }}</span>
          </div>
          <div>
            <input
              v-model="query"
              aria-label="搜索采集任务"
              placeholder="任务 / 组织 / 工作区 / 错误码"
            /><select v-model="status" aria-label="采集任务状态" @change="load">
              <option value="all">全部状态</option>
              <option value="running">执行中</option>
              <option value="retry_scheduled">等待重试</option>
              <option value="completed_with_warnings">部分完成</option>
              <option value="dead_letter">死信</option>
              <option value="succeeded">成功</option>
            </select>
          </div>
        </header>
        <ResponsiveDataView
          :rows="filtered"
          :row-key="(item) => item.id"
          title="采集任务队列"
          :detail-title="(item) => `${label(item.status)} · ${time(item.updated_at)}`"
        >
          <template #desktop>
            <table>
              <thead>
                <tr>
                  <th>任务</th>
                  <th>范围</th>
                  <th>状态 / 覆盖</th>
                  <th>子查询</th>
                  <th>证据</th>
                  <th>更新时间</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in filtered" :key="item.id">
                  <td>
                    <strong>采集任务</strong
                    ><small>{{ item.priority }} · 第 {{ item.attempt_count }} 次</small>
                  </td>
                  <td><span>已绑定组织与工作区</span></td>
                  <td>
                    <b :data-status="item.status">{{ label(item.status) }}</b
                    ><small>{{ label(item.coverage_status) }}</small>
                  </td>
                  <td>
                    {{ item.successful_subquery_count }} 成功<small
                      >{{ item.failed_subquery_count }} 失败 ·
                      {{ item.blocked_subquery_count }} 受阻</small
                    >
                  </td>
                  <td>
                    {{ item.available_result_count }} 条<small>{{
                      item.missing_fields.length
                        ? `缺 ${item.missing_fields.join("、")}`
                        : "字段完整"
                    }}</small>
                  </td>
                  <td>
                    {{ time(item.updated_at) }}<small>{{ item.last_error_code || "无错误" }}</small>
                  </td>
                  <td>
                    <button type="button" @click="openTask(item.id)">查看</button>
                  </td>
                </tr>
                <tr v-if="!filtered.length">
                  <td colspan="7">当前筛选没有任务记录。</td>
                </tr>
              </tbody>
            </table>
          </template>
          <template #summary="{ row }">
            <span class="responsive-record-summary">
              <strong>{{ label(row.status) }} · {{ row.available_result_count }} 条证据</strong>
              <small>{{ label(row.coverage_status) }} · {{ time(row.updated_at) }}</small>
            </span>
          </template>
          <template #detail="{ row, close }">
            <dl>
              <div>
                <dt>状态 / 覆盖</dt>
                <dd>{{ label(row.status) }} · {{ label(row.coverage_status) }}</dd>
              </div>
              <div>
                <dt>子查询</dt>
                <dd>
                  {{ row.successful_subquery_count }} 成功 · {{ row.failed_subquery_count }} 失败 ·
                  {{ row.blocked_subquery_count }} 受阻
                </dd>
              </div>
              <div>
                <dt>可用证据</dt>
                <dd>{{ row.available_result_count }} 条</dd>
              </div>
              <div>
                <dt>缺失字段</dt>
                <dd>
                  {{ row.missing_fields.length ? row.missing_fields.join("、") : "字段完整" }}
                </dd>
              </div>
              <div>
                <dt>更新时间</dt>
                <dd>{{ time(row.updated_at) }}</dd>
              </div>
            </dl>
            <button
              type="button"
              @click="
                close();
                openTask(row.id);
              "
            >
              打开完整任务详情
            </button>
            <details>
              <summary>技术详情</summary>
              <dl>
                <div>
                  <dt>任务 ID</dt>
                  <dd>{{ row.id }}</dd>
                </div>
                <div>
                  <dt>组织 ID</dt>
                  <dd>{{ row.organization_id }}</dd>
                </div>
                <div>
                  <dt>工作区 ID</dt>
                  <dd>{{ row.workspace_id }}</dd>
                </div>
                <div>
                  <dt>错误码</dt>
                  <dd>{{ row.last_error_code || "—" }}</dd>
                </div>
                <div>
                  <dt>请求 ID</dt>
                  <dd>{{ row.request_id }}</dd>
                </div>
              </dl>
            </details>
          </template>
        </ResponsiveDataView>
      </section>
      <aside v-if="detail || detailLoading" class="collection-task-detail" aria-live="polite">
        <p v-if="detailLoading">正在读取任务详情…</p>
        <template v-else-if="detail"
          ><header>
            <div>
              <p>采集任务详情</p>
              <h3>{{ detail.task.id }}</h3>
              <span>关联编号 {{ detail.task.request_id }}</span>
            </div>
            <button
              type="button"
              aria-label="关闭任务详情"
              title="关闭任务详情"
              @click="detail = null"
            >
              ×
            </button>
          </header>
          <div class="collection-detail-summary">
            <article>
              <small>状态</small><strong>{{ label(detail.task.status) }}</strong>
            </article>
            <article>
              <small>覆盖</small><strong>{{ label(detail.task.coverage_status) }}</strong>
            </article>
            <article>
              <small>尝试</small><strong>{{ detail.attempts.length }}</strong>
            </article>
            <article>
              <small>事件</small><strong>{{ detail.events.length }}</strong>
            </article>
          </div>
          <section v-if="recoveryAction" class="collection-recovery" aria-label="建议恢复动作">
            <div>
              <small>下一步</small>
              <strong>{{ recoveryAction.label }}</strong>
              <span>{{ recoveryAction.description }}</span>
            </div>
            <a v-if="recoveryAction.kind === 'replay'" href="#collection-replay">进入重放</a>
            <RouterLink v-else :to="recoveryAction.to">{{ recoveryAction.label }}</RouterLink>
          </section>
          <section>
            <h4>子查询覆盖</h4>
            <article v-for="item in detail.subqueries" :key="item.id" class="collection-subquery">
              <div>
                <strong>{{ item.provider_name }}</strong
                ><small>{{ item.is_required ? "必需来源" : "可选来源" }}</small>
              </div>
              <b :data-status="item.status">{{ label(item.status) }}</b
              ><span class="collection-subquery-result"
                >结果 {{ item.available_result_count }} 条 ·
                {{ subqueryDurationText(item.started_at, item.finished_at) }} ·
                {{ item.error_code || "无错误" }}</span
              ><small class="collection-subquery-missing">{{
                item.missing_fields.length ? `缺失 ${item.missing_fields.join("、")}` : "无缺失字段"
              }}</small
              ><small v-if="item.result_kind" class="collection-subquery-kind">{{
                resultKindText(item.result_kind)
              }}</small>
              <details v-if="item.robots_decision" class="collection-subquery-policy">
                <summary>robots 判定：{{ robotsDecisionText(item.robots_decision) }}</summary>
                <small
                  >判定版本 {{ item.robots_decision.decision_version }} · User-agent
                  {{ item.robots_decision.matched_user_agent || "未命中分组" }}</small
                >
              </details>
              ><small class="collection-subquery-retry">{{
                subqueryRetryText(detail.task, item.retryable)
              }}</small>
            </article>
          </section>
          <section class="collection-detail-history">
            <h4>执行尝试</h4>
            <div v-if="!detail.attempts.length" class="collection-detail-empty">尚无执行尝试。</div>
            <article v-for="(item, index) in detail.attempts" :key="cell(item.id) || index">
              <strong
                >第 {{ cell(item.attempt_number) || index + 1 }} 次 ·
                {{ label(cell(item.status)) }}</strong
              ><span
                >执行器 {{ cell(item.worker_id || item.lease_owner) }} · 开始
                {{ cell(item.started_at) }} · 完成 {{ cell(item.finished_at) }}</span
              ><small>{{ cell(item.error_code || "无错误") }}</small>
            </article>
          </section>
          <section class="collection-detail-history">
            <h4>状态事件</h4>
            <div v-if="!detail.events.length" class="collection-detail-empty">尚无状态事件。</div>
            <article v-for="(item, index) in detail.events" :key="cell(item.id) || index">
              <strong
                >{{ cell(item.event_type) }} · {{ label(cell(item.from_status)) }} →
                {{ label(cell(item.to_status)) }}</strong
              ><span
                >{{ cell(item.actor_type) }} · {{ cell(item.actor_id) }} ·
                {{ cell(item.occurred_at) }}</span
              >
            </article>
          </section>
          <section class="collection-detail-history">
            <h4>死信记录</h4>
            <div v-if="!detail.dead_letter" class="collection-detail-empty">
              该任务没有死信记录。
            </div>
            <article v-else>
              <strong>{{ cell(detail.dead_letter.error_code || detail.dead_letter.status) }}</strong
              ><span
                >进入死信：{{
                  cell(detail.dead_letter.created_at || detail.dead_letter.updated_at)
                }}</span
              ><small>{{ cell(detail.dead_letter) }}</small>
            </article>
          </section>
          <footer v-if="detail.task.status === 'dead_letter'" id="collection-replay">
            <label
              >人工重放原因<textarea
                v-model="replayReason"
                rows="3"
                maxlength="500"
                placeholder="说明恢复条件和重放原因（2–500 字）"
              ></textarea></label
            ><button
              type="button"
              :disabled="replayReason.trim().length < 2 || saving"
              @click="confirming = true"
            >
              人工重放
            </button>
          </footer></template
        >
      </aside>
    </template>
    <ConfirmDialog
      :open="confirming"
      title="重放这个死信任务？"
      description="将复制原任务的内部子查询，创建一个新的 scheduled 任务；原任务改为 manually_replayed。"
      impact="原任务、全部尝试、死信与审计事件都会保留，不会覆盖历史结果。"
      confirm-label="确认重放"
      confirmation-text="确认重放"
      @cancel="confirming = false"
      @confirm="replay"
    />
  </section>
</template>
