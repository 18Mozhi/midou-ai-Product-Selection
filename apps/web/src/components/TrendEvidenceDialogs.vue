<script setup lang="ts">
import { ref } from "vue";
import { useModalDialog } from "../use-modal-dialog";
import { trapModalTab } from "../modal-dialog-keyboard";
import type { TrendDetail as Detail } from "./trend-workspace-types";

const props = defineProps<{ canManage: boolean; busy: string }>();
const emit = defineEmits<{
  createQualityIssue: [];
  markIrrelevant: [];
}>();
const anomalyEvidence = defineModel<Detail["evidence"][number] | null>("anomalyEvidence", {
  required: true,
});
const anomalySeverity = defineModel<"warning" | "critical">("anomalySeverity", {
  required: true,
});
const anomalyReason = defineModel<string>("anomalyReason", { required: true });
const relevanceDialog = defineModel<"active" | "irrelevant" | null>("relevanceDialog", {
  required: true,
});
const relevanceReason = defineModel<string>("relevanceReason", { required: true });
const { dialogElement: relevanceDialogElement, handleCancel: handleRelevanceCancel } =
  useModalDialog(
    () => Boolean(relevanceDialog.value && props.canManage),
    () => {
      if (!props.busy) relevanceDialog.value = null;
    },
  );
const {
  dialogElement: anomalyDialogElement,
  handleCancel: handleAnomalyCancel,
  discardReturnFocus: discardAnomalyReturnFocus,
} = useModalDialog(
  () => Boolean(anomalyEvidence.value && props.canManage),
  () => {
    if (!props.busy) anomalyEvidence.value = null;
  },
);

function handleRelevanceKeydown(event: KeyboardEvent) {
  trapModalTab(event, relevanceDialogElement.value);
}

function handleAnomalyKeydown(event: KeyboardEvent) {
  trapModalTab(event, anomalyDialogElement.value);
}

defineExpose({ discardAnomalyReturnFocus });
</script>

<template>
  <dialog
    ref="anomalyDialogElement"
    class="trend-modal trend-native-dialog trend-anomaly-dialog"
    aria-labelledby="trend-anomaly-title"
    @cancel="handleAnomalyCancel"
    @keydown="handleAnomalyKeydown"
  >
    <form @submit.prevent="emit('createQualityIssue')">
      <header>
        <div>
          <p>异常证据</p>
          <h3 id="trend-anomaly-title">创建数据质量工单</h3>
        </div>
        <button
          type="button"
          aria-label="关闭异常报告"
          :disabled="Boolean(busy)"
          @click="anomalyEvidence = null"
        >
          ×
        </button>
      </header>
      <p>{{ anomalyEvidence?.title }}</p>
      <label
        >风险等级<select v-model="anomalySeverity">
          <option value="warning">需要复核</option>
          <option value="critical">严重异常</option>
        </select></label
      ><label
        >异常说明<textarea
          v-model="anomalyReason"
          required
          minlength="2"
          maxlength="500"
          rows="4"
          placeholder="说明哪个事实异常，以及复核时应检查什么"
          autofocus
        ></textarea>
      </label>
      <aside>工单会关联当前主题、证据、来源、原始证据和解析器版本。</aside>
      <footer>
        <button type="button" :disabled="Boolean(busy)" @click="anomalyEvidence = null">取消</button
        ><button type="submit" :disabled="anomalyReason.trim().length < 2 || Boolean(busy)">
          {{ busy.includes("quality-issues") ? "创建中…" : "创建质量工单" }}
        </button>
      </footer>
    </form>
  </dialog>
  <dialog
    v-if="relevanceDialog && canManage"
    ref="relevanceDialogElement"
    class="trend-modal trend-relevance-dialog"
    aria-modal="true"
    aria-labelledby="trend-relevance-title"
    @cancel="handleRelevanceCancel"
    @keydown="handleRelevanceKeydown"
  >
    <form @submit.prevent="emit('markIrrelevant')">
      <header>
        <div>
          <p>相关性治理</p>
          <h3 id="trend-relevance-title">
            {{ relevanceDialog === "irrelevant" ? "标记为无关" : "恢复为相关" }}
          </h3>
        </div>
        <button
          type="button"
          aria-label="关闭相关性变更"
          :disabled="Boolean(busy)"
          @click="relevanceDialog = null"
        >
          ×
        </button>
      </header>
      <p>原始证据、时间线和历史原因不会删除；本次变更会形成可回溯审计。</p>
      <label
        >变更原因<textarea
          v-model="relevanceReason"
          required
          minlength="2"
          maxlength="500"
          rows="4"
          placeholder="说明判定依据，便于后续复核"
          autofocus
        ></textarea>
      </label>
      <footer>
        <button type="button" :disabled="Boolean(busy)" @click="relevanceDialog = null">取消</button
        ><button type="submit" :disabled="relevanceReason.trim().length < 2 || Boolean(busy)">
          {{ busy.includes("/relevance") ? "提交中…" : "确认并记录" }}
        </button>
      </footer>
    </form>
  </dialog>
</template>
