<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ApiClientError, createApiClient } from "../api-client";
import "../approval-workspace.css";
type ViewState =
  | "loading"
  | "ready"
  | "empty"
  | "error"
  | "forbidden"
  | "expired"
  | "rate_limited"
  | "version_conflict";
type Template = {
  id: string;
  name: string;
  resource_type: string;
  status: string;
  current_version: number;
  revision: number;
  node_count: number;
};
type Approval = {
  id: string;
  title: string;
  template_name: string;
  resource_type: string;
  resource_id: string;
  status: string;
  current_node_ordinal: number;
  current_node_name: string | null;
  can_decide: boolean;
  due_at: string | null;
  escalated_at: string | null;
  version: number;
  approval_template_version?: number;
  nodes?: Array<{
    id: string;
    ordinal: number;
    name: string;
    status: string;
    active_approver_id: string;
    active_approver_name: string;
    due_at: string | null;
    decision_reason: string | null;
    decided_by_name: string | null;
  }>;
  actions?: Array<{
    id: string;
    action: string;
    reason: string;
    actor_name: string;
    created_at: string;
  }>;
  decision_context?: {
    snapshot_status: "captured" | "live_fallback";
    captured_at: string | null;
    observed_at: string;
    resource: {
      type: "task" | "opportunity";
      id: string;
      label: string;
      route: string;
    };
    evidence: {
      applicable: boolean;
      complete: number;
      total: number;
      percent: number | null;
      is_complete: boolean | null;
      missing_items: string[];
      note: string | null;
      requirements: Array<{
        code: string;
        label: string;
        complete: boolean;
        detail: string;
        route: string;
      }>;
    };
    rule_versions: {
      approval_template: string;
      scoring: string | null;
      profit: string | null;
    };
    decision: {
      action: string;
      reason: string;
      opportunity_version: number;
      created_at: string;
    } | null;
    basis_items: Array<{ code: string; label: string; value: string | null }>;
    evidence_complete: number;
    evidence_total: number;
    missing_items: string[];
    rule_version: string;
    basis: string[];
  };
};
const props = defineProps<{ apiBaseUrl: string }>(),
  request = createApiClient(props.apiBaseUrl),
  state = ref<ViewState>("loading"),
  approvals = ref<Approval[]>([]),
  templates = ref<Template[]>([]),
  selected = ref<Approval | null>(null),
  filter = ref("pending"),
  notice = ref(""),
  requestId = ref(""),
  reason = ref(""),
  busy = ref(false),
  showTemplate = ref(false),
  showRequest = ref(false),
  templateForm = ref({
    name: "",
    resource_type: "task",
    node_name: "",
    approver_id: "",
    sla_minutes: 60,
    escalation_assignee_id: "",
  }),
  requestForm = ref({
    template_id: "",
    resource_type: "task",
    resource_id: "",
    title: "",
  });
const pendingCount = computed(
    () => approvals.value.filter((x) => x.status === "pending").length,
  ),
  mineCount = computed(
    () => approvals.value.filter((x) => x.can_decide).length,
  ),
  overdueCount = computed(
    () =>
      approvals.value.filter(
        (x) =>
          x.status === "pending" && x.due_at && new Date(x.due_at) < new Date(),
      ).length,
  ),
  published = computed(() =>
    templates.value.filter((x) => x.status === "published"),
  );
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
  basisValue = (value: string | null) =>
    value == null || value === "" ? "未提供" : statusText(value) !== "未知状态" ? statusText(value) : value,
  time = (v: string | null) =>
    v ? new Date(v).toLocaleString("zh-CN", { hour12: false }) : "—";
