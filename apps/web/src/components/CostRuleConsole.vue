<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ApiClientError, createApiClient, type ApiFailureKind } from "../api-client";
import { useModalDialog } from "../use-modal-dialog";
import UiStatePanel from "./UiStatePanel.vue";
import "../profit.css";

type State = "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
type FeeType = "platform_fee" | "payment_fee" | "tax" | "fulfillment";
type ApprovalRole = "selection_manager" | "organization_admin";
type Action = "submit" | "approve" | "reject" | "publish" | "rollback";
interface Rule {
  id: string;
  market: string;
  platform: string;
  version_code: string;
  name: string;
  status: string;
  fee_lines: Array<{
    type: FeeType;
    mode: "percentage_of_sale" | "fixed_amount";
    value: number;
    currency: string | null;
  }>;
  effective_from: string;
  revision: number;
  approvals: ApprovalRole[];
  published_at: string | null;
  updated_at: string;
}
interface PendingAction {
  action: Action;
  approvalRole?: ApprovalRole;
}

const props = defineProps<{ apiBaseUrl: string; roles: string[]; capabilities: string[] }>();
const route = useRoute(),
  router = useRouter(),
  request = createApiClient(props.apiBaseUrl),
  state = ref<State>("loading"),
  rules = ref<Rule[]>([]),
  selected = ref<Rule | null>(null),
  requestId = ref(""),
  notice = ref(""),
  busy = ref(false),
  showCreate = ref(false),
  showAction = ref(false),
  createError = ref(""),
  actionError = ref(""),
  actionReason = ref(""),
  rollbackTargetId = ref(""),
  pendingAction = ref<PendingAction | null>(null),
  search = ref(""),
  statusFilter = ref("all"),
  page = ref(1);

const pageSize = 10;

