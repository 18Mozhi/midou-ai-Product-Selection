<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";

type ViewState = "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
interface ProvisionedSource {
  id: string;
  code: string;
  status: "draft" | "disabled" | "enabled";
  version: number;
  schedule_minutes: number;
  timeout_ms: number;
  retry_limit: number;
  updated_at: string;
  last_success: {
    task_id: string;
    status: "succeeded" | "succeeded_empty";
    available_result_count: number;
    finished_at: string;
  } | null;
}
interface SourceItem {
  code: string;
  name: string;
  access_mode: string;
  target_url: string;
  markets: string[];
  languages: string[];
  fields: string[];
  schedule_minutes: number;
  timeout_ms: number;
  retry_limit: number;
  owner_label: string;
  category: "news" | "ecommerce" | "data" | "community" | "product_supply";
  availability: "automatic" | "setup_required" | "manual";
  policy_note: string;
  provisioned: ProvisionedSource | null;
}
interface ParserSample {
  id: string;
  name: string;
  baseline_parser_version: string;
  last_replay_status: "never" | "passed" | "changed" | "failed";
  last_replay_at: string | null;
  created_at: string;
}
interface ParserSampleCandidate {
  browser_job_id: string;
  captured_at: string;
  item_count: number;
  parser_version: string;
}
interface ParserSampleReplay {
  status: "passed" | "changed" | "failed";
  diff: Array<{ path: string; before: unknown; after: unknown }>;
  error_code: string | null;
}
interface ConfigurationChange {
  field: "schedule_minutes" | "timeout_ms" | "retry_limit" | "status";
  before: number | string | null;
  after: number | string;
}
interface ConfigurationVersion {
  version: number;
  action: string;
  created_at: string;
  current: boolean;
  rollback_available: boolean;
  changes: ConfigurationChange[];
}

const props = defineProps<{ apiBaseUrl: string }>();
const state = ref<ViewState>("loading");
const items = ref<SourceItem[]>([]);
const query = ref("");
const category = ref("");
const availability = ref("");
const message = ref("");
const requestId = ref("");
const editing = ref<SourceItem | null>(null);
const saving = ref(false);
const testing = ref<string | null>(null);
const sampleSource = ref<SourceItem | null>(null);
const sampleLoading = ref(false);
const sampleSaving = ref<string | null>(null);
const sampleReplaying = ref<string | null>(null);
const sampleOverview = reactive<{
  samples: ParserSample[];
  candidates: ParserSampleCandidate[];
}>({ samples: [], candidates: [] });
const latestReplay = ref<ParserSampleReplay | null>(null);
const versionSource = ref<SourceItem | null>(null);
const versionLoading = ref(false);
const versionHistory = ref<ConfigurationVersion[]>([]);
const versionCurrentVersion = ref<number | null>(null);
const rollingBack = ref<number | null>(null);
const rollbackReason = ref("恢复已验证的来源采集设置");
const form = reactive({
  schedule_minutes: 15,
  timeout_ms: 20000,
  retry_limit: 3,
  status: "enabled",
  reason: "调整来源采集配置",
});

const filtered = computed(() =>
  items.value.filter((item) => {
    const term = query.value.trim().toLowerCase();
    return (
      (!term ||
        `${item.name} ${item.code} ${item.markets.join(" ")} ${item.target_url}`
          .toLowerCase()
          .includes(term)) &&
      (!category.value || item.category === category.value) &&
      (!availability.value || item.availability === availability.value)
    );
  }),
);
const counts = computed(() => ({
  all: items.value.length,
  automatic: items.value.filter((item) => item.availability === "automatic").length,
  nonGoogle: items.value.filter(
    (item) => item.availability === "automatic" && !item.target_url.includes("news.google.com"),
  ).length,
  markets: new Set(items.value.flatMap((item) => item.markets)).size,
}));
const failure = (status: number): ViewState =>
  status === 401
    ? "expired"
    : status === 403
      ? "forbidden"
      : [408, 425, 429, 502, 503, 504].includes(status)
        ? "blocked"
        : "error";
const categoryText = (value: SourceItem["category"]) =>
  ({
    news: "新闻",
    ecommerce: "电商平台",
    data: "趋势数据",
    community: "论坛社区",
    product_supply: "商品供应链",
  })[value];
