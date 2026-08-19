<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ApiClientError, createApiClient, type ApiFailureKind } from "../api-client";
import { applyTheme, isThemeId, themes, type ThemeId } from "../design/theme";
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
  | "conflict";
interface Preference {
  theme: ThemeId;
  source: "default" | "saved";
  organization_id: string;
  workspace_id: string;
  version: number;
  updated_at: string | null;
}
const state = ref<State>("loading"),
  selected = ref<ThemeId>("deep-ocean"),
  saved = ref<Preference | null>(null),
  requestId = ref("");
const dirty = computed(() => selected.value !== (saved.value?.theme ?? "deep-ocean"));
const selectedName = computed(() => themes.find((item) => item.id === selected.value)!.name);
function choose(theme: ThemeId) {
  if (state.value === "saving") return;
  selected.value = theme;
  applyTheme(theme);
  if (state.value === "saved") state.value = "ready";
}
function mapError(kind: ApiFailureKind, code?: string): State {
  if (kind === "expired") return "expired";
  if (kind === "forbidden") return "forbidden";
  if (kind === "conflict" && code === "preference_version_conflict") return "conflict";
  if (kind === "conflict" || kind === "blocked" || kind === "rate_limited") return "blocked";
  return "error";
}
async function load() {
  state.value = "loading";
  requestId.value = "";
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
      state.value = mapError(error.kind, error.code);
      return;
    }
    state.value = "error";
  }
}
async function save() {
  if (!dirty.value || state.value === "saving") return;
  state.value = "saving";
  const clientRequestId = crypto.randomUUID();
  try {
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
    state.value = "saved";
  } catch (error) {
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      state.value = mapError(error.kind, error.code);
      return;
    }
    requestId.value = clientRequestId;
    state.value = "error";
  }
}
function restore() {
  selected.value = saved.value?.theme ?? "deep-ocean";
  applyTheme(selected.value);
  state.value = "ready";
}
onMounted(load);
</script>

