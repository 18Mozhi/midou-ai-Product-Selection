<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import UiStatePanel from "./UiStatePanel.vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import "../data-quality.css";
type State = "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
interface Evidence {
  id: string;
  organization_id: string;
  workspace_id: string;
  collection_task_id: string;
  provider_name: string;
  canonical_url: string;
  content_sha256: string;
  content_type: string;
  size_bytes: number;
  captured_at: string;
  parser_version: string;
  retention_until: string;
  status: string;
  request_id: string;
  trace_id: string;
}
interface Issue {
  id: string;
  provider_name: string;
  metric_code: string;
  field_path: string | null;
  severity: "warning" | "critical";
  status: "open" | "resolved";
  actual_value: number | null;
  threshold_value: number | null;
  resolution_reason: string | null;
  version: number;
  updated_at: string;
}
interface Run {
  id: string;
  provider_name: string;
  parser_version: string;
  market: string;
  sample_count: number;
  metrics: Array<{
    code: string;
    value: number;
    threshold: number;
    status: string;
    numerator?: number;
    denominator?: number;
  }>;
  status: string;
  window_ended_at: string;
}
const props = defineProps<{ apiBaseUrl: string }>(),
  state = ref<State>("loading"),
  evidence = ref<Evidence[]>([]),
  issues = ref<Issue[]>([]),
  runs = ref<Run[]>([]),
  totalEvidence = ref(0),
  totalIssues = ref(0),
  requestId = ref(""),
  tab = ref<"evidence" | "issues" | "runs">("evidence"),
  query = ref(""),
  detail = ref<any>(null),
  notice = ref(""),
  resolving = ref<Issue | null>(null),
  reason = ref(""),
  confirming = ref(false),
  saving = ref(false);
const filteredEvidence = computed(() =>
    evidence.value.filter(
      (item) =>
        !query.value ||
        [item.id, item.provider_name, item.canonical_url, item.content_sha256].some((value) =>
          value.toLowerCase().includes(query.value.toLowerCase()),
        ),
    ),
  ),
  filteredIssues = computed(() =>
    issues.value.filter(
      (item) =>
        !query.value ||
        [item.metric_code, item.provider_name, item.field_path].some((value) =>
          value?.toLowerCase().includes(query.value.toLowerCase()),
        ),
    ),
  ),
  metrics = computed(() => ({
    open: issues.value.filter((item) => item.status === "open").length,
    critical: issues.value.filter((item) => item.status === "open" && item.severity === "critical")
      .length,
    passed: runs.value.filter((item) => item.status === "passed").length,
  })),
  qualityHighlightCodes = [
    "title_accuracy",
    "price_accuracy",
    "currency_accuracy",
    "external_id_accuracy",
    "canonical_url_accuracy",
    "duplicate_ratio",
    "source_freshness",
  ],
  qualityHighlights = computed(() => {
    const latest = new Map<
      string,
      Run["metrics"][number] & {
        provider_name: string;
        window_ended_at: string;
        sample_count: number;
      }
    >();
    for (const run of runs.value)
      for (const metric of run.metrics)
        if (qualityHighlightCodes.includes(metric.code) && !latest.has(metric.code))
          latest.set(metric.code, {
            ...metric,
            provider_name: run.provider_name,
            window_ended_at: run.window_ended_at,
            sample_count: run.sample_count,
          });
    return qualityHighlightCodes.map((code) => ({ code, metric: latest.get(code) ?? null }));
  });
const failure = (code: number): State =>
    code === 401
      ? "expired"
      : code === 403
        ? "forbidden"
        : [408, 425, 429, 502, 503, 504].includes(code)
          ? "blocked"
          : "error",
  time = (value: string) =>
    new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value)),
  size = (value: number) =>
    value < 1024
      ? `${value} B`
      : value < 1048576
        ? `${(value / 1024).toFixed(1)} KB`
        : `${(value / 1048576).toFixed(1)} MB`,
  metricLabel = (value: string) =>
    ({
      title_accuracy: "标题准确率",
      price_accuracy: "价格准确率",
      currency_accuracy: "币种准确率",
      external_id_accuracy: "商品 ID 准确率",
      canonical_url_accuracy: "URL 规范化",
      duplicate_ratio: "重复比例",
      supplier_mismatch_ratio: "供应商误匹配",
      ai_classification_approval: "AI 分类抽检",
      source_freshness: "来源新鲜度",
      source_success_rate: "来源成功率",
    })[value] ?? value,
  qualityStatusLabel = (value: string) =>
    ({ passed: "通过", failed: "未通过", insufficient_sample: "样本不足" })[value] ?? "状态未知";