const statusText = (item: SourceItem) => {
  if (item.availability === "automatic")
    return item.provisioned?.status === "enabled"
      ? "已启用"
      : item.provisioned
        ? "已停用"
        : "等待同步";
  if (item.availability === "setup_required") return "待实施";
  return "手动维护";
};
const modeText = (value: string) =>
  (
    ({
      public_rss: "公开 RSS/Atom 爬虫",
      public_page: "公开页面爬虫",
      authenticated_browser: "网页登录爬虫",
      import: "文件导入",
      manual: "人工录入",
    }) as Record<string, string>
  )[value] ?? value;
const replayText = (value: ParserSample["last_replay_status"] | ParserSampleReplay["status"]) =>
  ({ never: "尚未回放", passed: "一致通过", changed: "发现差异", failed: "解析失败" })[value];
const displayValue = (value: unknown) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text == null ? "未提供" : text.length > 240 ? `${text.slice(0, 240)}…` : text;
};
const configurationFieldText = (field: ConfigurationChange["field"]) =>
  ({
    schedule_minutes: "采集频率",
    timeout_ms: "单次超时",
    retry_limit: "失败重试",
    status: "运行状态",
  })[field];
const configurationActionText = (action: string) =>
  ({
    created: "创建配置",
    updated: "更新配置",
    configuration_updated: "更新采集设置",
    configuration_rolled_back: "从历史版本恢复",
  })[action] ?? "配置变更";
const successText = (item: SourceItem) => {
  const success = item.provisioned?.last_success;
  if (!success) return "尚无成功任务";
  const count = success.available_result_count
    ? `${success.available_result_count} 条结果`
    : "成功但无结果";
  return `${new Date(success.finished_at).toLocaleString("zh-CN")} · ${count}`;
};
const slaText = (item: SourceItem) =>
  item.availability === "automatic"
    ? `≤ ${item.provisioned?.schedule_minutes ?? item.schedule_minutes} 分钟（沿用采集计划）`
    : "未设自动 SLA";

async function load() {
  state.value = "loading";
  message.value = "";
  try {
    const response = await fetch(`${props.apiBaseUrl}/platform/provider-sources`, {
      credentials: "include",
    });
    const body = await response.json().catch(() => null);
    requestId.value = body?.request_id ?? "";
    if (!response.ok) {
      message.value = body?.error?.action_hint ?? "读取来源失败";
      state.value = failure(response.status);
      return;
    }
    items.value = body.data ?? [];
    state.value = items.value.length ? "ready" : "empty";
  } catch (error) {
    message.value = error instanceof Error ? error.message : "来源服务暂不可用";
    state.value = "blocked";
  }
}

function beginEdit(item: SourceItem) {
  if (!item.provisioned) return;
  editing.value = item;
  Object.assign(form, {
    schedule_minutes: item.provisioned.schedule_minutes,
    timeout_ms: item.provisioned.timeout_ms,
    retry_limit: item.provisioned.retry_limit,
    status: item.provisioned.status === "enabled" ? "enabled" : "disabled",
    reason: "调整来源采集配置",
  });
}