<template>
  <main class="theme-page" data-testid="theme-studio">
    <aside class="theme-nav">
      <a class="theme-brand" href="/"><b>选</b><span>智能选品</span></a>
      <p>个人中心</p>
      <nav>
        <a href="/login">个人资料</a><a href="/security/mfa">安全设置</a
        ><a class="active" href="/settings/theme">主题设置</a>
      </nav>
      <small>主题不改变权限、数据范围或业务结论</small>
    </aside>
    <section class="theme-main">
      <header class="theme-header">
        <div>
          <p>个人外观</p>
          <h1>主题与视觉语义</h1>
          <span>选择适合工作环境的界面。所有状态同时保留图标、文字与数值。</span>
        </div>
        <div class="theme-context">
          <span>当前主题</span><strong>{{ selectedName }}</strong
          ><small v-if="saved">工作区 · {{ saved.workspace_id.slice(0, 8) }}</small>
        </div>
      </header>
      <section v-if="state === 'loading'" class="theme-state" aria-live="polite">
        <span class="theme-spinner"></span><strong>正在读取你的工作区偏好</strong>
        <p>默认显示深海蓝；服务器确认前不会覆盖已保存选择。</p>
      </section>
      <section
        v-else-if="['error', 'forbidden', 'expired', 'blocked', 'conflict'].includes(state)"
        class="theme-state theme-state--error"
        aria-live="assertive"
      >
        <b>{{
          state === "forbidden"
            ? "403"
            : state === "expired"
              ? "401"
              : state === "conflict"
                ? "↻"
                : "!"
        }}</b
        ><strong>{{
          state === "forbidden"
            ? "无权访问当前偏好范围"
            : state === "expired"
              ? "登录已过期"
              : state === "blocked"
                ? "尚未选择组织与工作区"
                : state === "conflict"
                  ? "主题偏好已在其他窗口更新"
                  : "主题偏好暂时无法读取"
        }}</strong>
        <p>
          {{
            state === "blocked"
              ? "先完成组织与工作区选择，再返回主题设置。"
              : state === "conflict"
                ? "刷新最新偏好后重新选择。"
                : "重试；如仍失败，请向管理员提供请求标识。"
          }}
        </p>
        <small v-if="requestId">请求标识：{{ requestId }}</small
        ><a v-if="state === 'expired'" href="/login">重新登录</a
        ><a v-else-if="state === 'blocked'" href="/select-context">选择工作区</a
        ><button v-else @click="load">刷新偏好</button>
      </section>
      <template v-else>
        <section class="theme-workbench">
          <div class="theme-picker">
            <div class="section-heading">
              <div>
                <p>界面主题</p>
                <h2>三种外观，同一套判断</h2>
              </div>
              <span>{{
                state === "saved" ? "✓ 已保存" : dirty ? "● 有未保存更改" : "✓ 已同步"
              }}</span>
            </div>
            <div class="theme-options" role="radiogroup" aria-label="界面主题">
              <button
                v-for="theme in themes"
                :key="theme.id"
                class="theme-option"
                :class="{ selected: selected === theme.id }"
                role="radio"
                :aria-checked="selected === theme.id"
                @click="choose(theme.id)"
              >
                <i :data-swatch="theme.id"><span></span><span></span><span></span></i
                ><b>{{ theme.name }}</b
                ><small>{{ theme.mode }} · {{ theme.caption }}</small
                ><em>{{ selected === theme.id ? "当前预览" : "选择预览" }}</em>
              </button>
            </div>
            <div class="theme-actions">
              <button class="secondary" :disabled="!dirty" @click="restore">撤销预览</button
              ><button class="primary" :disabled="!dirty || state === 'saving'" @click="save">
                {{ state === "saving" ? "正在保存…" : "保存主题" }}
              </button>
            </div>
          </div>
          <aside class="theme-preview" aria-label="主题实时预览">
            <div class="preview-top">
              <span><b>选</b>决策概览</span><small>实时预览</small>
            </div>
            <div class="preview-metrics">
              <article>
                <span>机会评分</span><strong>87</strong><small>高潜力 · 文字结论</small>
              </article>
              <article>
                <span>证据新鲜度</span><strong>2 小时</strong><small>最新 · 2026-08-07</small>
              </article>
            </div>
            <div class="preview-chart">
              <div class="chart-copy">
                <span>需求变化</span><strong>+18.4%</strong
                ><small>近 30 天 · 来源：公开市场信号</small>
              </div>
              <svg
                viewBox="0 0 320 110"
                role="img"
                aria-label="近 30 天需求上升 18.4%，来源为公开市场信号"
              >
                <path
                  class="chart-area"
                  d="M4 91 C45 82 52 67 90 72 S142 34 176 53 S229 18 316 24 L316 108 L4 108Z"
                />
                <path
                  class="chart-line"
                  d="M4 91 C45 82 52 67 90 72 S142 34 176 53 S229 18 316 24"
                />
              </svg>
            </div>
            <ul class="semantic-status">
              <li>
                <i data-kind="success">✓</i
                ><span><b>数据可用</b><small>完整度 96% · 刚刚检查</small></span>
              </li>
              <li>
                <i data-kind="warning">!</i
                ><span><b>需要复核</b><small>2 项成本假设待确认</small></span>
              </li>
              <li>
                <i data-kind="danger">×</i
                ><span><b>风险受阻</b><small>1 项资质证据缺失</small></span>
              </li>
            </ul>
          </aside>
        </section>
        <section class="theme-contract">
          <article>
            <span>01</span><strong>状态不只靠颜色</strong>
            <p>成功、警告和受阻均提供符号、文字与下一步。</p>
          </article>
          <article>
            <span>02</span><strong>图表可被读懂</strong>
            <p>同时提供数值、时间范围、来源和新鲜度。</p>
          </article>
          <article>
            <span>03</span><strong>权限保持不变</strong>
            <p>主题不会改变路由、操作权限或数据范围。</p>
          </article>
        </section>
      </template>
    </section>
  </main>
</template>