async function load() {
  state.value = "loading";
  notice.value = "";
  try {
    const response = await fetch(
        `${props.apiBaseUrl}/platform/data-quality?page=1&page_size=50&status=all`,
        { credentials: "include", headers: { accept: "application/json" } },
      ),
      body = await response.json().catch(() => null);
    requestId.value = body?.request_id ?? "";
    if (!response.ok) {
      state.value = failure(response.status);
      return;
    }
    evidence.value = body.data.evidence ?? [];
    issues.value = body.data.issues ?? [];
    runs.value = body.data.reconciliationRuns ?? [];
    totalEvidence.value = body.data.totalEvidence ?? 0;
    totalIssues.value = body.data.totalIssues ?? 0;
    state.value =
      evidence.value.length || issues.value.length || runs.value.length ? "ready" : "empty";
  } catch {
    state.value = "blocked";
  }
}
async function openEvidence(id: string) {
  try {
    const response = await fetch(`${props.apiBaseUrl}/platform/data/evidence/${id}`, {
        credentials: "include",
      }),
      body = await response.json().catch(() => null);
    requestId.value = body?.request_id ?? requestId.value;
    if (!response.ok) {
      notice.value = body?.error?.action_hint ?? "证据详情暂不可用";
      return;
    }
    detail.value = body.data;
  } catch {
    notice.value = "证据详情依赖暂不可用";
  }
}
async function grantDownload(item: Evidence) {
  try {
    const response = await fetch(
        `${props.apiBaseUrl}/platform/data/evidence/${item.id}/download-grant`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            "idempotency-key": crypto.randomUUID(),
          },
          body: "{}",
        },
      ),
      body = await response.json().catch(() => null);
    requestId.value = body?.request_id ?? requestId.value;
    if (!response.ok) {
      notice.value = body?.error?.action_hint ?? "下载授权未签发";
      return;
    }
    notice.value = `短时下载授权已签发，${time(body.data.expires_at)} 前有效。`;
    window.location.assign(
      `${props.apiBaseUrl}/platform/data/evidence/${item.id}/download?grant=${encodeURIComponent(body.data.grant)}`,
    );
  } catch {
    notice.value = "下载依赖暂不可用";
  }
}
function beginResolve(item: Issue) {
  resolving.value = item;
  reason.value = "";
}
async function resolveIssue() {
  if (!resolving.value) return;
  saving.value = true;
  try {
    const response = await fetch(
        `${props.apiBaseUrl}/platform/data-quality/issues/${resolving.value.id}/resolve`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            "idempotency-key": crypto.randomUUID(),
          },
          body: JSON.stringify({
            reason: reason.value.trim(),
            expected_version: resolving.value.version,
          }),
        },
      ),
      body = await response.json().catch(() => null);
    requestId.value = body?.request_id ?? requestId.value;
    if (!response.ok) {
      notice.value = body?.error?.action_hint ?? "问题未解决";
      return;
    }
    await load();
    notice.value = `质量问题 ${body.data.id.slice(0, 8)}… 已记录解决原因。`;
    resolving.value = null;
    reason.value = "";
  } catch {
    notice.value = "依赖不可用，未更新质量问题";
  } finally {
    saving.value = false;
    confirming.value = false;
  }
}
onMounted(load);
</script>
<template>
  <section class="quality-center" aria-labelledby="quality-title">
    <header class="quality-title">
      <div>
        <p>证据与数据质量</p>
        <h2 id="quality-title">证据与数据质量</h2>
        <span>任务成功不替代字段准确率；原文、规范记录和字段溯源始终可关联。</span>
      </div>
      <b>中国境内受控存储</b>
    </header>
    <UiStatePanel
      v-if="state !== 'ready'"
      :kind="state"
      :request-id="requestId"
      @primary="load"
    /><template v-else
      ><div class="quality-metrics">
        <article>
          <small>原始证据</small><strong>{{ totalEvidence }}</strong
          ><span>内容哈希校验</span>
        </article>
        <article>
          <small>开放问题</small><strong>{{ metrics.open }}</strong
          ><span>不可静默覆盖</span>
        </article>
        <article>
          <small>严重问题</small><strong>{{ metrics.critical }}</strong
          ><span>阻断不可靠数据</span>
        </article>
        <article>
          <small>通过核对</small><strong>{{ metrics.passed }}</strong
          ><span>按来源与解析器</span>
        </article>
      </div>
      <section class="quality-card" aria-labelledby="quality-highlight-title">
        <header>
          <div>
            <h3 id="quality-highlight-title">采集质量指标</h3>
            <span>每项取最近一次已持久化核对，不合成无依据的总分。</span>
          </div>
        </header>
        <div class="quality-run-grid">
          <article v-for="item in qualityHighlights" :key="item.code">
            <header>
              <strong>{{ metricLabel(item.code) }}</strong>
              <b v-if="item.metric" :data-status="item.metric.status">
                {{ qualityStatusLabel(item.metric.status) }}
              </b>
            </header>
            <template v-if="item.metric">
              <p>
                <strong>{{ (item.metric.value * 100).toFixed(1) }}%</strong>
                · 门槛 {{ (item.metric.threshold * 100).toFixed(1) }}%
              </p>
              <small>
                {{ item.metric.provider_name }} ·
                {{ item.metric.denominator ?? item.metric.sample_count }} 个样本 ·
                {{ time(item.metric.window_ended_at) }}
              </small>
            </template>
            <p v-else>暂无核对数据</p>
          </article>
        </div>
      </section>
      <section class="quality-card">
        <header>
          <nav aria-label="数据质量视图">
            <button
              :aria-current="tab === 'evidence' ? 'page' : undefined"
              @click="tab = 'evidence'"
            >
              证据</button
            ><button :aria-current="tab === 'issues' ? 'page' : undefined" @click="tab = 'issues'">
              质量问题</button
            ><button :aria-current="tab === 'runs' ? 'page' : undefined" @click="tab = 'runs'">
              核对运行
            </button>
          </nav>
          <div>
            <span>{{ notice || "原文下载需要短时授权，并记录访问审计。" }}</span
            ><input
              v-model="query"
              aria-label="搜索证据与质量"
              placeholder="来源 / URL / 指标 / 哈希"
            />
          </div>
        </header>
        <div v-if="tab === 'evidence'" class="quality-table-wrap">
          <table>
            <thead>
              <tr>
                <th>证据</th>
                <th>来源</th>
                <th>范围</th>
                <th>格式 / 大小</th>
                <th>捕获 / 保留</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in filteredEvidence" :key="item.id">
                <td>
                  <strong>{{ item.id.slice(0, 8) }}…</strong
                  ><small>{{ item.content_sha256.slice(0, 14) }}…</small>
                </td>
                <td>
                  <span>{{ item.provider_name }}</span
                  ><small>{{ item.canonical_url }}</small>
                </td>
                <td>
                  {{ item.organization_id.slice(0, 8) }}…<small
                    >{{ item.workspace_id.slice(0, 8) }}…</small
                  >
                </td>
                <td>
                  {{ item.content_type }}<small>{{ size(item.size_bytes) }}</small>
                </td>
                <td>
                  {{ time(item.captured_at) }}<small>至 {{ time(item.retention_until) }}</small>
                </td>
                <td>
                  <button @click="openEvidence(item.id)">详情</button
                  ><button class="secondary" @click="grantDownload(item)">下载</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else-if="tab === 'issues'" class="quality-table-wrap">
          <table>
            <thead>
              <tr>
                <th>问题</th>
                <th>来源</th>
                <th>状态</th>
                <th>实际 / 门槛</th>
                <th>更新时间</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in filteredIssues" :key="item.id">
                <td>
                  <strong>{{ metricLabel(item.metric_code) }}</strong
                  ><small>{{ item.field_path || "来源级指标" }}</small>
                </td>
                <td>{{ item.provider_name }}</td>
                <td>
                  <b :data-severity="item.severity"
                    >{{ item.severity === "critical" ? "严重" : "警告" }} ·
                    {{ item.status === "open" ? "待处理" : "已解决" }}</b
                  >
                </td>
                <td>
                  {{ item.actual_value === null ? "—" : `${(item.actual_value * 100).toFixed(1)}%`
                  }}<small>{{
                    item.threshold_value === null
                      ? "—"
                      : `${(item.threshold_value * 100).toFixed(1)}%`
                  }}</small>
                </td>
                <td>{{ time(item.updated_at) }}</td>
                <td>
                  <button v-if="item.status === 'open'" @click="beginResolve(item)">
                    记录解决
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="quality-run-grid">
          <article v-for="run in runs" :key="run.id">
            <header>
              <div>
                <strong>{{ run.provider_name }}</strong
                ><small>{{ run.market }} · {{ run.parser_version }}</small>
              </div>
              <b :data-status="run.status">{{ qualityStatusLabel(run.status) }}</b>
            </header>
            <p>{{ run.sample_count }} 个样本 · {{ time(run.window_ended_at) }}</p>
            <ul>
              <li v-for="metric in run.metrics" :key="metric.code">
                <span>{{ metricLabel(metric.code) }}</span
                ><strong>{{ (metric.value * 100).toFixed(1) }}%</strong
                ><small
                  >门槛 {{ (metric.threshold * 100).toFixed(1) }}% ·
                  {{ qualityStatusLabel(metric.status) }}</small
                >
              </li>
            </ul>
          </article>
        </div>
      </section>
      <aside v-if="detail" class="quality-detail">
        <header>
          <div>
            <p>证据详情</p>
            <h3>{{ detail.evidence.id }}</h3>
          </div>
          <button aria-label="关闭证据详情" @click="detail = null">×</button>
        </header>
        <dl>
          <div>
            <dt>规范 URL</dt>
            <dd>{{ detail.evidence.canonical_url }}</dd>
          </div>
          <div>
            <dt>解析器 / 适配器</dt>
            <dd>
              {{ detail.evidence.parser_version }} /
              {{ detail.evidence.adapter_version }}
            </dd>
          </div>
          <div>
            <dt>关联编号</dt>
            <dd>{{ detail.evidence.request_id }}</dd>
          </div>
          <div>
            <dt>链路编号</dt>
            <dd>{{ detail.evidence.trace_id }}</dd>
          </div>
        </dl>
        <h4>规范记录版本</h4>
        <article v-for="item in detail.normalized_records" :key="item.id">
          <strong>{{ item.record_key }} · v{{ item.record_version }}</strong
          ><span>{{ item.schema_version }} · {{ item.status }}</span>
        </article>
        <h4>字段溯源</h4>
        <article v-for="item in detail.field_provenance" :key="item.id">
          <strong>{{ item.field_path }}</strong
          ><span>{{ item.source_path }} · {{ item.transform_version }}</span
          ><small>{{ item.source_value_sha256 }}</small>
        </article>
      </aside>
      <aside v-if="resolving" class="quality-resolution">
        <header>
          <div>
            <p>质量问题</p>
            <h3>{{ metricLabel(resolving.metric_code) }}</h3>
          </div>
          <button aria-label="关闭解决表单" @click="resolving = null">×</button>
        </header>
        <p>解决只追加原因和审计，不修改或删除原始证据与历史核对。</p>
        <label
          >解决原因<textarea
            v-model="reason"
            rows="4"
            maxlength="500"
            placeholder="说明修复方式与验证依据（2–500 字）"
          ></textarea></label
        ><button :disabled="reason.trim().length < 2 || saving" @click="confirming = true">
          确认前检查
        </button>
      </aside></template
    ><ConfirmDialog
      :open="confirming"
      title="将此质量问题标记为已解决？"
      description="系统会用 expected_version 防止覆盖他人更新，并保存原因、操作人和关联标识。"
      impact="原始证据、规范记录、字段溯源和核对历史不会被删除或改写。"
      confirm-label="确认解决"
      confirmation-text="确认解决"
      @cancel="confirming = false"
      @confirm="resolveIssue"
    />
  </section>
</template>
