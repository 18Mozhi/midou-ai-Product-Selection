<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ApiClientError, createApiClient, rethrowUnexpectedError } from "../api-client";
import { useModalDialog } from "../use-modal-dialog";
import ApprovalQueuePanel from "./ApprovalQueuePanel.vue";
import type {
  ApprovalItem,
  ApprovalMemberOption,
  ApprovalRequestForm,
  ApprovalTemplate,
  ApprovalTemplateForm,
  ApprovalViewState,
} from "./approval-workspace-types";
import "../approval-workspace.css";
const props = defineProps<{ apiBaseUrl: string; capabilities?: string[] }>(),
  route = useRoute(),
  router = useRouter(),
  request = createApiClient(props.apiBaseUrl),
  state = ref<ApprovalViewState>("loading"),
  approvals = ref<ApprovalItem[]>([]),
  templates = ref<ApprovalTemplate[]>([]),
  memberOptions = ref<ApprovalMemberOption[]>([]),
  selected = ref<ApprovalItem | null>(null),
  detailBusy = ref(false),
  detailNotice = ref(""),
  queue = ref<"decidable" | "requested">(
    route.query.view === "requested" ? "requested" : "decidable",
  ),
  filter = ref(
    ["pending", "approved", "rejected", "cancelled", ""].includes(String(route.query.status ?? ""))
      ? String(route.query.status ?? "pending")
      : "pending",
  ),
  page = ref(Math.max(1, Number(route.query.page) || 1)),
  total = ref(0),
  notice = ref(""),
  requestId = ref(""),
  reason = ref(""),
  busy = ref(false),
  showTemplate = ref(false),
  showRequest = ref(false),
  publishTarget = ref<ApprovalTemplate | null>(null),
  publishReason = ref(""),
  templateForm = ref<ApprovalTemplateForm>({
    name: "",
    resource_type: "task",
    node_name: "",
    approver_id: "",
    sla_minutes: 60,
    escalation_assignee_id: "",
  }),
  requestForm = ref<ApprovalRequestForm>({
    template_id: "",
    resource_type: "task",
    resource_id: "",
    title: "",
  });
const { dialogElement: templateDialogElement, handleCancel: handleTemplateCancel } = useModalDialog(
    () => showTemplate.value,
    () => (showTemplate.value = false),
  ),
  { dialogElement: requestDialogElement, handleCancel: handleRequestCancel } = useModalDialog(
    () => showRequest.value,
    () => (showRequest.value = false),
  ),
  { dialogElement: publishDialogElement, handleCancel: handlePublishCancel } = useModalDialog(
    () => Boolean(publishTarget.value),
    () => {
      publishTarget.value = null;
      publishReason.value = "";
    },
  );
const canManage = computed(() => props.capabilities?.includes("task:assign") ?? false),
  mineCount = computed(() => approvals.value.filter((x) => x.can_decide).length),
  overdueCount = computed(
    () =>
      approvals.value.filter(
        (x) => x.status === "pending" && x.due_at && new Date(x.due_at) < new Date(),
      ).length,
  ),
  published = computed(() => templates.value.filter((x) => x.status === "published")),
  pageSize = 20,
  pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize))),
  notificationReturn = computed(() => {
    const value = typeof route.query.from === "string" ? route.query.from : "";
    return value === "/notifications" || value.startsWith("/notifications?") ? value : "";
  }),
  selectedTemplate = computed(() =>
    published.value.find((item) => item.id === requestForm.value.template_id),
  ),
  focusSummary = computed(() => {
    if (overdueCount.value > 0)
      return {
        tone: "danger",
        eyebrow: "立即处理",
        title: `${overdueCount.value} 个审批节点已经超时`,
        detail: "先核对升级后的当前审批人与证据变化，再记录批准或驳回原因。",
      };
    if (mineCount.value > 0)
      return {
        tone: "active",
        eyebrow: "需要判断",
        title: `${mineCount.value} 个审批正在等待你`,
        detail: "打开首项，先看影响范围、当前节点和证据变化，再作决定。",
      };
    return {
      tone: "quiet",
      eyebrow: "当前清空",
      title: queue.value === "requested" ? "没有进行中的发起记录" : "没有待你处理的审批",
      detail: "新审批到达你的节点后会自动进入当前队列。",
    };
  });
