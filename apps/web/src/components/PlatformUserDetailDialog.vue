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
      <aside class="user-detail-identity">
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
        <p class="user-detail-context">
          资料与访问状态分区展示。所有管理操作仍由现有服务校验并记录原因。
        </p>
      </aside>
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
.detail-dialog {
  position: fixed;
  inset: 0;
  z-index: 10;
  display: none;
  width: min(1120px, calc(100% - 40px));
  max-height: min(90dvh, 900px);
  overflow: hidden;
  margin: auto;
  padding: 0;
  border: 1px solid #dbe1e9;
  border-radius: 14px;
  color: #202c3d;
  background: #fff;
  box-shadow: 0 24px 80px rgb(22 38 63 / 24%);
}
.detail-dialog[open] {
  display: block;
}
dialog::backdrop {
  background: rgb(24 37 55 / 54%);
}
.user-detail-shell {
  display: grid;
  grid-template-columns: minmax(220px, 270px) minmax(0, 1fr);
  min-height: min(580px, 85dvh);
  max-height: min(90dvh, 900px);
}
.user-detail-identity {
  display: flex;
  flex-direction: column;
  gap: 26px;
  padding: 28px 22px;
  color: #fff;
  background: #254a9c;
}
.user-detail-identity small,
.user-detail-identity p {
  color: #e5edff;
}
.user-detail-identity h3 {
  overflow-wrap: anywhere;
  margin: 8px 0 12px;
  color: #fff;
  font-size: 18px;
  line-height: 1.35;
}
.user-detail-status {
  display: inline-flex;
  padding: 5px 9px;
  border: 1px solid rgb(255 255 255 / 34%);
  border-radius: 999px;
  color: #fff;
  background: rgb(9 35 82 / 24%);
  font-size: 13px;
}
.user-detail-identity nav {
  display: grid;
  gap: 7px;
}
.user-detail-identity nav button {
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 8px;
  color: #fff;
  background: transparent;
  text-align: left;
  font: inherit;
  cursor: pointer;
}
.user-detail-identity nav button:hover,
.user-detail-identity nav button:focus-visible {
  border-color: #fff;
  color: #18386f;
  background: #fff;
}
.user-detail-context {
  margin-top: auto;
  font-size: 13px;
  line-height: 1.55;
}
.user-detail-main {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  min-width: 0;
  min-height: 0;
  max-height: min(90dvh, 900px);
  background: #fff;
}
.user-detail-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  border-bottom: 1px solid #dbe1e9;
  color: #58677b;
}
.user-detail-toolbar button,
.user-detail-actions button,
.user-detail-section button {
  min-height: 44px;
  padding: 9px 13px;
  border: 1px solid #cbd6e4;
  border-radius: 8px;
  color: #254a9c;
  background: #fff;
  font: inherit;
  cursor: pointer;
}
.user-detail-toolbar button {
  color: #202c3d;
}
.user-detail-scroll {
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  scroll-behavior: smooth;
}
.user-detail-main > .detail-feedback {
  margin: 12px 22px 0;
}
.user-detail-section {
  scroll-margin-top: 12px;
  padding: 22px 26px;
  border-bottom: 1px solid #dbe1e9;
}
.user-detail-section > header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 18px;
}
.user-detail-section > header h4 {
  margin: 0;
  color: #202c3d;
  font-size: 21px;
}
.user-detail-section > header p {
  margin: 6px 0 0;
  color: #58677b;
  font-size: 14px;
  line-height: 1.5;
}
.user-detail-section > header > strong {
  flex: 0 0 auto;
  color: #254a9c;
  font-size: 14px;
}
.user-detail-facts {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}
.user-detail-facts article {
  display: grid;
  gap: 5px;
  padding: 12px 14px;
  border-left: 3px solid #254a9c;
  background: #f4f7fb;
}
.user-detail-facts small,
.user-detail-list small {
  color: #58677b;
}
.user-detail-list {
  display: grid;
  gap: 8px;
  padding: 0;
  list-style: none;
}
.user-detail-list > li {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid #dbe1e9;
  border-radius: 8px;
}
.user-detail-list li strong,
.user-detail-list li small {
  display: block;
}
.user-detail-list li small {
  margin-top: 4px;
}
.user-detail-list li button {
  min-width: 86px;
}
.user-detail-empty,
.user-detail-boundary {
  margin: 12px 0;
  padding: 12px 14px;
  color: #58677b;
  background: #f4f7fb;
  line-height: 1.5;
}
.user-detail-boundary {
  border-left: 3px solid #254a9c;
}
.user-role-list > li {
  grid-template-columns: minmax(0, 1fr) auto;
}
.user-session-list > li {
  grid-template-columns: minmax(0, 1fr) auto auto;
}
.detail-dialog .button-danger {
  border-color: #b97068;
  color: #8c3c32;
  background: #fff;
}
.user-detail-actions {
  position: sticky;
  bottom: 0;
  z-index: 1;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid #dbe1e9;
  background: #fff;
}
.detail-dialog button:disabled {
  cursor: not-allowed;
  color: #738096;
  background: #edf1f6;
  opacity: 1;
}
.detail-dialog :is(button, input, select, textarea):focus-visible {
  outline: 3px solid rgb(37 74 156 / 35%);
  outline-offset: 2px;
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
  .detail-dialog {
    width: calc(100% - 20px);
    max-height: min(92dvh, 900px);
    border-radius: 12px;
  }
  .user-detail-shell {
    grid-template-columns: minmax(0, 1fr);
    min-height: 0;
    max-height: min(92dvh, 900px);
  }
  .user-detail-identity {
    gap: 14px;
    padding: 16px 18px 12px;
  }
  .user-detail-identity h3 {
    margin: 4px 0 8px;
    font-size: 16px;
  }
  .user-detail-identity nav {
    display: flex;
    gap: 5px;
    overflow-x: auto;
  }
  .user-detail-identity nav button {
    flex: 0 0 auto;
    padding-inline: 10px;
  }
  .user-detail-context {
    margin: 0;
  }
  .user-detail-main {
    max-height: min(92dvh, 900px);
  }
  .user-detail-toolbar {
    padding: 10px 16px;
  }
  .user-detail-section {
    padding: 18px 16px;
  }
  .user-detail-section > header h4 {
    font-size: 19px;
  }
  .user-detail-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding: 10px 12px max(10px, env(safe-area-inset-bottom));
  }
  .user-detail-actions button {
    min-width: 0;
    padding-inline: 8px;
  }
  .user-detail-list > li,
  .user-role-list > li,
  .user-session-list > li {
    grid-template-columns: 1fr;
  }
  .user-detail-facts {
    grid-template-columns: 1fr;
  }
}
@media (prefers-reduced-motion: reduce) {
  .user-detail-scroll {
    scroll-behavior: auto;
  }
}
</style>