const localDay = () =>
  new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const initialForm = () => ({
  market: "US",
  platform: "amazon",
  version_code: "",
  name: "",
  effective_from: localDay(),
  platform_fee: "",
  payment_fee: "",
  tax: "",
  fulfillment: "",
  currency: "USD",
});
const form = reactive(initialForm());
const canManage = computed(() => props.capabilities.includes("opportunity:approve")),
  canSelection = computed(() => canManage.value && props.roles.includes("selection_manager")),
  canAdmin = computed(() => canManage.value && props.roles.includes("organization_admin")),
  returnPath = computed(() => {
    const value = typeof route.query.from === "string" ? route.query.from : "/sourcing";
    return /^\/sourcing(?:[/?#]|$)/.test(value) && !value.startsWith("//") ? value : "/sourcing";
  }),
  rollbackTargets = computed(() => {
    if (!selected.value) return [];
    return rules.value.filter(
      (item) =>
        item.id !== selected.value?.id &&
        item.market === selected.value?.market &&
        item.platform === selected.value?.platform &&
        ["approved", "retired"].includes(item.status),
    );
  }),
  statusOptions = computed(() => [...new Set(rules.value.map((item) => item.status))]),
  filteredRules = computed(() => {
    const query = search.value.trim().toLocaleLowerCase();
    return rules.value.filter(
      (item) =>
        (statusFilter.value === "all" || item.status === statusFilter.value) &&
        (!query ||
          [item.name, item.market, item.platform, item.version_code]
            .join(" ")
            .toLocaleLowerCase()
            .includes(query)),
    );
  }),
  pageCount = computed(() => Math.max(1, Math.ceil(filteredRules.value.length / pageSize))),
  pagedRules = computed(() =>
    filteredRules.value.slice((page.value - 1) * pageSize, page.value * pageSize),
  ),
  createValidation = computed(() => {
    if (
      !form.market.trim() ||
      !form.platform.trim() ||
      !form.version_code.trim() ||
      !form.name.trim() ||
      !form.effective_from
    )
      return "请完整填写市场、平台、版本号、规则名称和生效日期。";
    const feeValues = [form.platform_fee, form.payment_fee, form.tax, form.fulfillment];
    if (feeValues.some((value) => String(value).trim() === ""))
      return "平台费、支付手续费、税费和履约成本都必须显式填写。";
    const platformFee = Number(form.platform_fee),
      paymentFee = Number(form.payment_fee),
      tax = Number(form.tax),
      fulfillment = Number(form.fulfillment);
    if (
      ![platformFee, paymentFee, tax].every(
        (value) => Number.isFinite(value) && value >= 0 && value <= 100,
      )
    )
      return "三项百分比费用必须在 0 到 100 之间。";
    if (!Number.isFinite(fulfillment) || fulfillment < 0) return "履约成本不能小于 0。";
    if (!/^[A-Za-z]{3}$/.test(form.currency.trim())) return "履约币种必须是 3 位字母代码。";
    return "";
  }),
  actionTitle = computed(() => {
    const action = pendingAction.value?.action;
    if (action === "submit") return "提交费用规则审批";
    if (action === "approve")
      return pendingAction.value?.approvalRole === "selection_manager"
        ? "选品经理审批"
        : "组织管理员审批";
    if (action === "reject") return "拒绝费用规则";
    if (action === "publish") return "发布费用规则";
    if (action === "rollback") return "回滚费用规则";
    return "确认规则操作";
  }),
  statePrimaryLabel = computed(() =>
    state.value === "empty" && canManage.value ? "新建第一条规则" : "刷新列表",
  );

const statusLabels: Record<string, string> = {
    draft: "草稿",
    pending_approval: "待审批",
    approved: "已批准",
    active: "生效中",
    retired: "已停用",
    rejected: "已拒绝",
    rolled_back: "已回滚",
  },
  feeLabels: Record<FeeType, string> = {
    platform_fee: "平台费",
    payment_fee: "支付手续费",
    tax: "税费",
    fulfillment: "履约成本",
  },
  modeLabels = {
    percentage_of_sale: "按售价百分比",
    fixed_amount: "固定金额",
  } as const,
  actionLabels: Record<Action, string> = {
    submit: "提交审批",
    approve: "批准",
    reject: "拒绝",
    publish: "发布",
    rollback: "回滚",
  },
  profitErrorLabels: Record<string, string> = {
    cost_rule_version_conflict: "同一市场和平台下的版本号已存在。",
    cost_rule_revision_conflict: "规则已被其他操作更新，请刷新后重试。",
    cost_rule_transition_invalid: "当前规则状态不允许此操作。",
    cost_rule_not_found: "规则不存在或不属于当前工作区。",
    cost_rule_approval_conflict: "当前角色已经处理过该规则。",
    cost_rule_approval_role_forbidden: "当前账号不能代表该审批角色操作。",
    cost_rule_rollback_target_required: "请选择要恢复的历史规则。",
    cost_rule_rollback_target_invalid: "所选历史规则不能用于本次回滚。",
  };

const { dialogElement: createDialogElement, handleCancel: cancelCreate } = useModalDialog(
    () => showCreate.value,
    () => closeCreate(),
  ),
  { dialogElement: actionDialogElement, handleCancel: cancelAction } = useModalDialog(
    () => showAction.value,
    () => closeAction(),
  );

const stateFrom = (kind: ApiFailureKind): State =>
    kind === "expired"
      ? "expired"
      : kind === "forbidden"
        ? "forbidden"
        : kind === "blocked" || kind === "rate_limited"
          ? "blocked"
          : "error",
  apiErrorText = (error: ApiClientError) =>
    `${profitErrorLabels[error.code] ?? error.userMessage} ${error.actionHint}`.trim();

async function load() {
  state.value = "loading";
  notice.value = "";
  try {
    const response = await request<Rule[]>("/cost-rules");
    requestId.value = response.request_id;
    rules.value = response.data;
    const routeRuleId = typeof route.query.rule === "string" ? route.query.rule : "";
    selected.value =
      rules.value.find((item) => item.id === selected.value?.id) ??
      rules.value.find((item) => item.id === routeRuleId) ??
      rules.value[0] ??
      null;
    const selectedIndex = filteredRules.value.findIndex((item) => item.id === selected.value?.id);
    if (selectedIndex >= 0) page.value = Math.floor(selectedIndex / pageSize) + 1;
    state.value = rules.value.length ? "ready" : "empty";
  } catch (error) {
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      notice.value = apiErrorText(error);
      state.value = stateFrom(error.kind);
    } else {
      notice.value = "依赖暂不可用，请检查网络或服务状态后重试。";
      state.value = "blocked";
    }
  }
}
async function post(path: string, body: unknown, setError: (value: string) => void) {
  if (busy.value) return null;
  busy.value = true;
  setError("");
  try {
    const response = await request<Rule>(path, { method: "POST", body });
    requestId.value = response.request_id;
    return response.data;
  } catch (error) {
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      setError(apiErrorText(error));
      return null;
    }
    setError("依赖暂不可用，未写入状态。请检查网络后重试。");
    return null;
  } finally {
    busy.value = false;
  }
}
function openCreate() {
  if (!canManage.value) return;
  Object.assign(form, initialForm());
  createError.value = "";
  showCreate.value = true;
}
function selectRule(rule: Rule, persist = true) {
  selected.value = rule;
  if (persist && route.query.rule !== rule.id)
    void router.replace({ query: { ...route.query, rule: rule.id } });
}
function resetFilters() {
  search.value = "";
  statusFilter.value = "all";
}
function closeCreate() {
  if (busy.value) return;
  showCreate.value = false;
  createError.value = "";
}
async function create() {
  if (createValidation.value) {
    createError.value = createValidation.value;
    return;
  }
  const result = await post(
    "/cost-rules",
    {
      market: form.market.trim(),
      platform: form.platform.trim(),
      version_code: form.version_code.trim(),
      name: form.name.trim(),
      effective_from: form.effective_from,
      fee_lines: [
        {
          type: "platform_fee",
          mode: "percentage_of_sale",
          value: Number(form.platform_fee),
          currency: null,
        },
        {
          type: "payment_fee",
          mode: "percentage_of_sale",
          value: Number(form.payment_fee),
          currency: null,
        },
        {
          type: "tax",
          mode: "percentage_of_sale",
          value: Number(form.tax),
          currency: null,
        },
        {
          type: "fulfillment",
          mode: "fixed_amount",
          value: Number(form.fulfillment),
          currency: form.currency.trim().toUpperCase(),
        },
      ],
    },
    (value) => (createError.value = value),
  );
  if (result) {
    showCreate.value = false;
    selectRule(result);
    await load();
    notice.value = "费用规则草稿已创建，发布前仍需双角色审批。";
  }
}
function beginAction(action: Action, approvalRole?: ApprovalRole) {
  if (!selected.value || !canManage.value) return;
  pendingAction.value = { action, ...(approvalRole ? { approvalRole } : {}) };
  actionReason.value = "";
  actionError.value = "";
  rollbackTargetId.value = action === "rollback" ? (rollbackTargets.value[0]?.id ?? "") : "";
  showAction.value = true;
}
function closeAction() {
  if (busy.value) return;
  showAction.value = false;
  pendingAction.value = null;
  actionError.value = "";
}
async function submitAction() {
  if (!selected.value || !pendingAction.value) return;
  const reason = actionReason.value.trim();
  if (reason.length < 2) {
    actionError.value = "请填写至少 2 个字的审计原因。";
    return;
  }
  if (pendingAction.value.action === "rollback" && !rollbackTargetId.value) {
    actionError.value = "请选择要恢复的历史规则。";
    return;
  }
  const currentAction = pendingAction.value;
  const result = await post(
    `/cost-rules/${selected.value.id}/actions`,
    {
      action: currentAction.action,
      reason,
      expected_revision: selected.value.revision,
      ...(currentAction.approvalRole ? { approval_role: currentAction.approvalRole } : {}),
      ...(currentAction.action === "rollback" ? { target_rule_id: rollbackTargetId.value } : {}),
    },
    (value) => (actionError.value = value),
  );
  if (result) {
    showAction.value = false;
    pendingAction.value = null;
    selectRule(result);
    await load();
    notice.value = `规则已${actionLabels[currentAction.action]}，历史版本与审计记录均已保留。`;
  }
}
function handleStatePrimary() {
  if (state.value === "empty" && canManage.value) openCreate();
  else void load();
}
function hasApproval(role: ApprovalRole) {
  return selected.value?.approvals.includes(role) ?? false;
}

