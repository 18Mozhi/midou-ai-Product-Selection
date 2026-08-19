<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import UiStatePanel from "./UiStatePanel.vue";
import "../provider-registry.css";
type State =
  "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
interface Provider {
  id: string;
  code: string;
  name: string;
  target_url: string;
  access_mode: string;
  markets: string[];
  languages: string[];
  fields: string[];
  schedule_minutes: number;
  concurrency_limit: number;
  timeout_ms: number;
  retry_limit: number;
  circuit_failure_threshold: number;
  dedupe_key: string;
  retention_days: number;
  failure_rules: string[];
  parser_version: string;
  healthcheck_url: string | null;
  owner_label: string;
  status: string;
  version: number;
  updated_at: string;
}
const props = defineProps<{ apiBaseUrl: string }>(),
  state = ref<State>("loading"),
  items = ref<Provider[]>([]),
  requestId = ref(""),
  editing = ref<Provider | null>(null),
  editorOpen = ref(false),
  saving = ref(false),
  message = ref(""),
  form = reactive({
    code: "",
    name: "",
    target_url: "",
    access_mode: "public_rss",
    markets: "US",
    languages: "en-US",
    fields: "title,summary,published_at,canonical_url,publisher",
    schedule_minutes: 30,
    concurrency_limit: 1,
    timeout_ms: 15000,
    retry_limit: 2,
    circuit_failure_threshold: 5,
    dedupe_key: "canonical_url",
    retention_days: 365,
    failure_rules: "timeout,rate_limited,login_expired,parser_changed,empty",
    parser_version: "v1",
    healthcheck_url: "",
    owner_label: "平台运营",
    status: "disabled",
  });
const failure = (s: number) =>
  s === 401
    ? "expired"
    : s === 403
      ? "forbidden"
      : [408, 429, 502, 503, 504].includes(s)
        ? "blocked"
        : "error";
