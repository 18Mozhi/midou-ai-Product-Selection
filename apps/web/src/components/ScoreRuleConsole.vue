<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import UiStatePanel from "./UiStatePanel.vue";
import "../scoring.css";
type State =
  "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
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
const props = defineProps<{ apiBaseUrl: string }>(),
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
  targetRuleId = ref("");
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
const stateFrom = (status: number): State =>
    status === 401
      ? "expired"
      : status === 403
        ? "forbidden"
        : [408, 425, 429, 502, 503, 504].includes(status)
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
    const response = await fetch(
        `${props.apiBaseUrl}/opportunity-score-rules`,
        { credentials: "include", headers: { accept: "application/json" } },
      ),
      body = await response.json().catch(() => null);
    requestId.value = body?.request_id ?? "";
    if (!response.ok) {
      state.value = stateFrom(response.status);
      return;
    }
    rules.value = body.data;
    state.value = rules.value.length ? "ready" : "empty";
  } catch {
    state.value = "blocked";
  }
}
async function post(path: string, body: unknown) {
  busy.value = true;
  message.value = "";
  try {
    const response = await fetch(`${props.apiBaseUrl}${path}`, {
        method: "POST",
        credentials: "include",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify(body),
      }),
      result = await response.json().catch(() => null);
    requestId.value = result?.request_id ?? "";
    if (!response.ok) {
      message.value = result?.error?.action_hint ?? "操作未完成。";
      return null;
    }
    return result.data;
  } catch {
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
async function runAction() {
  if (!selected.value) return;
  const result = await post(
    `/opportunity-score-rules/${selected.value.id}/actions`,
    {
      action: action.value,
      reason: reason.value,
      expected_revision: selected.value.revision,
      ...(action.value === "rollback"
        ? { target_rule_id: targetRuleId.value }
        : {}),
    },
  );
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
        <span
          >权重、阈值、证据覆盖与计算结果均版本化；历史结果不会被新规则或回滚改写。</span
        >
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
        <span>版本</span><span>阈值</span><span>维度与权重</span
        ><span>状态</span><span>操作</span>
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
          <button v-if="rule.status === 'draft'" @click="begin(rule, 'submit')">
            提交</button
          ><button
            v-if="rule.status === 'pending_approval'"
            @click="begin(rule, 'approve')"
          >
            批准</button
          ><button
            v-if="rule.status === 'pending_approval'"
            @click="begin(rule, 'reject')"
          >
            拒绝</button
          ><button
            v-if="rule.status === 'approved'"
            @click="begin(rule, 'activate')"
          >
            启用</button
          ><button
            v-if="rule.status === 'active'"
            @click="begin(rule, 'rollback')"
          >
            回滚
          </button>
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
          <button type="button" aria-label="关闭" @click="showCreate = false">
            ×
          </button>
        </header>
        <div>
          <label
            >版本代码<input
              v-model="form.version_code"
              required
              maxlength="64"
              placeholder="例如 org-v1" /></label
          ><label
            >规则名称<input v-model="form.name" required maxlength="160"
          /></label>
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
          <header>
            <b>评分维度</b
            ><small>仅权重大于 0 的维度会提交；合计必须为 100。</small>
          </header>
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
            ><label
              ><input v-model="item.required" type="checkbox" /> 必填</label
            >
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
            <h3 id="score-rule-action-title">
              {{ action }} · {{ selected.version_code }}
            </h3>
          </div>
          <button type="button" aria-label="关闭" @click="showAction = false">
            ×
          </button>
        </header>
        <label
          >原因（必填）<textarea
            v-model="reason"
            required
            maxlength="1000"
          ></textarea></label
        ><label v-if="action === 'rollback'"
          >回滚目标版本<select v-model="targetRuleId" required>
            <option value="">请选择已批准或停用版本</option>
            <option
              v-for="rule in rules.filter((item) =>
                ['approved', 'retired'].includes(item.status),
              )"
              :key="rule.id"
              :value="rule.id"
            >
              {{ rule.version_code }} · {{ rule.status }}
            </option>
          </select></label
        >
        <aside>
          状态变化和原因会写入审计与事务消息；历史评分运行保持不变。
        </aside>
        <footer>
          <button type="button" @click="showAction = false">取消</button
          ><button type="submit" :disabled="busy">确认 {{ action }}</button>
        </footer>
      </form>
    </div>
  </section>
</template>