async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
  affectPageState = true,
) {
  try {
    const response = await request<T>(path, options);
    requestId.value = response.request_id;
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
    const [list, tpl] = await Promise.all([
      api<Approval[]>(
        `/tasks/approvals?page=1&page_size=100${filter.value ? `&status=${filter.value}` : ""}`,
      ),
      api<Template[]>("/tasks/approval-templates"),
    ]);
    approvals.value = list;
    templates.value = tpl;
    state.value = list.length ? "ready" : "empty";
  } catch {}
}
async function open(item: Approval) {
  try {
    selected.value = await api<Approval>(`/tasks/approvals/${item.id}`);
    reason.value = "";
    state.value = "ready";
  } catch {}
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
      action === "approve"
        ? "本节点已批准，审批历史不可变。"
        : "本节点已驳回，审批历史不可变。";
    selected.value = null;
    await load();
  } catch {
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
  } catch {
  } finally {
    busy.value = false;
  }
}
async function publish(t: Template) {
  const reasonValue = window.prompt("请输入发布原因")?.trim();
  if (!reasonValue) return;
  try {
    await api(
      `/tasks/approval-templates/${t.id}/actions`,
      {
        method: "POST",
        body: { expected_revision: t.revision, reason: reasonValue },
      },
      false,
    );
    notice.value = "模板版本已发布并锁定。";
    await load();
  } catch {}
}
async function createRequest() {
  busy.value = true;
  try {
    await api(
      "/tasks/approvals",
      { method: "POST", body: requestForm.value },
      false,
    );
    showRequest.value = false;
    notice.value = "审批已发起；第一节点 SLA 已开始计时。";
    await load();
  } catch {
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>
<template>
  <section class="approval-workspace">
    <header>
      <div>
        <p>工作管理</p>
        <h2>审批中心</h2>
        <span
          >模板版本、节点时限、人工原因与升级记录均来自当前工作区后端。</span
        >
      </div>
      <div>
        <button class="secondary" @click="showTemplate = true">配置模板</button
        ><button @click="showRequest = true">＋ 发起审批</button>
      </div>
    </header>
    <div v-if="notice" class="approval-notice" aria-live="polite">
      {{ notice }}
      <details v-if="requestId">
        <summary>技术详情</summary>
        <code>{{ requestId }}</code>
      </details>
    </div>
    <section class="approval-metrics">
      <article>
        <span>审批中</span><b>{{ pendingCount }}</b>
      </article>
      <article>
        <span>待我审批</span><b>{{ mineCount }}</b>
      </article>
      <article class="alert">
        <span>节点超时</span><b>{{ overdueCount }}</b>
      </article>
      <article>
        <span>已发布模板</span><b>{{ published.length }}</b>
      </article>
    </section>
    <nav>
      <button
        v-for="x in [
          { v: 'pending', t: '审批中' },
          { v: 'approved', t: '已批准' },
          { v: 'rejected', t: '已驳回' },
          { v: '', t: '全部' },
        ]"
        :key="x.v"
        :aria-pressed="filter === x.v"
        @click="
          filter = x.v;
          load();
        "
      >
        {{ x.t }}
      </button>
    </nav>
    <section v-if="state === 'loading'" class="approval-state">
      正在读取审批事实…
    </section>
    <section
      v-else-if="
        [
          'error',
          'forbidden',
          'expired',
          'rate_limited',
          'version_conflict',
        ].includes(state)
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
    <section v-else-if="!approvals.length" class="approval-state">
      <h3>当前筛选条件下没有审批</h3>
      <p>系统不会填充示例审批；请使用已发布模板发起真实审批。</p>
    </section>
    <div v-else class="approval-list">
      <button v-for="item in approvals" :key="item.id" @click="open(item)">
        <span class="approval-mark">{{ item.current_node_ordinal }}</span
        ><span
          ><strong>{{ item.title }}</strong
          ><small
            >{{ item.template_name }} · {{ resourceText(item.resource_type) }}</small
          ></span
        ><span
          ><em :data-status="item.status">{{ statusText(item.status) }}</em
          ><small>{{ item.current_node_name || "流程已结束" }}</small></span
        ><span
          ><strong>{{
            item.escalated_at ? "已升级" : time(item.due_at)
          }}</strong
          ><small>{{ item.can_decide ? "需要你处理" : "只读" }}</small></span
        ><b>查看 →</b>
      </button>
    </div>
    <aside v-if="selected" class="approval-detail">
      <button
        class="close"
        aria-label="关闭审批详情"
        title="关闭审批详情"
        @click="selected = null"
      >
        ×
      </button>
      <p>
        {{ selected.template_name }} / 模板 v{{
          selected.approval_template_version ?? "—"
        }}
      </p>
      <h3>{{ selected.title }}</h3>
      <a
        v-if="selected.decision_context?.resource"
        class="approval-resource-link"
        :href="selected.decision_context.resource.route"
        >查看{{ selected.decision_context.resource.label }} →</a
      >
      <section
        v-if="selected.decision_context"
        class="approval-decision-context"
      >
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
          :data-fallback="
            selected.decision_context.snapshot_status === 'live_fallback'
          "
        >
          {{
            selected.decision_context.snapshot_status === "captured"
              ? `发起审批时已锁定 · ${time(selected.decision_context.captured_at)}`
              : `历史审批未保存快照，以下为当前事实 · ${time(selected.decision_context.observed_at)}`
          }}
        </p>
        <template v-if="selected.decision_context.evidence.applicable">
          <progress
            :value="selected.decision_context.evidence.complete"
            :max="selected.decision_context.evidence.total"
          ></progress>
          <p v-if="selected.decision_context.evidence.missing_items.length">
            缺失：{{
              selected.decision_context.evidence.missing_items.join("、")
            }}
          </p>
          <div class="approval-requirements">
            <a
              v-for="requirement in selected.decision_context.evidence
                .requirements"
              :key="requirement.code"
              :href="requirement.route"
              :data-complete="requirement.complete"
            >
              <span>
                <b>{{ requirement.label }}</b>
                <em>{{ requirement.complete ? "已具备" : "待补齐" }}</em>
              </span>
              <small>{{ requirement.detail }}</small>
            </a>
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
        <section
          v-if="selected.decision_context.decision"
          class="approval-requested-decision"
        >
          <h4>申请决策</h4>
          <strong>{{ statusText(selected.decision_context.decision.action) }}</strong>
          <p>{{ selected.decision_context.decision.reason }}</p>
          <small
            >基于机会第
            {{ selected.decision_context.decision.opportunity_version }} 版</small
          >
        </section>
        <section class="approval-decision-basis">
          <h4>决策依据</h4>
          <dl>
            <div
              v-for="basis in selected.decision_context.basis_items"
              :key="basis.code"
            >
              <dt>{{ basis.label }}</dt>
              <dd>{{ basisValue(basis.value) }}</dd>
            </div>
          </dl>
        </section>
      </section>
      <div class="approval-timeline">
        <article
          v-for="node in selected.nodes"
          :key="node.id"
          :data-status="node.status"
        >
          <i></i>
          <div>
            <b>{{ node.ordinal }}. {{ node.name }}</b
            ><span>{{ statusText(node.status) }} · {{ time(node.due_at) }}</span
            ><small>审批人 {{ node.active_approver_name }}</small>
            <p v-if="node.decision_reason">{{ node.decision_reason }}</p>
          </div>
        </article>
      </div>
      <section v-if="selected.can_decide">
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
          <button
            :disabled="busy || !reason.trim()"
            @click="decide('reject')"
            class="danger"
          >
            驳回</button
          ><button
            :disabled="busy || !reason.trim()"
            @click="decide('approve')"
          >
            批准并流转
          </button>
        </div>
      </section>
      <section v-else class="readonly">
        当前节点不是由你审批，或审批已结束。
      </section>
      <details class="approval-technical">
        <summary>技术详情</summary>
        <dl>
          <div><dt>审批编号</dt><dd>{{ selected.id }}</dd></div>
          <div><dt>资源类型</dt><dd>{{ selected.resource_type }}</dd></div>
          <div><dt>资源编号</dt><dd>{{ selected.resource_id }}</dd></div>
          <div
            v-for="node in selected.nodes"
            :key="`technical-${node.id}`"
          >
            <dt>节点 {{ node.ordinal }}</dt>
            <dd>{{ node.id }} / {{ node.active_approver_id }}</dd>
          </div>
        </dl>
      </details>
    </aside>
    <dialog :open="showTemplate">
      <form @submit.prevent="createTemplate">
        <h3>新建审批模板草稿</h3>
        <label
          >模板名称<input
            v-model="templateForm.name"
            required
            maxlength="200" /></label
        ><label
          >资源类型<select v-model="templateForm.resource_type">
            <option value="task">任务</option>
            <option value="opportunity_decision">机会决策</option>
          </select></label
        ><label
          >节点名称<input
            v-model="templateForm.node_name"
            required
            maxlength="120" /></label
        ><label
          >处理时限（分钟）<input
            v-model.number="templateForm.sla_minutes"
            type="number"
            min="1"
            max="43200"
            required /></label>
        <details class="approval-form-technical">
          <summary>技术配置：审批人与超时接收人</summary>
          <label
            >审批人账号编号<input
              v-model="templateForm.approver_id"
              required /></label
          ><label
            >超时接收人账号编号<input
              v-model="templateForm.escalation_assignee_id"
              required
          /></label>
        </details>
        <p>草稿必须显式发布；超时只升级审批人，不会自动批准或驳回。</p>
        <div>
          <button type="button" class="secondary" @click="showTemplate = false">
            取消</button
          ><button :disabled="busy">保存草稿</button>
        </div>
      </form>
      <section class="template-list">
        <h4>现有模板</h4>
        <article v-for="t in templates" :key="t.id">
          <span
            ><b>{{ t.name }}</b
            ><small
              >{{ statusText(t.status) }} · {{ t.node_count }} 节点</small
            ></span
          ><button v-if="t.status === 'draft'" @click="publish(t)">发布</button>
        </article>
      </section>
    </dialog>
    <dialog :open="showRequest">
      <form @submit.prevent="createRequest">
        <h3>发起审批</h3>
        <label
          >已发布模板<select v-model="requestForm.template_id" required>
            <option value="" disabled>请选择</option>
            <option v-for="t in published" :key="t.id" :value="t.id">
              {{ t.name }}
            </option>
          </select></label
        ><label
          >资源类型<select v-model="requestForm.resource_type">
            <option value="task">任务</option>
            <option value="opportunity_decision">机会决策</option>
          </select></label
        ><details class="approval-form-technical">
          <summary>技术配置：关联资源编号</summary>
          <label
            >资源编号<input v-model="requestForm.resource_id" required
          /></label>
        </details>
        <label
          >审批标题<input v-model="requestForm.title" required maxlength="200"
        /></label>
        <div>
          <button type="button" class="secondary" @click="showRequest = false">
            取消</button
          ><button :disabled="busy">发起</button>
        </div>
      </form>
    </dialog>
  </section>
</template>
