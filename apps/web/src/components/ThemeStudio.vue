<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ApiClientError, createApiClient, type ApiFailureKind } from "../api-client";
import PreferenceRadioGroup from "./theme-studio/PreferenceRadioGroup.vue";
import "./theme-studio-c.css";
import {
  applyDensity,
  applyTheme,
  densities,
  isDensityId,
  isThemeId,
  themes,
  type DensityId,
  type ThemeId,
} from "../design/theme";

const props = defineProps<{ apiBaseUrl: string }>();
const request = createApiClient(props.apiBaseUrl);
type State =
  | "loading"
  | "ready"
  | "saving"
  | "saved"
  | "error"
  | "forbidden"
  | "expired"
  | "blocked"
  | "conflict"
  | "rate_limited";
interface Preference {
  theme: ThemeId;
  source: "default" | "saved";
  organization_id: string;
  workspace_id: string;
  version: number;
  updated_at: string | null;
}

const state = ref<State>("loading");
const selected = ref<ThemeId>("deep-ocean");
const selectedDensity = ref<DensityId>(
  isDensityId(document.documentElement.dataset.density)
    ? document.documentElement.dataset.density
    : "standard",
);
const saved = ref<Preference | null>(null);
const requestId = ref("");
const actionHint = ref("");
const themeDirty = computed(() => selected.value !== (saved.value?.theme ?? "deep-ocean"));
const isDirty = computed(() => themeDirty.value);
const selectedTheme = computed(() => themes.find((item) => item.id === selected.value)!);

function chooseTheme(theme: ThemeId) {
  if (state.value === "saving") return;
  selected.value = theme;
  applyTheme(theme);
  if (state.value === "saved") state.value = "ready";
}

function chooseDensity(density: DensityId) {
  if (state.value === "saving") return;
  selectedDensity.value = density;
  applyDensity(density);
}

function mapError(kind: ApiFailureKind, code?: string): State {
  if (kind === "expired") return "expired";
  if (kind === "forbidden") return "forbidden";
  if (kind === "conflict" && code === "preference_scope_required") return "blocked";
  if (kind === "conflict" && code === "preference_version_conflict") return "conflict";
  if (kind === "rate_limited") return "rate_limited";
  return "error";
}

async function load() {
  state.value = "loading";
  requestId.value = "";
  actionHint.value = "";
  try {
    const response = await request<Preference>("/me/ui-preferences");
    requestId.value = response.request_id;
    if (!isThemeId(response.data?.theme)) throw new Error("invalid_theme_contract");
    saved.value = response.data;
    selected.value = response.data.theme;
    applyTheme(selected.value);
    state.value = "ready";
  } catch (error) {
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      actionHint.value = error.actionHint;
      state.value = mapError(error.kind, error.code);
      return;
    }
    state.value = "error";
  }
}

async function save() {
  if (!isDirty.value || state.value === "saving") return;
  state.value = "saving";
  actionHint.value = "";
  const clientRequestId = crypto.randomUUID();
  try {
    if (themeDirty.value) {
      const response = await request<Preference>("/me/ui-preferences", {
        method: "PUT",
        requestId: clientRequestId,
        body: {
          theme: selected.value,
          expected_version: saved.value?.version ?? 0,
        },
      });
      requestId.value = response.request_id;
      saved.value = response.data;
    }
    state.value = "saved";
  } catch (error) {
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      actionHint.value = error.actionHint;
      state.value = mapError(error.kind, error.code);
      return;
    }
    requestId.value = clientRequestId;
    state.value = "error";
  }
}

function restore() {
  if (state.value === "saving") return;
  selected.value = saved.value?.theme ?? "deep-ocean";
  applyTheme(selected.value);
  state.value = "ready";
}

onMounted(load);
</script>

