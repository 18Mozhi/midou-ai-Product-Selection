<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import UiStatePanel from "./UiStatePanel.vue";
import "../sourcing.css";
type State =
  "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
type Candidate = {
  id: string;
  supplier_name: string;
  product_title: string;
  specification: string | null;
  moq: number;
  quoted_price: number;
  currency: string;
  lead_time_days: number | null;
  location: string | null;
  original_url: string;
  observed_at: string;
  evidence_id: string;
  confidence_value: number | null;
  status: string;
  missing_fields: string[];
  quote: {
    id: string;
    version: number;
    stability_status: string;
    risk_level: string;
  } | null;
};
type Search = {
  id: string;
  input_type: string;
  input_ref: string;
  status: string;
  candidate_count: number;
  missing_fields: string[];
  created_at: string;
  candidates?: Candidate[];
  erp_reference?: {
    normalized_record_id: string;
    evidence_id: string;
    title: string;
    image_url: string | null;
    supplier_code: string | null;
    cost_cny: number | null;
    cost_usd: number | null;
    source_url: string;
    observed_at: string;
  } | null;
};
const props = defineProps<{ apiBaseUrl: string }>(),
  state = ref<State>("loading"),
  items = ref<Search[]>([]),
  selected = ref<Search | null>(null),
  requestId = ref(""),
  notice = ref(""),
  busy = ref(false),
  showSearch = ref(false),
  quoteCandidate = ref<Candidate | null>(null),
  selectedQuotes = ref<string[]>([]),
  form = reactive({
    collection_task_id: "",
    input_type: "keyword",
    input_ref: "",
  }),
  quote = reactive({
    specification: "",
    lead_time_days: 7,
    location: "",
    confidence_value: 80,
    stability_status: "unknown",
    risk_level: "unknown",
    observed_at: new Date().toISOString().slice(0, 16),
    evidence_id: "",
  });
const missingLabels: Record<string, string> = {
    specification: "规格",
    lead_time_days: "交期",
    location: "所在地",
    confidence_value: "可信度",
    stability_status: "稳定性",
    risk_level: "风险",
  },
  candidates = computed(() => selected.value?.candidates ?? []),
  missingText = computed(() =>
    (selected.value?.missing_fields ?? [])
      .map((x) => missingLabels[x] ?? x)
      .join("、"),
  ),
  erpCosts = computed(() => {
    const reference = selected.value?.erp_reference;
    if (!reference) return [];
    return [
      reference.cost_cny == null ? null : `人民币 ${reference.cost_cny}`,
      reference.cost_usd == null ? null : `美元 ${reference.cost_usd}`,
    ].filter((value): value is string => Boolean(value));
  }),
  inputTypeText = (value: string) =>
    ({ keyword: "关键词", image: "图片", url: "商品链接" })[value] ?? value,
  statusText = (value: string) =>
    ({
      queued: "等待采集",
      running: "采集中",
      completed: "已完成",
      completed_with_warnings: "已完成但有缺失",
      ready: "可确认",
      incomplete: "待补齐",
      failed: "采集失败",
    })[value] ?? value,
  stabilityText = (value: string | undefined) =>
    ({ stable: "稳定", volatile: "波动", unknown: "待确认" })[value ?? ""] ??
    (value || "缺失"),
  riskText = (value: string | undefined) =>
    ({ low: "低", medium: "中", high: "高", unknown: "待确认" })[
      value ?? ""
    ] ?? (value || "缺失"),
  stateFrom = (s: number): State =>
    s === 401
      ? "expired"
      : s === 403
        ? "forbidden"
        : [408, 425, 429, 502, 503, 504].includes(s)
          ? "blocked"
          : "error";
