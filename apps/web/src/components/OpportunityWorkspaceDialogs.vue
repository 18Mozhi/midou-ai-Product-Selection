<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useModalDialog } from "../use-modal-dialog";

type DecisionAction = "adopt" | "observe" | "reject";
type CreateFeedback =
  | { type: "error"; message: string }
  | {
      type: "created";
      id: string;
      name: string;
      submitted: { name: string; market: string; category: string; source_topic_id: string };
    };

const props = defineProps<{
    busy: boolean;
    form: { name: string; market: string; category: string; source_topic_id: string };
    createFeedback: CreateFeedback | null;
    decisionAction: DecisionAction;
    hasDetail: boolean;
  }>(),
  emit = defineEmits<{
    create: [];
    decide: [];
    importBrowser: [];
    importFile: [event: Event];
  }>(),
  erpImportOpen = defineModel<boolean>("erpImportOpen", { required: true }),
  createOpen = defineModel<boolean>("createOpen", { required: true }),
  decisionOpen = defineModel<boolean>("decisionOpen", { required: true }),
  erpImportLimit = defineModel<number>("erpImportLimit", { required: true }),
  decisionReason = defineModel<string>("decisionReason", { required: true }),
  decisionReasonValidationAttempted = ref(false),
  { dialogElement: erpDialog, handleCancel: cancelErp } = useModalDialog(
    () => erpImportOpen.value,
    () => (erpImportOpen.value = false),
  ),
  { dialogElement: createDialog, handleCancel: cancelCreate } = useModalDialog(
    () => createOpen.value,
    () => (createOpen.value = false),
  ),
  { dialogElement: decisionDialog, handleCancel: cancelDecision } = useModalDialog(
    () => decisionOpen.value && props.hasDetail,
    () => (decisionOpen.value = false),
  );
const createFeedbackMatchesForm = computed(() => {
  const feedback = props.createFeedback;
  return (
    feedback?.type === "created" &&
    props.form.name.trim() === feedback.submitted.name.trim() &&
    props.form.market.trim().toUpperCase() === feedback.submitted.market.trim().toUpperCase() &&
    props.form.category.trim() === feedback.submitted.category.trim() &&
    props.form.source_topic_id.trim().toLowerCase() ===
      feedback.submitted.source_topic_id.trim().toLowerCase()
  );
});
const decisionReasonInvalid = computed(
  () => decisionReasonValidationAttempted.value && decisionReason.value.length === 0,
);

watch(decisionOpen, (open) => {
  if (open) decisionReasonValidationAttempted.value = false;
});

function handleDecisionInvalid(event: Event) {
  if (event.target instanceof HTMLTextAreaElement) decisionReasonValidationAttempted.value = true;
}

const decisionLabel = {
  adopt: "采纳",
  observe: "继续观察",
  reject: "驳回",
} as const;

function containDialogTab(event: KeyboardEvent, dialog: HTMLDialogElement | null) {
  if (event.key !== "Tab" || !dialog?.open) return;
  const controls = [
    ...dialog.querySelectorAll<HTMLElement>(
      'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])',
    ),
  ].filter(
    (element) =>
      !element.matches(":disabled") && element.tabIndex >= 0 && element.getClientRects().length > 0,
  );
  const first = controls[0];
  const last = controls.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
    event.preventDefault();
    last.focus();
  } else if (
    !event.shiftKey &&
    (document.activeElement === last || document.activeElement === dialog)
  ) {
    event.preventDefault();
    first.focus();
  }
}
</script>

