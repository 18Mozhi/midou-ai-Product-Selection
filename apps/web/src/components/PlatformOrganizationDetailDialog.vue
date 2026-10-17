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
  refreshWarning: string;
  refreshing: boolean;
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
      <header class="p42-missing-identity">
        <small>平台组织 / 组织详情</small>
        <h3>当前列表未找到该组织</h3>
      </header>
      <div class="p42-missing-work">
        <p>
          本次组织列表没有返回这个目标。此结果不能单独说明组织已删除，或当前账号已失去访问权限。
        </p>
        <p v-if="refreshWarning" class="organization-feedback is-warning" role="status">
          {{ refreshWarning }}
        </p>
        <footer>
          <button
            type="button"
            class="secondary"
            :disabled="busy || refreshing"
            @click="$emit('retry')"
          >
            {{ refreshing ? "正在重新加载" : "重新加载" }}
          </button>
          <button type="button" class="secondary" @click="$emit('close')">返回组织列表</button>
        </footer>
      </div>
    </section>
    <form v-else-if="organization" class="p42-detail-form" @submit.prevent="$emit('save')">
      <section class="p42-identity">
        <header class="p42-identity-head">
          <small>平台组织 / 组织详情</small>
          <h3>{{ organization.name }}</h3>
        </header>
        <div class="detail-grid" aria-label="组织事实">
          <article>
            <small>状态</small><strong>{{ statusText(organization.status) }}</strong>
          </article>
          <article>
            <small>成员</small>
            <strong>{{
              organization.member_count == null ? "尚未读取" : `${organization.member_count} 人`
            }}</strong>
          </article>
          <article>
            <small>工作区</small>
            <strong>{{
              organization.workspace_count == null
                ? "尚未读取"
                : `${organization.workspace_count} 个`
            }}</strong>
          </article>
        </div>
      </section>
      <div class="p42-work">
        <header class="p42-work-head">
          <div>
            <small>资料与设置</small>
            <h3>组织资料与状态</h3>
          </div>
          <button type="button" class="secondary" aria-label="关闭组织详情" @click="$emit('close')">
            关闭
          </button>
        </header>
        <section class="organization-profile" aria-labelledby="organization-profile-title">
          <h4 id="organization-profile-title">组织资料</h4>
          <label>
            组织名称
            <input
              v-model="form.name"
              aria-describedby="organization-name-help"
              required
              minlength="2"
              maxlength="120"
              @input="$emit('clearFeedback')"
            />
            <small id="organization-name-help" class="field-help"
              >2–120 个字符；此处维护组织显示名称。</small
            >
          </label>
          <label>
            时区
            <input
              v-model="form.timezone"
              aria-describedby="organization-timezone-help"
              required
              maxlength="64"
              @input="$emit('clearFeedback')"
            />
            <small id="organization-timezone-help" class="field-help">必填，最多 64 个字符。</small>
          </label>
          <label>
            数据保留天数
            <input
              v-model.number="form.data_retention_days"
              aria-describedby="organization-retention-help"
              type="number"
              min="30"
              max="3650"
              step="1"
              required
              @input="$emit('clearFeedback')"
            />
            <small id="organization-retention-help" class="field-help"
              >填写 30–3650 天的整数。</small
            >
          </label>
        </section>
        <p v-if="errorMessage" class="organization-feedback is-error" role="alert">
          <strong>操作未完成</strong><span>{{ errorMessage }}</span>
        </p>
        <p v-else-if="successMessage" class="organization-feedback is-success" role="status">
          <strong>操作成功</strong><span>{{ successMessage }}</span>
        </p>
        <div v-if="refreshWarning" class="organization-feedback is-warning" role="status">
          <div>
            <strong>保存结果已确认，最新资料尚未读取</strong>
            <span>{{ refreshWarning }}</span>
          </div>
          <button
            type="button"
            class="secondary"
            :disabled="busy || refreshing"
            @click="$emit('retry')"
          >
            {{ refreshing ? "正在重新加载" : "重新加载组织资料" }}
          </button>
        </div>
        <details class="p42-technical">
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
        <section class="p42-status-zone" aria-labelledby="organization-status-title">
          <div>
            <h4 id="organization-status-title">组织状态操作</h4>
            <p>停用或恢复将单独要求填写原因。</p>
          </div>
          <button
            type="button"
            class="p42-status-action"
            :data-danger="organization.status === 'active'"
            :disabled="busy"
            @click="$emit('toggleStatus', organization)"
          >
            {{ organization.status === "active" ? "停用组织" : "恢复组织" }}
          </button>
        </section>
        <footer class="p42-actions">
          <button type="button" class="secondary" @click="$emit('close')">关闭</button>
          <button type="submit" class="p42-save" :disabled="busy">
            {{ busy ? "正在保存" : "保存组织资料" }}
          </button>
        </footer>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
