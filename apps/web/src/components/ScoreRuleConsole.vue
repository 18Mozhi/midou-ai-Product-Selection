<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ApiClientError, createApiClient, type ApiFailureKind } from "../api-client";
import UiStatePanel from "./UiStatePanel.vue";
import "../scoring.css";
type State = "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
type Action = "submit" | "approve" | "reject" | "activate" | "rollback";
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
const props = defineProps<{ apiBaseUrl: string }>(),
  request = createApiClient(props.apiBaseUrl),
  state = ref<State>("loading"),
  rules = ref<Rule[]>([]),
  requestId = ref(""),
  message = ref(""),
  busy = ref(false),
  showCreate = ref(false),
  showAction = ref(false),
  selected = ref<Rule | null>(null),
  action = ref<Action>("submit"),
  reason = ref(""),
  targetRuleId = ref(""),
  showPreview = ref(false),
  previewing = ref(false),
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
const form = reactive({
  version_code: "",
  name: "",
  recommend_min: null as number | null,
  observe_min: null as number | null,
  dimensions: definitions.map(([code, label]) => ({
    code,
    label,
    weight: 0,
    required: false,
    evidence_group: "other",
  })),
});
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
  state.value = "loading";
  try {
    const response = await request<Rule[]>("/opportunity-score-rules");
    requestId.value = response.request_id;
    rules.value = response.data;
    state.value = rules.value.length ? "ready" : "empty";
  } catch (error) {
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      message.value = error.actionHint;
      state.value = stateFrom(error.kind);
    } else state.value = "blocked";
  }
}
async function post(path: string, body: unknown) {
  busy.value = true;
  message.value = "";
  try {
    const response = await request<any>(path, { method: "POST", body });
    requestId.value = response.request_id;
    return response.data;
  } catch (error) {
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      message.value = error.actionHint;
      return null;
    }
    message.value = "依赖暂不可用，未写入状态。";
    return null;
  } finally {
    busy.value = false;
  }
}
async function create() {
  const dimensions = form.dimensions.filter((item) => item.weight > 0),
    result = await post("/opportunity-score-rules", {
      version_code: form.version_code,
      name: form.name,
      dimensions,
      thresholds: {
        recommend_min: form.recommend_min,
        observe_min: form.observe_min,
      },
    });
  if (result) {
    showCreate.value = false;
    await load();
    message.value = "草稿已创建；发布前仍需提交、审批和启用。";
  }
}
function begin(rule: Rule, value: Action) {
  selected.value = rule;
  action.value = value;
  reason.value = "";
  targetRuleId.value = "";
  showAction.value = true;
}
async function loadPreview(rule: Rule, page = 1) {
  previewRule.value = rule;
  showPreview.value = true;
  previewing.value = true;
  message.value = "";
  try {
    const response = await request<RulePreview>(
      `/opportunity-score-rules/${rule.id}/preview?page=${page}&page_size=20`,
    );
    requestId.value = response.request_id;
    preview.value = response.data;
  } catch (error) {
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      message.value = error.actionHint;
    } else message.value = "预览依赖暂不可用；规则和机会状态均未改变。";
  } finally {
    previewing.value = false;
  }
}
function changePreviewPage(page: number) {
  if (previewRule.value) void loadPreview(previewRule.value, page);
}
const scoreText = (value: number | null) => (value == null ? "数据不足" : value.toFixed(2)),
  deltaText = (value: number | null) =>
    value == null ? "不可比较" : `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
async function runAction() {
  if (!selected.value) return;
  const result = await post(`/opportunity-score-rules/${selected.value.id}/actions`, {
    action: action.value,
    reason: reason.value,
    expected_revision: selected.value.revision,
    ...(action.value === "rollback" ? { target_rule_id: targetRuleId.value } : {}),
  });
  if (result) {
    showAction.value = false;
    await load();
    message.value = `规则动作 ${action.value} 已审计记录。`;
  }
}
onMounted(() => void load());
</script>
<template>
  <section class="score-rules">
    <header class="score-rules-hero">
      <div>
        <p>版本化评分</p>
        <h2>评分规则引擎</h2>
        <span>权重、阈值、证据覆盖与计算结果均版本化；历史结果不会被新规则或回滚改写。</span>
      </div>
      <button type="button" @click="showCreate = true">＋ 新建规则草稿</button>
    </header>
    <p v-if="message" class="opportunity-message" role="status">
      {{ message }} <code v-if="requestId">{{ requestId }}</code>
    </p>
    <UiStatePanel
      v-if="state !== 'ready' && state !== 'empty'"
      :kind="state"
      :request-id="requestId"
      @primary="load"
    />
    <section v-else-if="state === 'empty'" class="score-empty">
      <strong>尚无评分规则</strong
      ><span>智能选品不提供虚构默认权重；请创建、审批并启用明确版本。</span
      ><button type="button" @click="showCreate = true">创建首个草稿</button>
    </section>
    <section v-else class="score-rule-list">
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
          <b :data-status="rule.status">{{ rule.status }}</b
          ><small>审批 {{ time(rule.approved_at) }}</small>
        </div>
        <nav>
          <button
            v-if="['draft', 'pending_approval', 'approved'].includes(rule.status)"
            type="button"
            @click="loadPreview(rule)"
          >
            预览影响
          </button>
          <button v-if="rule.status === 'draft'" @click="begin(rule, 'submit')">提交</button
          ><button v-if="rule.status === 'pending_approval'" @click="begin(rule, 'approve')">
            批准</button
          ><button v-if="rule.status === 'pending_approval'" @click="begin(rule, 'reject')">
            拒绝</button
          ><button v-if="rule.status === 'approved'" @click="begin(rule, 'activate')">启用</button
          ><button v-if="rule.status === 'active'" @click="begin(rule, 'rollback')">回滚</button>
        </nav>
      </article>
    </section>
    <div
      v-if="showCreate"
      class="opportunity-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="score-rule-create-title"
    >
      <form @submit.prevent="create">
        <header>
          <div>
            <p>不使用默认数值</p>
            <h3 id="score-rule-create-title">新建评分规则草稿</h3>
          </div>
          <button type="button" aria-label="关闭" @click="showCreate = false">×</button>
        </header>
        <div>
          <label
            >版本代码<input
              v-model="form.version_code"
              required
              maxlength="64"
              placeholder="例如 org-v1" /></label
          ><label>规则名称<input v-model="form.name" required maxlength="160" /></label>
        </div>
        <div>
          <label
            >推荐阈值<input
              v-model.number="form.recommend_min"
              required
              type="number"
              min="0"
              max="100"
              step="0.01" /></label
          ><label
            >观察阈值<input
              v-model.number="form.observe_min"
              required
              type="number"
              min="0"
              max="100"
              step="0.01"
          /></label>
        </div>
        <section class="score-dimension-form">
          <header><b>评分维度</b><small>仅权重大于 0 的维度会提交；合计必须为 100。</small></header>
          <div v-for="item in form.dimensions" :key="item.code">
            <span>{{ item.label }}</span
            ><label
              >权重<input
                v-model.number="item.weight"
                type="number"
                min="0"
                max="100"
                step="0.01" /></label
            ><label
              >证据组<select v-model="item.evidence_group">
                <option value="market">市场</option>
                <option value="competition">竞争</option>
                <option value="cost">成本</option>
                <option value="other">其他</option>
              </select></label
            ><label><input v-model="item.required" type="checkbox" /> 必填</label>
          </div>
        </section>
        <aside>规则不会自动生效；需持有相应权限的人员提交、批准并启用。</aside>
        <footer>
          <button type="button" @click="showCreate = false">取消</button
          ><button type="submit" :disabled="busy">
            {{ busy ? "保存中…" : "保存草稿" }}
          </button>
        </footer>
      </form>
    </div>
    <div
      v-if="showPreview && previewRule"
      class="opportunity-modal score-preview-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="score-rule-preview-title"
    >
      <section>
        <header>
          <div>
            <p>只读试算 · 不写入评分运行</p>
            <h3 id="score-rule-preview-title">发布影响预览 · {{ previewRule.version_code }}</h3>
          </div>
          <button type="button" aria-label="关闭" @click="showPreview = false">×</button>
        </header>
        <p v-if="previewing" role="status">正在按当前持久化输入试算…</p>
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
                  >{{ item.lifecycle_status }} · 当前规则
                  {{ item.current_rule_version ?? "未评分" }}</small
                >
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
                <small>结论</small><b>{{ item.projected_recommendation_status }}</b>
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
    </div>
    <div
      v-if="showAction && selected"
      class="opportunity-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="score-rule-action-title"
    >
      <form @submit.prevent="runAction">
        <header>
          <div>
            <p>留痕状态变更</p>
            <h3 id="score-rule-action-title">{{ action }} · {{ selected.version_code }}</h3>
          </div>
          <button type="button" aria-label="关闭" @click="showAction = false">×</button>
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
        <aside>状态变化和原因会写入审计与事务消息；历史评分运行保持不变。</aside>
        <footer>
          <button type="button" @click="showAction = false">取消</button
          ><button type="submit" :disabled="busy">确认 {{ action }}</button>
        </footer>
      </form>
    </div>
  </section>
</template>
