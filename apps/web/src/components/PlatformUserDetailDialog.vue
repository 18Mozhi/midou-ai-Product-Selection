<script setup lang="ts">
import { useModalDialog } from "../use-modal-dialog";
import PlatformUserMembershipForm from "./PlatformUserMembershipForm.vue";

const props = defineProps<{
  open: boolean;
  detail: any | null;
  selected: any | null;
  busy: boolean;
  errorMessage: string;
  successMessage: string;
  organizations: any[];
  statusText: (value: string) => string;
  roleText: (value: string) => string;
}>();

const emit = defineEmits<{
  close: [];
  retry: [];
  toggleStatus: [user: any];
  role: [userId: string, roleCode: string, enabled: boolean];
  addMembership: [
    userId: string,
    value: { organization_id: string; role_code: string; reason: string },
  ];
  resetPassword: [user: any];
  revokeSessions: [user: any, sessionId: string | null];
}>();
const { dialogElement, handleCancel } = useModalDialog(
  () => props.open,
  () => emit("close"),
);

const roleCodes = ["platform_operations_admin", "platform_security_admin", "platform_super_admin"];
const currentRoles = () => props.selected?.roles ?? props.selected?.platform_roles ?? [];
function scrollToSection(section: "memberships" | "roles" | "security") {
  dialogElement.value
    ?.querySelector<HTMLElement>(`[data-user-detail-section="${section}"]`)
    ?.scrollIntoView({ block: "start" });
}
</script>

