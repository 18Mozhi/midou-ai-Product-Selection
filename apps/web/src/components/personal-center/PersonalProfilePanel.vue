<script setup lang="ts">
import type { ActionFeedback, PersonalProfile, PersonalProfileDraft, ProfileField } from "./types";

const props = defineProps<{
  profile: PersonalProfile;
  draft: PersonalProfileDraft;
  saving: boolean;
  feedback: ActionFeedback | null;
}>();
const emit = defineEmits<{
  updateField: [field: ProfileField, value: string];
  submit: [];
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
      <h3>可保存的账号资料</h3>
      <span>邮箱只读，不会写入资料更新请求。</span>
    </header>

    <div class="p11-field-group">
      <label for="p11-email">邮箱</label>
      <div class="p11-field-value">
        <input id="p11-email" :value="props.profile.email" disabled />
        <small>{{ props.profile.email_verified_at ? "已验证" : "尚未验证" }}</small>
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
        <input
          id="p11-avatar"
          :value="props.draft.avatar_url ?? ''"
          type="url"
          inputmode="url"
          :disabled="props.saving"
          @input="update('avatar_url', $event)"
        />
        <small>头像地址由服务端校验，必须使用 HTTPS。</small>
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
        <small>{{
          props.profile.phone_verified_at ? "已验证" : "未验证；系统不会伪造短信验证结果。"
        }}</small>
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

    <div class="p11-field-group p11-wide">
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
    </footer>
  </form>
</template>
