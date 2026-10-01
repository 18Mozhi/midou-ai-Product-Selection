<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useModalDialog } from "../use-modal-dialog";
import { containDialogTab } from "../ui/contain-dialog-tab";
import OpportunityErpImportDialog from "./OpportunityErpImportDialog.vue";

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
</script>

<template>
  <OpportunityErpImportDialog
    v-model:open="erpImportOpen"
    v-model:import-limit="erpImportLimit"
    :busy="busy"
    @import-browser="emit('importBrowser')"
    @import-file="emit('importFile', $event)"
  />

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