async function load() {
  state.value = "loading";
  try {
    const r = await fetch(`${props.apiBaseUrl}/sourcing/searches`, {
        credentials: "include",
      }),
      b = await r.json().catch(() => null);
    requestId.value = b?.request_id ?? "";
    if (!r.ok) {
      state.value = stateFrom(r.status);
      return;
    }
    items.value = b.data;
    selected.value =
      items.value.find((x) => x.id === selected.value?.id) ??
      items.value[0] ??
      null;
    state.value = items.value.length ? "ready" : "empty";
    if (selected.value) await detail(selected.value);
  } catch {
    state.value = "blocked";
  }
}
async function detail(item: Search) {
  selected.value = item;
  try {
    const r = await fetch(`${props.apiBaseUrl}/sourcing/searches/${item.id}`, {
        credentials: "include",
      }),
      b = await r.json();
    if (r.ok) selected.value = b.data;
  } catch {
    notice.value = "详情暂不可用，列表状态未被覆盖。";
  }
}
async function post(path: string, body: unknown) {
  busy.value = true;
  notice.value = "";
  try {
    const r = await fetch(`${props.apiBaseUrl}${path}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify(body),
      }),
      b = await r.json().catch(() => null);
    requestId.value = b?.request_id ?? "";
    if (!r.ok) {
      notice.value = b?.error?.action_hint ?? "操作未完成。";
      return null;
    }
    return b.data;
  } catch {
    notice.value = "依赖暂不可用，未写入状态。";
    return null;
  } finally {
    busy.value = false;
  }
}
async function create() {
  if (await post("/sourcing/searches", form)) {
    showSearch.value = false;
    await load();
    notice.value = "已排队投影已完成采集任务；缺失字段会明确显示。";
  }
}
async function confirm() {
  if (!quoteCandidate.value) return;
  if (
    await post("/sourcing/quotes", {
      candidate_id: quoteCandidate.value.id,
      ...quote,
      observed_at: new Date(quote.observed_at).toISOString(),
    })
  ) {
    quoteCandidate.value = null;
    await load();
    notice.value = "报价已按新版本确认，原始候选和证据未改写。";
  }
}
function choose(candidate: Candidate) {
  if (!candidate.quote) return;
  const id = candidate.quote.id,
    index = selectedQuotes.value.indexOf(id);
  if (index >= 0) selectedQuotes.value.splice(index, 1);
  else if (selectedQuotes.value.length < 5) selectedQuotes.value.push(id);
  else notice.value = "一次最多比较五家供应商。";
}
async function compare() {
  if (
    await post("/sourcing/comparisons", {
      name: `${selected.value?.input_ref ?? "供应商"} 报价对比`,
      quote_ids: selectedQuotes.value,
    })
  ) {
    notice.value = `已保存 ${selectedQuotes.value.length} 家报价对比。`;
    selectedQuotes.value = [];
  }
}
async function purchase(candidate: Candidate) {
  if (!candidate.quote) return;
  const quantity = Number(
    window.prompt(
      `采购数量不得低于 MOQ ${candidate.moq}`,
      String(candidate.moq),
    ),
  );
  if (!Number.isSafeInteger(quantity)) return;
  if (
    await post("/sourcing/purchase-tasks", {
      quote_id: candidate.quote.id,
      quantity,
      reason: "从供应链找货页面创建采购任务",
    })
  )
    notice.value = "采购任务已进入任务中心待消费队列。";
}
onMounted(() => {
  showSearch.value =
    new URLSearchParams(window.location.search).get("create") === "1";
  void load();
});
</script>
<template>
  <section class="sourcing-workspace">
    <section class="member-module-guide"><div><p>供应链与利润怎么用</p><h3>从机会或商品出发，查找真实货源并比较到岸利润</h3><span>先发起货源搜索，再确认供应商报价；系统最多并排比较五家，并明确标出缺少运费、税费或平台费的项目。</span></div><ol><li>输入关键词、图片或商品链接</li><li>爬取货源候选</li><li>确认报价与起订量</li><li>补齐费用后比较利润</li></ol></section>
    <nav class="sourcing-tabs">
      <a href="/sourcing" aria-current="page">供应商找货</a
      ><a href="/sourcing/cost-rules">费用与利润规则</a>
    </nav>
    <header class="sourcing-head">
      <div>
        <p>供应商发现</p>
        <h2>供应链找货</h2>
        <span
          >采集事实先投影为候选；缺失规格、交期、地点、可信度与风险时禁止进入可靠对比。</span
        >
      </div>
      <button type="button" @click="showSearch = true">＋ 新建找货</button>
    </header>
    <p v-if="notice" class="sourcing-notice">
      {{ notice }} <code v-if="requestId">{{ requestId }}</code>
    </p>
    <UiStatePanel
      v-if="state !== 'ready'"
      :kind="state"
      :request-id="requestId"
      @primary="load"
    />
    <div v-else class="sourcing-layout">
      <aside>
        <button
          v-for="item in items"
          :key="item.id"
          :class="{ selected: selected?.id === item.id }"
          @click="detail(item)"
        >
          <b>{{ item.input_ref }}</b
          ><small>{{ inputTypeText(item.input_type) }} · {{ statusText(item.status) }}</small
          ><em>{{ item.candidate_count }} 个候选</em>
        </button>
      </aside>
      <main v-if="selected">
        <header>
          <div>
            <p>{{ inputTypeText(selected.input_type) }}</p>
            <h3>{{ selected.input_ref }}</h3>
          </div>
          <button
            v-if="selectedQuotes.length >= 2"
            type="button"
            @click="compare"
          >
            对比 {{ selectedQuotes.length }} 家
          </button>
        </header>
        <p v-if="selected.missing_fields.length" class="missing">
          当前候选仍缺：{{ missingText }}。必须人工带证据确认。
        </p>
        <section
          v-if="selected.erp_reference"
          class="sourcing-erp-reference"
        >
          <img
            v-if="selected.erp_reference.image_url"
            :src="selected.erp_reference.image_url"
            :alt="selected.erp_reference.title"
          />
          <div>
            <small>ERP 货源线索 · 不是已确认报价</small>
            <h4>{{ selected.erp_reference.title }}</h4>
            <p>
              供应商编码：{{ selected.erp_reference.supplier_code ?? "ERP 未提供" }}
            </p>
            <p>
              ERP 历史参考成本：{{ erpCosts.length ? erpCosts.join(" / ") : "未提供" }}
            </p>
            <span
              >仍需爬取供应商商品页、最小起订量、规格、交期与所在地后，才能形成可比较报价。</span
            >
            <footer>
              <a
                :href="selected.erp_reference.source_url"
                target="_blank"
                rel="noopener noreferrer"
                >打开 ERP 商品列表 ↗</a
              ><code>证据 {{ selected.erp_reference.evidence_id }}</code>
            </footer>
          </div>
        </section>
        <section v-if="!candidates.length" class="sourcing-pending">
          <strong>找货任务已经建立，尚未取得真实供应商报价</strong>
          <p>
            ERP 商品已经作为找货输入保留。系统不会虚构供应商、起订量或报价；请等待已启用的货源爬虫完成，或从“新建找货”导入带证据的供应链结果。
          </p>
          <span v-if="selected.missing_fields.length">待补齐：{{ missingText }}</span>
        </section>
        <section class="supplier-cards">
          <article
            v-for="item in candidates"
            :key="item.id"
            :data-ready="item.status === 'ready'"
          >
            <header>
              <label v-if="item.quote"
                ><input
                  type="checkbox"
                  :checked="selectedQuotes.includes(item.quote.id)"
                  @change="choose(item)"
                />加入对比</label
              ><b>{{ item.supplier_name }}</b
              ><span>{{ statusText(item.status) }}</span>
            </header>
            <h4>{{ item.product_title }}</h4>
            <dl>
              <div>
                <dt>报价 / 最小起订量</dt>
                <dd>
                  {{ item.currency }} {{ item.quoted_price }} / {{ item.moq }}
                </dd>
              </div>
              <div>
                <dt>规格</dt>
                <dd>{{ item.specification ?? "缺失" }}</dd>
              </div>
              <div>
                <dt>交期 / 地点</dt>
                <dd>
                  {{
                    item.lead_time_days == null
                      ? "缺失"
                      : `${item.lead_time_days} 天`
                  }}
                  / {{ item.location ?? "缺失" }}
                </dd>
              </div>
              <div>
                <dt>稳定性 / 风险</dt>
                <dd>
                  {{ stabilityText(item.quote?.stability_status) }} /
                  {{ riskText(item.quote?.risk_level) }}
                </dd>
              </div>
            </dl>
            <footer>
              <a
                :href="item.original_url"
                target="_blank"
                rel="noopener noreferrer"
                >原始页面 ↗</a
              ><code>证据 {{ item.evidence_id }}</code
              ><button
                v-if="!item.quote"
                type="button"
                @click="quoteCandidate = item"
              >
                确认报价</button
              ><button v-else type="button" @click="purchase(item)">
                创建采购任务
              </button>
            </footer>
          </article>
        </section>
      </main>
    </div>
    <div
      v-if="showSearch"
      class="sourcing-modal"
      role="dialog"
      aria-modal="true"
    >
      <form @submit.prevent="create">
        <header>
          <h3>从已完成采集任务投影找货结果</h3>
          <button
            type="button"
            aria-label="关闭供应商搜索"
            title="关闭供应商搜索"
            @click="showSearch = false"
          >
            ×
          </button>
        </header>
        <label
          >采集任务编号<input
            v-model="form.collection_task_id"
            required /></label
        ><label
          >输入类型<select v-model="form.input_type">
            <option value="keyword">关键词</option>
            <option value="image">图片</option>
            <option value="opportunity">机会</option>
            <option value="product_url">商品链接</option>
          </select></label
        ><label>输入引用<input v-model="form.input_ref" required /></label>
        <aside>
          任务必须来自当前工作区并已完成；当前可投影合同是已启用的商品与供应链
          CSV Provider。
        </aside>
        <footer>
          <button type="button" class="ghost" @click="showSearch = false">
            取消</button
          ><button type="submit" :disabled="busy">开始投影</button>
        </footer>
      </form>
    </div>
    <div
      v-if="quoteCandidate"
      class="sourcing-modal"
      role="dialog"
      aria-modal="true"
    >
      <form @submit.prevent="confirm">
        <header>
          <h3>确认完整供应商报价</h3>
          <button
            type="button"
            aria-label="关闭报价编辑"
            title="关闭报价编辑"
            @click="quoteCandidate = null"
          >
            ×
          </button>
        </header>
        <label>规格<input v-model="quote.specification" required /></label>
        <div class="form-grid">
          <label
            >交期（天）<input
              v-model.number="quote.lead_time_days"
              type="number"
              min="0"
              required /></label
          ><label>所在地<input v-model="quote.location" required /></label
          ><label
            >可信度（0–100）<input
              v-model.number="quote.confidence_value"
              type="number"
              min="0"
              max="100"
              required /></label
          ><label
            >稳定性<select v-model="quote.stability_status">
              <option value="stable">稳定</option>
              <option value="variable">波动</option>
              <option value="unknown">未知</option>
            </select></label
          ><label
            >风险<select v-model="quote.risk_level">
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
              <option value="unknown">未知</option>
            </select></label
          ><label
            >观测时间<input
              v-model="quote.observed_at"
              type="datetime-local"
              required
          /></label>
        </div>
        <label
          >确认依据证据编号<input v-model="quote.evidence_id" required
        /></label>
        <footer>
          <button type="button" class="ghost" @click="quoteCandidate = null">
            取消</button
          ><button type="submit" :disabled="busy">确认新版本</button>
        </footer>
      </form>
    </div>
  </section>
</template>
