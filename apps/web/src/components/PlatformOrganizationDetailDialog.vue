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
      <aside class="p42-missing-identity">
        <small>平台组织 / 组织详情</small>
        <h3>当前列表未找到该组织</h3>
      </aside>
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
      <aside class="p42-identity">
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
      </aside>
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
            <small id="organization-timezone-help" class="field-help">
              必填，最多 64 个字符；服务端按现有合同校验非空与长度。
            </small>
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
.organization-detail-dialog {
  position: fixed;
  inset: 0;
  z-index: 10;
  width: min(960px, calc(100% - 32px));
  max-height: calc(100dvh - 32px);
  overflow: auto;
  margin: auto;
  padding: 0;
  border: 1px solid #dbe1e9;
  border-radius: 12px;
  color: #202c3d;
  background: #fff;
  box-shadow: 0 20px 60px #10244226;
}
.organization-detail-dialog::backdrop {
  background: #23354e99;
  backdrop-filter: blur(3px);
}
.p42-detail-form {
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr);
  min-width: 0;
  gap: 0;
}
.p42-identity {
  min-width: 0;
  padding: 28px 24px;
  color: #fff;
  background: #254a9c;
}
.p42-identity-head {
  display: block;
  margin-bottom: 28px;
}
.p42-identity-head h3 {
  margin: 12px 0 0;
  color: #fff;
  font-size: 24px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.p42-identity-head small {
  color: #e5edff;
}
.detail-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0;
}
.detail-grid article {
  padding: 18px 0;
  border: 0;
  border-top: 1px solid #ffffff55;
  border-radius: 0;
  background: transparent;
}
.detail-grid small,
.detail-grid strong {
  display: block;
  color: #fff;
}
.detail-grid strong {
  margin-top: 6px;
  font-size: 20px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.p42-work {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 22px;
  padding: 26px 28px 0;
}
.p42-work-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.p42-work-head small,
.p42-missing-identity small {
  color: #58677b;
}
.p42-work-head h3 {
  margin: 4px 0 0;
  font-size: 24px;
}
.organization-profile {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}
.organization-profile h4 {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 18px;
}
.organization-profile label {
  display: grid;
  min-width: 0;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
}
.organization-profile label:first-of-type {
  grid-column: 1 / -1;
}
.organization-profile input {
  width: 100%;
  min-width: 0;
  min-height: 48px;
  padding: 10px 12px;
  border: 1px solid #6680a2;
  border-radius: 8px;
  color: #202c3d;
  background: #fff;
  font: inherit;
  font-size: 16px;
}
.field-help {
  color: #58677b;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.5;
}
.p42-work-head button,
.p42-missing-work button,
.p42-work button,
.p42-technical summary {
  min-height: 44px;
  min-width: 44px;
  padding: 10px 14px;
  border-radius: 8px;
  font: inherit;
  font-size: 15px;
}
.p42-work button,
.p42-missing-work button {
  border: 1px solid #dbe1e9;
  color: #202c3d;
  background: #fff;
  cursor: pointer;
}
.p42-work .p42-save {
  border-color: #254a9c;
  color: #fff;
  background: #254a9c;
}
.p42-status-zone {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 18px;
  border: 1px solid #dbe1e9;
  border-radius: 8px;
  background: #f6f8fb;
}
.p42-status-zone h4,
.p42-status-zone p {
  margin: 0;
}
.p42-status-zone h4 {
  margin-bottom: 8px;
  font-size: 16px;
}
.p42-status-zone p {
  color: #58677b;
  font-size: 13px;
  line-height: 1.5;
}
.p42-work .p42-status-action {
  flex-shrink: 0;
  color: #254a9c;
  border-color: #254a9c;
}
.p42-work .p42-status-action[data-danger="true"] {
  color: #8c3c32;
  border-color: #c9786d;
  background: #fff8f6;
}
.p42-technical {
  border-block: 1px solid #dbe1e9;
}
.p42-technical summary {
  display: flex;
  align-items: center;
  padding-inline: 0;
  color: #202c3d;
  cursor: pointer;
}
.p42-technical dl {
  display: grid;
  gap: 8px;
  padding: 0 0 14px;
  margin: 0;
}
.p42-technical dl div {
  display: grid;
  grid-template-columns: 100px minmax(0, 1fr);
  gap: 10px;
}
.p42-technical dt {
  color: #58677b;
}
.p42-technical dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
}
.organization-feedback {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 14px;
  border: 1px solid;
  border-radius: 8px;
  overflow-wrap: anywhere;
}
.organization-feedback.is-error {
  border-color: #c9786d;
  color: #8c3c32;
  background: #fff3ef;
}
.organization-feedback.is-success {
  border-color: #82a89a;
  color: #23664c;
  background: #eff8f3;
}
.organization-feedback.is-warning {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  border-color: #d2a958;
  color: #604d22;
  background: #fff9e9;
}
.organization-feedback > div {
  display: grid;
  gap: 4px;
}
.organization-feedback.is-warning button {
  white-space: nowrap;
}
.p42-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
  padding: 18px 0;
  border-top: 1px solid #dbe1e9;
  background: #fff;
}
.p42-actions button {
  min-height: 46px;
}
.p42-missing-identity {
  padding: 28px 24px;
  color: #fff;
  background: #254a9c;
}
.p42-missing-identity small {
  color: #e5edff;
}
.p42-missing-identity h3 {
  margin: 12px 0 0;
  color: #fff;
  font-size: 24px;
}
.p42-missing-work {
  display: grid;
  gap: 20px;
  padding: 28px;
}
.p42-missing-work > p {
  margin: 0;
  font-size: 16px;
  line-height: 1.7;
}
.p42-missing-work footer {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
  padding-top: 18px;
  border-top: 1px solid #dbe1e9;
}
.organization-detail-dialog :is(button, input, summary):focus-visible {
  outline: 3px solid #254a9c;
  outline-offset: 3px;
}
.organization-detail-dialog button:disabled {
  border-color: #dbe1e9;
  color: #58677b;
  background: #edf1f6;
  opacity: 1;
  cursor: not-allowed;
}
.organization-detail-state {
  display: grid;
  min-width: 0;
  grid-template-columns: 250px minmax(0, 1fr);
}
@media (max-width: 700px) {
  .organization-detail-dialog {
    width: calc(100% - 32px);
    max-height: calc(100dvh - 24px);
  }
  .p42-detail-form,
  .organization-detail-state {
    grid-template-columns: 1fr;
  }
  .p42-identity {
    padding: 20px;
  }
  .p42-identity-head {
    margin-bottom: 18px;
  }
  .p42-identity .detail-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }
  .p42-identity .detail-grid article {
    min-width: 0;
    padding: 12px 0 0;
  }
  .p42-identity .detail-grid strong {
    font-size: 16px;
  }
  .p42-work {
    gap: 18px;
    padding: 20px 20px 0;
  }
  .organization-profile {
    grid-template-columns: 1fr;
  }
  .organization-profile h4,
  .organization-profile label:first-of-type {
    grid-column: auto;
  }
  .p42-work .p42-actions {
    position: sticky;
    bottom: 0;
    z-index: 1;
    margin: 0 -20px;
    padding: 12px 20px max(12px, env(safe-area-inset-bottom));
    box-shadow: 0 -8px 20px #172b4512;
  }
  .p42-work .p42-actions button {
    min-height: 48px;
  }
  .p42-status-zone {
    display: grid;
  }
  .organization-feedback.is-warning {
    grid-template-columns: 1fr;
  }
  .organization-feedback.is-warning button {
    width: 100%;
  }
  .p42-missing-work {
    padding: 20px;
  }
}
</style>
