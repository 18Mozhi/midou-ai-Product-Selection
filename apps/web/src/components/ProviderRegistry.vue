<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
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
  terms_version: string | null;
  terms_expires_at: string | null;
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
  editorStep = ref(1),
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
    terms_version: "",
    terms_expires_at: "",
    status: "disabled",
  });
const steps = ["基本信息", "范围与字段", "执行策略", "合规与发布"],
  stepForField: Record<string, number> = {
    code: 1,
    name: 1,
    target_url: 1,
    owner_label: 1,
    markets: 2,
    languages: 2,
    fields: 2,
    dedupe_key: 2,
    parser_version: 2,
    healthcheck_url: 2,
    schedule_minutes: 3,
    concurrency_limit: 3,
    timeout_ms: 3,
    retry_limit: 3,
    circuit_failure_threshold: 3,
    retention_days: 3,
    failure_rules: 3,
    terms_reference_url: 4,
    terms_version: 4,
    terms_expires_at: 4,
  };
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
const list = (v: string) =>
    v
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  validHttpUrl = (value: string, httpsOnly = false) => {
    try {
      const url = new URL(value.replace(/\{[^}]+\}/g, "value"));
      return (
        (httpsOnly ? url.protocol === "https:" : ["http:", "https:"].includes(url.protocol)) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  },
  formErrors = computed<Record<string, string>>(() => {
    const errors: Record<string, string> = {};
    if (!/^[a-z0-9_]{2,80}$/.test(form.code))
      errors.code = "仅允许 2–80 位小写字母、数字和下划线。";
    if (form.name.trim().length < 2 || form.name.length > 160)
      errors.name = "名称需要 2–160 字符。";
    if (
      !form.target_url ||
      (!["import", "manual"].includes(form.access_mode) && !validHttpUrl(form.target_url))
    )
      errors.target_url = "目标地址必须是有效的 HTTP(S) 技术合同。";
    if (form.owner_label.trim().length < 2 || form.owner_label.length > 120)
      errors.owner_label = "负责人需要 2–120 字符。";
    for (const field of ["markets", "languages", "fields", "failure_rules"] as const)
      if (!list(form[field]).length || list(form[field]).length > 100)
        errors[field] = "使用英文逗号分隔，需要 1–100 项。";
    if (!form.dedupe_key.trim() || form.dedupe_key.length > 255)
      errors.dedupe_key = "去重键需要 1–255 字符。";
    if (!/^[A-Za-z0-9._-]{1,80}$/.test(form.parser_version))
      errors.parser_version = "仅允许字母、数字、点、下划线和短横线。";
    if (form.healthcheck_url && !validHttpUrl(form.healthcheck_url))
      errors.healthcheck_url = "健康检查地址必须是 HTTP(S)。";
    for (const [field, min, max] of [
      ["schedule_minutes", 1, 10080],
      ["concurrency_limit", 1, 20],
      ["timeout_ms", 1000, 120000],
      ["retry_limit", 0, 10],
      ["circuit_failure_threshold", 1, 20],
      ["retention_days", 1, 3650],
    ] as const) {
      const value = form[field];
      if (!Number.isInteger(value) || value < min || value > max)
        errors[field] = `请输入 ${min}–${max} 的整数。`;
    }
    if (form.terms_reference_url && !validHttpUrl(form.terms_reference_url, true))
      errors.terms_reference_url = "必须是不含账号信息的 HTTPS 地址。";
    if (form.terms_version && !/^[A-Za-z0-9._:-]{1,80}$/.test(form.terms_version))
      errors.terms_version = "仅允许字母、数字、点、下划线、冒号和短横线。";
    if (form.terms_expires_at && !Number.isFinite(new Date(form.terms_expires_at).getTime()))
      errors.terms_expires_at = "请选择有效时间。";
    if (["public_page", "public_rss"].includes(form.access_mode) && form.status === "enabled") {
      if (form.terms_review_status !== "approved")
        errors.terms_reference_url = "启用公开来源前必须批准条款并补齐下列信息。";
      if (!form.terms_reference_url || !validHttpUrl(form.terms_reference_url, true))
        errors.terms_reference_url = "启用前必须登记 HTTPS 条款地址。";
      if (!form.terms_version) errors.terms_version = "启用前必须登记条款版本。";
      if (!form.terms_expires_at || new Date(form.terms_expires_at) <= new Date())
        errors.terms_expires_at = "启用前必须登记未来的到期时间。";
    }
    return errors;
  }),
  currentStepErrors = computed(() =>
    Object.entries(formErrors.value).filter(([field]) => stepForField[field] === editorStep.value),
  );
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
  editorStep.value = 1;
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
          terms_version: item.terms_version ?? "",
          terms_expires_at: item.terms_expires_at?.slice(0, 16) ?? "",
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
          terms_version: "",
          terms_expires_at: "",
          status: "disabled",
        },
  );
}
function closeEditor() {
  editing.value = null;
  editorOpen.value = false;
  message.value = "";
}
function applyTemplate() {
  const shared = {
    schedule_minutes: 30,
    concurrency_limit: 1,
    timeout_ms: 15000,
    retry_limit: 2,
    circuit_failure_threshold: 5,
    retention_days: 365,
    dedupe_key: "canonical_url",
    parser_version: "v1",
  };
  Object.assign(form, shared);
  if (form.access_mode === "public_rss") {
    form.fields = "title,summary,published_at,canonical_url,publisher";
    form.failure_rules = "timeout,rate_limited,source_changed,empty_result";
  } else if (["public_page", "authenticated_browser"].includes(form.access_mode)) {
    form.fields = "title,canonical_url,observed_at";
    form.failure_rules =
      form.access_mode === "authenticated_browser"
        ? "timeout,rate_limited,login_required,session_expired,source_changed"
        : "timeout,rate_limited,source_changed,empty_result";
  } else {
    form.fields = "title,external_id,observed_at";
    form.failure_rules = "validation_failed,empty_result";
  }
  message.value = `已应用${accessModeText(form.access_mode)}技术模板，请按真实来源合同核对后发布。`;
}
function nextStep() {
  if (currentStepErrors.value.length) {
    message.value = `当前步骤还有 ${currentStepErrors.value.length} 项需要修正。`;
    return;
  }
  editorStep.value = Math.min(4, editorStep.value + 1);
  message.value = "";
}
async function save() {
  if (Object.keys(formErrors.value).length) {
    editorStep.value = Math.min(
      ...Object.keys(formErrors.value).map((field) => stepForField[field] ?? 4),
    );
    message.value = `还有 ${Object.keys(formErrors.value).length} 项即时校验未通过。`;
    return;
  }
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
      terms_version: form.terms_version || null,
      terms_expires_at: form.terms_expires_at
        ? new Date(form.terms_expires_at).toISOString()
        : null,
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
      v-if="state !== 'ready' && state !== 'empty'"
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
      v-else-if="items.length && !editorOpen"
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
          <div>
            <dt>条款版本</dt>
            <dd>{{ row.terms_version || "未登记" }}</dd>
          </div>
          <div>
            <dt>条款到期</dt>
            <dd>
              {{
                row.terms_expires_at
                  ? new Date(row.terms_expires_at).toLocaleString("zh-CN", { hour12: false })
                  : "未登记"
              }}
            </dd>
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
    <form
      v-if="editorOpen"
      class="provider-editor"
      role="dialog"
      aria-modal="true"
      aria-labelledby="provider-editor-title"
      novalidate
      @submit.prevent="save"
    >
      <header>
        <div>
          <p>{{ editing ? "编辑定义版本" : "新建来源定义" }}</p>
          <h3 id="provider-editor-title">{{ editing ? "编辑来源" : "登记来源" }}</h3>
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
      <ol class="provider-editor-steps" aria-label="来源登记步骤">
        <li v-for="(label, index) in steps" :key="label" :data-active="editorStep === index + 1">
          <button
            type="button"
            :aria-current="editorStep === index + 1 ? 'step' : undefined"
            @click="editorStep = index + 1"
          >
            <span>{{ index + 1 }}</span
            >{{ label }}
          </button>
        </li>
      </ol>
      <div class="provider-template-bar">
        <span>当前模板：{{ accessModeText(form.access_mode) }}</span>
        <button type="button" @click="applyTemplate">应用技术模板</button>
      </div>
      <div v-if="editorStep === 1" class="provider-fields">
        <label
          >来源代码（技术标识）<input v-model.trim="form.code" autocomplete="off" />
          <small v-if="formErrors.code">{{ formErrors.code }}</small></label
        ><label
          >名称<input v-model="form.name" />
          <small v-if="formErrors.name">{{ formErrors.name }}</small></label
        ><label class="wide"
          >目标 URL<input v-model="form.target_url" />
          <small v-if="formErrors.target_url">{{ formErrors.target_url }}</small></label
        ><label
          >负责人<input v-model="form.owner_label" />
          <small v-if="formErrors.owner_label">{{ formErrors.owner_label }}</small></label
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
        >
      </div>
      <div v-else-if="editorStep === 2" class="provider-fields">
        <label
          >市场<input v-model="form.markets" placeholder="US,CN" />
          <small v-if="formErrors.markets">{{ formErrors.markets }}</small></label
        ><label
          >语言<input v-model="form.languages" placeholder="en-US,zh-CN" />
          <small v-if="formErrors.languages">{{ formErrors.languages }}</small></label
        ><label class="wide"
          >字段清单<input v-model="form.fields" />
          <small v-if="formErrors.fields">{{ formErrors.fields }}</small></label
        ><label
          >去重键<input v-model="form.dedupe_key" />
          <small v-if="formErrors.dedupe_key">{{ formErrors.dedupe_key }}</small></label
        ><label
          >解析器版本<input v-model="form.parser_version" />
          <small v-if="formErrors.parser_version">{{ formErrors.parser_version }}</small></label
        ><label class="wide"
          >健康检查 URL<input v-model="form.healthcheck_url" />
          <small v-if="formErrors.healthcheck_url">{{ formErrors.healthcheck_url }}</small></label
        >
      </div>
      <div v-else-if="editorStep === 3" class="provider-fields">
        <label
          >频率（分钟）<input
            v-model.number="form.schedule_minutes"
            type="number"
            min="1"
            max="10080"
          />
          <small v-if="formErrors.schedule_minutes">{{ formErrors.schedule_minutes }}</small></label
        ><label
          >并发<input v-model.number="form.concurrency_limit" type="number" min="1" max="20" />
          <small v-if="formErrors.concurrency_limit">{{
            formErrors.concurrency_limit
          }}</small></label
        ><label
          >超时 ms<input v-model.number="form.timeout_ms" type="number" min="1000" max="120000" />
          <small v-if="formErrors.timeout_ms">{{ formErrors.timeout_ms }}</small></label
        ><label
          >重试<input v-model.number="form.retry_limit" type="number" min="0" max="10" />
          <small v-if="formErrors.retry_limit">{{ formErrors.retry_limit }}</small></label
        ><label
          >熔断阈值<input
            v-model.number="form.circuit_failure_threshold"
            type="number"
            min="1"
            max="20"
          />
          <small v-if="formErrors.circuit_failure_threshold">{{
            formErrors.circuit_failure_threshold
          }}</small></label
        ><label
          >保留天数<input v-model.number="form.retention_days" type="number" min="1" max="3650" />
          <small v-if="formErrors.retention_days">{{ formErrors.retention_days }}</small></label
        ><label class="wide"
          >失败规则<input v-model="form.failure_rules" />
          <small v-if="formErrors.failure_rules">{{ formErrors.failure_rules }}</small></label
        >
      </div>
      <div v-else class="provider-fields">
        <label
          >平台条款复核<select v-model="form.terms_review_status">
            <option value="pending">待复核</option>
            <option value="approved">已批准</option>
            <option value="rejected">已拒绝</option>
          </select></label
        ><label
          >发布状态<select v-model="form.status">
            <option value="draft">草稿</option>
            <option value="disabled">未启用</option>
            <option value="enabled">已启用</option>
          </select></label
        ><label class="wide"
          >条款参考 URL<input
            v-model="form.terms_reference_url"
            type="url"
            placeholder="https://…"
          />
          <small v-if="formErrors.terms_reference_url">{{
            formErrors.terms_reference_url
          }}</small></label
        ><label
          >条款版本<input v-model="form.terms_version" placeholder="例如 2026-08" />
          <small v-if="formErrors.terms_version">{{ formErrors.terms_version }}</small></label
        ><label
          >条款到期时间<input v-model="form.terms_expires_at" type="datetime-local" />
          <small v-if="formErrors.terms_expires_at">{{ formErrors.terms_expires_at }}</small></label
        >
        <section class="provider-publish-preview wide">
          <strong>发布预览</strong>
          <span>{{ form.name || "未命名来源" }} · {{ accessModeText(form.access_mode) }}</span>
          <span
            >{{ list(form.markets).join(" · ") || "未填写市场" }} /
            {{ list(form.languages).join(" · ") || "未填写语言" }}</span
          >
          <span
            >每 {{ form.schedule_minutes }} 分钟 · 并发 {{ form.concurrency_limit }} ·
            {{ providerStatusText(form.status) }}</span
          >
        </section>
      </div>
      <div v-if="message" class="provider-editor-message" role="status">
        <span>{{ message }}</span>
        <details v-if="requestId">
          <summary>技术详情</summary>
          <code>{{ requestId }}</code>
        </details>
      </div>
      <footer>
        <button v-if="editorStep > 1" type="button" class="secondary" @click="editorStep--">
          上一步
        </button>
        <span
          >第 {{ editorStep }} / 4 步<span v-if="currentStepErrors.length">
            · {{ currentStepErrors.length }} 项待修正</span
          ></span
        >
        <button v-if="editorStep < 4" type="button" @click="nextStep">下一步</button>
        <button v-else type="submit" :disabled="saving || Object.keys(formErrors).length > 0">
          {{ saving ? "保存中…" : editing ? "保存新版本" : "创建来源" }}
        </button>
      </footer>
    </form>
  </section>
</template>