<template>
  <dialog
    v-if="erpImportOpen"
    ref="erpDialog"
    class="opportunity-modal"
    aria-labelledby="erp-import-title"
    @cancel="cancelErp"
    @keydown="containDialogTab($event, erpDialog)"
  >
    <form class="so-dialog-manifest" @submit.prevent="emit('importBrowser')">
      <header>
        <div>
          <p>使用已有商品数据补齐系统</p>
          <h3 id="erp-import-title">从米豆 ERP 商品列表导入</h3>
        </div>
        <button
          class="so-action-quiet"
          type="button"
          aria-label="关闭 ERP 导入"
          @click="erpImportOpen = false"
        >
          ×
        </button>
      </header>
      <aside class="erp-import-guide">
        <strong>真实数据流</strong>
        <span
          >浏览器助手在本机读取 ERP 登录令牌并请求商品列表；令牌不会发送给
          智能选品。商品原始记录、来源网址和采集时间会保存为可追溯证据。</span
        >
      </aside>
      <label
        >本次导入数量<input
          v-model.number="erpImportLimit"
          type="number"
          min="1"
          max="500"
          required
      /></label>
      <label class="erp-file-fallback"
        >没有安装助手时上传 ERP JSON<input
          type="file"
          accept=".json,application/json"
          @change="emit('importFile', $event)"
        /><small>接受接口返回的 list 数组或商品数组。</small></label
      >
      <footer>
        <a href="/browser-helper/scoutops-browser-helper.zip">下载浏览器助手</a>
        <button class="so-action-secondary" type="button" @click="erpImportOpen = false">
          取消
        </button>
        <button class="so-action-primary" type="submit" :disabled="busy">
          {{ busy ? "读取并导入中…" : "从当前浏览器读取" }}
        </button>
      </footer>
    </form>
  </dialog>

  <dialog
    v-if="createOpen"
    ref="createDialog"
    class="opportunity-modal"
    aria-labelledby="opportunity-create-title"
    @cancel="cancelCreate"
    @keydown="containDialogTab($event, createDialog)"
  >
    <form class="so-dialog-manifest" @submit.prevent="emit('create')">
      <header>
        <div>
          <p>新候选项</p>
          <h3 id="opportunity-create-title">创建机会候选</h3>
        </div>
        <button class="so-action-quiet" type="button" aria-label="关闭" @click="createOpen = false">
          ×
        </button>
      </header>
      <label>机会名称<input v-model="form.name" required maxlength="200" /></label>
      <div>
        <label>市场<input v-model="form.market" required maxlength="40" /></label>
        <label>分类（可选）<input v-model="form.category" maxlength="80" /></label>
      </div>
      <label
        >来源趋势 ID（可选，只接受当前工作区主题）<input
          v-model="form.source_topic_id"
          maxlength="36"
      /></label>
      <aside v-if="createFeedback?.type === 'created'" role="status">
        机会“{{ createFeedback.name }}”已创建。当前草稿已保留；内容相同时暂不允许重复提交。
        <a :href="`/opportunities/${createFeedback.id}`">查看已创建机会</a>
      </aside>
      <p v-else-if="createFeedback?.type === 'error'" class="opportunity-message" role="alert">
        {{ createFeedback.message }}
      </p>
      <aside>创建后由宝塔 Node Worker 刷新真实证据覆盖；评分、利润与风险不会自动填充。</aside>
      <footer>
        <button class="so-action-secondary" type="button" @click="createOpen = false">取消</button>
        <button
          class="so-action-primary"
          type="submit"
          :disabled="busy || createFeedbackMatchesForm"
        >
          {{
            busy ? "创建中…" : createFeedbackMatchesForm ? "内容已创建，请修改后再提交" : "创建机会"
          }}
        </button>
      </footer>
    </form>
  </dialog>

  <dialog
    v-if="decisionOpen && hasDetail"
    ref="decisionDialog"
    class="opportunity-modal"
    aria-labelledby="opportunity-decision-dialog-title"
    @cancel="cancelDecision"
    @keydown="containDialogTab($event, decisionDialog)"
  >
    <form
      class="so-dialog-manifest"
      @submit.prevent="emit('decide')"
      @invalid.capture="handleDecisionInvalid"
    >
      <header>
        <div>
          <p>留痕决策</p>
          <h3 id="opportunity-decision-dialog-title">
            记录{{ decisionLabel[decisionAction] }}决定
          </h3>
        </div>
        <button
          class="so-action-quiet"
          type="button"
          aria-label="关闭"
          @click="decisionOpen = false"
        >
          ×
        </button>
      </header>
      <label
        >原因（必填）<textarea
          v-model="decisionReason"
          required
          maxlength="1000"
          :aria-invalid="decisionReasonInvalid ? 'true' : undefined"
          :aria-describedby="
            decisionReasonInvalid
              ? 'opportunity-decision-reason-help opportunity-decision-reason-error'
              : 'opportunity-decision-reason-help'
          "
        />
      </label>
      <small id="opportunity-decision-reason-help">填写决定依据，最多 1000 个字符。</small>
      <p
        v-if="decisionReasonInvalid"
        id="opportunity-decision-reason-error"
        class="opportunity-field-error"
        role="alert"
      >
        请填写原因后再记录决定。
      </p>
      <aside>此决定会覆盖推荐展示，但不会改写原始分数、证据或历史。</aside>
      <footer>
        <button class="so-action-secondary" type="button" @click="decisionOpen = false">
          取消
        </button>
        <button
          :class="decisionAction === 'reject' ? 'so-action-danger' : 'so-action-primary'"
          type="submit"
          :disabled="busy"
        >
          {{ busy ? "保存中…" : "确认记录" }}
        </button>
      </footer>
    </form>
  </dialog>
</template>
