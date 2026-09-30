<script setup lang="ts">
import {
  computed,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  reactive,
  ref,
} from "vue";
import { ApiClientError, createApiClient, type ApiFailureKind } from "../api-client";
import { useModalDialog } from "../use-modal-dialog";
import QualityGateSetupSummary from "./shared/QualityGateSetupSummary.vue";
import UiStatePanel from "./UiStatePanel.vue";
import "../opportunities.css";
import "../scoring.css";
type State = "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
type Action = "submit" | "approve" | "reject" | "activate" | "rollback";
type CreateField = "version_code" | "name" | "recommend_min" | "observe_min" | "dimensions";
interface Dimension {
  code: string;
  label: string;
  weight: number;
  required: boolean;
  evidence_group: string;
}
interface Rule {
  id: string;
  version_code: string;
  name: string;
  status: string;
  dimensions: Dimension[];
  thresholds: { recommend_min: number; observe_min: number };
  revision: number;
  submitted_at: string | null;
  approved_at: string | null;
  activated_at: string | null;
  updated_at: string;
}
interface RulePreview {
  rule_id: string;
  rule_version_code: string;
  rule_status: string;
  page: number;
  page_size: number;
  total: number;
  items: Array<{
    opportunity_id: string;
    opportunity_name: string;
    lifecycle_status: string;
    current_score: number | null;
    current_recommendation_status: string;
    current_rule_version: string | null;
    projected_score: number | null;
    projected_recommendation_status: string;
    projected_coverage_percent: number;
    score_delta: number | null;
    recommendation_changed: boolean;
    missing_fields: string[];
  }>;
  page_summary: {
    increased: number;
    decreased: number;
    unchanged: number;
    newly_calculable: number;
    insufficient_data: number;
    recommendation_changed: number;
  };
  read_only: true;
}
const props = withDefaults(defineProps<{ apiBaseUrl: string; capabilities?: string[] }>(), {
    capabilities: () => [],
  }),
  request = createApiClient(props.apiBaseUrl),
  state = ref<State>("loading"),
  rules = ref<Rule[]>([]),
  requestId = ref(""),
  message = ref(""),
  busy = ref(false),
  showCreate = ref(false),
  createError = ref(""),
  showAction = ref(false),
  actionError = ref(""),
  selected = ref<Rule | null>(null),
  action = ref<Action>("submit"),
  reason = ref(""),
  targetRuleId = ref(""),
  showPreview = ref(false),
  previewing = ref(false),
  previewError = ref(""),
  previewRule = ref<Rule | null>(null),
  preview = ref<RulePreview | null>(null);
const definitions = [
  ["market_demand", "市场需求"],
  ["competition", "竞争"],
  ["profit", "利润"],
  ["fulfillment_efficiency", "履约效率"],
  ["customer_experience", "客户体验"],
  ["content_fit", "场景与内容适配"],
  ["risk", "风险"],
  ["data_quality", "数据质量"],
];
const blankDimensions = () =>
  definitions.map(([code, label]) => ({
    code,
    label,
    weight: 0,
    required: false,
    evidence_group: "other",
  }));
const form = reactive({
  version_code: "",
  name: "",
  recommend_min: null as number | null,
  observe_min: null as number | null,
  dimensions: blankDimensions(),
});
const createTouched = reactive<Record<CreateField, boolean>>({
  version_code: false,
  name: false,
  recommend_min: false,
  observe_min: false,
  dimensions: false,
});
let actionDialogGeneration = 0;
let createDialogGeneration = 0;
let previewReadGeneration = 0;
let listReadController: AbortController | null = null,
  pageActive = true,
  resumeListRead = false;
