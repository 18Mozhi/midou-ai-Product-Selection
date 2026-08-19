<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ApiClientError, createApiClient, type ApiFailureKind } from "../api-client";
import UiStatePanel from "./UiStatePanel.vue";
import "../profit.css";

type State = "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
type FeeType = "platform_fee" | "payment_fee" | "tax" | "fulfillment";
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
  approvals: string[];
  published_at: string | null;
  updated_at: string;
}
const props = defineProps<{ apiBaseUrl: string; roles: string[] }>();
const request = createApiClient(props.apiBaseUrl),
  state = ref<State>("loading"),
  rules = ref<Rule[]>([]),
  selected = ref<Rule | null>(null),
  requestId = ref(""),
  notice = ref(""),
  busy = ref(false),
  showCreate = ref(false);
const form = reactive({
  market: "US",
  platform: "amazon",
  version_code: "",
  name: "",
  effective_from: new Date().toISOString().slice(0, 10),
  platform_fee: 0,
  payment_fee: 0,
  tax: 0,
  fulfillment: 0,
  currency: "USD",
});
const canSelection = computed(() => props.roles.includes("selection_manager")),
  canAdmin = computed(() => props.roles.includes("organization_admin"));
const stateFrom = (kind: ApiFailureKind): State =>
  kind === "expired"
    ? "expired"
    : kind === "forbidden"
      ? "forbidden"
      : kind === "blocked" || kind === "rate_limited"
        ? "blocked"
        : "error";
async function load() {
  state.value = "loading";
  try {
    const response = await request<Rule[]>("/cost-rules");
    requestId.value = response.request_id;
    rules.value = response.data;
    selected.value =
      rules.value.find((item) => item.id === selected.value?.id) ?? rules.value[0] ?? null;
    state.value = rules.value.length ? "ready" : "empty";
  } catch (error) {
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      notice.value = error.actionHint;
      state.value = stateFrom(error.kind);
    } else state.value = "blocked";
  }
}
async function post(path: string, body: unknown) {
  busy.value = true;
  notice.value = "";
  try {
    const response = await request<any>(path, { method: "POST", body });
    requestId.value = response.request_id;
    return response.data;
  } catch (error) {
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      notice.value = error.actionHint;
      return null;
    }
    notice.value = "依赖暂不可用，未写入状态。";
    return null;
  } finally {
    busy.value = false;
  }
}
async function create() {
  const result = await post("/cost-rules", {
    market: form.market,
    platform: form.platform,
    version_code: form.version_code,
    name: form.name,
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
        currency: form.currency,
      },
    ],
  });
  if (result) {
    showCreate.value = false;
    selected.value = result;
    await load();
    notice.value = "费用规则草稿已创建，发布前仍需双角色审批。";
  }
}
async function action(
  action: "submit" | "approve" | "reject" | "publish",
  approval_role?: "selection_manager" | "organization_admin",
) {
  if (!selected.value) return;
  const result = await post(`/cost-rules/${selected.value.id}/actions`, {
    action,
    reason: `通过费用规则控制台执行 ${action}`,
    expected_revision: selected.value.revision,
    ...(approval_role ? { approval_role } : {}),
  });
  if (result) {
    selected.value = result;
    await load();
    notice.value = `规则已执行 ${action}；历史版本未改写。`;
  }
}
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
      <button type="button" @click="showCreate = true">＋ 新建规则</button>
    </header>
    <p v-if="notice" class="cost-notice" role="status">
      {{ notice }} <code v-if="requestId">{{ requestId }}</code>
    </p>
    <UiStatePanel v-if="state !== 'ready'" :kind="state" :request-id="requestId" @primary="load" />
    <div v-else class="cost-layout">
      <section class="cost-rule-list">
        <button
          v-for="rule in rules"
          :key="rule.id"
          :class="{ selected: selected?.id === rule.id }"
          @click="selected = rule"
        >
          <i :data-status="rule.status"></i
          ><span
            ><strong>{{ rule.name }}</strong
            ><small>{{ rule.market }} · {{ rule.platform }} · {{ rule.version_code }}</small></span
          ><b>{{ rule.status }}</b
          ><em>v{{ rule.revision }}</em>
        </button>
      </section>
      <article v-if="selected" class="cost-rule-detail">
        <header>
          <div>
            <p>版本化规则</p>
            <h3>{{ selected.name }}</h3>
            <span
              >生效日 {{ selected.effective_from }} · {{ selected.market }} /
              {{ selected.platform }}</span
            >
          </div>
          <b>{{ selected.status }}</b>
        </header>
        <div class="cost-fees">
          <article v-for="fee in selected.fee_lines" :key="fee.type">
            <small>{{ fee.type }}</small
            ><strong
              >{{ fee.value
              }}{{ fee.mode === "percentage_of_sale" ? "%" : ` ${fee.currency}` }}</strong
            ><span>{{ fee.mode }}</span>
          </article>
        </div>
        <section>
          <h4>审批链</h4>
          <p>
            <b :data-done="selected.approvals.includes('selection_manager')">选品经理</b
            ><b :data-done="selected.approvals.includes('organization_admin')">组织管理员</b>
          </p>
          <small>审批和发布均写入审计、事件与事务消息；回滚通过后端 保留全部历史。</small>
        </section>
        <footer>
          <button v-if="selected.status === 'draft'" :disabled="busy" @click="action('submit')">
            提交审批</button
          ><button
            v-if="
              selected.status === 'pending_approval' &&
              canSelection &&
              !selected.approvals.includes('selection_manager')
            "
            :disabled="busy"
            @click="action('approve', 'selection_manager')"
          >
            选品经理审批</button
          ><button
            v-if="
              selected.status === 'pending_approval' &&
              canAdmin &&
              !selected.approvals.includes('organization_admin')
            "
            :disabled="busy"
            @click="action('approve', 'organization_admin')"
          >
            组织管理员审批</button
          ><button
            v-if="selected.status === 'approved'"
            :disabled="busy"
            @click="action('publish')"
          >
            发布规则
          </button>
        </footer>
      </article>
    </div>
    <div
      v-if="showCreate"
      class="cost-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-cost-rule"
    >
      <form @submit.prevent="create">
        <header>
          <div>
            <p>不使用默认费用</p>
            <h3 id="new-cost-rule">新建费用规则</h3>
          </div>
          <button type="button" aria-label="关闭" @click="showCreate = false">×</button>
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
              v-model.number="form.platform_fee"
              required
              type="number"
              min="0"
              max="100"
              step="0.000001" /></label
          ><label
            >支付手续费 %<input
              v-model.number="form.payment_fee"
              required
              type="number"
              min="0"
              max="100"
              step="0.000001" /></label
          ><label
            >税费 %<input
              v-model.number="form.tax"
              required
              type="number"
              min="0"
              max="100"
              step="0.000001" /></label
          ><label
            >履约成本<input
              v-model.number="form.fulfillment"
              required
              type="number"
              min="0"
              step="0.000001" /></label
          ><label>履约币种<input v-model="form.currency" required maxlength="3" /></label>
        </fieldset>
        <aside>不提供默认费率；每个数字都成为版本化规则的一部分。</aside>
        <footer>
          <button type="button" @click="showCreate = false">取消</button
          ><button type="submit" :disabled="busy">
            {{ busy ? "保存中…" : "保存草稿" }}
          </button>
        </footer>
      </form>
    </div>
  </section>
</template>
