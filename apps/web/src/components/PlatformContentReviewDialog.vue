<script setup lang="ts">
import { computed, shallowRef, useId, watch } from "vue";
import { useModalDialog } from "../use-modal-dialog";
import type { PlatformContentReviewSnapshot } from "./use-platform-content-review";

type ReviewStatus = "active" | "irrelevant" | "stale";

const props = defineProps<{
  open: boolean;
  item: PlatformContentReviewSnapshot | null;
  error: string;
  submitting: boolean;
}>();
const emit = defineEmits<{ cancel: []; submit: [] }>();
const status = defineModel<ReviewStatus>("status", { required: true });
const reason = defineModel<string>("reason", { required: true });
const attempted = shallowRef(false);
const fieldId = useId();
const reasonInvalid = computed(() => attempted.value && reason.value.trim().length < 2);
const sameStatus = computed(() => props.item?.status === status.value);
const statusName = (value: string) =>
  ({ active: "展示中", irrelevant: "无关", stale: "已过期" })[value] ?? value;
const { dialogElement, handleCancel } = useModalDialog(
  () => props.open,
  () => emit("cancel"),
);

watch(
  () => props.open,
  (open) => {
    if (open) attempted.value = false;
  },
);

function submit() {
  attempted.value = true;
  if (reason.value.trim().length < 2 || props.submitting) return;
  emit("submit");
}
</script>

<template>
  <dialog
    ref="dialogElement"
    class="platform-content-review"
    aria-labelledby="platform-content-review-title"
    @cancel="handleCancel"
  >
    <form @submit.prevent="submit">
      <header>
        <div>
          <small>CONTENT REVIEW</small>
          <h3 id="platform-content-review-title">审核热点内容</h3>
          <p>只修改展示状态。原因将进入审核记录；本页不会编辑来源事实。</p>
        </div>
        <button type="button" aria-label="关闭审核" @click="emit('cancel')">关闭</button>
      </header>

      <section v-if="item" class="platform-content-review__subject">
        <strong>{{ item.title }}</strong>
        <span>
          {{ item.organization_name || "组织未提供" }} /
          {{ item.workspace_name || "工作区未提供" }} · 当前{{ statusName(item.status) }} · v{{
            item.version
          }}
        </span>
      </section>

      <label>
        <span>目标状态</span>
        <select v-model="status" :disabled="submitting">
          <option value="active">展示中</option>
          <option value="irrelevant">无关</option>
          <option value="stale">已过期</option>
        </select>
        <small v-if="sameStatus" class="platform-content-review__same-status">
          当前选择与原状态相同；提交后仍会按现有合同记录一次审核。
        </small>
      </label>

      <label :for="fieldId">
        <span>审核依据</span>
        <textarea
          :id="fieldId"
          v-model="reason"
          required
          minlength="2"
          maxlength="300"
          rows="5"
          placeholder="说明判断依据"
          :disabled="submitting"
          :aria-invalid="reasonInvalid || Boolean(error)"
          :aria-describedby="`${fieldId}-help${reasonInvalid ? ` ${fieldId}-error` : ''}${error ? ` ${fieldId}-request-error` : ''}`"
        ></textarea>
        <span class="platform-content-review__field-meta">
          <small :id="`${fieldId}-help`">去除首尾空白后 2–300 字</small>
          <small>{{ reason.length }} / 300</small>
        </span>
        <small v-if="reasonInvalid" :id="`${fieldId}-error`" class="platform-content-review__error">
          请填写至少 2 个字的审核依据。
        </small>
      </label>

      <p
        v-if="error"
        :id="`${fieldId}-request-error`"
        class="platform-content-review__request-error"
        role="alert"
      >
        {{ error }}
      </p>
      <p v-if="submitting" class="platform-content-review__pending" role="status">
        正在保存审核。此时关闭窗口不会取消已发出的请求。
      </p>

      <footer>
        <button type="button" @click="emit('cancel')">
          {{ submitting ? "关闭窗口" : "取消" }}
        </button>
        <button type="submit" :disabled="reason.trim().length < 2 || submitting">
          {{ submitting ? "正在保存…" : "确认审核" }}
        </button>
      </footer>
    </form>
  </dialog>
</template>