const statusText = (x: string) =>
    (
      ({
        pending: "审批中",
        approved: "已批准",
        rejected: "已驳回",
        waiting: "等待中",
        escalated: "已升级",
        draft: "草稿",
        published: "已发布",
        todo: "待处理",
        in_progress: "进行中",
        completed: "已完成",
        cancelled: "已取消",
        low: "低",
        normal: "普通",
        high: "高",
        critical: "紧急",
        adopt: "采纳",
        observe: "观察",
        reject: "驳回",
        recommend: "推荐",
        not_recommend: "不推荐",
        insufficient_data: "数据不足",
        calculated: "已计算",
        not_calculated: "尚未计算",
        unknown: "待识别",
        medium: "中",
      }) as Record<string, string>
    )[x] ?? "未知状态",
  resourceText = (x: string) =>
    ({ task: "任务", opportunity_decision: "机会决策" })[x] ?? "业务记录",
  actionText = (x: string) =>
    ({
      approve: "批准",
      approved: "批准",
      reject: "驳回",
      rejected: "驳回",
      escalated: "超时升级",
    })[x] ?? x,
  basisValue = (value: string | null) =>
    value == null || value === ""
      ? "未提供"
      : statusText(value) !== "未知状态"
        ? statusText(value)
        : value,
  time = (v: string | null) => (v ? new Date(v).toLocaleString("zh-CN", { hour12: false }) : "—");
