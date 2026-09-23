<script setup lang="ts">
import PersonalSectionReadStatus from "./PersonalSectionReadStatus.vue";
import { formatPersonalDate, statusName } from "./formatters";
import type {
  ActionFeedback,
  PasswordDraft,
  PasswordField,
  PersonalSession,
  SectionResource,
} from "./types";

const props = defineProps<{
  resource: SectionResource<PersonalSession[]>;
  passwordDraft: PasswordDraft;
  passwordSaving: boolean;
  writesBusy: boolean;
  revoking: Set<string>;
  passwordFeedback: ActionFeedback | null;
  sessionFeedback: ActionFeedback | null;
}>();
const emit = defineEmits<{
  retry: [];
  updatePassword: [field: PasswordField, value: string];
  changePassword: [];
  revokeSession: [id: string];
}>();

function update(field: PasswordField, event: Event) {
  const target = event.target;
  if (target instanceof HTMLInputElement) emit("updatePassword", field, target.value);
}
</script>

<template>
  <section class="p11-section">
    <div class="p11-grid">
      <article class="p11-panel">
        <p class="p11-kicker">安全中心</p>
        <h3>多因素认证</h3>
        <p class="p11-body-copy">认证器绑定、恢复码和停用由独立安全页面处理。</p>
        <RouterLink class="p11-inline-link" to="/security/mfa">管理 MFA</RouterLink>
      </article>

      <form class="p11-panel p11-password-form" @submit.prevent="emit('changePassword')">
        <p class="p11-kicker">凭证更新</p>
        <h3>修改密码</h3>
        <label for="p11-current-password">当前密码</label>
        <input
          id="p11-current-password"
          :value="props.passwordDraft.current_password"
          type="password"
          autocomplete="current-password"
          required
          minlength="12"
          :disabled="props.writesBusy"
          @input="update('current_password', $event)"
        />
        <label for="p11-new-password">新密码</label>
        <input
          id="p11-new-password"
          :value="props.passwordDraft.new_password"
          type="password"
          autocomplete="new-password"
          required
          minlength="12"
          :disabled="props.writesBusy"
          @input="update('new_password', $event)"
        />
        <label for="p11-confirm-password">确认新密码</label>
        <input
          id="p11-confirm-password"
          :value="props.passwordDraft.confirm_password"
          type="password"
          autocomplete="new-password"
          required
          minlength="12"
          :disabled="props.writesBusy"
          @input="update('confirm_password', $event)"
        />
        <button class="p11-primary" type="submit" :disabled="props.writesBusy">
          {{ props.passwordSaving ? "正在修改…" : "修改并撤销全部会话" }}
        </button>
        <p
          v-if="props.passwordFeedback"
          class="p11-action-feedback"
          :data-status="props.passwordFeedback.status"
          role="status"
        >
          {{ props.passwordFeedback.message }}
          <small
            v-if="props.passwordFeedback.status === 'error' && props.passwordFeedback.requestId"
          >
            请求编号：<code>{{ props.passwordFeedback.requestId }}</code>
          </small>
          <small v-if="props.passwordFeedback.status === 'error' && props.passwordFeedback.traceId">
            追踪编号：<code>{{ props.passwordFeedback.traceId }}</code>
          </small>
        </p>
      </form>

      <article class="p11-panel p11-wide">
        <div>
          <p class="p11-kicker">当前设备与登录</p>
          <h3>设备会话</h3>
        </div>
        <PersonalSectionReadStatus
          :status="props.resource.status"
          title="设备会话"
          :message="props.resource.message"
          :has-snapshot="Boolean(props.resource.data)"
          :request-id="props.resource.readFailureId"
          :trace-id="props.resource.readFailureTraceId"
          @retry="emit('retry')"
        />
        <div v-if="props.resource.data?.length" class="p11-session-list">
          <div v-for="session in props.resource.data" :key="session.id" class="p11-row">
            <span>
              <b>{{ session.device_label || "设备信息未提供" }}</b>
              <small
                >{{ statusName(session.status) }} ·
                {{ formatPersonalDate(session.last_seen_at) }}</small
              >
            </span>
            <button
              type="button"
              class="p11-danger-button"
              :disabled="props.resource.status !== 'ready' || props.writesBusy"
              @click="emit('revokeSession', session.id)"
            >
              {{ props.revoking.has(session.id) ? "正在撤销…" : "撤销会话" }}
            </button>
          </div>
        </div>
        <p v-else-if="props.resource.status === 'ready'" class="p11-muted">
          当前没有可显示的设备会话。
        </p>
        <p
          v-if="props.sessionFeedback"
          class="p11-action-feedback"
          :data-status="props.sessionFeedback.status"
          role="status"
        >
          {{ props.sessionFeedback.message }}
          <small v-if="props.sessionFeedback.status === 'error' && props.sessionFeedback.requestId">
            请求编号：<code>{{ props.sessionFeedback.requestId }}</code>
          </small>
          <small v-if="props.sessionFeedback.status === 'error' && props.sessionFeedback.traceId">
            追踪编号：<code>{{ props.sessionFeedback.traceId }}</code>
          </small>
        </p>
      </article>
    </div>
  </section>
</template>