async function load() {
  state.value = "loading";
  try {
    const r = await fetch(`${props.apiBaseUrl}/platform/providers`, {
        credentials: "include",
        headers: { accept: "application/json" },
      }),
      b = await r.json().catch(() => null);
    requestId.value = b?.request_id ?? "";
    if (!r.ok) {
      state.value = failure(r.status);
      return;
    }
    items.value = b.data;
    state.value = items.value.length ? "ready" : "empty";
  } catch {
    state.value = "blocked";
  }
}
function edit(item?: Provider) {
  editing.value = item ?? null;
  editorOpen.value = true;
  message.value = "";
  Object.assign(
    form,
    item
      ? {
          ...item,
          markets: item.markets.join(","),
          languages: item.languages.join(","),
          fields: item.fields.join(","),
          failure_rules: item.failure_rules.join(","),
          healthcheck_url: item.healthcheck_url ?? "",
        }
      : {
          code: "",
          name: "",
          target_url: "",
          access_mode: "public_rss",
          markets: "US",
          languages: "en-US",
          fields: "title,summary,published_at,canonical_url,publisher",
          schedule_minutes: 30,
          concurrency_limit: 1,
          timeout_ms: 15000,
          retry_limit: 2,
          circuit_failure_threshold: 5,
          dedupe_key: "canonical_url",
          retention_days: 365,
          failure_rules:
            "timeout,rate_limited,login_expired,parser_changed,empty",
          parser_version: "v1",
          healthcheck_url: "",
          owner_label: "平台运营",
          status: "disabled",
        },
  );
}
function closeEditor() {
  editing.value = null;
  editorOpen.value = false;
  message.value = "";
}
const list = (v: string) =>
  v
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
async function save() {
  saving.value = true;
  message.value = "";
  const body = {
      ...form,
      markets: list(form.markets),
      languages: list(form.languages),
      fields: list(form.fields),
      failure_rules: list(form.failure_rules),
      healthcheck_url: form.healthcheck_url || null,
      ...(editing.value ? { expected_version: editing.value.version } : {}),
    },
    path = editing.value
      ? `/platform/providers/${editing.value.id}`
      : "/platform/providers";
  try {
    const r = await fetch(`${props.apiBaseUrl}${path}`, {
        method: editing.value ? "PUT" : "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify(body),
      }),
      b = await r.json().catch(() => null);
    requestId.value = b?.request_id ?? "";
    if (!r.ok) {
      message.value = b?.error?.action_hint ?? "保存失败";
      return;
    }
    closeEditor();
    await load();
  } catch {
    message.value = "依赖不可用，未保存";
  } finally {
    saving.value = false;
  }
}
onMounted(load);
</script>
<template>
  <section class="provider-registry">
    <header>
      <div>
        <p>来源登记与平台资产</p>
        <h2>来源注册中心</h2>
        <span>技术合同版本化；未启用不进入生产默认调度。</span>
      </div>
      <button type="button" @click="edit()">＋ 新建来源</button>
    </header>
    <UiStatePanel
      v-if="!['ready', 'empty'].includes(state)"
      :kind="state"
      :request-id="requestId"
      @primary="load"
    />
    <section
      v-else-if="state === 'empty' && !editorOpen"
      class="provider-empty"
    >
      <h3>还没有来源定义</h3>
      <p>先登记真实目标 URL、字段、频率、并发、超时、去重与失败规则。</p>
      <button type="button" @click="edit()">登记第一个来源</button>
    </section>
    <div v-else-if="items.length" class="provider-table-wrap">
      <table>
        <thead>
          <tr>
            <th>来源</th>
            <th>模式 / 市场</th>
            <th>频率 / 并发</th>
            <th>超时 / 重试</th>
            <th>解析器</th>
            <th>状态</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id">
            <td>
              <strong>{{ item.name }}</strong
              ><code>{{ item.code }}</code
              ><small>{{ item.target_url }}</small>
            </td>
            <td>
              {{ item.access_mode
              }}<small
                >{{ item.markets.join(" · ") }} /
                {{ item.languages.join(" · ") }}</small
              >
            </td>
            <td>
              {{ item.schedule_minutes }} 分钟 / {{ item.concurrency_limit }}
            </td>
            <td>{{ item.timeout_ms }}ms / {{ item.retry_limit }}</td>
            <td>
              {{ item.parser_version }}<small>v{{ item.version }}</small>
            </td>
            <td>
              <span :data-status="item.status">{{ item.status }}</span>
            </td>
            <td><button type="button" @click="edit(item)">编辑</button></td>
          </tr>
        </tbody>
      </table>
    </div>
    <form v-if="editorOpen" class="provider-editor" @submit.prevent="save">
      <header>
        <div>
          <p>{{ editing ? "EDIT VERSION" : "NEW PROVIDER" }}</p>
          <h3>{{ editing ? "编辑来源" : "登记来源" }}</h3>
        </div>
        <button
          type="button"
          aria-label="关闭来源设置编辑"
          title="关闭来源设置编辑"
          @click="closeEditor"
        >
          ×
        </button>
      </header>
      <div class="provider-fields">
        <label
          >Code<input
            v-model="form.code"
            required
            pattern="[a-z0-9_]{2,80}" /></label
        ><label>名称<input v-model="form.name" required /></label
        ><label class="wide"
          >目标 URL<input v-model="form.target_url" required /></label
        ><label
          >接入模式<select v-model="form.access_mode">
            <option
              v-for="v in [
                'public_page',
                'public_rss',
                'authenticated_browser',
                'import',
                'manual',
              ]"
              :key="v"
            >
              {{ v }}
            </option>
          </select></label
        ><label
          >状态<select v-model="form.status">
            <option>draft</option>
            <option>disabled</option>
            <option>enabled</option>
          </select></label
        ><label>市场<input v-model="form.markets" /></label
        ><label>语言<input v-model="form.languages" /></label
        ><label class="wide">字段清单<input v-model="form.fields" /></label
        ><label
          >频率（分钟）<input
            v-model.number="form.schedule_minutes"
            type="number"
            min="1"
            max="10080" /></label
        ><label
          >并发<input
            v-model.number="form.concurrency_limit"
            type="number"
            min="1"
            max="20" /></label
        ><label
          >超时 ms<input
            v-model.number="form.timeout_ms"
            type="number"
            min="1000"
            max="120000" /></label
        ><label
          >重试<input
            v-model.number="form.retry_limit"
            type="number"
            min="0"
            max="10" /></label
        ><label
          >熔断阈值<input
            v-model.number="form.circuit_failure_threshold"
            type="number"
            min="1"
            max="20" /></label
        ><label
          >保留天数<input
            v-model.number="form.retention_days"
            type="number"
            min="1"
            max="3650" /></label
        ><label>去重键<input v-model="form.dedupe_key" /></label
        ><label>解析器版本<input v-model="form.parser_version" /></label
        ><label class="wide"
          >失败规则<input v-model="form.failure_rules" /></label
        ><label>负责人<input v-model="form.owner_label" /></label
        ><label>健康检查 URL<input v-model="form.healthcheck_url" /></label>
      </div>
      <p v-if="message" role="status">
        {{ message }} <code v-if="requestId">{{ requestId }}</code>
      </p>
      <footer>
        <button type="submit" :disabled="saving">
          {{ saving ? "保存中…" : "保存版本" }}
        </button>
      </footer>
    </form>
  </section>
</template>
