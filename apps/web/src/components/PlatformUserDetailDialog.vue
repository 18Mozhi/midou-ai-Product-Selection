<script setup lang="ts">
import { useModalDialog } from "../use-modal-dialog";

const props = defineProps<{
  open: boolean;
  detail: any | null;
  selected: any | null;
  busy: boolean;
  errorMessage: string;
  successMessage: string;
  statusText: (value: string) => string;
  roleText: (value: string) => string;
}>();

const emit = defineEmits<{
  close: [];
  retry: [];
  toggleStatus: [user: any];
  role: [userId: string, roleCode: string, enabled: boolean];
  resetPassword: [user: any];
  revokeSessions: [user: any, sessionId: string | null];
}>();
const { dialogElement, handleCancel } = useModalDialog(
  () => props.open,
  () => emit("close"),
);

const roleCodes = ["platform_operations_admin", "platform_security_admin", "platform_super_admin"];
const currentRoles = () => props.selected?.roles ?? props.selected?.platform_roles ?? [];
</script>

<template>
  <dialog
    ref="dialogElement"
    class="detail-dialog"
    :aria-label="detail?.user?.email ?? selected?.email ?? '账号详情'"
    @cancel="handleCancel"
  >
    <section v-if="detail">
      <header>
        <div>
          <small>账号详情</small>
          <h3>{{ detail.user.email }}</h3>
        </div>
        <button aria-label="关闭账号详情" title="关闭账号详情" @click="$emit('close')">关闭</button>
      </header>
      <p v-if="errorMessage" class="detail-feedback detail-feedback--error" role="alert">
        {{ errorMessage }}
      </p>
      <p v-if="successMessage" class="detail-feedback detail-feedback--success" role="status">
        {{ successMessage }}
      </p>
      <div class="detail-grid">
        <article>
          <small>账号状态</small><strong>{{ statusText(detail.user.status) }}</strong>
        </article>
        <article>
          <small>首次安全设置</small
          ><strong>{{
            detail.user.must_change_password || detail.user.must_enroll_mfa ? "待完成" : "已完成"
          }}</strong>
        </article>
        <article>
          <small>组织关系</small><strong>{{ detail.memberships.length }}</strong>
        </article>
        <article>
          <small>活动会话</small
          ><strong>{{
            detail.sessions.filter((item: any) => item.status === "active").length
          }}</strong>
        </article>
      </div>
      <h4>组织与角色</h4>
      <p v-if="!detail.memberships.length">尚未加入组织。</p>
      <ul>
        <li v-for="item in detail.memberships" :key="item.id">
          <span>{{ item.organization_name }}</span
          ><b>{{ item.roles.map(roleText).join("、") }}</b
          ><small>{{ statusText(item.status) }}</small>
        </li>
      </ul>
      <h4>登录会话</h4>
      <p v-if="!detail.sessions.length">暂无会话。</p>
      <ul>
        <li v-for="session in detail.sessions" :key="session.id">
          <span>{{ session.device_label }}</span
          ><b>{{ statusText(session.status) }}</b
          ><small>{{ new Date(session.last_seen_at).toLocaleString() }}</small>
          <button
            v-if="session.status === 'active'"
            :disabled="busy"
            @click="$emit('revokeSessions', selected, session.id)"
          >
            撤销
          </button>
        </li>
      </ul>
      <h4>平台角色</h4>
      <p>{{ currentRoles().map(roleText).join("、") || "普通用户，没有平台后台权限。" }}</p>
      <div class="role-actions">
        <button
          v-for="code in roleCodes"
          :key="code"
          :disabled="busy || selected?.status !== 'active'"
          @click="$emit('role', selected.id, code, !currentRoles().includes(code))"
        >
          {{ currentRoles().includes(code) ? "撤销" : "授予" }}{{ roleText(code) }}
        </button>
      </div>
      <footer>
        <button :disabled="busy" @click="$emit('toggleStatus', selected)">
          {{ selected?.status === "active" ? "停用登录" : "恢复登录" }}
        </button>
        <button :disabled="busy" @click="$emit('resetPassword', selected)">强制改密</button>
        <button :disabled="busy" @click="$emit('revokeSessions', selected, null)">
          撤销全部会话
        </button>
        <button @click="$emit('close')">关闭</button>
      </footer>
    </section>
    <section v-else-if="errorMessage" class="account-state account-state--error" role="alert">
      <strong>账号详情暂时无法读取</strong>
      <span>{{ errorMessage }}</span>
      <div>
        <button type="button" @click="$emit('retry')">重试</button>
        <button type="button" @click="$emit('close')">关闭</button>
      </div>
    </section>
    <section v-else class="account-state" aria-live="polite">正在读取账号详情…</section>
  </dialog>
</template>

<style scoped>
dialog {
  position: fixed;
  inset: 0;
  z-index: 10;
  width: min(760px, calc(100% - 28px));
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
.detail-dialog > section > header {
  display: flex;
  justify-content: space-between;
  align-items: start;
}
.detail-dialog > section > header button {
  border: 0;
  color: var(--so-text);
  background: transparent;
  font-size: 26px;
}
.detail-dialog button {
  min-height: 44px;
  padding: 9px 12px;
}
.detail-dialog button:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}
.detail-feedback {
  margin: 12px 0 0;
  padding: 11px 13px;
  border-radius: 9px;
}
.detail-feedback--error {
  border: 1px solid color-mix(in srgb, var(--so-danger) 45%, var(--so-border));
  color: var(--so-danger);
  background: var(--so-danger-soft);
}
.detail-feedback--success {
  border: 1px solid color-mix(in srgb, var(--so-success) 45%, var(--so-border));
  color: var(--so-success);
  background: color-mix(in srgb, var(--so-success) 12%, var(--so-panel));
}
.detail-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin: 16px 0;
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
.detail-dialog ul {
  padding: 0;
  display: grid;
  gap: 8px;
  list-style: none;
}
.detail-dialog li {
  padding: 10px;
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr) minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--so-border);
  border-radius: 9px;
}
.detail-dialog li small {
  color: var(--so-text-muted);
}
.role-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
footer {
  margin-top: 18px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}
.account-state {
  padding: 18px;
  text-align: center;
}
.account-state--error {
  display: grid;
  gap: 12px;
}
.account-state--error span {
  color: var(--so-text-muted);
}
.account-state--error div {
  display: flex;
  justify-content: center;
  gap: 8px;
}
@media (max-width: 700px) {
  dialog {
    width: calc(100% - 28px);
  }
  .detail-grid {
    grid-template-columns: 1fr 1fr;
  }
  .detail-dialog li {
    grid-template-columns: 1fr;
  }
}
</style>
