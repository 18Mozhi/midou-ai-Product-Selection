<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import type { SourcingCandidate, SourcingSearch } from "./sourcing-workspace-types";

const props = defineProps<{
  showSearch: boolean;
  searchForm: { input_type: string; input_ref: string };
  quoteCandidate: SourcingCandidate | null;
  quote: {
    moq: number;
    specification: string;
    lead_time_days: number;
    location: string;
    confidence_value: number;
    stability_status: string;
    risk_level: string;
    observed_at: string;
    evidence_id: string;
  };
  evidenceOptions: Array<{ id: string; label: string }>;
  purchaseCandidate: SourcingCandidate | null;
  purchaseForm: { quantity: number; reason: string };
  deleting: SourcingSearch | null;
  deleteReason: string;
  busy: boolean;
}>();
const emit = defineEmits<{
  closeSearch: [];
  create: [];
  closeQuote: [];
  confirmQuote: [];
  closePurchase: [];
  purchase: [];
  closeDelete: [];
  removeSearch: [];
  updateDeleteReason: [value: string];
}>();
const deleteReasonModel = computed({
  get: () => props.deleteReason,
  set: (value: string) => emit("updateDeleteReason", value),
});
const searchDialog = ref<HTMLElement | null>(null),
  quoteDialog = ref<HTMLElement | null>(null),
  purchaseDialog = ref<HTMLElement | null>(null),
  deleteDialog = ref<HTMLElement | null>(null),
  inputLabel = computed(
    () =>
      ({
        keyword: "商品关键词",
        image: "图片地址或图片证据编号",
        opportunity: "机会编号",
        product_url: "商品链接",
      })[props.searchForm.input_type] ?? "查找内容",
  ),
  inputPlaceholder = computed(
    () =>
      ({
        keyword: "例如：折叠收纳箱",
        image: "输入可访问的图片地址或已有图片证据编号",
        opportunity: "从选品机会详情进入会自动填写",
        product_url: "输入需要查找同类货源的商品链接",
      })[props.searchForm.input_type] ?? "请输入查找内容",
  );
function focusFirst(dialog: () => HTMLElement | null) {
  void nextTick(() =>
    window.requestAnimationFrame(() =>
      dialog()?.querySelector<HTMLElement>("select, input, textarea, button")?.focus(),
    ),
  );
}
watch(
  () => props.showSearch,
  (open) => open && focusFirst(() => searchDialog.value),
);
watch(
  () => props.quoteCandidate,
  (value) => value && focusFirst(() => quoteDialog.value),
);
watch(
  () => props.purchaseCandidate,
  (value) => value && focusFirst(() => purchaseDialog.value),
);
watch(
  () => props.deleting,
  (value) => value && focusFirst(() => deleteDialog.value),
);
const searchName = (item: SourcingSearch | null) =>
  item?.display_name || item?.input_ref || "供应商";
</script>

