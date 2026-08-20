<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ApiClientError, createApiClient } from "../api-client";
import ResponsiveDataView from "./ResponsiveDataView.vue";
import UiStatePanel from "./UiStatePanel.vue";
import "../provider-registry.css";
type State = "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
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
  terms_review_status: "pending" | "approved" | "rejected";
  terms_reference_url: string | null;
  terms_reviewed_at: string | null;
  status: string;
  version: number;
  updated_at: string;
}
const props = defineProps<{ apiBaseUrl: string }>(),
  request = createApiClient(props.apiBaseUrl),
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
    terms_review_status: "pending",
    terms_reference_url: "",
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
const accessModeText = (value: string) =>
    (
      ({
        public_page: "公开页面",
        public_rss: "公开订阅源",
        authenticated_browser: "登录浏览器",
        import: "文件导入",
        manual: "人工录入",
      }) as Record<string, string>
    )[value] ?? "其他方式",
  providerStatusText = (value: string) =>
    (({ draft: "草稿", disabled: "未启用", enabled: "已启用" }) as Record<string, string>)[value] ??
    "未知状态",
  termsStatusText = (value: Provider["terms_review_status"]) =>
    value === "approved" ? "已批准" : value === "rejected" ? "已拒绝" : "待复核";
async function load() {
  state.value = "loading";
  try {
    const response = await request<Provider[]>("/platform/providers");
    requestId.value = response.request_id;
    items.value = response.data;
    state.value = items.value.length ? "ready" : "empty";
  } catch (error) {
    const apiError = error instanceof ApiClientError ? error : null;
    requestId.value = apiError?.requestId ?? "";
    state.value = apiError ? failure(apiError.status) : "blocked";
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
          terms_reference_url: item.terms_reference_url ?? "",
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
          failure_rules: "timeout,rate_limited,login_expired,parser_changed,empty",
          parser_version: "v1",
          healthcheck_url: "",
          owner_label: "平台运营",
          terms_review_status: "pending",
          terms_reference_url: "",
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
      terms_reference_url: form.terms_reference_url || null,
      ...(editing.value ? { expected_version: editing.value.version } : {}),
    },
    path = editing.value ? `/platform/providers/${editing.value.id}` : "/platform/providers";
  try {
    const response = await request(path, {
      method: editing.value ? "PUT" : "POST",
      body,
    });
    requestId.value = response.request_id;
    closeEditor();
    await load();
  } catch (error) {
    const apiError = error instanceof ApiClientError ? error : null;
    requestId.value = apiError?.requestId ?? "";
    message.value = apiError?.actionHint ?? "依赖不可用，未保存";
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
    <section v-else-if="state === 'empty' && !editorOpen" class="provider-empty">
      <h3>还没有来源定义</h3>
      <p>先登记真实目标 URL、字段、频率、并发、超时、去重与失败规则。</p>
      <button type="button" @click="edit()">登记第一个来源</button>
    </section>
    <ResponsiveDataView
      v-else-if="items.length"
      :rows="items"
      :row-key="(item) => item.id"
      title="来源定义"
      :detail-title="(item) => item.name"
    >
      <template #desktop>
        <div class="provider-table-wrap">
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
                  ><small>{{ item.target_url }}</small>
                </td>
                <td>
                  {{ accessModeText(item.access_mode)
                  }}<small>{{ item.markets.join(" · ") }} / {{ item.languages.join(" · ") }}</small>
                </td>
                <td>{{ item.schedule_minutes }} 分钟 / {{ item.concurrency_limit }}</td>
                <td>{{ item.timeout_ms }}ms / {{ item.retry_limit }}</td>
                <td>
                  {{ item.parser_version }}<small>定义版本 {{ item.version }}</small>
                </td>
                <td>
                  <span :data-status="item.status">{{ providerStatusText(item.status) }}</span
                  ><small>条款：{{ termsStatusText(item.terms_review_status) }}</small>
                </td>
                <td><button type="button" @click="edit(item)">编辑</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
      <template #summary="{ row }">
        <span class="responsive-record-summary">
          <strong>{{ row.name }} · {{ providerStatusText(row.status) }}</strong>
          <small
            >{{ accessModeText(row.access_mode) }} · {{ row.markets.join(" · ") }} · 每
            {{ row.schedule_minutes }} 分钟</small
          >
        </span>
      </template>
      <template #detail="{ row, close }">
        <dl>
          <div>
            <dt>接入方式</dt>
            <dd>{{ accessModeText(row.access_mode) }}</dd>
          </div>
          <div>
            <dt>市场 / 语言</dt>
            <dd>{{ row.markets.join(" · ") }} / {{ row.languages.join(" · ") }}</dd>
          </div>
          <div>
            <dt>调度</dt>
            <dd>每 {{ row.schedule_minutes }} 分钟 · 并发 {{ row.concurrency_limit }}</dd>
          </div>
          <div>
            <dt>超时 / 重试</dt>
            <dd>{{ row.timeout_ms }}ms · {{ row.retry_limit }} 次</dd>
          </div>
          <div>
            <dt>当前状态</dt>
            <dd>{{ providerStatusText(row.status) }}</dd>
          </div>
          <div>
            <dt>条款复核</dt>
            <dd>{{ termsStatusText(row.terms_review_status) }}</dd>
          </div>
        </dl>
        <button
          type="button"
          @click="
            close();
            edit(row);
          "
        >
          编辑来源
        </button>
        <details>
          <summary>技术详情</summary>
          <dl>
            <div>
              <dt>来源 ID</dt>
              <dd>{{ row.id }}</dd>
            </div>
            <div>
              <dt>来源代码</dt>
              <dd>{{ row.code }}</dd>
            </div>
            <div>
              <dt>目标地址</dt>
              <dd>{{ row.target_url }}</dd>
            </div>
            <div>
              <dt>接入模式代码</dt>
              <dd>{{ row.access_mode }}</dd>
            </div>
            <div>
              <dt>解析器 / 定义版本</dt>
              <dd>{{ row.parser_version }} / {{ row.version }}</dd>
            </div>
          </dl>
        </details>
      </template>
    </ResponsiveDataView>
    <form v-if="editorOpen" class="provider-editor" @submit.prevent="save">
      <header>
        <div>
          <p>{{ editing ? "编辑定义版本" : "新建来源定义" }}</p>
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
          >来源代码（技术标识）<input
            v-model="form.code"
            required
            pattern="[a-z0-9_]{2,80}" /></label
        ><label>名称<input v-model="form.name" required /></label
        ><label class="wide">目标 URL<input v-model="form.target_url" required /></label
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
              :value="v"
            >
              {{ accessModeText(v) }}
            </option>
          </select></label
        ><label
          >状态<select v-model="form.status">
            <option value="draft">草稿</option>
            <option value="disabled">未启用</option>
            <option value="enabled">已启用</option>
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
          >重试<input v-model.number="form.retry_limit" type="number" min="0" max="10" /></label
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
        ><label class="wide">失败规则<input v-model="form.failure_rules" /></label
        ><label>负责人<input v-model="form.owner_label" /></label
        ><label>健康检查 URL<input v-model="form.healthcheck_url" /></label
        ><label
          >平台条款复核<select v-model="form.terms_review_status">
            <option value="pending">待复核</option>
            <option value="approved">已批准</option>
            <option value="rejected">已拒绝</option>
          </select></label
        ><label class="wide"
          >条款参考 URL<input v-model="form.terms_reference_url" type="url" placeholder="https://…"
        /></label>
      </div>
      <div v-if="message" class="provider-editor-message" role="status">
        <span>{{ message }}</span>
        <details v-if="requestId">
          <summary>技术详情</summary>
          <code>{{ requestId }}</code>
        </details>
      </div>
      <footer>
        <button type="submit" :disabled="saving">
          {{ saving ? "保存中…" : "保存版本" }}
        </button>
      </footer>
    </form>
  </section>
</template>