let pendingPreviewRead: { rule: Rule; page: number; generation: number } | null = null;
const capabilities = computed(() => new Set(props.capabilities)),
  canDecide = computed(() => capabilities.value.has("opportunity:decide")),
  canApprove = computed(() => capabilities.value.has("opportunity:approve")),
  activeRule = computed(() => rules.value.find((rule) => rule.status === "active") ?? null),
  activeEvidenceGroups = computed(
    () =>
      new Set(
        (activeRule.value?.dimensions ?? [])
          .filter((item) => item.weight > 0)
          .map((item) => item.evidence_group),
      ),
  ),
  scoringSetupItems = computed(() => [
    {
      label: "评分规则",
      detail: activeRule.value ? activeRule.value.version_code : "尚无已启用版本",
      ready: Boolean(activeRule.value),
    },
    {
      label: "市场证据",
      detail: activeEvidenceGroups.value.has("market") ? "已纳入评分" : "未设置市场证据组",
      ready: activeEvidenceGroups.value.has("market"),
    },
    {
      label: "竞争证据",
      detail: activeEvidenceGroups.value.has("competition") ? "已纳入评分" : "未设置竞争证据组",
      ready: activeEvidenceGroups.value.has("competition"),
    },
    {
      label: "成本证据",
      detail: activeEvidenceGroups.value.has("cost") ? "已纳入评分" : "未设置成本证据组",
      ready: activeEvidenceGroups.value.has("cost"),
    },
    {
      label: "风险维度",
      detail: activeRule.value?.dimensions.some((item) => item.code === "risk" && item.weight > 0)
        ? "已启用风险权重"
        : "未启用风险权重",
      ready: Boolean(
        activeRule.value?.dimensions.some((item) => item.code === "risk" && item.weight > 0),
      ),
    },
  ]),
  scoringSetupReady = computed(() => scoringSetupItems.value.every((item) => item.ready)),
  activeDimensions = computed(() => form.dimensions.filter((item) => item.weight > 0)),
  weightTotal = computed(
    () =>
      Math.round(activeDimensions.value.reduce((sum, item) => sum + item.weight, 0) * 100) / 100,
  ),
  createValidation = computed(() => {
    if (!form.version_code.trim() || !form.name.trim()) return "请填写版本代码和规则名称。";
    if (form.recommend_min == null || form.observe_min == null) return "请填写推荐与观察阈值。";
    if (
      form.recommend_min < 0 ||
      form.recommend_min > 100 ||
      form.observe_min < 0 ||
      form.observe_min > 100
    )
      return "推荐与观察阈值必须在 0 到 100 之间。";
    if (form.recommend_min <= form.observe_min) return "推荐阈值必须大于观察阈值。";
    if (activeDimensions.value.length < 2) return "至少配置 2 个权重大于 0 的评分维度。";
    if (weightTotal.value !== 100) return `当前权重合计 ${weightTotal.value}%，必须为 100%。`;
    if (!activeDimensions.value.some((item) => item.required))
      return "至少将 1 个已启用维度标记为必填。";
    return "";
  }),
  createFieldErrors = computed<Record<CreateField, string>>(() => {
    const recommendRangeInvalid =
        form.recommend_min != null && (form.recommend_min < 0 || form.recommend_min > 100),
      observeRangeInvalid =
        form.observe_min != null && (form.observe_min < 0 || form.observe_min > 100),
      thresholdsComparable =
        form.recommend_min != null &&
        form.observe_min != null &&
        !recommendRangeInvalid &&
        !observeRangeInvalid,
      dimensionError =
        activeDimensions.value.length < 2
          ? "至少配置 2 个权重大于 0 的评分维度。"
          : weightTotal.value !== 100
            ? `当前权重合计 ${weightTotal.value}%，必须为 100%。`
            : !activeDimensions.value.some((item) => item.required)
              ? "至少将 1 个已启用维度标记为必填。"
              : "";
    return {
      version_code: form.version_code.trim() ? "" : "请输入版本代码。",
      name: form.name.trim() ? "" : "请输入规则名称。",
      recommend_min:
        form.recommend_min == null
          ? "请输入推荐阈值。"
          : recommendRangeInvalid
            ? "推荐阈值必须在 0 到 100 之间。"
            : thresholdsComparable && form.recommend_min <= form.observe_min!
              ? "推荐阈值必须大于观察阈值。"
              : "",
      observe_min:
        form.observe_min == null
          ? "请输入观察阈值。"
          : observeRangeInvalid
            ? "观察阈值必须在 0 到 100 之间。"
            : "",
      dimensions: dimensionError,
    };
  }),
  statusLabels: Record<string, string> = {
    draft: "草稿",
    pending_approval: "待审批",
    approved: "已批准",
    active: "已启用",
    rejected: "已拒绝",
    retired: "已停用",
    rolled_back: "已回滚",
  },
  recommendationLabels: Record<string, string> = {
    recommend: "推荐",
    observe: "观察",
    insufficient_data: "数据不足",
  },
  lifecycleLabels: Record<string, string> = {
    candidate: "候选",
    validating: "验证中",
    ready: "可决策",
    adopted: "已采纳",
    observing: "观察中",
    rejected: "已驳回",
    archived: "已归档",
  },
  actionLabels: Record<Action, string> = {
    submit: "提交审批",
    approve: "批准",
    reject: "拒绝",
    activate: "启用",
    rollback: "回滚",
  };