async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
  affectPageState = true,
  captureMeta?: (meta: unknown) => void,
) {
  try {
    const response = await request<T>(path, options);
    requestId.value = response.request_id;
    captureMeta?.(response.meta);
    return response.data;
  } catch (error) {
    const failure = error instanceof ApiClientError ? error : null;
    requestId.value = failure?.requestId ?? "";
    if (affectPageState)
      state.value =
        failure?.kind === "conflict"
          ? "version_conflict"
          : failure?.kind === "blocked"
            ? "error"
            : (failure?.kind ?? "error");
    notice.value = failure?.actionHint ?? "稍后重试。";
    throw error;
  }
}
async function load() {
  state.value = "loading";
  try {
    const [list, tpl, members] = await Promise.all([
      api<ApprovalItem[]>(
        `/tasks/approvals?page=${page.value}&page_size=${pageSize}&involvement=${queue.value}${filter.value ? `&status=${filter.value}` : ""}`,
        {},
        true,
        (meta) => {
          total.value = Number((meta as { total?: number } | undefined)?.total ?? 0);
        },
      ),
      api<ApprovalTemplate[]>("/tasks/approval-templates"),
      canManage.value ? api<ApprovalMemberOption[]>("/tasks/member-options") : Promise.resolve([]),
    ]);
    approvals.value = list;
    templates.value = tpl;
    memberOptions.value = members;
    state.value = list.length ? "ready" : "empty";
    const approvalId = typeof route.query.approval === "string" ? route.query.approval : "";
    if (approvalId) await openById(approvalId, false);
  } catch (error) {
    rethrowUnexpectedError(error);
  }
}
async function openById(id: string, syncUrl = true) {
  detailBusy.value = true;
  detailNotice.value = "";
  try {
    selected.value = await api<ApprovalItem>(`/tasks/approvals/${id}`, {}, false);
    reason.value = "";
    if (syncUrl) await router.replace({ query: { ...route.query, approval: selected.value.id } });
  } catch (error) {
    const failure = error instanceof ApiClientError ? error : null;
    selected.value = null;
    detailNotice.value =
      failure?.status === 404
        ? "该审批记录不存在或不属于当前工作区。"
        : (failure?.actionHint ?? "审批详情读取失败，请重试。");
    if (!syncUrl) await router.replace({ query: { ...route.query, approval: undefined } });
    rethrowUnexpectedError(error);
  } finally {
    detailBusy.value = false;
  }
}
async function open(item: ApprovalItem) {
  await openById(item.id);
}
async function closeDetail() {
  selected.value = null;
  await router.replace({ query: { ...route.query, approval: undefined } });
}
async function setQueue(value: "decidable" | "requested") {
  queue.value = value;
  page.value = 1;
  selected.value = null;
  await router.replace({
    query: {
      ...route.query,
      view: value === "requested" ? "requested" : undefined,
      page: undefined,
      approval: undefined,
    },
  });
  await load();
}
async function setFilter(value: string) {
  filter.value = value;
  page.value = 1;
  await router.replace({
    query: { ...route.query, status: value || undefined, page: undefined, approval: undefined },
  });
  selected.value = null;
  await load();
}
async function setPage(value: number) {
  page.value = Math.min(pageCount.value, Math.max(1, value));
  await router.replace({
    query: { ...route.query, page: page.value > 1 ? String(page.value) : undefined },
  });
  await load();
}
async function decide(action: "approve" | "reject") {
  if (!selected.value || !reason.value.trim()) return;
  busy.value = true;
  try {
    await api(
      `/tasks/approvals/${selected.value.id}/actions`,
      {
        method: "POST",
        body: {
          action,
          reason: reason.value,
          expected_version: selected.value.version,
        },
      },
      false,
    );
    notice.value =
      action === "approve" ? "本节点已批准，审批历史不可变。" : "本节点已驳回，审批历史不可变。";
    await closeDetail();
    await load();
  } catch (error) {
    rethrowUnexpectedError(error);
  } finally {
    busy.value = false;
  }
}
async function createTemplate() {
  busy.value = true;
  try {
    await api(
      "/tasks/approval-templates",
      {
        method: "POST",
        body: {
          name: templateForm.value.name,
          resource_type: templateForm.value.resource_type,
          nodes: [
            {
              name: templateForm.value.node_name,
              approver_id: templateForm.value.approver_id,
              sla_minutes: Number(templateForm.value.sla_minutes),
              escalation_assignee_id: templateForm.value.escalation_assignee_id,
            },
          ],
        },
      },
      false,
    );
    showTemplate.value = false;
    notice.value = "审批模板草稿已创建；发布前不会用于新审批。";
    await load();
  } catch (error) {
    rethrowUnexpectedError(error);
  } finally {
    busy.value = false;
  }
}
function openPublish(t: ApprovalTemplate) {
  publishTarget.value = t;
  publishReason.value = "";
}
async function publish() {
  if (busy.value || !publishTarget.value || !publishReason.value.trim()) return;
  const target = publishTarget.value;
  busy.value = true;
  try {
    await api(
      `/tasks/approval-templates/${target.id}/actions`,
      {
        method: "POST",
        body: { expected_revision: target.revision, reason: publishReason.value.trim() },
      },
      false,
    );
    notice.value = "模板版本已发布并锁定。";
    publishTarget.value = null;
    publishReason.value = "";
    await load();
  } catch (error) {
    rethrowUnexpectedError(error);
  } finally {
    busy.value = false;
  }
}
async function createRequest() {
  busy.value = true;
  try {
    await api(
      "/tasks/approvals",
      {
        method: "POST",
        body: {
          ...requestForm.value,
          title: requestForm.value.title.trim(),
          resource_id: requestForm.value.resource_id.trim(),
        },
      },
      false,
    );
    showRequest.value = false;
    notice.value = "审批已发起；第一节点 SLA 已开始计时。";
    await load();
  } catch (error) {
    rethrowUnexpectedError(error);
  } finally {
    busy.value = false;
  }
}
onMounted(load);
watch(
  () => route.query.approval,
  (value) => {
    if (typeof value === "string" && value !== selected.value?.id) void openById(value, false);
    else if (!value) selected.value = null;
  },
);
watch(
  () => requestForm.value.template_id,
  () => {
    if (selectedTemplate.value)
      requestForm.value.resource_type = selectedTemplate.value.resource_type;
  },
);
</script>
<template>
  <section class="approval-workspace">
    <header class="approval-header">
      <div>
        <p>人工决策</p>
        <h2>审批中心</h2>
        <span>先处理到达当前节点的事项；证据差异和历史记录按需展开。</span>
      </div>
      <div v-if="canManage" class="approval-header-actions">
        <button v-if="published.length" class="secondary" @click="showTemplate = true">
          管理模板
        </button>
        <button v-if="published.length" @click="showRequest = true">＋ 发起审批</button>
        <button v-else @click="showTemplate = true">配置第一个模板</button>
      </div>
      <p v-else class="approval-readonly-badge">只读权限</p>
    </header>
    <div v-if="notice" class="approval-notice" aria-live="polite">
      {{ notice }}
      <details v-if="requestId">
        <summary>技术详情</summary>
        <code>{{ requestId }}</code>
      </details>
    </div>
    <section class="approval-focus-strip" :data-tone="focusSummary.tone" aria-label="当前审批重点">
      <span class="approval-focus-signal" aria-hidden="true"></span>
      <div>
        <small>{{ focusSummary.eyebrow }}</small>
        <strong>{{ focusSummary.title }}</strong>
        <p>{{ focusSummary.detail }}</p>
      </div>
      <dl>
        <div>
          <dt>待我处理</dt>
          <dd>{{ mineCount }}</dd>
        </div>
        <div>
          <dt>已超时</dt>
          <dd>{{ overdueCount }}</dd>
        </div>
        <div>
          <dt>可用模板</dt>
          <dd>{{ published.length }}</dd>
        </div>
      </dl>
    </section>
    <section v-if="state === 'loading'" class="approval-state">正在读取审批事实…</section>
    <section
      v-else-if="
        ['error', 'forbidden', 'expired', 'rate_limited', 'version_conflict'].includes(state)
      "
      class="approval-state"
    >
      <h3>
        {{
          state === "expired"
            ? "登录已失效"
            : state === "forbidden"
              ? "无权访问审批"
              : state === "rate_limited"
                ? "请求过于频繁"
                : state === "version_conflict"
                  ? "审批版本已变化"
                  : "审批服务暂不可用"
        }}
      </h3>
      <p>{{ notice }}</p>
      <button @click="load">刷新最新状态</button>
    </section>
    <ApprovalQueuePanel
      v-else
      :approvals="approvals"
      :queue="queue"
      :filter="filter"
      :can-manage="canManage"
      :published-count="published.length"
      :status-text="statusText"
      :resource-text="resourceText"
      :time="time"
      @queue="setQueue"
      @filter="setFilter"
      @open="open"
      @create-request="showRequest = true"
      @manage-templates="showTemplate = true"
    />
    <section v-if="detailBusy" class="approval-detail-state" aria-live="polite">
      正在读取审批详情…
    </section>
    <section v-else-if="detailNotice" class="approval-detail-state" role="alert">
      {{ detailNotice }}
      <button class="secondary" @click="detailNotice = ''">关闭提示</button>
    </section>
    <nav v-if="total > pageSize" class="approval-pagination" aria-label="审批分页">
      <button :disabled="page <= 1" @click="setPage(page - 1)">上一页</button>
      <span>第 {{ page }} / {{ pageCount }} 页 · 共 {{ total }} 项</span>
      <button :disabled="page >= pageCount" @click="setPage(page + 1)">下一页</button>
    </nav>
    <div
      v-if="selected"
      class="approval-detail-backdrop"
      aria-hidden="true"
      @click="closeDetail"
    ></div>
    <aside
      v-if="selected"
      class="approval-detail"
      role="dialog"
      aria-modal="true"
      aria-labelledby="approval-detail-title"
    >
      <button class="close" aria-label="关闭审批详情" title="关闭审批详情" @click="closeDetail">
        ×
      </button>
      <p>{{ selected.template_name }} / 模板 v{{ selected.approval_template_version ?? "—" }}</p>
      <h3 id="approval-detail-title">{{ selected.title }}</h3>
      <RouterLink
        v-if="selected.decision_context?.resource"
        class="approval-resource-link"
        :to="selected.decision_context.resource.route"
        >查看{{ selected.decision_context.resource.label }} →</RouterLink
      >
      <RouterLink v-if="notificationReturn" class="approval-resource-link" :to="notificationReturn"
        >返回通知中心</RouterLink
      >
      <section class="approval-impact-summary" aria-label="审批依据与影响范围">
        <div>
          <small>影响范围</small>
          <strong>{{ resourceText(selected.resource_type) }} · {{ selected.title }}</strong>
        </div>
        <div>
          <small>当前节点</small>
          <strong>{{ selected.current_node_name || "流程已结束" }}</strong>
        </div>
        <div>
          <small>判断依据</small>
          <strong v-if="selected.decision_context?.evidence.applicable"
            >证据完整度 {{ selected.decision_context.evidence.percent }}%</strong
          >
          <strong v-else>{{ selected.decision_context?.evidence.note || "按任务事实审批" }}</strong>
        </div>
      </section>
      <section v-if="selected.decision_context" class="approval-decision-context">
        <header>
          <div>
            <small>证据完整度</small>
            <strong v-if="selected.decision_context.evidence.applicable"
              >{{ selected.decision_context.evidence.percent }}%</strong
            >
            <strong v-else>不适用</strong>
          </div>
          <div>
            <small>审批模板版本</small>
            <strong>{{ selected.decision_context.rule_versions.approval_template }}</strong>
          </div>
        </header>
        <p
          class="approval-context-origin"
          :data-fallback="selected.decision_context.snapshot_status === 'live_fallback'"
        >
          {{
            selected.decision_context.snapshot_status === "captured"
              ? `发起审批时已锁定 · ${time(selected.decision_context.captured_at)}`
              : `历史审批未保存快照，以下为当前事实 · ${time(selected.decision_context.observed_at)}`
          }}
        </p>
        <section
          v-if="selected.decision_context_diff?.available"
          class="approval-context-diff"
          :data-changed="selected.decision_context_diff.has_changes"
        >
          <header>
            <div>
              <h4>提交快照与当前证据</h4>
              <small>当前事实读取于 {{ time(selected.decision_context_diff.observed_at) }}</small>
            </div>
            <strong v-if="selected.decision_context_diff.has_changes">已有变化</strong>
            <strong v-else>保持一致</strong>
          </header>
          <div v-if="selected.decision_context_diff.evidence_summary" class="approval-diff-summary">
            <span>
              <small>提交时完整度</small>
              <b
                >{{ selected.decision_context_diff.evidence_summary.before_percent ?? "不适用"
                }}<template
                  v-if="selected.decision_context_diff.evidence_summary.before_percent !== null"
                  >%</template
                ></b
              >
            </span>
            <em>→</em>
            <span>
              <small>当前完整度</small>
              <b
                >{{ selected.decision_context_diff.evidence_summary.after_percent ?? "不适用"
                }}<template
                  v-if="selected.decision_context_diff.evidence_summary.after_percent !== null"
                  >%</template
                ></b
              >
            </span>
          </div>
          <p v-if="!selected.decision_context_diff.has_changes" class="approval-diff-empty">
            当前证据、事实和规则版本与提交审批时一致。
          </p>
          <div
            v-for="change in selected.decision_context_diff.requirement_changes"
            :key="`requirement-${change.code}`"
            class="approval-diff-row"
          >
            <b>{{ change.label }}</b>
            <span :data-complete="change.before_complete"
              >提交时：{{ change.before_detail ?? "无" }}</span
            >
            <em>→</em>
            <span :data-complete="change.after_complete"
              >当前：{{ change.after_detail ?? "无" }}</span
            >
          </div>
          <div
            v-for="change in selected.decision_context_diff.basis_changes"
            :key="`basis-${change.code}`"
            class="approval-diff-row"
          >
            <b>{{ change.label }}</b>
            <span>提交时：{{ basisValue(change.before) }}</span>
            <em>→</em>
            <span>当前：{{ basisValue(change.after) }}</span>
          </div>
          <div
            v-for="change in selected.decision_context_diff.rule_version_changes"
            :key="`rule-${change.code}`"
            class="approval-diff-row"
          >
            <b>{{ change.label }}</b>
            <span>提交时：{{ change.before ?? "未生成" }}</span>
            <em>→</em>
            <span>当前：{{ change.after ?? "未生成" }}</span>
          </div>
        </section>
        <template v-if="selected.decision_context.evidence.applicable">
          <progress
            :value="selected.decision_context.evidence.complete"
            :max="selected.decision_context.evidence.total"
          ></progress>
          <p v-if="selected.decision_context.evidence.missing_items.length">
            缺失：{{ selected.decision_context.evidence.missing_items.join("、") }}
          </p>
          <div class="approval-requirements">
            <RouterLink
              v-for="requirement in selected.decision_context.evidence.requirements"
              :key="requirement.code"
              :to="requirement.route"
              :data-complete="requirement.complete"
            >
              <span>
                <b>{{ requirement.label }}</b>
                <em>{{ requirement.complete ? "已具备" : "待补齐" }}</em>
              </span>
              <small>{{ requirement.detail }}</small>
            </RouterLink>
          </div>
        </template>
        <p v-else class="approval-context-note">
          {{ selected.decision_context.evidence.note }}
        </p>
        <section class="approval-rule-versions">
          <h4>规则版本</h4>
          <dl>
            <div>
              <dt>审批模板</dt>
              <dd>{{ selected.decision_context.rule_versions.approval_template }}</dd>
            </div>
            <div>
              <dt>评分规则</dt>
              <dd>{{ selected.decision_context.rule_versions.scoring ?? "未生成" }}</dd>
            </div>
            <div>
              <dt>利润规则</dt>
              <dd>{{ selected.decision_context.rule_versions.profit ?? "未生成" }}</dd>
            </div>
          </dl>
        </section>
        <section v-if="selected.decision_context.decision" class="approval-requested-decision">
          <h4>申请决策</h4>
          <strong>{{ statusText(selected.decision_context.decision.action) }}</strong>
          <p>{{ selected.decision_context.decision.reason }}</p>
          <small>基于机会第 {{ selected.decision_context.decision.opportunity_version }} 版</small>
        </section>
        <section class="approval-decision-basis">
          <h4>决策依据</h4>
          <dl>
            <div v-for="basis in selected.decision_context.basis_items" :key="basis.code">
              <dt>{{ basis.label }}</dt>
              <dd>{{ basisValue(basis.value) }}</dd>
            </div>
          </dl>
        </section>
      </section>
      <div class="approval-timeline">
        <article v-for="node in selected.nodes" :key="node.id" :data-status="node.status">
          <i></i>
          <div>
            <b>{{ node.ordinal }}. {{ node.name }}</b
            ><span>{{ statusText(node.status) }} · {{ time(node.due_at) }}</span
            ><small>当前审批人 {{ node.active_approver_name }}</small>
            <div class="approval-escalation-path">
              <span>{{ node.approver_name }}</span
              ><em>超时后 →</em><span>{{ node.escalation_assignee_name }}</span>
            </div>
            <small v-if="node.escalated_at">已于 {{ time(node.escalated_at) }} 升级</small>
            <p v-if="node.decision_reason">{{ node.decision_reason }}</p>
          </div>
        </article>
      </div>
      <section class="approval-action-history" aria-label="审批操作记录">
        <h4>操作记录</h4>
        <p v-if="!selected.actions?.length">尚无批准、驳回或升级记录。</p>
        <article v-for="action in selected.actions" :key="action.id">
          <div>
            <strong>{{ actionText(action.action) }}</strong>
            <span>{{ action.actor_name || "未知成员" }} · {{ time(action.created_at) }}</span>
          </div>
          <p>{{ action.reason }}</p>
        </article>
      </section>
      <section v-if="selected.can_decide && canManage">
        <p
          v-if="
            selected.decision_context?.evidence.applicable &&
            !selected.decision_context.evidence.is_complete
          "
          class="approval-evidence-warning"
        >
          证据仍有缺失；若继续审批，请在原因中明确说明判断依据。
        </p>
        <label
          >审批原因（批准与驳回均必填）<textarea
            v-model="reason"
            maxlength="1000"
            placeholder="记录可审计的判断依据"
          ></textarea>
        </label>
        <div>
          <button :disabled="busy || !reason.trim()" @click="decide('reject')" class="danger">
            驳回</button
          ><button :disabled="busy || !reason.trim()" @click="decide('approve')">批准并流转</button>
        </div>
      </section>
      <section v-else class="readonly">当前节点不是由你审批，或审批已结束。</section>
      <details class="approval-technical">
        <summary>技术详情</summary>
        <dl>
          <div>
            <dt>审批编号</dt>
            <dd>{{ selected.id }}</dd>
          </div>
          <div>
            <dt>资源类型</dt>
            <dd>{{ selected.resource_type }}</dd>
          </div>
          <div>
            <dt>资源编号</dt>
            <dd>{{ selected.resource_id }}</dd>
          </div>
          <div v-for="node in selected.nodes" :key="`technical-${node.id}`">
            <dt>节点 {{ node.ordinal }}</dt>
            <dd>{{ node.id }} / {{ node.active_approver_id }}</dd>
          </div>
        </dl>
      </details>
    </aside>
    <dialog
      ref="templateDialogElement"
      aria-label="新建审批模板草稿"
      @cancel="handleTemplateCancel"
    >
      <form @submit.prevent="createTemplate">
        <h3>新建审批模板草稿</h3>
        <label>模板名称<input v-model="templateForm.name" required maxlength="200" /></label
        ><label
          >资源类型<select v-model="templateForm.resource_type">
            <option value="task">任务</option>
            <option value="opportunity_decision">机会决策</option>
          </select></label
        ><label>节点名称<input v-model="templateForm.node_name" required maxlength="120" /></label
        ><label
          >处理时限（分钟）<input
            v-model.number="templateForm.sla_minutes"
            type="number"
            min="1"
            max="43200"
            required
        /></label>
        <details class="approval-form-technical">
          <summary>技术配置：审批人与超时接收人</summary>
          <label
            >审批人<select v-model="templateForm.approver_id" required>
              <option value="" disabled>请选择当前工作区成员</option>
              <option v-for="member in memberOptions" :key="member.id" :value="member.id">
                {{ member.label }}
              </option>
            </select></label
          ><label
            >超时接收人<select v-model="templateForm.escalation_assignee_id" required>
              <option value="" disabled>请选择当前工作区成员</option>
              <option v-for="member in memberOptions" :key="member.id" :value="member.id">
                {{ member.label }}
              </option>
            </select></label
          >
        </details>
        <p>草稿必须显式发布；超时只升级审批人，不会自动批准或驳回。</p>
        <div>
          <button type="button" class="secondary" @click="showTemplate = false">取消</button
          ><button :disabled="busy">保存草稿</button>
        </div>
      </form>
      <section class="template-list">
        <h4>现有模板</h4>
        <article v-for="t in templates" :key="t.id">
          <span
            ><b>{{ t.name }}</b
            ><small>{{ statusText(t.status) }} · {{ t.node_count }} 节点</small></span
          ><button v-if="t.status === 'draft'" @click="openPublish(t)">发布</button>
        </article>
      </section>
    </dialog>
    <dialog ref="publishDialogElement" aria-label="发布审批模板" @cancel="handlePublishCancel">
      <form @submit.prevent="publish">
        <h3>发布审批模板</h3>
        <p>
          将发布“{{ publishTarget?.name }}”第
          {{ publishTarget?.current_version }} 版。新审批会锁定该版本，历史审批不会被改写。
        </p>
        <label>
          发布原因
          <textarea
            v-model="publishReason"
            required
            maxlength="500"
            placeholder="说明本次发布的依据、适用范围或变更原因"
          ></textarea>
        </label>
        <div>
          <button type="button" class="secondary" @click="publishTarget = null">返回</button>
          <button type="submit" :disabled="busy">确认发布</button>
        </div>
      </form>
    </dialog>
    <dialog ref="requestDialogElement" aria-label="发起审批" @cancel="handleRequestCancel">
      <form @submit.prevent="createRequest">
        <h3>发起审批</h3>
        <label
          >已发布模板<select v-model="requestForm.template_id" required>
            <option value="" disabled>请选择</option>
            <option v-for="t in published" :key="t.id" :value="t.id">
              {{ t.name }}
            </option>
          </select></label
        >
        <p v-if="selectedTemplate" class="approval-form-context">
          关联类型：{{
            resourceText(selectedTemplate.resource_type)
          }}。资源类型由模板锁定，不能单独改写。
        </p>
        <details class="approval-form-technical">
          <summary>技术配置：关联资源编号</summary>
          <label>资源编号<input v-model="requestForm.resource_id" required /></label>
        </details>
        <label>审批标题<input v-model="requestForm.title" required maxlength="200" /></label>
        <div>
          <button type="button" class="secondary" @click="showRequest = false">取消</button
          ><button :disabled="busy || !published.length">发起</button>
        </div>
      </form>
    </dialog>
  </section>
</template>