watch([search, statusFilter], () => {
  page.value = 1;
});
watch(pageCount, (count) => {
  if (page.value > count) page.value = count;
});
watch(pagedRules, (items) => {
  if (!items.length) {
    selected.value = null;
    return;
  }
  if (!items.some((item) => item.id === selected.value?.id)) selected.value = items[0] ?? null;
});

onMounted(load);
</script>

<template>
  <section class="cost-console" aria-labelledby="cost-rule-title">
    <header>
      <div>
        <p>费用治理</p>
        <h2 id="cost-rule-title">费用与利润规则</h2>
        <span>所有费率必须显式填写；规则经选品经理与组织管理员双审批后才可发布。</span>
      </div>
      <div class="cost-head-actions">
        <RouterLink :to="returnPath">返回当前找货记录</RouterLink>
        <button v-if="canManage" type="button" @click="openCreate">新建规则</button>
      </div>
    </header>
    <p v-if="notice" class="cost-notice" role="status">
      {{ notice }} <code v-if="requestId">{{ requestId }}</code>
    </p>
    <UiStatePanel
      v-if="state !== 'ready'"
      :kind="state"
      :request-id="requestId"
      :title="
        state === 'empty' ? (canManage ? '尚未创建费用规则' : '暂无可查看的费用规则') : undefined
      "
      :description="
        state === 'empty'
          ? canManage
            ? '创建首个显式费用版本后，再提交双角色审批。'
            : '当前工作区尚未发布费用规则，请联系有审批权限的成员创建。'
          : undefined
      "
      :primary-label="statePrimaryLabel"
      secondary-label="返回找货记录"
      @primary="handleStatePrimary"
      @secondary="router.push(returnPath)"
    />
    <div v-else class="cost-layout">
      <section class="cost-rule-browser" aria-label="费用规则浏览器">
        <form class="cost-rule-filters" role="search" @submit.prevent>
          <label
            >搜索规则<input v-model="search" type="search" placeholder="名称、市场、平台或版本号"
          /></label>
          <label
            >状态<select v-model="statusFilter">
              <option value="all">全部状态</option>
              <option v-for="status in statusOptions" :key="status" :value="status">
                {{ statusLabels[status] ?? status }}
              </option>
            </select></label
          >
          <button type="button" :disabled="!search && statusFilter === 'all'" @click="resetFilters">
            重置
          </button>
          <output>共 {{ filteredRules.length }} 条</output>
        </form>
        <section class="cost-rule-list" aria-label="费用规则版本">
          <button
            v-for="rule in pagedRules"
            :key="rule.id"
            :class="{ selected: selected?.id === rule.id }"
            :aria-pressed="selected?.id === rule.id"
            @click="selectRule(rule)"
          >
            <i :data-status="rule.status"></i
            ><span
              ><strong>{{ rule.name }}</strong
              ><small
                >{{ rule.market }} · {{ rule.platform }} · {{ rule.version_code }}</small
              ></span
            ><b>{{ statusLabels[rule.status] ?? rule.status }}</b
            ><em>修订 {{ rule.revision }}</em>
          </button>
          <p v-if="!pagedRules.length" class="cost-filter-empty">没有符合当前条件的规则。</p>
        </section>
        <nav v-if="pageCount > 1" class="cost-pagination" aria-label="费用规则分页">
          <button type="button" :disabled="page <= 1" @click="page--">上一页</button>
          <span>第 {{ page }} / {{ pageCount }} 页</span>
          <button type="button" :disabled="page >= pageCount" @click="page++">下一页</button>
        </nav>
      </section>
      <article v-if="selected" class="cost-rule-detail">
        <header>
          <div>
            <p>版本化规则</p>
            <h3>{{ selected.name }}</h3>
            <span
              >生效日 {{ selected.effective_from }} · {{ selected.market }} /
              {{ selected.platform }} · {{ selected.version_code }}</span
            >
          </div>
          <b :data-status="selected.status">{{
            statusLabels[selected.status] ?? selected.status
          }}</b>
        </header>
        <div class="cost-fees">
          <article v-for="fee in selected.fee_lines" :key="fee.type">
            <small>{{ feeLabels[fee.type] }}</small
            ><strong
              >{{ fee.value
              }}{{ fee.mode === "percentage_of_sale" ? "%" : ` ${fee.currency}` }}</strong
            ><span>{{ modeLabels[fee.mode] }}</span>
          </article>
        </div>
        <section>
          <h4>审批链</h4>
          <p>
            <b :data-done="hasApproval('selection_manager')">选品经理</b
            ><b :data-done="hasApproval('organization_admin')">组织管理员</b>
          </p>
          <small>提交、审批、拒绝、发布和回滚均保留操作者、原因、事件与事务消息。</small>
        </section>
        <footer class="cost-rule-actions">
          <button
            v-if="canManage && selected.status === 'draft'"
            :disabled="busy"
            @click="beginAction('submit')"
          >
            提交审批
          </button>
          <template v-if="selected.status === 'pending_approval'">
            <button
              v-if="canSelection && !hasApproval('selection_manager')"
              :disabled="busy"
              @click="beginAction('approve', 'selection_manager')"
            >
              选品经理批准
            </button>
            <button
              v-if="canSelection && !hasApproval('selection_manager')"
              :disabled="busy"
              class="danger"
              @click="beginAction('reject', 'selection_manager')"
            >
              选品经理拒绝
            </button>
            <button
              v-if="canAdmin && !hasApproval('organization_admin')"
              :disabled="busy"
              @click="beginAction('approve', 'organization_admin')"
            >
              组织管理员批准
            </button>
            <button
              v-if="canAdmin && !hasApproval('organization_admin')"
              :disabled="busy"
              class="danger"
              @click="beginAction('reject', 'organization_admin')"
            >
              组织管理员拒绝
            </button>
          </template>
          <button
            v-if="canManage && selected.status === 'approved'"
            :disabled="busy"
            @click="beginAction('publish')"
          >
            发布规则
          </button>
          <button
            v-if="canManage && selected.status === 'active' && rollbackTargets.length"
            :disabled="busy"
            class="danger"
            @click="beginAction('rollback')"
          >
            回滚到历史版本
          </button>
          <small v-if="!canManage" class="cost-readonly-note"
            >当前账号仅可查看，不能变更规则。</small
          >
          <small
            v-else-if="selected.status === 'pending_approval' && !canSelection && !canAdmin"
            class="cost-readonly-note"
            >等待选品经理或组织管理员处理。</small
          >
          <small
            v-else-if="selected.status === 'active' && !rollbackTargets.length"
            class="cost-readonly-note"
            >暂无同市场、同平台的已批准或停用版本可回滚。</small
          >
        </footer>
      </article>
    </div>
    <dialog
      v-if="showCreate"
      ref="createDialogElement"
      class="cost-modal"
      aria-labelledby="new-cost-rule"
      @cancel="cancelCreate"
    >
      <form @submit.prevent="create">
        <header>
          <div>
            <p>不使用默认费用</p>
            <h3 id="new-cost-rule">新建费用规则草稿</h3>
          </div>
          <button type="button" aria-label="关闭" @click="closeCreate">×</button>
        </header>
        <div>
          <label>市场<input v-model="form.market" required maxlength="40" /></label
          ><label>平台<input v-model="form.platform" required maxlength="80" /></label>
        </div>
        <label
          >版本号<input
            v-model="form.version_code"
            required
            maxlength="64"
            placeholder="例如 US-AMZ-2026-01" /></label
        ><label>规则名称<input v-model="form.name" required maxlength="160" /></label
        ><label>生效日期<input v-model="form.effective_from" required type="date" /></label>
        <fieldset>
          <legend>显式费用</legend>
          <label
            >平台费 %<input
              v-model="form.platform_fee"
              required
              type="number"
              min="0"
              max="100"
              step="0.000001"
              placeholder="必须填写" /></label
          ><label
            >支付手续费 %<input
              v-model="form.payment_fee"
              required
              type="number"
              min="0"
              max="100"
              step="0.000001"
              placeholder="必须填写" /></label
          ><label
            >税费 %<input
              v-model="form.tax"
              required
              type="number"
              min="0"
              max="100"
              step="0.000001"
              placeholder="必须填写" /></label
          ><label
            >履约成本<input
              v-model="form.fulfillment"
              required
              type="number"
              min="0"
              step="0.000001"
              placeholder="必须填写" /></label
          ><label
            >履约币种<input
              v-model="form.currency"
              required
              maxlength="3"
              pattern="[A-Za-z]{3}"
              autocomplete="off"
          /></label>
        </fieldset>
        <p class="cost-form-summary" :data-valid="!createValidation" role="status">
          {{ createValidation || "四项费用已显式填写，可以保存草稿。" }}
        </p>
        <p v-if="createError" class="cost-dialog-error" role="alert">
          {{ createError }} <code v-if="requestId">{{ requestId }}</code>
        </p>
        <aside>保存仅创建草稿；必须完成两类真实角色审批后才能发布。</aside>
        <footer>
          <button type="button" :disabled="busy" @click="closeCreate">取消</button
          ><button type="submit" :disabled="busy || Boolean(createValidation)">
            {{ busy ? "保存中…" : "保存草稿" }}
          </button>
        </footer>
      </form>
    </dialog>
    <dialog
      v-if="showAction && selected && pendingAction"
      ref="actionDialogElement"
      class="cost-modal cost-action-modal"
      :aria-label="actionTitle"
      @cancel="cancelAction"
    >
      <form @submit.prevent="submitAction">
        <header>
          <div>
            <p>审计操作</p>
            <h3>{{ actionTitle }}</h3>
          </div>
          <button type="button" aria-label="关闭操作确认" @click="closeAction">×</button>
        </header>
        <p class="cost-action-context">
          {{ selected.name }} · {{ selected.market }} / {{ selected.platform }} ·
          {{ selected.version_code }}
        </p>
        <label v-if="pendingAction.action === 'rollback'">
          恢复目标
          <select v-model="rollbackTargetId" required>
            <option v-for="target in rollbackTargets" :key="target.id" :value="target.id">
              {{ target.name }} · {{ target.version_code }} ·
              {{ statusLabels[target.status] ?? target.status }}
            </option>
          </select>
        </label>
        <label>
          操作原因（至少 2 个字）
          <textarea v-model="actionReason" required minlength="2" maxlength="1000" rows="4" />
        </label>
        <p v-if="actionError" class="cost-dialog-error" role="alert">
          {{ actionError }} <code v-if="requestId">{{ requestId }}</code>
        </p>
        <aside>原因会与操作者、角色、规则版本和请求链路一起保留。</aside>
        <footer>
          <button type="button" :disabled="busy" @click="closeAction">取消</button
          ><button type="submit" :disabled="busy || actionReason.trim().length < 2">
            {{ busy ? "提交中…" : `确认${actionLabels[pendingAction.action]}` }}
          </button>
        </footer>
      </form>
    </dialog>
  </section>
</template>
