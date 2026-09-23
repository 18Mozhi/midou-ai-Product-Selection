<script setup lang="ts">
import { ref, watch } from "vue";
import PersonalAssetsPanel from "./personal-center/PersonalAssetsPanel.vue";
import PersonalNotificationsPanel from "./personal-center/PersonalNotificationsPanel.vue";
import PersonalPermissionsPanel from "./personal-center/PersonalPermissionsPanel.vue";
import PersonalProfilePanel from "./personal-center/PersonalProfilePanel.vue";
import PersonalSecurityPanel from "./personal-center/PersonalSecurityPanel.vue";
import { usePersonalCenter } from "./personal-center/usePersonalCenter";
import type { PersonalSection } from "./personal-center/types";
import "./personal-center/personal-center.css";

const props = withDefaults(
  defineProps<{ apiBaseUrl: string; initialSection?: string; accountShell?: boolean }>(),
  { initialSection: "profile", accountShell: false },
);

const validSections: PersonalSection[] = [
  "profile",
  "permissions",
  "security",
  "notifications",
  "assets",
];
const normalizeSection = (value: string): PersonalSection =>
  validSections.includes(value as PersonalSection) ? (value as PersonalSection) : "profile";
const section = ref<PersonalSection>(normalizeSection(props.initialSection));
const center = usePersonalCenter(props.apiBaseUrl, () => section.value);

watch(
  () => props.initialSection,
  (value) => {
    section.value = normalizeSection(value);
  },
);

const sectionItems = [
  { key: "profile" as const, label: "基本资料" },
  { key: "permissions" as const, label: "我的权限" },
  { key: "security" as const, label: "安全与设备" },
  { key: "notifications" as const, label: "通知偏好" },
  { key: "assets" as const, label: "我的资产" },
];
</script>

<template>
  <section class="personal-center p11-center" :data-state="center.state.value">
    <header class="p11-center-head">
      <div>
        <p>当前账号</p>
        <h2>{{ center.profile.value?.display_name || "个人中心" }}</h2>
        <span>资料与各分区按各自的读取结果呈现，不把尚未读取的内容当作已确认。</span>
      </div>
      <button
        type="button"
        :disabled="center.state.value === 'loading' || center.writesBusy.value"
        @click="center.load"
      >
        {{ center.state.value === "loading" ? "正在读取…" : "刷新资料" }}
      </button>
    </header>

    <p
      v-if="center.sectionsLoading.value && center.state.value === 'ready'"
      class="p11-section-loading"
      role="status"
    >
      基本资料已显示；正在分别读取权限、安全、通知和资产分区。
    </p>

    <section v-if="center.state.value !== 'ready'" class="p11-root-state">
      <strong>{{
        center.state.value === "loading" ? "正在读取个人资料" : "当前无法读取个人资料"
      }}</strong>
      <span v-if="center.state.value === 'loading'">资料确认前，不显示其他分区的默认内容。</span>
      <span v-else>{{ center.profileMessage.value }} 请重试；如问题持续，请附上关联编号。</span>
      <small v-if="center.state.value === 'error' && center.profileReadFailureId.value">
        请求编号：<code>{{ center.profileReadFailureId.value }}</code>
      </small>
      <small v-if="center.state.value === 'error' && center.profileReadFailureTraceId.value">
        追踪编号：<code>{{ center.profileReadFailureTraceId.value }}</code>
      </small>
      <button
        v-if="center.state.value === 'error'"
        class="p11-primary"
        type="button"
        @click="center.retryProfile"
      >
        重新加载
      </button>
    </section>

    <template v-else>
      <nav v-if="!props.accountShell" class="p11-inline-sections" aria-label="个人中心分区">
        <button
          v-for="item in sectionItems"
          :key="item.key"
          type="button"
          :aria-current="section === item.key ? 'page' : undefined"
          @click="section = item.key"
        >
          {{ item.label }}
        </button>
      </nav>

      <PersonalProfilePanel
        v-if="section === 'profile' && center.profile.value"
        :profile="center.profile.value"
        :draft="center.profileDraft"
        :saving="center.profileSaving.value"
        :feedback="center.profileFeedback.value"
        @update-field="center.updateProfileField"
        @submit="center.saveProfile"
      />
      <PersonalPermissionsPanel
        v-else-if="section === 'permissions'"
        :resource="center.authorization.value"
        :can-manage-organization-token="center.canManageOrganizationToken.value"
        @retry="center.retrySection('authorization')"
      />
      <PersonalSecurityPanel
        v-else-if="section === 'security'"
        :resource="center.sessions.value"
        :password-draft="center.passwordDraft"
        :password-saving="center.passwordSaving.value"
        :writes-busy="center.writesBusy.value"
        :revoking="center.sessionRevocations.value"
        :password-feedback="center.passwordFeedback.value"
        :session-feedback="center.sessionFeedback.value"
        @retry="center.retrySection('sessions')"
        @update-password="center.updatePasswordField"
        @change-password="center.changePassword"
        @revoke-session="center.revokeSession"
      />
      <PersonalNotificationsPanel
        v-else-if="section === 'notifications'"
        :resource="center.preferences.value"
        :draft="center.preferenceDraft.value"
        :saving="center.preferencesSaving.value"
        :feedback="center.preferenceFeedback.value"
        @retry="center.retrySection('preferences')"
        @update-preference="center.updatePreference"
        @submit="center.savePreferences"
      />
      <PersonalAssetsPanel
        v-else
        :resource="center.assets.value"
        @retry="center.retrySection('assets')"
      />
    </template>
  </section>
</template>
