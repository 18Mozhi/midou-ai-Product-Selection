<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { ApiClientError, createApiClient, type ApiFailureKind } from "../api-client";
import UiStatePanel from "./UiStatePanel.vue";
type Mode = "search" | "create";
type Shell = "member" | "organization_admin" | "platform_admin";
type State = "idle" | "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
interface Result {
  id: string;
  resource_type: string;
  resource_id: string;
  title: string;
  subtitle: string | null;
  route: string;
  updated_at: string;
}
interface Action {
  id: string;
  label: string;
  description: string;
  route: string;
  required_capability: string;
}
const props = defineProps<{
    open: boolean;
    mode: Mode;
    shell: Shell;
    apiBaseUrl: string;
  }>(),
  emit = defineEmits<{ close: [] }>(),
  request = createApiClient(props.apiBaseUrl);
const query = ref(""),
  state = ref<State>("idle"),
  results = ref<Result[]>([]),
  actions = ref<Action[]>([]),
  requestId = ref(""),
  traceId = ref(""),
  actionHint = ref(""),
  input = ref<HTMLInputElement | null>(null);
watch(
  () => [props.open, props.mode] as const,
  async ([open, mode]) => {
    if (!open) return;
    state.value = "idle";
    requestId.value = "";
    traceId.value = "";
    actionHint.value = "";
    results.value = [];
    actions.value = [];
    await nextTick();
    if (mode === "search") input.value?.focus();
    else await loadActions();
  },
  { immediate: true },
);
const failure = (kind: ApiFailureKind): State =>
  kind === "expired"
    ? "expired"
    : kind === "forbidden"
      ? "forbidden"
      : kind === "blocked" || kind === "rate_limited"
        ? "blocked"
        : "error";
async function get<T>(path: string): Promise<T | null> {
  state.value = "loading";
  actionHint.value = "";
  try {
    const response = await request<T>(path);
    requestId.value = response.request_id;
    traceId.value = response.trace_id;
    return response.data;
  } catch (error) {
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      traceId.value = error.traceId;
      actionHint.value = error.actionHint;
      state.value = failure(error.kind);
      return null;
    }
    actionHint.value = "网络连接异常，请稍后重试。";
    state.value = "blocked";
    return null;
  }
}
async function search() {
  const value = query.value.trim();
  if (value.length < 2) {
    state.value = "error";
    return;
  }
  const data = await get(`/me/global-search?q=${encodeURIComponent(value)}&limit=10`);
  if (!data) return;
  results.value = data.items;
  state.value = results.value.length ? "ready" : "empty";
}
async function loadActions() {
  const data = await get(`/me/quick-actions?shell=${props.shell}`);
  if (!data) return;
  actions.value = data;
  state.value = actions.value.length ? "ready" : "empty";
}
</script>
<template>
  <Teleport to="body"
    ><div v-if="open" class="discovery-backdrop" @mousedown.self="emit('close')">
      <section
        class="discovery-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="mode === 'search' ? '全局搜索' : '快捷创建'"
        @keydown.esc="emit('close')"
      >
        <header>
          <div>
            <p>{{ mode === "search" ? "GLOBAL SEARCH" : "QUICK CREATE" }}</p>
            <h2>
              {{ mode === "search" ? "搜索当前工作区" : "选择已授权入口" }}
            </h2>
          </div>
          <button type="button" aria-label="关闭" @click="emit('close')">×</button>
        </header>
        <form v-if="mode === 'search'" @submit.prevent="search">
          <label
            ><span>⌕</span
            ><input
              ref="input"
              v-model="query"
              minlength="2"
              maxlength="100"
              autocomplete="off"
              placeholder="输入至少 2 个字符"
            /><kbd>Enter</kbd></label
          >
        </form>
        <div v-if="state === 'idle'" class="discovery-hint">
          <b>只搜索真实索引</b>
          <p>范围固定为当前组织与工作区，结果按服务端 capabilities 再过滤。</p>
        </div>
        <UiStatePanel
          v-else-if="
            ['loading', 'empty', 'error', 'expired', 'forbidden', 'blocked'].includes(state)
          "
          compact
          :kind="
            state === 'loading'
              ? 'loading'
              : state === 'empty'
                ? 'empty'
                : state === 'expired'
                  ? 'expired'
                  : state === 'forbidden'
                    ? 'forbidden'
                    : state === 'blocked'
                      ? 'blocked'
                      : 'error'
          "
          :request-id="requestId"
          :trace-id="traceId"
          :action-hint="actionHint"
          primary-label="重新加载"
          @primary="mode === 'search' ? search() : loadActions()"
        />
        <div v-else class="discovery-results">
          <a v-for="item in results" :key="item.id" :href="item.route"
            ><i>⌕</i
            ><span
              ><strong>{{ item.title }}</strong
              ><small
                >{{ item.subtitle || item.resource_type }} ·
                {{ new Date(item.updated_at).toLocaleString("zh-CN") }}</small
              ></span
            ><b>↗</b></a
          ><a v-for="item in actions" :key="item.id" :href="item.route"
            ><i>＋</i
            ><span
              ><strong>{{ item.label }}</strong
              ><small>{{ item.description }} · {{ item.required_capability }}</small></span
            ><b>→</b></a
          >
        </div>
        <footer>
          <span>{{
            mode === "search" ? "搜索不跨组织或工作区" : "这里只提供入口，不提前创建业务对象"
          }}</span
          ><a v-if="shell === 'member'" href="/notifications">打开通知中心</a>
        </footer>
      </section>
    </div></Teleport
  >
</template>