#app .organization-detail-dialog {
  position: fixed;
  inset: 0;
  z-index: 10;
  width: min(760px, calc(100% - 32px));
  max-height: calc(100dvh - 32px);
  overflow: auto;
  margin: auto;
  padding: 0;
  border: 1px solid var(--so-border-strong);
  border-radius: 10px;
  background: var(--so-panel);
  color: var(--so-text);
  box-shadow: var(--so-shadow-dialog);
}
#app .organization-detail-dialog::backdrop {
  background: var(--so-scrim);
  backdrop-filter: none;
}
#app .organization-detail-dialog .p42-detail-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
  min-width: 0;
  margin: 0;
  padding: 0;
}
.p42-identity,
.p42-missing-identity {
  padding: 16px 20px;
  border-bottom: 1px solid var(--so-border);
  background: var(--so-panel);
}
.p42-identity-head small,
.p42-missing-identity small {
  color: var(--so-text-muted);
  font-size: 12px;
}
.p42-identity h3,
.p42-missing-identity h3 {
  margin: 5px 0 0;
  font-size: 18px;
  overflow-wrap: anywhere;
}
.detail-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}
.detail-grid article {
  min-width: 0;
  padding: 0 12px 0 0;
  border-right: 1px solid var(--so-border);
}
.detail-grid article:last-child {
  border: 0;
}
.detail-grid small,
.detail-grid strong {
  display: block;
  overflow-wrap: anywhere;
}
.detail-grid small {
  color: var(--so-text-muted);
  font-size: 12px;
}
.detail-grid strong {
  margin-top: 5px;
  font-size: 16px;
}
.p42-work,
.p42-missing-work {
  display: grid;
  gap: 16px;
  min-width: 0;
  padding: 16px 20px 0;
}
.p42-work-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.p42-work-head small {
  display: none;
}
.p42-work-head h3 {
  margin: 0;
  font-size: 14px;
}
.organization-profile {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.organization-profile h4 {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 14px;
}
.organization-profile label {
  display: grid;
  min-width: 0;
  gap: 6px;
  font-size: 13px;
}
.organization-profile label:first-of-type {
  grid-column: 1 / -1;
}
#app .organization-profile input {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 9px 12px;
  border: 1px solid var(--so-border-strong);
  border-radius: 6px;
  background: var(--so-panel);
  color: var(--so-text);
  font: inherit;
}
.field-help {
  color: var(--so-text-muted);
  font-size: 12px;
  line-height: 1.5;
}
#app .organization-detail-dialog button {
  min-height: 44px;
  padding: 9px 14px;
  border: 1px solid var(--so-border-strong);
  border-radius: 6px;
  background: var(--so-panel);
  color: var(--so-text);
  font: inherit;
}
#app .organization-detail-dialog .p42-save {
  border-color: var(--so-primary);
  background: var(--so-primary);
  color: var(--so-on-primary);
}
.p42-status-zone {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--so-border);
  border-radius: 6px;
  background: var(--so-panel-soft);
}
.p42-status-zone h4 {
  margin: 0 0 5px;
  font-size: 13px;
}
.p42-status-zone p {
  margin: 0;
  color: var(--so-text-muted);
  font-size: 13px;
}
#app .organization-detail-dialog .p42-status-action[data-danger="true"] {
  border-color: var(--so-danger-border);
  color: var(--so-danger);
  background: var(--so-danger-soft);
}
.p42-technical {
  border-block: 1px solid var(--so-border);
}
.p42-technical summary {
  min-height: 44px;
  display: list-item;
  padding-block: 12px;
  cursor: pointer;
  font-size: 13px;
}
.p42-technical dl {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0 0 14px;
}
.p42-technical dl div {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr);
  gap: 10px;
}
.p42-technical dt {
  color: var(--so-text-muted);
}
.p42-technical dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.organization-feedback {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 12px;
  border: 1px solid var(--so-border);
  border-radius: 6px;
  overflow-wrap: anywhere;
  font-size: 13px;
}
.organization-feedback.is-error {
  border-color: var(--so-danger-border);
  background: var(--so-danger-soft);
  color: var(--so-danger);
}
.organization-feedback.is-success {
  border-color: var(--so-success-border);
  background: var(--so-success-soft);
  color: var(--so-success);
}
.organization-feedback.is-warning {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  border-color: var(--so-warning-border);
  background: var(--so-warning-soft);
  color: var(--so-warning);
}
.organization-feedback > div {
  display: grid;
  gap: 4px;
}
#app .organization-detail-dialog .p42-actions {
  position: sticky;
  bottom: 0;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin: 0 -20px;
  padding: 12px 20px;
  border-top: 1px solid var(--so-border);
  background: var(--so-panel);
}
.organization-detail-state {
  display: grid;
  min-width: 0;
}
.p42-missing-work {
  padding-bottom: 16px;
}
.p42-missing-work > p {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
}
.p42-missing-work footer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}
#app .organization-detail-dialog :is(button, input, summary):focus-visible {
  outline: 3px solid var(--so-focus);
  outline-offset: 2px;
}
#app .organization-detail-dialog button:disabled {
  background: var(--so-panel-soft);
  color: var(--so-text-muted);
  cursor: not-allowed;
  opacity: 1;
}
@media (max-width: 640px) {
  .organization-profile,
  .organization-feedback.is-warning {
    grid-template-columns: minmax(0, 1fr);
  }
  .organization-profile label:first-of-type {
    grid-column: auto;
  }
  .p42-work,
  .p42-missing-work {
    padding-inline: 16px;
  }
  .p42-identity,
  .p42-missing-identity {
    padding-inline: 16px;
  }
  #app .organization-detail-dialog .p42-actions {
    margin-inline: -16px;
    padding-inline: 16px;
  }
}
</style>