<template>
  <main class="theme-page theme-page--c" data-testid="theme-studio">
    <header class="theme-c-topbar">
      <RouterLink class="theme-c-brand" to="/" aria-label="ScoutOps 首页">
        <span class="theme-c-brand__mark" aria-hidden="true">S</span>
        <span>ScoutOps <i>/</i> 个人设置</span>
      </RouterLink>
      <nav aria-label="个人设置">
        <RouterLink to="/me">个人资料</RouterLink>
        <RouterLink to="/security/mfa">安全设置</RouterLink>
        <RouterLink class="is-current" to="/settings/theme" aria-current="page"
          >外观偏好</RouterLink
        >
      </nav>
    </header>

    <section class="theme-c-pagehead">
      <div>
        <p class="theme-c-eyebrow">PREFERENCES <span>·</span> 外观偏好</p>
        <h1>界面外观</h1>
        <p class="theme-c-intro">选择主题即时预览；确认保存后才会更新服务器偏好。</p>
      </div>
      <div class="theme-c-context">
        <span>当前预览</span>
        <strong>{{ selectedTheme.name }}</strong>
        <small v-if="saved">工作区 · {{ saved.workspace_id.slice(0, 8) }}</small>
      </div>
    </section>

    <section
      v-if="state === 'loading'"
      class="theme-c-message"
      data-state="loading"
      aria-live="polite"
    >
      <span class="theme-c-message__symbol" aria-hidden="true">…</span>
      <div>
        <strong>正在读取已保存偏好</strong>
        <p>读取完成前不会把本地默认值描述为服务器确认。</p>
      </div>
    </section>

    <section
      v-else-if="
        ['error', 'forbidden', 'expired', 'blocked', 'conflict', 'rate_limited'].includes(state)
      "
      class="theme-c-message theme-c-message--error"
      :data-state="state"
      aria-live="assertive"
    >
      <span class="theme-c-message__symbol" aria-hidden="true">{{
        state === "conflict" ? "↻" : "!"
      }}</span>
      <div class="theme-c-message__body">
        <strong>{{
          state === "forbidden"
            ? "当前账号无权读取此偏好范围"
            : state === "expired"
              ? "登录状态已过期"
              : state === "blocked"
                ? "还需要选择组织和工作区"
                : state === "conflict"
                  ? "偏好已在其他窗口更新"
                  : state === "rate_limited"
                    ? "请求较频繁，请稍后再试"
                    : "暂时无法读取主题偏好"
        }}</strong>
        <p>
          {{
            state === "blocked"
              ? "选择当前工作区后，可以重新读取偏好。"
              : state === "conflict"
                ? "先刷新服务器上的最新偏好，再重新选择；不会覆盖其他窗口的更新。"
                : actionHint || "请稍后重试；如仍无法继续，可将关联编号提供给管理员。"
          }}
        </p>
        <details v-if="requestId" class="theme-c-trace">
          <summary>查看关联编号</summary>
          <code>{{ requestId }}</code>
        </details>
        <div class="theme-c-message__actions">
          <RouterLink
            v-if="state === 'expired'"
            class="theme-c-action theme-c-action--primary"
            to="/login"
            >重新登录</RouterLink
          >
          <RouterLink
            v-else-if="state === 'blocked'"
            class="theme-c-action theme-c-action--primary"
            to="/select-context"
            >选择工作区</RouterLink
          >
          <button v-else type="button" class="theme-c-action theme-c-action--primary" @click="load">
            重新读取
          </button>
        </div>
      </div>
    </section>

    <template v-else>
      <section
        class="theme-c-save-status"
        :data-state="
          state === 'saving'
            ? 'saving'
            : state === 'saved'
              ? 'saved'
              : isDirty
                ? 'preview'
                : 'synced'
        "
        aria-live="polite"
      >
        <span class="theme-c-save-status__label">{{
          state === "saving"
            ? "正在保存"
            : state === "saved"
              ? "服务器已确认"
              : isDirty
                ? "本地预览"
                : "已同步"
        }}</span>
        <p>
          {{
            state === "saving"
              ? "正在写入主题偏好；此期间选择已锁定。"
              : state === "saved"
                ? "服务器已确认当前主题偏好。"
                : isDirty
                  ? "当前预览尚未保存到服务器。"
                  : saved?.source === "default"
                    ? "当前主题来自服务器默认值，尚未保存为个人偏好。"
                    : "当前主题与服务器已保存偏好一致。"
          }}
        </p>
      </section>

      <section class="theme-c-settings" aria-label="外观设置">
        <div class="theme-c-section-head">
          <div>
            <p class="theme-c-eyebrow">01 <span>·</span> COLOR</p>
            <h2>主题</h2>
          </div>
          <p>主题预览立即应用于当前界面；保存操作仅写入主题偏好。</p>
        </div>
        <PreferenceRadioGroup
          label="界面主题"
          :options="themes"
          :selected="selected"
          :disabled="state === 'saving'"
          @select="chooseTheme($event)"
        />

        <div class="theme-c-section-head theme-c-section-head--density">
          <div>
            <p class="theme-c-eyebrow">02 <span>·</span> SPACING</p>
            <h2>页面密度</h2>
          </div>
          <p>仅在当前会话生效，不会保存到服务器。</p>
        </div>
        <PreferenceRadioGroup
          label="页面密度"
          :options="densities"
          :selected="selectedDensity"
          :disabled="state === 'saving'"
          @select="chooseDensity($event)"
        />

        <footer class="theme-c-actions">
          <p>
            当前选择：<strong>{{ selectedTheme.name }}</strong
            ><span> · {{ selectedDensity === "compact" ? "紧凑" : "标准" }}密度</span>
          </p>
          <div>
            <button
              class="theme-c-action theme-c-action--quiet"
              type="button"
              :disabled="!isDirty || state === 'saving'"
              @click="restore"
            >
              撤销主题预览
            </button>
            <button
              class="theme-c-action theme-c-action--primary"
              type="button"
              :disabled="!isDirty || state === 'saving'"
              @click="save"
            >
              {{ state === "saving" ? "正在保存…" : state === "saved" ? "已保存" : "保存主题偏好" }}
            </button>
          </div>
        </footer>
      </section>
      <p class="theme-c-boundary">主题与密度只影响显示方式，不改变权限、数据范围或业务结论。</p>
    </template>
  </main>
</template>