const { dialogElement: createDialogElement, handleCancel: cancelCreate } = useModalDialog(
    () => showCreate.value,
    () => closeCreate(),
  ),
  { dialogElement: previewDialogElement, handleCancel: cancelPreview } = useModalDialog(
    () => showPreview.value && Boolean(previewRule.value),
    () => closePreview(),
  ),
  { dialogElement: actionDialogElement, handleCancel: cancelAction } = useModalDialog(
    () => showAction.value && Boolean(selected.value),
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
  time = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat("zh-CN", {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date(value))
      : "—";
async function load() {
  if (!pageActive) {
    resumeListRead = true;
    return;
  }
  listReadController?.abort("superseded");
  const controller = new AbortController();
  listReadController = controller;
  state.value = "loading";
  try {
    const response = await request<Rule[]>("/opportunity-score-rules", {
      signal: controller.signal,
    });
    if (!pageActive || controller !== listReadController) return;
    requestId.value = response.request_id;
    rules.value = response.data;
    state.value = rules.value.length ? "ready" : "empty";
  } catch (error) {
    if (!pageActive || controller !== listReadController) return;
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      message.value = error.actionHint;
      state.value = stateFrom(error.kind);
    } else state.value = "blocked";
  } finally {
    if (listReadController === controller) listReadController = null;
  }
}
function suspendListRead(reason: "deactivated" | "unmounted") {
  const interrupted = Boolean(listReadController);
  pageActive = false;
  listReadController?.abort(reason);
  listReadController = null;
  resumeListRead ||= reason === "deactivated" && interrupted;
}
const scoreRuleErrorLabels: Record<string, string> = {
    score_rule_version_conflict: "版本代码已存在。",
    score_rule_revision_conflict: "规则已被其他操作更新。",
    score_rule_transition_invalid: "当前规则状态不允许此操作。",
    score_rule_not_found: "规则不存在或不属于当前工作区。",
    score_rule_weight_invalid: "维度权重合计必须为 100。",
    score_rule_threshold_invalid: "推荐与观察阈值无效。",
    score_rule_action_invalid: "规则动作无效。",
    score_rule_rollback_target_required: "请选择要恢复的历史规则版本。",
    score_rule_rollback_target_invalid: "所选历史规则版本不可用于回滚。",
    score_rule_preview_status_invalid: "当前规则状态不能预览发布影响。",
    score_rule_preview_pagination_invalid: "预览页码或每页数量无效。",
  },
  apiErrorText = (error: ApiClientError) =>
    `${scoreRuleErrorLabels[error.code] ?? error.userMessage} ${error.actionHint}`.trim();
async function post(
  path: string,
  body: unknown,
  setError: (value: string) => void,
  isCurrent: () => boolean = () => true,
) {
  if (busy.value) return null;
  busy.value = true;
  setError("");
  try {
    const response = await request<any>(path, { method: "POST", body });
    if (isCurrent()) requestId.value = response.request_id;
    return response.data;
  } catch (error) {
    if (isCurrent() && error instanceof ApiClientError) {
      requestId.value = error.requestId;
      setError(apiErrorText(error));
      return null;
    }
    if (isCurrent()) setError("依赖暂不可用，未写入状态。请检查网络后重试。");
    return null;
  } finally {
    busy.value = false;
  }
}
function resetForm() {
  form.version_code = "";
  form.name = "";
  form.recommend_min = null;
  form.observe_min = null;
  form.dimensions.splice(0, form.dimensions.length, ...blankDimensions());
  for (const field of Object.keys(createTouched) as CreateField[]) createTouched[field] = false;
}
function touchCreateField(field: CreateField) {
  createTouched[field] = true;
}
function createFieldError(field: CreateField) {
  return createTouched[field] ? createFieldErrors.value[field] : "";
}
function createFieldDescribedBy(field: CreateField, helpId: string) {
  return [helpId, createFieldError(field) ? `score-rule-${field}-error` : ""]
    .filter(Boolean)
    .join(" ");
}
function createFieldInvalid(field: CreateField) {
  return Boolean(createFieldError(field));
}
function openCreate() {
  createDialogGeneration += 1;
  createError.value = "";
  showCreate.value = true;
}
function closeCreate() {
  showCreate.value = false;
  createError.value = "";
}
function closePreview() {
  showPreview.value = false;
  previewError.value = "";
  previewReadGeneration += 1;
  pendingPreviewRead = null;
  preview.value = null;
}
function closeAction() {
  actionDialogGeneration += 1;
  showAction.value = false;
  actionError.value = "";
}
async function create() {
  if (!canDecide.value || createValidation.value) return;
  const generation = createDialogGeneration;
  const dimensions = form.dimensions.filter((item) => item.weight > 0),
    result = await post(
      "/opportunity-score-rules",
      {
        version_code: form.version_code,
        name: form.name,
        dimensions,
        thresholds: {
          recommend_min: form.recommend_min,
          observe_min: form.observe_min,
        },
      },
      (value) => (createError.value = value),
      () => generation === createDialogGeneration && showCreate.value,
    );
  if (result) {
    if (generation === createDialogGeneration) {
      closeCreate();
      resetForm();
    }
    await load();
    message.value = "草稿已创建；发布前仍需提交、审批和启用。";
  }
}
function begin(rule: Rule, value: Action) {
  if ((value === "submit" && !canDecide.value) || (value !== "submit" && !canApprove.value)) return;
  actionDialogGeneration += 1;
  selected.value = rule;
  action.value = value;
  reason.value = "";
  targetRuleId.value = "";
  actionError.value = "";
  showAction.value = true;
}
async function runPreviewRead(rule: Rule, page: number, generation: number) {
  previewing.value = true;
  try {
    const response = await request<RulePreview>(
      `/opportunity-score-rules/${rule.id}/preview?page=${page}&page_size=20`,
    );
    if (
      generation !== previewReadGeneration ||
      !showPreview.value ||
      previewRule.value?.id !== rule.id
    )
      return;
    requestId.value = response.request_id;
    preview.value = response.data;
  } catch (error) {
    if (
      generation !== previewReadGeneration ||
      !showPreview.value ||
      previewRule.value?.id !== rule.id
    )
      return;
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      previewError.value = apiErrorText(error);
    } else previewError.value = "预览依赖暂不可用；规则和机会状态均未改变。";
  } finally {
    previewing.value = false;
    const queued = pendingPreviewRead;
    pendingPreviewRead = null;
    if (
      queued &&
      queued.generation === previewReadGeneration &&
      showPreview.value &&
      previewRule.value?.id === queued.rule.id
    )
      void runPreviewRead(queued.rule, queued.page, queued.generation);
  }
}
function loadPreview(rule: Rule, page = 1) {
  if (!canApprove.value) return;
  const generation = ++previewReadGeneration;
  previewRule.value = rule;
  showPreview.value = true;
  previewError.value = "";
  preview.value = null;
  if (previewing.value) {
    pendingPreviewRead = { rule, page, generation };
    return;
  }
  void runPreviewRead(rule, page, generation);
}
function changePreviewPage(page: number) {
  if (previewRule.value) void loadPreview(previewRule.value, page);
}
const scoreText = (value: number | null) => (value == null ? "数据不足" : value.toFixed(2)),
  deltaText = (value: number | null) =>
    value == null ? "不可比较" : `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
async function runAction() {
  const selectedRule = selected.value;
  if (!selectedRule) return;
  const submittedAction = action.value,
    submittedReason = reason.value,
    submittedTargetRuleId = targetRuleId.value,
    generation = actionDialogGeneration,
    isCurrent = () => generation === actionDialogGeneration;
  const result = await post(
    `/opportunity-score-rules/${selectedRule.id}/actions`,
    {
      action: submittedAction,
      reason: submittedReason,
      expected_revision: selectedRule.revision,
      ...(submittedAction === "rollback" ? { target_rule_id: submittedTargetRuleId } : {}),
    },
    (value) => {
      if (isCurrent()) actionError.value = value;
    },
    isCurrent,
  );
  if (result) {
    if (isCurrent()) closeAction();
    await load();
    message.value = `${actionLabels[submittedAction]}已完成并写入审计记录。`;
  }
}
onMounted(() => void load());
onDeactivated(() => suspendListRead("deactivated"));
onBeforeUnmount(() => suspendListRead("unmounted"));
onActivated(() => {
  pageActive = true;
  if (!resumeListRead) return;
  resumeListRead = false;
  void load();
});
</script>
<template>
  <section class="score-rules score-rules--review">
    <header class="score-rules-hero">
      <div>
        <p>自动推荐 · 评分与证据</p>
        <h2>评分与质量门</h2>
        <span>只有已启用规则要求真实市场、竞争、成本和风险证据时，候选才可能进入“建议采纳”。</span>
      </div>
      <button v-if="canDecide && state !== 'ready'" type="button" @click="openCreate">
        新建规则版本
      </button>
      <span v-else-if="!canDecide" class="score-rule-readonly-note">当前身份仅可查看规则。</span>
    </header>
    <p v-if="message" class="opportunity-message" role="status">
      {{ message }} <code v-if="requestId">{{ requestId }}</code>
    </p>
    <UiStatePanel
      v-if="state !== 'ready' && state !== 'empty'"
      :kind="state"
      :request-id="requestId"
      :hide-secondary="true"
      @primary="load"
    />
    <section v-else-if="state === 'empty'" class="score-empty">
      <strong>尚无评分规则</strong
      ><span>智能选品不提供虚构默认权重；请创建、审批并启用明确版本。</span
      ><button v-if="canDecide" type="button" @click="openCreate">创建首个草稿</button
      ><span v-else class="score-rule-readonly-note"
        >请联系具备规则提交权限的成员创建首个草稿。</span
      >
    </section>
    <QualityGateSetupSummary
      v-else
      title="评分规则覆盖"
      :description="
        activeRule
          ? `当前启用 ${activeRule.version_code}；完整自动推荐还需要竞品监控和费用规则同时生效。`
          : '当前没有已启用评分规则，所有规则命中商品只能停留在候选队列。'
      "
      :status="scoringSetupReady ? '评分配置已覆盖' : '评分配置未就绪'"
      :ready="scoringSetupReady"
      :items="scoringSetupItems"
    >
      <button v-if="canDecide" class="quality-gate-next" type="button" @click="openCreate">
        创建新版本补齐配置
      </button>
    </QualityGateSetupSummary>
    <section v-if="state === 'ready'" class="score-rule-list">
      <header>
        <span>版本</span><span>阈值</span><span>维度与权重</span><span>状态</span><span>操作</span>
      </header>
      <article v-for="rule in rules" :key="rule.id">
        <div>
          <strong>{{ rule.name }}</strong
          ><code>{{ rule.version_code }} · rev {{ rule.revision }}</code
          ><small>更新 {{ time(rule.updated_at) }}</small>
        </div>
        <div>
          <b>推荐 ≥ {{ rule.thresholds.recommend_min }}</b
          ><small>观察 ≥ {{ rule.thresholds.observe_min }}</small>
        </div>
        <div class="score-weight-list">
          <span v-for="item in rule.dimensions" :key="item.code"
            ><i :style="{ width: `${item.weight}%` }"></i
            ><em>{{ item.label }} {{ item.weight }}%</em></span
          >
        </div>
        <div>
          <b :data-status="rule.status">{{ statusLabels[rule.status] ?? rule.status }}</b
          ><small>审批 {{ time(rule.approved_at) }}</small>
        </div>
        <nav>
          <button
            v-if="canApprove && ['draft', 'pending_approval', 'approved'].includes(rule.status)"
            type="button"
            @click="loadPreview(rule)"
          >
            预览影响
          </button>
          <button v-if="canDecide && rule.status === 'draft'" @click="begin(rule, 'submit')">
            提交</button
          ><button
            v-if="canApprove && rule.status === 'pending_approval'"
            @click="begin(rule, 'approve')"
          >
            批准</button
          ><button
            v-if="canApprove && rule.status === 'pending_approval'"
            @click="begin(rule, 'reject')"
          >
            拒绝</button
          ><button v-if="canApprove && rule.status === 'approved'" @click="begin(rule, 'activate')">
            启用</button
          ><button v-if="canApprove && rule.status === 'active'" @click="begin(rule, 'rollback')">
            回滚
          </button>
          <small
            v-if="rule.status === 'pending_approval' && !canApprove"
            class="score-rule-readonly-note"
            >等待有审批权限的成员处理</small
          >
        </nav>
      </article>
    </section>
    <dialog
      v-if="showCreate"
      ref="createDialogElement"
      class="opportunity-modal"
      aria-labelledby="score-rule-create-title"
      @cancel="cancelCreate"
    >
      <form @submit.prevent="create">
        <header>
          <div>
            <p>不使用默认数值</p>
            <h3 id="score-rule-create-title">新建评分规则草稿</h3>
          </div>
          <button type="button" aria-label="关闭" @click="closeCreate">×</button>
        </header>
        <div class="score-form-fields">
          <div class="score-field">
            <label for="score-rule-version-code">版本代码</label>
            <input
              id="score-rule-version-code"
              v-model="form.version_code"
              required
              maxlength="64"
              placeholder="例如 org-v1"
              :aria-invalid="createFieldInvalid('version_code') ? 'true' : undefined"
              :aria-describedby="
                createFieldDescribedBy('version_code', 'score-rule-version-code-help')
              "
              @blur="touchCreateField('version_code')"
            />
            <small id="score-rule-version-code-help">必填，最多 64 个字符。</small>
            <small
              v-if="createFieldError('version_code')"
              id="score-rule-version_code-error"
              class="score-field-error"
              role="alert"
              >{{ createFieldError("version_code") }}</small
            >
          </div>
          <div class="score-field">
            <label for="score-rule-name">规则名称</label>
            <input
              id="score-rule-name"
              v-model="form.name"
              required
              maxlength="160"
              :aria-invalid="createFieldInvalid('name') ? 'true' : undefined"
              :aria-describedby="createFieldDescribedBy('name', 'score-rule-name-help')"
              @blur="touchCreateField('name')"
            />
            <small id="score-rule-name-help">必填，最多 160 个字符。</small>
            <small
              v-if="createFieldError('name')"
              id="score-rule-name-error"
              class="score-field-error"
              role="alert"
              >{{ createFieldError("name") }}</small
            >
          </div>
        </div>
        <div class="score-form-fields">
          <div class="score-field">
            <label for="score-rule-recommend-min">推荐阈值</label>
            <input
              id="score-rule-recommend-min"
              v-model.number="form.recommend_min"
              required
              type="number"
              min="0"
              max="100"
              step="0.01"
              :aria-invalid="createFieldInvalid('recommend_min') ? 'true' : undefined"
              :aria-describedby="
                createFieldDescribedBy('recommend_min', 'score-rule-recommend-min-help')
              "
              @blur="touchCreateField('recommend_min')"
            />
            <small id="score-rule-recommend-min-help">0 到 100，且必须高于观察阈值。</small>
            <small
              v-if="createFieldError('recommend_min')"
              id="score-rule-recommend_min-error"
              class="score-field-error"
              role="alert"
              >{{ createFieldError("recommend_min") }}</small
            >
          </div>
          <div class="score-field">
            <label for="score-rule-observe-min">观察阈值</label>
            <input
              id="score-rule-observe-min"
              v-model.number="form.observe_min"
              required
              type="number"
              min="0"
              max="100"
              step="0.01"
              :aria-invalid="createFieldInvalid('observe_min') ? 'true' : undefined"
              :aria-describedby="
                createFieldDescribedBy('observe_min', 'score-rule-observe-min-help')
              "
              @blur="touchCreateField('observe_min')"
            />
            <small id="score-rule-observe-min-help">0 到 100。</small>
            <small
              v-if="createFieldError('observe_min')"
              id="score-rule-observe-min-error"
              class="score-field-error"
              role="alert"
              >{{ createFieldError("observe_min") }}</small
            >
          </div>
        </div>
        <section class="score-dimension-form" aria-labelledby="score-rule-dimensions-title">
          <header>
            <b id="score-rule-dimensions-title">评分维度</b>
            <small id="score-dimensions-help">仅权重大于 0 的维度会提交；合计必须为 100。</small>
          </header>
          <div v-for="item in form.dimensions" :key="item.code">
            <span>{{ item.label }}</span
            ><label
              >权重<input
                v-model.number="item.weight"
                :aria-label="`${item.label}权重`"
                :aria-invalid="createFieldInvalid('dimensions') ? 'true' : undefined"
                :aria-describedby="createFieldDescribedBy('dimensions', 'score-dimensions-help')"
                type="number"
                min="0"
                max="100"
                step="0.01"
                @blur="touchCreateField('dimensions')" /></label
            ><label
              >证据组<select v-model="item.evidence_group" :aria-label="`${item.label}证据组`">
                <option value="market">市场</option>
                <option value="competition">竞争</option>
                <option value="cost">成本</option>
                <option value="other">其他</option>
              </select></label
            ><label
              ><input
                v-model="item.required"
                type="checkbox"
                :aria-label="`${item.label}必填`"
                :aria-invalid="createFieldInvalid('dimensions') ? 'true' : undefined"
                :aria-describedby="createFieldDescribedBy('dimensions', 'score-dimensions-help')"
                @change="touchCreateField('dimensions')"
              />
              必填</label
            >
          </div>
          <p
            v-if="createFieldError('dimensions')"
            id="score-rule-dimensions-error"
            class="score-field-error"
            role="alert"
          >
            {{ createFieldError("dimensions") }}
          </p>
        </section>
        <p class="score-form-summary" :data-valid="!createValidation" role="status">
          {{ createValidation || `权重合计 ${weightTotal}%，可以保存草稿。` }}
        </p>
        <p v-if="createError" class="score-dialog-error" role="alert">
          {{ createError }} <code v-if="requestId">{{ requestId }}</code>
        </p>
        <aside>规则不会自动生效；需持有相应权限的人员提交、批准并启用。</aside>
        <footer>
          <button type="button" @click="closeCreate">取消</button
          ><button type="submit" :disabled="busy || Boolean(createValidation)">
            {{ busy ? "保存中…" : "保存草稿" }}
          </button>
        </footer>
      </form>
    </dialog>
    <dialog
      v-if="showPreview && previewRule"
      ref="previewDialogElement"
      class="opportunity-modal score-preview-modal"
      aria-labelledby="score-rule-preview-title"
      @cancel="cancelPreview"
    >
      <section>
        <header>
          <div>
            <p>只读试算 · 不写入评分运行</p>
            <h3 id="score-rule-preview-title">发布影响预览 · {{ previewRule.version_code }}</h3>
          </div>
          <button type="button" aria-label="关闭" @click="closePreview">×</button>
        </header>
        <p v-if="previewing" role="status">正在按当前持久化输入试算…</p>
        <div v-else-if="previewError" class="score-dialog-error" role="alert">
          <p>
            {{ previewError }} <code v-if="requestId">{{ requestId }}</code>
          </p>
          <button type="button" @click="loadPreview(previewRule)">重试预览</button>
        </div>
        <template v-else-if="preview">
          <aside>
            当前页 {{ preview.items.length }} / 共
            {{ preview.total }} 个机会；只比较当前页，不改规则、机会或历史评分。
          </aside>
          <dl class="score-preview-summary">
            <div>
              <dt>分数上升</dt>
              <dd>{{ preview.page_summary.increased }}</dd>
            </div>
            <div>
              <dt>分数下降</dt>
              <dd>{{ preview.page_summary.decreased }}</dd>
            </div>
            <div>
              <dt>新可计算</dt>
              <dd>{{ preview.page_summary.newly_calculable }}</dd>
            </div>
            <div>
              <dt>结论变化</dt>
              <dd>{{ preview.page_summary.recommendation_changed }}</dd>
            </div>
            <div>
              <dt>仍数据不足</dt>
              <dd>{{ preview.page_summary.insufficient_data }}</dd>
            </div>
          </dl>
          <div class="score-preview-table">
            <article v-for="item in preview.items" :key="item.opportunity_id">
              <div>
                <strong>{{ item.opportunity_name }}</strong>
                <small
                  >{{ lifecycleLabels[item.lifecycle_status] ?? item.lifecycle_status }} · 当前规则
                  {{ item.current_rule_version ?? "未评分" }}</small
                >
                <small v-if="item.missing_fields.length" class="score-preview-missing">
                  缺失字段：{{ item.missing_fields.join("、") }}
                </small>
              </div>
              <div>
                <small>当前</small><b>{{ scoreText(item.current_score) }}</b>
              </div>
              <div>
                <small>试算</small><b>{{ scoreText(item.projected_score) }}</b>
              </div>
              <div>
                <small>变化</small
                ><b :data-delta="item.score_delta">{{ deltaText(item.score_delta) }}</b>
              </div>
              <div>
                <small>结论</small
                ><b>{{
                  recommendationLabels[item.projected_recommendation_status] ??
                  item.projected_recommendation_status
                }}</b>
                <em v-if="item.recommendation_changed">有变化</em>
              </div>
              <div>
                <small>覆盖</small><b>{{ item.projected_coverage_percent }}%</b>
              </div>
            </article>
            <p v-if="!preview.items.length">当前工作区尚无机会可预览。</p>
          </div>
          <footer>
            <button
              type="button"
              :disabled="preview.page <= 1 || previewing"
              @click="changePreviewPage(preview.page - 1)"
            >
              上一页</button
            ><span>第 {{ preview.page }} 页</span
            ><button
              type="button"
              :disabled="preview.page * preview.page_size >= preview.total || previewing"
              @click="changePreviewPage(preview.page + 1)"
            >
              下一页
            </button>
          </footer>
        </template>
      </section>
    </dialog>
    <dialog
      v-if="showAction && selected"
      ref="actionDialogElement"
      class="opportunity-modal"
      aria-labelledby="score-rule-action-title"
      @cancel="cancelAction"
    >
      <form @submit.prevent="runAction">
        <header>
          <div>
            <p>留痕状态变更</p>
            <h3 id="score-rule-action-title">
              {{ actionLabels[action] }} · {{ selected.version_code }}
            </h3>
          </div>
          <button type="button" aria-label="关闭" @click="closeAction">×</button>
        </header>
        <label>原因（必填）<textarea v-model="reason" required maxlength="1000"></textarea></label
        ><label v-if="action === 'rollback'"
          >回滚目标版本<select v-model="targetRuleId" required>
            <option value="">请选择已批准或停用版本</option>
            <option
              v-for="rule in rules.filter((item) => ['approved', 'retired'].includes(item.status))"
              :key="rule.id"
              :value="rule.id"
            >
              {{ rule.version_code }} · {{ rule.status }}
            </option>
          </select></label
        >
        <p v-if="actionError" class="score-dialog-error" role="alert">
          {{ actionError }} <code v-if="requestId">{{ requestId }}</code>
        </p>
        <aside>状态变化和原因会写入审计与事务消息；历史评分运行保持不变。</aside>
        <footer>
          <button type="button" @click="closeAction">取消</button
          ><button type="submit" :disabled="busy">确认{{ actionLabels[action] }}</button>
        </footer>
      </form>
    </dialog>
  </section>
</template>
