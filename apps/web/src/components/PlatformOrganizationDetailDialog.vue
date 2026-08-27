<script setup lang="ts">
import { useModalDialog } from "../use-modal-dialog";

const props = defineProps<{
  open: boolean;
  organization: any | null;
  form: { name: string; timezone: string; data_retention_days: number };
  busy: boolean;
  missing: boolean;
  errorMessage: string;
  successMessage: string;
  statusText: (value: string) => string;
}>();

const emit = defineEmits<{
  close: [];
  retry: [];
  clearFeedback: [];
  save: [];
  toggleStatus: [organization: any];
}>();
const { dialogElement, handleCancel } = useModalDialog(
  () => props.open,
  () => emit("close"),
);
</script>

<template>
  <dialog
    ref="dialogElement"
    class="organization-detail-dialog"
    :aria-label="organization?.name ?? (missing ? '未找到组织' : '组织详情')"
    @cancel="handleCancel"
  >
    <section v-if="missing" class="organization-detail-state" role="alert">
      <small>组织详情</small>
      <h3>未找到该组织</h3>
      <p>该组织可能已被删除，或当前账号已无法访问。请重新加载，或返回组织列表选择其他组织。</p>
      <footer>
        <button type="button" class="secondary" :disabled="busy" @click="$emit('retry')">
          重新加载
        </button>
        <button type="button" @click="$emit('close')">返回组织列表</button>
      </footer>
    </section>
    <form v-else-if="organization" @submit.prevent="$emit('save')">
      <header>
        <div>
          <small>组织详情</small>
          <h3>{{ organization.name }}</h3>
        </div>
        <button type="button" aria-label="关闭组织详情" @click="$emit('close')">关闭</button>
      </header>
      <div class="detail-grid">
        <article>
          <small>状态</small><strong>{{ statusText(organization.status) }}</strong>
        </article>
        <article>
          <small>成员</small><strong>{{ organization.member_count ?? 1 }} 人</strong>
        </article>
        <article>
          <small>工作区</small><strong>{{ organization.workspace_count ?? 1 }} 个</strong>
        </article>
      </div>
      <section class="organization-profile">
        <h4>组织资料与设置</h4>
        <label
          >组织名称<input
            v-model="form.name"
            required
            minlength="2"
            maxlength="120"
            @input="$emit('clearFeedback')"
        /></label>
        <label
          >时区<input
            v-model="form.timezone"
            required
            maxlength="64"
            @input="$emit('clearFeedback')"
        /></label>
        <label
          >数据保留天数<input
            v-model.number="form.data_retention_days"
            type="number"
            min="30"
            max="3650"
            required
            @input="$emit('clearFeedback')"
        /></label>
      </section>
      <p v-if="errorMessage" class="organization-feedback is-error" role="alert">
        <strong>操作未完成</strong><span>{{ errorMessage }}</span>
      </p>
      <p v-else-if="successMessage" class="organization-feedback is-success" role="status">
        <strong>操作成功</strong><span>{{ successMessage }}</span>
      </p>
      <details>
        <summary>技术详情</summary>
        <dl>
          <div>
            <dt>组织标识</dt>
            <dd>{{ organization.slug }}</dd>
          </div>
          <div>
            <dt>组织 UUID</dt>
            <dd>{{ organization.id }}</dd>
          </div>
        </dl>
      </details>
      <footer>
        <button
          type="button"
          class="secondary"
          :disabled="busy"
          @click="$emit('toggleStatus', organization)"
        >
          {{ organization.status === "active" ? "停用组织" : "恢复组织" }}
        </button>
        <button type="button" class="secondary" @click="$emit('close')">关闭</button>
        <button :disabled="busy">保存组织资料</button>
      </footer>
    </form>
  </dialog>
</template>

<style scoped>
dialog {
  position: fixed;
  inset: 0;
  z-index: 10;
  width: min(720px, calc(100% - 28px));
  max-height: 84vh;
  overflow: auto;
  margin: auto;
  border: 1px solid var(--so-border-strong);
  border-radius: 16px;
  color: var(--so-text);
  background: var(--so-bg-elevated);
  box-shadow: 0 24px 80px color-mix(in srgb, var(--so-shadow-color) 40%, transparent);
}
dialog::backdrop {
  background: color-mix(in srgb, var(--so-bg) 70%, transparent);
  backdrop-filter: blur(4px);
}
form,
.organization-profile,
.organization-detail-state {
  display: grid;
  gap: 14px;
}
header,
footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
header h3,
.organization-profile h4,
.organization-detail-state h3,
.organization-detail-state p {
  margin: 0;
}
header small,
.detail-grid small,
dt {
  color: var(--so-text-muted);
}
.detail-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.detail-grid article {
  padding: 12px;
  border: 1px solid var(--so-border);
  border-radius: 10px;
  background: var(--so-panel-soft);
}
.detail-grid small,
.detail-grid strong {
  display: block;
}
.organization-profile {
  grid-template-columns: 1fr 1fr;
}
.organization-profile h4 {
  grid-column: 1 / -1;
}
label {
  display: grid;
  gap: 6px;
}
label:first-of-type {
  grid-column: 1 / -1;
}
input {
  min-height: 44px;
  padding: 10px;
  border: 1px solid var(--so-border-strong);
  border-radius: 8px;
  color: var(--so-text);
  background: var(--so-panel-soft);
}
summary {
  display: flex;
  min-height: 44px;
  align-items: center;
  cursor: pointer;
}
.organization-feedback {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 12px;
  border: 1px solid;
  border-radius: 10px;
}
.organization-feedback.is-error {
  border-color: color-mix(in srgb, var(--so-danger) 55%, var(--so-border));
  color: var(--so-danger);
  background: color-mix(in srgb, var(--so-danger) 8%, var(--so-bg-elevated));
}
.organization-feedback.is-success {
  border-color: color-mix(in srgb, var(--so-success) 55%, var(--so-border));
  color: var(--so-success);
  background: color-mix(in srgb, var(--so-success) 8%, var(--so-bg-elevated));
}
dl {
  display: grid;
  gap: 8px;
}
dl div {
  display: grid;
  grid-template-columns: 100px minmax(0, 1fr);
  gap: 10px;
}
dd {
  margin: 0;
  overflow-wrap: anywhere;
}
footer {
  justify-content: flex-end;
  flex-wrap: wrap;
}
footer button {
  min-height: 44px;
}
@media (max-width: 700px) {
  dialog {
    width: calc(100% - 28px);
  }
  .detail-grid,
  .organization-profile {
    grid-template-columns: 1fr;
  }
  .organization-profile h4,
  label:first-of-type {
    grid-column: auto;
  }
}
</style>