<template>
  <div
    v-if="showSearch"
    ref="searchDialog"
    class="sourcing-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="sourcing-search-title"
    @keydown.esc="emit('closeSearch')"
  >
    <form @submit.prevent="emit('create')">
      <header>
        <h3 id="sourcing-search-title">发起供应商找货</h3>
        <button
          type="button"
          aria-label="关闭供应商搜索"
          title="关闭供应商搜索"
          @click="emit('closeSearch')"
        >
          ×
        </button>
      </header>
      <label
        >输入类型<select v-model="searchForm.input_type">
          <option value="keyword">关键词</option>
          <option value="image">图片</option>
          <option value="opportunity">机会</option>
          <option value="product_url">商品链接</option>
        </select></label
      ><label
        >{{ inputLabel
        }}<input
          v-model="searchForm.input_ref"
          required
          maxlength="2048"
          :inputmode="['image', 'product_url'].includes(searchForm.input_type) ? 'url' : 'text'"
          :placeholder="inputPlaceholder"
      /></label>
      <aside>
        系统会直接爬取公开供应商商品页，保存供应商、商品、价格、图片、网址与采集时间；网页没有披露的
        MOQ、规格和交期会明确标为待确认。
      </aside>
      <footer>
        <button type="button" class="ghost" @click="emit('closeSearch')">取消</button
        ><button type="submit" :disabled="busy">开始公开网页采集</button>
      </footer>
    </form>
  </div>
  <div
    v-if="quoteCandidate"
    ref="quoteDialog"
    class="sourcing-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="sourcing-quote-title"
    @keydown.esc="emit('closeQuote')"
  >
    <form @submit.prevent="emit('confirmQuote')">
      <header>
        <h3 id="sourcing-quote-title">确认完整供应商报价</h3>
        <button
          type="button"
          aria-label="关闭报价编辑"
          title="关闭报价编辑"
          @click="emit('closeQuote')"
        >
          ×
        </button>
      </header>
      <label>规格<input v-model="quote.specification" required /></label>
      <div class="form-grid">
        <label>最小起订量<input v-model.number="quote.moq" type="number" min="1" required /></label>
        <label
          >交期（天）<input v-model.number="quote.lead_time_days" type="number" min="0" required
        /></label>
        <label>所在地<input v-model="quote.location" required /></label>
        <label
          >可信度（0–100）<input
            v-model.number="quote.confidence_value"
            type="number"
            min="0"
            max="100"
            required
        /></label>
        <label
          >稳定性<select v-model="quote.stability_status">
            <option value="stable">稳定</option>
            <option value="variable">波动</option>
            <option value="unknown">未知</option>
          </select></label
        >
        <label
          >风险<select v-model="quote.risk_level">
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
            <option value="unknown">未知</option>
          </select></label
        >
        <label>观测时间<input v-model="quote.observed_at" type="datetime-local" required /></label>
      </div>
      <label
        >确认依据证据（可搜索）<input
          v-model="quote.evidence_id"
          type="search"
          list="sourcing-evidence-options"
          required
          placeholder="输入证据编号或从候选中选择"
      /></label>
      <datalist id="sourcing-evidence-options">
        <option v-for="option in evidenceOptions" :key="option.id" :value="option.id">
          {{ option.label }}
        </option>
      </datalist>
      <footer>
        <button type="button" class="ghost" @click="emit('closeQuote')">取消</button
        ><button type="submit" :disabled="busy">确认新版本</button>
      </footer>
    </form>
  </div>
  <div
    v-if="purchaseCandidate"
    ref="purchaseDialog"
    class="sourcing-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="purchase-task-title"
    @keydown.esc="emit('closePurchase')"
  >
    <form @submit.prevent="emit('purchase')">
      <header>
        <div>
          <small>结构化采购创建</small>
          <h3 id="purchase-task-title">创建采购任务</h3>
        </div>
        <button type="button" aria-label="关闭采购任务创建" @click="emit('closePurchase')">
          ×
        </button>
      </header>
      <dl>
        <div>
          <dt>供应商</dt>
          <dd>{{ purchaseCandidate.supplier_name }}</dd>
        </div>
        <div>
          <dt>锁定报价版本</dt>
          <dd>v{{ purchaseCandidate.quote?.version }}</dd>
        </div>
        <div>
          <dt>最小起订量（MOQ）</dt>
          <dd>{{ purchaseCandidate.moq }}</dd>
        </div>
        <div>
          <dt>报价证据</dt>
          <dd>{{ purchaseCandidate.quote?.evidence_id }}</dd>
        </div>
      </dl>
      <label
        >采购数量<input
          v-model.number="purchaseForm.quantity"
          type="number"
          :min="purchaseCandidate.moq ?? 1"
          step="1"
          required
      /></label>
      <label
        >创建原因<textarea
          v-model="purchaseForm.reason"
          minlength="2"
          maxlength="1000"
          rows="3"
          required
        ></textarea>
      </label>
      <footer>
        <button type="button" class="ghost" @click="emit('closePurchase')">取消</button
        ><button
          type="submit"
          :disabled="
            busy ||
            purchaseForm.reason.trim().length < 2 ||
            purchaseForm.quantity < (purchaseCandidate.moq ?? 1)
          "
        >
          确认创建
        </button>
      </footer>
    </form>
  </div>
  <div
    v-if="deleting"
    ref="deleteDialog"
    class="sourcing-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="sourcing-delete-title"
    @keydown.esc="emit('closeDelete')"
  >
    <form @submit.prevent="emit('removeSearch')">
      <header>
        <h3 id="sourcing-delete-title">删除找货记录</h3>
        <button
          type="button"
          aria-label="关闭删除确认"
          title="关闭删除确认"
          @click="emit('closeDelete')"
        >
          ×
        </button>
      </header>
      <p>删除“{{ searchName(deleting) }}”后不再显示在工作台，候选证据和审计记录仍保留。</p>
      <label
        >删除原因<textarea
          v-model="deleteReasonModel"
          required
          maxlength="500"
          placeholder="请填写删除原因"
        ></textarea>
      </label>
      <footer>
        <button type="button" class="ghost" @click="emit('closeDelete')">取消</button
        ><button type="submit" class="danger" :disabled="busy">确认删除</button>
      </footer>
    </form>
  </div>
</template>
