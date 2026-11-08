<script setup lang="ts">
import ProfileAvatar from "./personal-center/ProfileAvatar.vue";
import { ref, watch } from "vue";
import AppIcon from "./AppIcon.vue";
import ThemeStudio from "./ThemeStudio.vue";
import PersonalAssetsPanel from "./personal-center/PersonalAssetsPanel.vue";
import PersonalNotificationsPanel from "./personal-center/PersonalNotificationsPanel.vue";
import PersonalPermissionsPanel from "./personal-center/PersonalPermissionsPanel.vue";
import PersonalProfilePanel from "./personal-center/PersonalProfilePanel.vue";
import PersonalSecurityPanel from "./personal-center/PersonalSecurityPanel.vue";
import { usePersonalCenter } from "./personal-center/usePersonalCenter";
import type { PersonalSection } from "./personal-center/types";
import "./personal-center/personal-center.css";

const props = withDefaults(
  defineProps<{
    apiBaseUrl: string;
    initialSection?: string;
    accountShell?: boolean;
    organizationName?: string | null;
    workspaceName?: string | null;
  }>(),
  { initialSection: "profile", accountShell: false },
);

const validSections: PersonalSection[] = [
  "profile",
  "permissions",
  "security",
  "notifications",
  "assets",
  "appearance",
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
  { key: "appearance" as const, label: "外观偏好" },
];
</script>

<template>
  <section class="personal-center p11-center" :data-state="center.state.value">
    <header class="p11-center-head">
      <div>
        <p>当前账号</p>
        <h2>{{ center.profile.value?.display_name || "个人中心" }}</h2>
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
      <span v-if="center.state.value === 'loading'"></span>
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

      <div v-if="section === 'profile' && center.profile.value" class="midou-profile-grid">
        <aside class="midou-profile-summary">
          <section>
            <ProfileAvatar
              class="midou-profile-avatar"
              :name="center.profile.value.display_name || center.profile.value.email"
              :url="center.profile.value.avatar_url"
            />
            <h2 class="midou-profile-name">{{ center.profile.value.display_name }}</h2>
            <div class="midou-profile-email">
              <span>{{ center.profile.value.email }}</span>
              <small
                class="midou-profile-badge"
                :data-verified="Boolean(center.profile.value.email_verified_at)"
              >
                <AppIcon v-if="center.profile.value.email_verified_at" name="check" :size="12" />
                {{ center.profile.value.email_verified_at ? "邮箱已验证" : "邮箱尚未验证" }}
              </small>
            </div>
            <dl v-if="organizationName || workspaceName" class="midou-profile-context">
              <div v-if="organizationName">
                <dt><AppIcon name="building" />所属组织</dt>
                <dd>{{ organizationName }}</dd>
              </div>
              <div v-if="workspaceName">
                <dt><AppIcon name="box" />工作区</dt>
                <dd>{{ workspaceName }}</dd>
              </div>
            </dl>
          </section>
          <section class="midou-profile-security">
            <h3>安全信息</h3>
            <dl class="midou-profile-security-facts">
              <div>
                <dt><AppIcon name="mail" />邮箱</dt>
                <dd
                  class="midou-profile-badge"
                  :data-verified="Boolean(center.profile.value.email_verified_at)"
                >
                  <AppIcon v-if="center.profile.value.email_verified_at" name="check" :size="12" />
                  {{ center.profile.value.email_verified_at ? "已验证" : "未验证" }}
                </dd>
              </div>
              <div>
                <dt><AppIcon name="smartphone" />手机号</dt>
                <dd
                  class="midou-profile-badge"
                  :data-verified="Boolean(center.profile.value.phone_verified_at)"
                >
                  <AppIcon v-if="center.profile.value.phone_verified_at" name="check" :size="12" />
                  {{
                    center.profile.value.phone_verified_at
                      ? "已验证"
                      : center.profile.value.phone
                        ? "未验证"
                        : "未绑定"
                  }}
                </dd>
              </div>
            </dl>
            <RouterLink to="/me?section=security"><AppIcon name="shield" />管理安全设置</RouterLink>
          </section>
        </aside>
        <PersonalProfilePanel
          :profile="center.profile.value"
          :draft="center.profileDraft"
          :saving="center.profileSaving.value"
          :feedback="center.profileFeedback.value"
          @update-field="center.updateProfileField"
          @submit="center.saveProfile"
          @cancel="center.cancelProfileEdit"
        />
      </div>
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
      <ThemeStudio v-else-if="section === 'appearance'" :api-base-url="apiBaseUrl" embedded />
      <PersonalAssetsPanel
        v-else
        :resource="center.assets.value"
        @retry="center.retrySection('assets')"
      />
    </template>
  </section>
</template>