async function save() {
  if (!editing.value?.provisioned) return;
  saving.value = true;
  message.value = "";
  try {
    const isAutomatic = editing.value.availability === "automatic";
    const source = editing.value.provisioned;
    const response = await fetch(
      `${props.apiBaseUrl}/platform/provider-sources/${source.id}/configuration`,
      {
        method: "PUT",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify({ ...form, expected_version: source.version }),
      },
    );
    const body = await response.json().catch(() => null);
    requestId.value = body?.request_id ?? requestId.value;
    if (!response.ok) {
      message.value = body?.error?.action_hint ?? "来源配置未保存";
      return;
    }
    editing.value = null;
    await load();
    message.value = isAutomatic
      ? "来源配置已保存；频率、超时、重试和启停状态不会再被启动同步覆盖。"
      : "来源设置已保存；该来源完成解析合同验收前不会进入自动采集。";
  } catch {
    message.value = "来源配置服务暂不可用，本次没有保存。";
  } finally {
    saving.value = false;
  }
}
async function loadConfigurationVersions(item: SourceItem) {
  if (!item.provisioned) return;
  versionSource.value = item;
  versionLoading.value = true;
  versionHistory.value = [];
  versionCurrentVersion.value = null;
  rollbackReason.value = "恢复已验证的来源采集设置";
  try {
    const response = await fetch(
        `${props.apiBaseUrl}/platform/provider-sources/${item.provisioned.id}/configuration/versions`,
        { credentials: "include" },
      ),
      body = await response.json().catch(() => null);
    requestId.value = body?.request_id ?? requestId.value;
    if (!response.ok) {
      message.value = body?.error?.action_hint ?? "配置版本读取失败";
      versionSource.value = null;
      return;
    }
    const currentVersion = Number(body.data?.current_version);
    if (!Number.isInteger(currentVersion) || currentVersion < 1) {
      message.value = "配置版本响应缺少有效的当前版本。";
      versionSource.value = null;
      return;
    }
    versionCurrentVersion.value = currentVersion;
    versionHistory.value = body.data?.versions ?? [];
  } catch {
    message.value = "配置版本服务暂不可用。";
    versionSource.value = null;
  } finally {
    versionLoading.value = false;
  }
}
async function rollbackConfiguration(version: ConfigurationVersion) {
  const source = versionSource.value?.provisioned;
  if (!source || versionCurrentVersion.value === null || !version.rollback_available) return;
  rollingBack.value = version.version;
  try {
    const response = await fetch(
        `${props.apiBaseUrl}/platform/provider-sources/${source.id}/configuration/rollbacks`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
          body: JSON.stringify({
            target_version: version.version,
            expected_version: versionCurrentVersion.value,
            reason: rollbackReason.value,
          }),
        },
      ),
      body = await response.json().catch(() => null);
    requestId.value = body?.request_id ?? requestId.value;
    if (!response.ok) {
      message.value = body?.error?.action_hint ?? "配置未能回滚";
      return;
    }
    const code = versionSource.value?.code;
    await load();
    const refreshed = items.value.find((item) => item.code === code);
    if (refreshed) await loadConfigurationVersions(refreshed);
    message.value = `已从第 ${version.version} 版生成新的当前版本；历史记录保持不变。`;
  } catch {
    message.value = "配置回滚服务暂不可用，本次没有修改。";
  } finally {
    rollingBack.value = null;
  }
}
async function testSource(item: SourceItem) {
  if (!item.provisioned) return;
  testing.value = item.provisioned.id;
  message.value = "";
  try {
    const response = await fetch(
      `${props.apiBaseUrl}/platform/provider-adapters/${item.provisioned.id}/health-check`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
        },
      },
    );
    const body = await response.json().catch(() => null);
    requestId.value = body?.request_id ?? requestId.value;
    if (!response.ok) {
      message.value = body?.error?.action_hint ?? "来源测试未完成";
      return;
    }
    message.value =
      body.data?.health_status === "ready"
        ? `${item.name} 匿名采集测试通过，未使用登录凭证。`
        : `${item.name} 已完成测试：${body.data?.last_error_code ?? "来源暂不可用"}。`;
  } catch {
    message.value = "来源测试服务暂不可用，本次没有修改配置。";
  } finally {
    testing.value = null;
  }
}
async function loadParserSamples(item: SourceItem) {
  if (!item.provisioned) return;
  sampleSource.value = item;
  sampleLoading.value = true;
  latestReplay.value = null;
  try {
    const response = await fetch(
      `${props.apiBaseUrl}/platform/provider-sources/${item.provisioned.id}/parser-samples`,
      { credentials: "include" },
    );
    const body = await response.json().catch(() => null);
    requestId.value = body?.request_id ?? requestId.value;
    if (!response.ok) {
      message.value = body?.error?.action_hint ?? "固定样本读取失败";
      sampleSource.value = null;
      return;
    }
    sampleOverview.samples = body.data?.samples ?? [];
    sampleOverview.candidates = body.data?.candidates ?? [];
  } catch {
    message.value = "固定样本服务暂不可用。";
    sampleSource.value = null;
  } finally {
    sampleLoading.value = false;
  }
}
async function createParserSample(candidate: ParserSampleCandidate) {
  if (!sampleSource.value?.provisioned) return;
  sampleSaving.value = candidate.browser_job_id;
  try {
    const response = await fetch(
      `${props.apiBaseUrl}/platform/provider-sources/${sampleSource.value.provisioned.id}/parser-samples`,
      {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({
          browser_job_id: candidate.browser_job_id,
          name: `真实登录样本 ${new Date(candidate.captured_at).toLocaleString("zh-CN")}`,
        }),
      },
    );
    const body = await response.json().catch(() => null);
    requestId.value = body?.request_id ?? requestId.value;
    if (!response.ok) {
      message.value = body?.error?.action_hint ?? "固定样本未保存";
      return;
    }
    await loadParserSamples(sampleSource.value);
    message.value = "已从真实登录作业固定样本；请执行差异回放后再启用来源。";
  } catch {
    message.value = "固定样本服务暂不可用。";
  } finally {
    sampleSaving.value = null;
  }
}
async function replayParserSample(sample: ParserSample) {
  if (!sampleSource.value?.provisioned) return;
  sampleReplaying.value = sample.id;
  latestReplay.value = null;
  try {
    const response = await fetch(
      `${props.apiBaseUrl}/platform/provider-sources/${sampleSource.value.provisioned.id}/parser-samples/${sample.id}/replays`,
      {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      },
    );
    const body = await response.json().catch(() => null);
    requestId.value = body?.request_id ?? requestId.value;
    if (!response.ok) {
      message.value = body?.error?.action_hint ?? "固定样本回放失败";
      return;
    }
    latestReplay.value = body.data;
    await loadParserSamples(sampleSource.value);
    latestReplay.value = body.data;
    message.value =
      body.data.status === "passed"
        ? "固定样本与当前解析结果一致。"
        : "回放已留存差异，来源继续保持停用。";
  } catch {
    message.value = "固定样本回放服务暂不可用。";
  } finally {
    sampleReplaying.value = null;
  }
}

