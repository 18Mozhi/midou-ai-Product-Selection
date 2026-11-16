<script setup lang="ts">
import type { ActionFeedback, PersonalProfile, PersonalProfileDraft, ProfileField } from "./types";
import ProfileAvatar from "./ProfileAvatar.vue";

const props = defineProps<{
  profile: PersonalProfile;
  draft: PersonalProfileDraft;
  saving: boolean;
  feedback: ActionFeedback | null;
}>();
const emit = defineEmits<{
  updateField: [field: ProfileField, value: string];
  submit: [];
  cancel: [];
}>();

function update(field: ProfileField, event: Event) {
  const target = event.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
    emit("updateField", field, target.value);
}
</script>

<template>
  <form class="p11-panel p11-form" @submit.prevent="emit('submit')">
    <header class="p11-panel-heading">
      <p>基本资料</p>
      <h3>基本资料</h3>
    </header>

    <div class="p11-field-group">
      <label for="p11-email">邮箱</label>
      <div class="p11-field-value">
        <input
          id="p11-email"
          :value="props.profile.email"
          aria-describedby="p11-email-note"
          disabled
        />
        <small id="p11-email-note" class="p11-email-note">
          <span
            class="midou-profile-form-verification"
            :data-verified="Boolean(props.profile.email_verified_at)"
            >{{ props.profile.email_verified_at ? "已验证" : "尚未验证" }}</span
          >
          <span>邮箱暂不支持修改。</span>
        </small>
      </div>
    </div>

    <div class="p11-field-group">
      <label for="p11-username">登录用户名</label>
      <div class="p11-field-value">
        <input
          id="p11-username"
          :value="props.draft.username ?? ''"
          autocomplete="username"
          minlength="2"
          maxlength="32"
          placeholder="可选；设置后可代替邮箱登录"
          :disabled="props.saving"
          @input="update('username', $event)"
        />
        <small>2–32 个字符；支持文字、数字、点、下划线和连字符。</small>
      </div>
    </div>

    <div class="p11-field-group">
      <label for="p11-display-name">显示名称</label>
      <div class="p11-field-value">
        <input
          id="p11-display-name"
          :value="props.draft.display_name"
          required
          maxlength="120"
          :disabled="props.saving"
          @input="update('display_name', $event)"
        />
      </div>
    </div>

    <div class="p11-field-group">
      <label for="p11-avatar">头像 HTTPS 地址</label>
      <div class="p11-field-value">
        <div class="p11-avatar-field">
          <input
            id="p11-avatar"
            :value="props.draft.avatar_url ?? ''"
            type="url"
            inputmode="url"
            placeholder="请输入 HTTPS 图片地址"
            :disabled="props.saving"
            @input="update('avatar_url', $event)"
          />
          <span class="p11-avatar-frame">
            <ProfileAvatar
              class="p11-avatar-preview"
              :name="props.profile.display_name || props.profile.email"
              :url="props.profile.avatar_url"
            />
          </span>
        </div>
      </div>
    </div>

    <div class="p11-field-group">
      <label for="p11-phone">手机号</label>
      <div class="p11-field-value">
        <input
          id="p11-phone"
          :value="props.draft.phone ?? ''"
          inputmode="tel"
          autocomplete="tel"
          :disabled="props.saving"
          @input="update('phone', $event)"
        />
        <small>{{ props.profile.phone_verified_at ? "已验证" : "未验证" }}</small>
      </div>
    </div>

    <div class="p11-field-group">
      <label for="p11-locale">语言</label>
      <div class="p11-field-value">
        <select
          id="p11-locale"
          :value="props.draft.locale"
          :disabled="props.saving"
          @change="update('locale', $event)"
        >
          <option value="zh-CN">简体中文</option>
        </select>
      </div>
    </div>

    <div class="p11-field-group">
      <label for="p11-timezone">时区</label>
      <div class="p11-field-value">
        <input
          id="p11-timezone"
          :value="props.draft.timezone"
          required
          :disabled="props.saving"
          @input="update('timezone', $event)"
        />
      </div>
    </div>

    <div class="p11-field-group p11-wide midou-profile-reason">
      <label for="p11-profile-reason">修改原因</label>
      <div class="p11-field-value">
        <textarea
          id="p11-profile-reason"
          :value="props.draft.reason"
          required
          maxlength="300"
          :disabled="props.saving"
          @input="update('reason', $event)"
        ></textarea>
      </div>
    </div>

    <footer class="p11-form-footer p11-wide">
      <p
        v-if="props.feedback"
        class="p11-action-feedback"
        :data-status="props.feedback.status"
        role="status"
      >
        {{ props.feedback.message }}
        <small v-if="props.feedback.status === 'error' && props.feedback.requestId">
          请求编号：<code>{{ props.feedback.requestId }}</code>
        </small>
        <small v-if="props.feedback.status === 'error' && props.feedback.traceId">
          追踪编号：<code>{{ props.feedback.traceId }}</code>
        </small>
      </p>
      <button class="p11-primary" type="submit" :disabled="props.saving">
        {{ props.saving ? "正在保存…" : "保存资料" }}
      </button>
      <button
        class="so-action-secondary"
        type="button"
        :disabled="props.saving"
        @click="emit('cancel')"
      >
        取消
      </button>
    </footer>
  </form>
</template>

<style scoped>
.p11-email-note {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 8px;
}
.p11-avatar-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 44px;
  align-items: center;
  gap: 10px;
}
.p11-avatar-preview {
  width: 40px;
  height: 40px;
  justify-self: center;
  box-shadow: 0 0 0 1px var(--so-border);
}
.p11-avatar-frame {
  display: grid;
  place-items: center;
}
@media (min-width: 1440px) {
  .p11-avatar-field {
    grid-template-columns: minmax(0, 1fr) 46px;
  }
  .p11-avatar-frame {
    box-sizing: border-box;
    width: 46px;
    height: 46px;
    border: 1px solid var(--so-border);
    border-radius: 8px;
    background: var(--so-panel-soft);
  }
  .p11-avatar-preview {
    box-shadow: none;
  }
}
</style>