<template>
  <dialog
    ref="dialogElement"
    class="detail-dialog"
    :aria-label="detail?.user?.email ?? selected?.email ?? '账号详情'"
    @cancel="handleCancel"
  >
    <section v-if="detail" class="user-detail-shell">
      <header class="user-detail-identity">
        <div>
          <small>账号身份</small>
          <h3>{{ detail.user.email }}</h3>
          <span class="user-detail-status">{{ statusText(detail.user.status) }}</span>
        </div>
        <nav aria-label="账号详情分区">
          <button type="button" @click="scrollToSection('memberships')">组织关系</button>
          <button type="button" @click="scrollToSection('roles')">平台权限</button>
          <button type="button" @click="scrollToSection('security')">登录安全</button>
        </nav>
      </header>
      <div class="user-detail-main">
        <header class="user-detail-toolbar">
          <small>账号详情</small>
          <button type="button" aria-label="关闭账号详情" @click="$emit('close')">关闭</button>
        </header>
        <p v-if="errorMessage" class="detail-feedback detail-feedback--error" role="alert">
          {{ errorMessage }}
        </p>
        <p v-if="successMessage" class="detail-feedback detail-feedback--success" role="status">
          {{ successMessage }}
        </p>
        <div class="user-detail-scroll">
          <section
            id="user-detail-organizations"
            class="user-detail-section"
            data-user-detail-section="memberships"
            aria-labelledby="user-detail-organizations-title"
          >
            <header>
              <div>
                <h4 id="user-detail-organizations-title">组织关系</h4>
                <p>核对现有组织角色；仅在服务返回候选时添加新的组织关系。</p>
              </div>
              <strong>{{ detail.memberships.length }} 项</strong>
            </header>
            <div class="user-detail-facts">
              <article>
                <small>首次安全设置</small>
                <strong>{{
                  detail.user.must_change_password || detail.user.must_enroll_mfa
                    ? "待完成"
                    : "已完成"
                }}</strong>
              </article>
            </div>
            <p v-if="!detail.memberships.length" class="user-detail-empty">尚未加入组织。</p>
            <ul v-else class="user-detail-list user-membership-list">
              <li v-for="item in detail.memberships" :key="item.id">
                <strong>{{ item.organization_name }}</strong>
                <span>{{ item.roles.map(roleText).join("、") }}</span>
                <small>{{ statusText(item.status) }}</small>
              </li>
            </ul>
            <p
              v-if="detail.memberships.some((item: any) => !item.organization_id)"
              class="user-detail-boundary"
            >
              部分已返回关系缺少组织标识；因此不会据此判断可重复加入。
            </p>
            <PlatformUserMembershipForm
              :open="open"
              :user-id="selected.id"
              :user-status="selected.status"
              :memberships="detail.memberships"
              :organizations="organizations"
              :busy="busy"
              :role-text="roleText"
              @submit="$emit('addMembership', selected.id, $event)"
            />
          </section>
          <section
            id="user-detail-platform-roles"
            class="user-detail-section"
            data-user-detail-section="roles"
            aria-labelledby="user-detail-platform-roles-title"
          >
            <header>
              <div>
                <h4 id="user-detail-platform-roles-title">平台权限</h4>
                <p>平台角色与组织成员角色彼此独立，以当前账号记录为准。</p>
              </div>
              <strong>{{ currentRoles().length }} 项</strong>
            </header>
            <p v-if="!currentRoles().length" class="user-detail-empty">
              普通用户，没有平台后台权限。
            </p>
            <ul class="user-detail-list user-role-list">
              <li v-for="code in roleCodes" :key="code">
                <div>
                  <strong>{{ roleText(code) }}</strong>
                  <small>{{ currentRoles().includes(code) ? "当前已授予" : "当前未授予" }}</small>
                </div>
                <button
                  type="button"
                  :class="{ 'button-danger': currentRoles().includes(code) }"
                  :disabled="busy || selected?.status !== 'active'"
                  @click="$emit('role', selected.id, code, !currentRoles().includes(code))"
                >
                  {{ currentRoles().includes(code) ? "撤销" : "授予" }}{{ roleText(code) }}
                </button>
              </li>
            </ul>
          </section>
          <section
            id="user-detail-login-security"
            class="user-detail-section"
            data-user-detail-section="security"
            aria-labelledby="user-detail-login-security-title"
          >
            <header>
              <div>
                <h4 id="user-detail-login-security-title">登录安全</h4>
                <p>会话状态来自账号详情；安全操作需再次填写原因。</p>
              </div>
              <strong
                >{{
                  detail.sessions.filter((item: any) => item.status === "active").length
                }}
                个活动会话</strong
              >
            </header>
            <p v-if="!detail.sessions.length" class="user-detail-empty">暂无会话。</p>
            <ul v-else class="user-detail-list user-session-list">
              <li v-for="session in detail.sessions" :key="session.id">
                <div>
                  <strong>{{ session.device_label }}</strong>
                  <small>{{ new Date(session.last_seen_at).toLocaleString() }}</small>
                </div>
                <span>{{ statusText(session.status) }}</span>
                <button
                  v-if="session.status === 'active'"
                  type="button"
                  class="button-danger"
                  :disabled="busy"
                  @click="$emit('revokeSessions', selected, session.id)"
                >
                  撤销
                </button>
              </li>
            </ul>
          </section>
        </div>
        <footer class="user-detail-actions">
          <button
            type="button"
            :class="{ 'button-danger': selected?.status === 'active' }"
            :disabled="busy"
            @click="$emit('toggleStatus', selected)"
          >
            {{ selected?.status === "active" ? "停用登录" : "恢复登录" }}
          </button>
          <button type="button" :disabled="busy" @click="$emit('resetPassword', selected)">
            强制改密
          </button>
          <button
            type="button"
            class="button-danger"
            :disabled="busy"
            @click="$emit('revokeSessions', selected, null)"
          >
            撤销全部会话
          </button>
          <button type="button" @click="$emit('close')">关闭详情</button>
        </footer>
      </div>
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
#app .detail-dialog {
  position: fixed;
  inset: 0;
  z-index: 10;
  width: min(920px, calc(100% - 32px));
  max-height: calc(100dvh - 32px);
  overflow: hidden;
  margin: auto;
  padding: 0;
  border: 1px solid var(--so-border-strong);
  border-radius: 10px;
  background: var(--so-panel);
  color: var(--so-text);
  box-shadow: var(--so-shadow-dialog);
}
#app .detail-dialog::backdrop {
  background: var(--so-scrim);
  backdrop-filter: none;
}
.user-detail-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr);
  height: min(760px, calc(100dvh - 34px));
  min-height: 0;
}
.user-detail-identity {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--so-border);
  background: var(--so-panel);
}
.user-detail-identity small {
  color: var(--so-text-muted);
  font-size: 12px;
}
.user-detail-identity h3 {
  margin: 4px 0;
  max-width: 100%;
  overflow-wrap: anywhere;
  font-size: 16px;
}
.user-detail-identity > div {
  min-width: 0;
}
.user-detail-status {
  color: var(--so-text-muted);
  font-size: 13px;
}
.user-detail-identity nav {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
#app .detail-dialog button {
  min-height: 44px;
  padding: 9px 12px;
  border: 1px solid var(--so-border-strong);
  border-radius: 6px;
  background: var(--so-panel);
  color: var(--so-text);
  font: inherit;
  cursor: pointer;
}
#app .detail-dialog .user-detail-identity nav button {
  border-color: transparent;
  color: var(--so-primary);
}
.user-detail-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.user-detail-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 20px;
  border-bottom: 1px solid var(--so-border);
}
.user-detail-toolbar small {
  color: var(--so-text-muted);
}
.user-detail-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}
.user-detail-section {
  padding: 16px 20px;
  border-bottom: 1px solid var(--so-border);
  scroll-margin-top: 8px;
}
.user-detail-section > header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 12px;
  margin-bottom: 12px;
}
.user-detail-section > header h4 {
  margin: 0;
  font-size: 14px;
}
.user-detail-section > header p {
  margin: 5px 0 0;
  color: var(--so-text-muted);
  font-size: 13px;
  line-height: 1.5;
}
.user-detail-section > header > strong {
  flex-shrink: 0;
  font-size: 13px;
}
.user-detail-facts {
  display: grid;
  gap: 8px;
  margin-bottom: 12px;
}
.user-detail-facts article {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid var(--so-border);
  border-radius: 6px;
  background: var(--so-panel-soft);
  overflow-wrap: anywhere;
}
.user-detail-facts small,
.user-detail-list small {
  color: var(--so-text-muted);
}
.user-detail-list {
  display: grid;
  gap: 8px;
  margin: 12px 0;
  padding: 0;
  list-style: none;
}
.user-detail-list > li {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--so-border);
  border-radius: 6px;
  overflow-wrap: anywhere;
}
.user-detail-list li strong,
.user-detail-list li small {
  display: block;
}
.user-detail-list li small {
  margin-top: 4px;
}
.user-role-list > li {
  grid-template-columns: minmax(0, 1fr) auto;
}
.user-session-list > li {
  grid-template-columns: minmax(0, 1fr) auto auto;
}
.user-detail-empty,
.user-detail-boundary {
  margin: 12px 0;
  padding: 10px 12px;
  color: var(--so-text-muted);
  background: var(--so-panel-soft);
  font-size: 13px;
  line-height: 1.5;
}
#app .detail-dialog .button-danger {
  border-color: var(--so-danger-border);
  color: var(--so-danger);
}
#app .detail-dialog .user-detail-actions {
  flex: 0 0 auto;
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--so-border);
  background: var(--so-panel);
}
#app .detail-dialog button:disabled {
  background: var(--so-panel-soft);
  color: var(--so-text-muted);
  cursor: not-allowed;
  opacity: 1;
}
#app .detail-dialog :is(button, input, select, textarea):focus-visible {
  outline: 3px solid var(--so-focus);
  outline-offset: 2px;
}
.detail-feedback {
  flex: 0 0 auto;
  margin: 10px 20px 0;
  padding: 10px 12px;
  border: 1px solid var(--so-border);
  border-radius: 6px;
  font-size: 13px;
}
.detail-feedback--error {
  border-color: var(--so-danger-border);
  background: var(--so-danger-soft);
  color: var(--so-danger);
}
.detail-feedback--success {
  border-color: var(--so-success-border);
  background: var(--so-success-soft);
  color: var(--so-success);
}
.account-state {
  padding: 20px;
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
  gap: 8px;
}
@media (max-width: 640px) {
  .user-detail-identity,
  .user-detail-section {
    padding: 12px 16px;
  }
  .user-detail-toolbar {
    padding: 8px 16px;
  }
  .user-detail-identity {
    display: grid;
  }
  .user-detail-identity nav {
    flex-wrap: nowrap;
  }
  #app .detail-dialog .user-detail-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding: 10px 12px;
  }
  #app .detail-dialog .user-detail-actions button {
    min-width: 0;
  }
  .user-detail-list > li,
  .user-role-list > li,
  .user-session-list > li {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