onMounted(load);
</script>

<template>
  <section class="source-center novice">
    <header class="source-guide">
      <div>
        <p>热点来源</p>
        <h2>多平台、多国家来源已自动登记</h2>
        <span
          >公开
          RSS、论坛与电商内容直接由爬虫采集；需要登录的平台可保存浏览器档案，完成解析验收后才会进入自动采集，不需要配置官方
          API。</span
        >
      </div>
      <a href="/platform-admin/providers">管理来源规则</a>
    </header>
    <div class="source-metrics">
      <article>
        <small>全部来源</small><strong>{{ counts.all }}</strong
        ><span>代码目录</span>
      </article>
      <article>
        <small>自动采集</small><strong>{{ counts.automatic }}</strong
        ><span>已进入调度</span>
      </article>
      <article>
        <small>非谷歌自动源</small><strong>{{ counts.nonGoogle }}</strong
        ><span>电商 / 论坛 / 信息订阅</span>
      </article>
      <article>
        <small>市场覆盖</small><strong>{{ counts.markets }}</strong
        ><span>国家与全球市场</span>
      </article>
    </div>
    <aside class="source-help">
      <strong>已经替你配置好的部分</strong>
      <ol>
        <li>公开信息订阅和论坛频道会自动采集，不需要密钥。</li>
        <li>频率、超时、重试、启停可直接在本页修改。</li>
        <li>网页登录型平台先保存浏览器档案，完成解析验收后才进入自动采集。</li>
      </ol>
    </aside>
    <form class="source-filter" @submit.prevent>
      <input v-model="query" placeholder="搜索 Amazon、eBay、Reddit、国家或来源网址" /><select
        v-model="category"
      >
        <option value="">全部类型</option>
        <option value="news">新闻</option>
        <option value="ecommerce">电商平台</option>
        <option value="data">趋势数据</option>
        <option value="community">论坛社区</option>
        <option value="product_supply">商品供应链</option></select
      ><select v-model="availability">
        <option value="">全部状态</option>
        <option value="automatic">自动采集</option>
        <option value="setup_required">需要完成配置</option>
        <option value="manual">手动来源</option>
      </select>
    </form>
    <p v-if="message" class="source-message" role="status">
      {{ message }} <code v-if="requestId">{{ requestId }}</code>
    </p>
    <div v-if="state === 'loading'" class="source-state">正在读取来源目录…</div>
    <div v-else-if="state !== 'ready'" class="source-state" :data-kind="state">
      <strong>{{
        state === "empty"
          ? "还没有来源目录"
          : state === "expired"
            ? "登录已过期"
            : state === "forbidden"
              ? "当前账号不能管理平台来源"
              : "来源服务暂不可用"
      }}</strong>
      <p>{{ message }}</p>
      <button v-if="!['expired', 'forbidden'].includes(state)" @click="load">重新加载</button>
    </div>
    <section v-else class="source-list">
      <article v-for="item in filtered" :key="item.code" :data-availability="item.availability">
        <header>
          <div>
            <small>{{ categoryText(item.category) }} · {{ item.markets.join(" / ") }}</small>
            <h3>{{ item.name }}</h3>
          </div>
          <b>{{ statusText(item) }}</b>
        </header>
        <p>
          {{ item.policy_note }}
          <a
            v-if="item.target_url.startsWith('https://')"
            class="source-target"
            :href="item.target_url"
            target="_blank"
            rel="noopener noreferrer"
            >查看来源页面 ↗</a
          >
        </p>
        <dl>
          <div>
            <dt>采集方式</dt>
            <dd>{{ modeText(item.access_mode) }}</dd>
          </div>
          <div>
            <dt>频率</dt>
            <dd>
              {{ item.provisioned?.schedule_minutes ?? item.schedule_minutes }}
              分钟
            </dd>
          </div>
          <div>
            <dt>超时 / 重试</dt>
            <dd>
              {{ item.provisioned?.timeout_ms ?? item.timeout_ms }} ms /
              {{ item.provisioned?.retry_limit ?? item.retry_limit }} 次
            </dd>
          </div>
          <div>
            <dt>负责人</dt>
            <dd>{{ item.owner_label }}</dd>
          </div>
          <div>
            <dt>更新 SLA</dt>
            <dd>{{ slaText(item) }}</dd>
          </div>
          <div>
            <dt>最近成功任务</dt>
            <dd>{{ successText(item) }}</dd>
          </div>
          <div>
            <dt>影响范围</dt>
            <dd>
              {{ categoryText(item.category) }} · {{ item.markets.join(" / ") }} ·
              {{ item.fields.length }} 类字段
            </dd>
          </div>
        </dl>
        <footer>
          <span>{{ item.languages.join(" / ") }} · {{ item.fields.length }} 类数据字段</span
          ><button
            v-if="
              item.provisioned &&
              item.availability === 'automatic' &&
              ['public_page', 'public_rss'].includes(item.access_mode)
            "
            type="button"
            :disabled="testing === item.provisioned.id"
            @click="testSource(item)"
          >
            {{ testing === item.provisioned.id ? "测试中…" : "匿名测试" }}</button
          ><button v-if="item.provisioned" type="button" @click="beginEdit(item)">
            编辑采集设置</button
          ><button v-if="item.provisioned" type="button" @click="loadConfigurationVersions(item)">
            版本与回滚</button
          ><a
            v-if="item.access_mode === 'authenticated_browser'"
            :href="`/platform-admin/credentials?provider_code=${encodeURIComponent(item.code)}&mode=login`"
            >配置网页登录</a
          ><button
            v-if="item.code === '1688_search' && item.provisioned"
            type="button"
            @click="loadParserSamples(item)"
          >
            固定样本回放</button
          ><span v-if="!item.provisioned && item.access_mode !== 'authenticated_browser'"
            >等待系统登记</span
          >
        </footer>
      </article>
      <p v-if="!filtered.length" class="source-state">没有符合筛选条件的来源。</p>
    </section>
    <div
      v-if="editing"
      class="source-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="source-edit-title"
    >
      <form @submit.prevent="save">
        <header>
          <div>
            <p>编辑采集来源</p>
            <h3 id="source-edit-title">{{ editing.name }}</h3>
          </div>
          <button type="button" aria-label="关闭来源编辑" @click="editing = null">×</button>
        </header>
        <label
          >采集频率（分钟）<input
            v-model.number="form.schedule_minutes"
            type="number"
            min="1"
            max="10080"
            required /></label
        ><label
          >单次超时（毫秒）<input
            v-model.number="form.timeout_ms"
            type="number"
            min="1000"
            max="120000"
            required /></label
        ><label
          >失败重试次数<input
            v-model.number="form.retry_limit"
            type="number"
            min="0"
            max="10"
            required /></label
        ><label
          >{{
            editing.availability === "automatic"
              ? "运行状态"
              : "来源设置状态（解析验收前不会自动采集）"
          }}<select v-model="form.status">
            <option value="enabled">启用</option>
            <option value="disabled">停用</option>
          </select></label
        ><label
          >变更原因<textarea
            v-model="form.reason"
            minlength="2"
            maxlength="500"
            required
          ></textarea>
        </label>
        <footer>
          <button type="button" @click="editing = null">取消</button
          ><button :disabled="saving">
            {{ saving ? "保存中…" : "保存配置" }}
          </button>
        </footer>
      </form>
    </div>
    <div
      v-if="versionSource"
      class="source-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="configuration-version-title"
    >
      <section class="configuration-version-panel">
        <header>
          <div>
            <p>配置版本</p>
            <h3 id="configuration-version-title">版本、差异与回滚 · {{ versionSource.name }}</h3>
          </div>
          <button type="button" aria-label="关闭配置版本" @click="versionSource = null">×</button>
        </header>
        <p>只展示采集频率、超时、重试和启停状态；凭证、Cookie 与受限环境值不会进入版本详情。</p>
        <label
          >回滚原因<textarea
            v-model="rollbackReason"
            minlength="2"
            maxlength="500"
            required
          ></textarea>
        </label>
        <div v-if="versionLoading" class="source-state">正在读取配置版本…</div>
        <ol v-else class="configuration-version-list">
          <li v-for="version in versionHistory" :key="version.version">
            <header>
              <div>
                <strong>第 {{ version.version }} 版</strong>
                <span
                  >{{ configurationActionText(version.action) }} ·
                  {{ new Date(version.created_at).toLocaleString("zh-CN") }}</span
                >
              </div>
              <b v-if="version.current">当前版本</b>
              <button
                v-else-if="version.rollback_available"
                type="button"
                :disabled="rollingBack === version.version || rollbackReason.trim().length < 2"
                @click="rollbackConfiguration(version)"
              >
                {{ rollingBack === version.version ? "恢复中…" : "恢复此版本" }}
              </button>
            </header>
            <ul v-if="version.changes.length">
              <li v-for="change in version.changes" :key="change.field">
                <span>{{ configurationFieldText(change.field) }}</span>
                <code>{{ displayValue(change.before) }} → {{ displayValue(change.after) }}</code>
              </li>
            </ul>
            <p v-else>与上一版本的可见采集设置一致。</p>
          </li>
        </ol>
        <p v-if="!versionLoading && !versionHistory.length">还没有可用配置版本。</p>
      </section>
    </div>
    <div
      v-if="sampleSource"
      class="source-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="parser-sample-title"
    >
      <section class="parser-sample-panel">
        <header>
          <div>
            <p>真实登录采集验收</p>
            <h3 id="parser-sample-title">固定样本回放 · {{ sampleSource.name }}</h3>
          </div>
          <button type="button" aria-label="关闭固定样本回放" @click="sampleSource = null">
            ×
          </button>
        </header>
        <p>只能从同时保存截图、DOM 和结构化快照的真实浏览器作业固化；回放一致才允许启用来源。</p>
        <div v-if="sampleLoading" class="source-state">正在读取固定样本…</div>
        <template v-else>
          <section>
            <h4>可固定的真实作业</h4>
            <article v-for="candidate in sampleOverview.candidates" :key="candidate.browser_job_id">
              <div>
                <strong>{{ new Date(candidate.captured_at).toLocaleString("zh-CN") }}</strong>
                <span>{{ candidate.item_count }} 条结果</span>
              </div>
              <button
                type="button"
                :disabled="sampleSaving === candidate.browser_job_id"
                @click="createParserSample(candidate)"
              >
                {{ sampleSaving === candidate.browser_job_id ? "保存中…" : "固定为样本" }}
              </button>
              <details>
                <summary>技术详情</summary>
                <code>{{ candidate.parser_version }}</code>
              </details>
            </article>
            <p v-if="!sampleOverview.candidates.length">暂无合格候选；先完成一条真实登录采集。</p>
          </section>
          <section>
            <h4>已固定样本</h4>
            <article v-for="sample in sampleOverview.samples" :key="sample.id">
              <div>
                <strong>{{ sample.name }}</strong>
                <span>{{ replayText(sample.last_replay_status) }}</span>
              </div>
              <button
                type="button"
                :disabled="sampleReplaying === sample.id"
                @click="replayParserSample(sample)"
              >
                {{ sampleReplaying === sample.id ? "回放中…" : "运行差异回放" }}
              </button>
              <details>
                <summary>技术详情</summary>
                <code>{{ sample.baseline_parser_version }}</code>
              </details>
            </article>
            <p v-if="!sampleOverview.samples.length">还没有固定样本。</p>
          </section>
          <section v-if="latestReplay" class="parser-diff" :data-status="latestReplay.status">
            <h4>本次回放：{{ replayText(latestReplay.status) }}</h4>
            <p v-if="latestReplay.error_code">解析器未能读取固定样本，来源继续停用。</p>
            <ol v-else-if="latestReplay.diff.length">
              <li v-for="item in latestReplay.diff" :key="item.path">
                <code>{{ item.path }}</code>
                <span>{{ displayValue(item.before) }} → {{ displayValue(item.after) }}</span>
              </li>
            </ol>
            <p v-else>字段、路径与结果顺序均与基线一致。</p>
          </section>
        </template>
      </section>
    </div>
  </section>
</template>

<style scoped>
.novice {
  display: grid;
  gap: 16px;
}
.source-guide {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-radius: 18px;
  background: linear-gradient(135deg, var(--so-panel-soft), var(--so-bg-elevated));
  color: var(--so-text);
}
.source-guide p {
  color: var(--so-primary);
  font-weight: 800;
  margin: 0;
}
.source-guide h2 {
  font-size: 28px;
  margin: 6px 0;
}
.source-guide span {
  opacity: 0.8;
}
.source-guide a {
  white-space: nowrap;
  color: var(--so-on-primary);
  background: var(--so-primary);
  padding: 11px 16px;
  border-radius: 10px;
  font-weight: 800;
  text-decoration: none;
}
.source-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.source-metrics article {
  padding: 18px;
  border: 1px solid var(--so-border);
  border-radius: 14px;
  background: var(--so-panel);
  color: var(--so-text);
}
.source-metrics small,
.source-metrics span {
  display: block;
  color: var(--so-text-muted);
}
.source-metrics strong {
  display: block;
  margin: 5px 0;
  font-size: 28px;
}
.source-help {
  padding: 16px 20px;
  border: 1px solid color-mix(in srgb, var(--so-success) 35%, transparent);
  background: color-mix(in srgb, var(--so-success) 8%, var(--so-panel));
  border-radius: 13px;
  color: var(--so-text);
}
.source-help ol {
  margin: 8px 0 0;
  padding-left: 20px;
  color: var(--so-text-muted);
}
.source-filter {
  display: flex;
  gap: 10px;
}
.source-filter input,
.source-filter select,
.source-modal input,
.source-modal select,
.source-modal textarea {
  padding: 10px;
  border: 1px solid var(--so-border);
  border-radius: 9px;
  color: var(--so-text);
  background: var(--so-panel-soft);
}
.source-filter input {
  flex: 1;
}
.source-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}
.source-list article {
  display: grid;
  grid-template-columns:
    minmax(220px, 1.4fr) minmax(200px, 1fr) minmax(320px, 1.5fr)
    auto;
  align-items: center;
  gap: 16px;
  padding: 16px 18px;
  border: 1px solid var(--so-border);
  border-left: 5px solid var(--so-success);
  border-radius: 13px;
  background: var(--so-panel);
  color: var(--so-text);
}
.source-list article[data-availability="setup_required"] {
  border-left-color: var(--so-warning);
}
.source-list article[data-availability="manual"] {
  border-left-color: var(--so-info);
}
.source-list header,
.source-list footer {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.source-list article > header {
  min-width: 0;
}
.source-list article > p {
  margin: 0;
}
.source-target {
  display: block;
  margin-top: 6px;
  color: var(--so-info);
  font-size: 12px;
  overflow-wrap: anywhere;
  text-decoration: none;
}
.source-list h3 {
  margin: 4px 0;
}
.source-list small,
.source-list p,
.source-list footer,
.source-list dt {
  color: var(--so-text-muted);
}
.source-list b {
  white-space: nowrap;
  color: var(--so-success);
}
.source-list dl {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.source-list dl div {
  padding: 9px;
  border-radius: 8px;
  background: var(--so-panel-soft);
}
.source-list dt {
  font-size: 11px;
}
.source-list dd {
  margin: 5px 0 0;
}
.source-list footer {
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
}
.source-list footer button,
.source-list footer a {
  padding: 8px 10px;
  border-radius: 8px;
  color: var(--so-text);
  border: 1px solid var(--so-border);
  background: var(--so-panel-soft);
  text-decoration: none;
}
.source-message {
  padding: 12px 14px;
  border: 1px solid var(--so-border);
  border-radius: 10px;
  background: var(--so-panel-soft);
}
.source-state {
  padding: 30px;
  text-align: center;
}
.source-modal {
  position: fixed;
  z-index: 80;
  inset: 0;
  padding: 20px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--so-bg) 80%, transparent);
}
.source-modal form {
  width: min(520px, 100%);
  display: grid;
  gap: 14px;
  padding: 24px;
  border: 1px solid var(--so-border);
  border-radius: 18px;
  background: var(--so-bg-elevated);
  box-shadow: var(--so-shadow);
}
.parser-sample-panel {
  width: min(820px, 100%);
  max-height: min(760px, 90vh);
  overflow: auto;
  display: grid;
  gap: 16px;
  padding: 24px;
  border: 1px solid var(--so-border);
  border-radius: 18px;
  background: var(--so-bg-elevated);
  color: var(--so-text);
}
.configuration-version-panel {
  display: grid;
  gap: 14px;
}
.configuration-version-panel > header,
.configuration-version-list > li > header,
.configuration-version-list > li > header > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.configuration-version-panel > header,
.configuration-version-list > li > header {
  align-items: center;
}
.configuration-version-panel label,
.configuration-version-list > li > header > div {
  flex-direction: column;
}
.configuration-version-panel textarea {
  width: 100%;
  min-height: 72px;
}
.configuration-version-list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.configuration-version-list > li {
  padding: 14px;
  border: 1px solid var(--so-border);
  border-radius: 12px;
  background: var(--so-panel-soft);
}
.configuration-version-list ul {
  display: grid;
  gap: 6px;
  margin-top: 12px;
}
.configuration-version-list ul li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.parser-sample-panel > header,
.parser-sample-panel article {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.parser-sample-panel article {
  margin-top: 8px;
  padding: 12px;
  border: 1px solid var(--so-border);
  border-radius: 10px;
}
.parser-sample-panel article div,
.parser-diff li {
  display: grid;
  gap: 4px;
}
.parser-sample-panel span,
.parser-sample-panel > p {
  color: var(--so-text-muted);
}
.parser-diff {
  padding: 14px;
  border-left: 4px solid var(--so-success);
  background: var(--so-panel-soft);
}
.parser-diff[data-status="changed"],
.parser-diff[data-status="failed"] {
  border-left-color: var(--so-warning);
}
.parser-diff ol {
  display: grid;
  gap: 10px;
  padding-left: 24px;
}
.source-modal header,
.source-modal footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.source-modal h3,
.source-modal p {
  margin: 0;
}
.source-modal label {
  display: grid;
  gap: 6px;
}
.source-modal header > button {
  font-size: 22px;
  color: var(--so-text);
  background: transparent;
}
.source-modal footer {
  justify-content: flex-end;
}
.source-modal footer button:first-child {
  color: var(--so-text);
  background: var(--so-panel-soft);
}
@media (max-width: 760px) {
  .novice {
    padding-bottom: 76px;
  }
  .source-guide {
    align-items: flex-start;
    flex-direction: column;
    gap: 16px;
  }
  .source-metrics {
    grid-template-columns: 1fr 1fr;
  }
  .source-filter {
    flex-direction: column;
  }
  .source-list {
    grid-template-columns: 1fr;
  }
  .source-list article {
    grid-template-columns: 1fr;
  }
  .source-list dl {
    grid-template-columns: 1fr;
  }
}
</style>
