<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ApiClientError, createApiClient } from "../api-client";
import UiStatePanel from "./UiStatePanel.vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import ResponsiveDataView from "./ResponsiveDataView.vue";
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
  organization_id: string;
  reconciliation_run_id: string | null;
  raw_evidence_id: string | null;
  parser_version: string | null;
  provider_name: string;
  metric_code: string;
  field_path: string | null;
  severity: "warning" | "critical";
  status: "open" | "resolved";
  actual_value: number | null;
  threshold_value: number | null;
  assigned_membership_id: string | null;
  assigned_member_label: string | null;
  attribution_reason: string | null;
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
  request = createApiClient(props.apiBaseUrl),
  state = ref<State>("loading"),
  evidence = ref<Evidence[]>([]),
  issues = ref<Issue[]>([]),
  runs = ref<Run[]>([]),
  totalEvidence = ref(0),
  totalIssues = ref(0),
  observedAt = ref(""),
  requestId = ref(""),
  tab = ref<"evidence" | "issues" | "runs">("evidence"),
  selectedRunId = ref(""),
  query = ref(""),
  detail = ref<any>(null),
  notice = ref(""),
  resolving = ref<Issue | null>(null),
  reason = ref(""),
  confirming = ref(false),
  saving = ref(false);
const memberOptions = ref<Array<{ id: string; organization_id: string; label: string }>>([]),
  selectedIssueIds = ref<string[]>([]),
  batchAction = ref<"attribute" | "assign" | "close">("attribute"),
  batchReason = ref(""),
  batchAssignee = ref(""),
  batchConfirming = ref(false);
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
        (!selectedRunId.value || item.reconciliation_run_id === selectedRunId.value) &&
        (!query.value ||
          [item.metric_code, item.provider_name, item.field_path].some((value) =>
            value?.toLowerCase().includes(query.value.toLowerCase()),
          )),
    ),
  ),
  metrics = computed(() => ({
    open: issues.value.filter((item) => item.status === "open").length,
    critical: issues.value.filter((item) => item.status === "open" && item.severity === "critical")
      .length,
    passed: runs.value.filter((item) => item.status === "passed").length,
  })),
  retentionRisks = computed(() => {
    const observed = Date.parse(observedAt.value);
    if (!Number.isFinite(observed)) return { expiring: 0, expired: 0 };
    return evidence.value.reduce(
      (result, item) => {
        const expiry = Date.parse(item.retention_until);
        if (!Number.isFinite(expiry)) return result;
        if (expiry <= observed) result.expired += 1;
        else if (expiry - observed <= 7 * 86400000) result.expiring += 1;
        return result;
      },
      { expiring: 0, expired: 0 },
    );
  }),
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
  }),
  selectedIssues = computed(() =>
    issues.value.filter(
      (item) => selectedIssueIds.value.includes(item.id) && item.status === "open",
    ),
  ),
  batchMembers = computed(() => {
    const organizations = new Set(selectedIssues.value.map((item) => item.organization_id));
    if (organizations.size !== 1) return [];
    const organizationId = selectedIssues.value[0]?.organization_id;
    return memberOptions.value.filter((item) => item.organization_id === organizationId);
  }),
  batchImpact = computed(() => {
    const providers = [...new Set(selectedIssues.value.map((item) => item.provider_name))];
    return `将处理 ${selectedIssues.value.length} 个开放问题，涉及 ${providers.length} 个来源：${providers.join("、") || "无"}。历史证据与核对运行不会被删除。`;
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
const retentionStatus = (value: string) => {
  const observed = Date.parse(observedAt.value),
    expiry = Date.parse(value);
  if (!Number.isFinite(observed) || !Number.isFinite(expiry)) return "到期风险未知";
  if (expiry <= observed) return "已到期，等待受控治理";
  const days = Math.ceil((expiry - observed) / 86400000);
  return days <= 7 ? `${days} 天内到期` : `剩余 ${days} 天`;
};
async function load() {
  state.value = "loading";
  notice.value = "";
  try {
    const response = await request<any>("/platform/data-quality?page=1&page_size=50&status=all");
    requestId.value = response.request_id;
    evidence.value = response.data.evidence ?? [];
    issues.value = response.data.issues ?? [];
    runs.value = response.data.reconciliationRuns ?? [];
    memberOptions.value = response.data.memberOptions ?? [];
    selectedIssueIds.value = [];
    totalEvidence.value = response.data.totalEvidence ?? 0;
    totalIssues.value = response.data.totalIssues ?? 0;
    observedAt.value = response.data.observedAt ?? "";
    state.value =
      evidence.value.length || issues.value.length || runs.value.length ? "ready" : "empty";
  } catch (error) {
    const apiError = error instanceof ApiClientError ? error : null;
    requestId.value = apiError?.requestId ?? "";
    state.value = apiError ? failure(apiError.status) : "blocked";
  }
}
async function openEvidence(id: string) {
  try {
    const response = await request<any>(`/platform/data/evidence/${id}`);
    requestId.value = response.request_id;
    detail.value = response.data;
  } catch (error) {
    const apiError = error instanceof ApiClientError ? error : null;
    requestId.value = apiError?.requestId ?? requestId.value;
    notice.value = apiError?.actionHint ?? "证据详情依赖暂不可用";
  }
}
async function grantDownload(item: Evidence) {
  try {
    const response = await request<any>(`/platform/data/evidence/${item.id}/download-grant`, {
      method: "POST",
      body: {},
    });
    requestId.value = response.request_id;
    notice.value = `短时下载授权已签发，${time(response.data.expires_at)} 前有效。`;
    window.location.assign(
      `${props.apiBaseUrl}/platform/data/evidence/${item.id}/download?grant=${encodeURIComponent(response.data.grant)}`,
    );
  } catch (error) {
    const apiError = error instanceof ApiClientError ? error : null;
    requestId.value = apiError?.requestId ?? requestId.value;
    notice.value = apiError?.actionHint ?? "下载依赖暂不可用";
  }
}
function beginResolve(item: Issue) {
  resolving.value = item;
  reason.value = "";
}
function drillIntoRun(run: Run) {
  selectedRunId.value = run.id;
  query.value = "";
  tab.value = "issues";
  notice.value = `${run.provider_name} · ${run.parser_version}：正在查看本次核对的异常样本与字段。`;
}
function clearRunDrilldown() {
  selectedRunId.value = "";
  notice.value = "已返回全部质量问题。";
}
async function resolveIssue() {
  if (!resolving.value) return;
  saving.value = true;
  try {
    const response = await request<any>(
      `/platform/data-quality/issues/${resolving.value.id}/resolve`,
      {
        method: "POST",
        body: {
          reason: reason.value.trim(),
          expected_version: resolving.value.version,
        },
      },
    );
    requestId.value = response.request_id;
    await load();
    notice.value = `质量问题 ${response.data.id.slice(0, 8)}… 已记录解决原因。`;
    resolving.value = null;
    reason.value = "";
  } catch (error) {
    const apiError = error instanceof ApiClientError ? error : null;
    requestId.value = apiError?.requestId ?? requestId.value;
    notice.value = apiError?.actionHint ?? "依赖不可用，未更新质量问题";
  } finally {
    saving.value = false;
    confirming.value = false;
  }
}
function toggleIssue(id: string, checked: boolean) {
  selectedIssueIds.value = checked
    ? [...selectedIssueIds.value, id]
    : selectedIssueIds.value.filter((value) => value !== id);
}
function previewBatch() {
  if (!selectedIssues.value.length) {
    notice.value = "先选择 1–50 个开放问题。";
    return;
  }
  if (batchReason.value.trim().length < 2) {
    notice.value = "填写至少 2 个字符的处理原因。";
    return;
  }
  if (batchAction.value === "assign" && !batchAssignee.value) {
    notice.value = batchMembers.value.length
      ? "选择所选问题所属组织的活动成员。"
      : "批量指派只能选择同一组织的问题。";
    return;
  }
  batchConfirming.value = true;
}
async function executeBatch() {
  saving.value = true;
  try {
    const response = await request<Issue[]>("/platform/data-quality/issues/batch", {
      method: "POST",
      body: {
        items: selectedIssues.value.map((item) => ({
          id: item.id,
          expected_version: item.version,
        })),
        action: batchAction.value,
        reason: batchReason.value.trim(),
        assignee_membership_id: batchAction.value === "assign" ? batchAssignee.value : null,
      },
    });
    requestId.value = response.request_id;
    const count = response.data.length;
    await load();
    notice.value = `已批量处理 ${count} 个质量问题；每个问题均已增加独立事件和审计事实。`;
    batchReason.value = "";
    batchAssignee.value = "";
  } catch (error) {
    const apiError = error instanceof ApiClientError ? error : null;
    requestId.value = apiError?.requestId ?? requestId.value;
    notice.value = apiError?.actionHint ?? "依赖不可用，批量处理未生效";
  } finally {
    saving.value = false;
    batchConfirming.value = false;
  }
}
onMounted(async () => {
  await load();
  const evidenceId = new URLSearchParams(window.location.search).get("evidence");
  if (evidenceId && /^[0-9a-f-]{36}$/i.test(evidenceId)) await openEvidence(evidenceId);
});
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
        <article>
          <small>即将到期</small><strong>{{ retentionRisks.expiring }}</strong
          ><span>{{ retentionRisks.expired }} 条已到期</span>
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
        <ResponsiveDataView
          v-if="tab === 'evidence'"
          :rows="filteredEvidence"
          :row-key="(item) => item.id"
          title="采集证据"
          :detail-title="(item) => `${item.provider_name} · ${time(item.captured_at)}`"
        >
          <template #desktop>
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
                  <td><strong>采集证据</strong><small>哈希已校验</small></td>
                  <td>
                    <span>{{ item.provider_name }}</span
                    ><small>{{ item.canonical_url }}</small>
                  </td>
                  <td>已绑定组织与工作区</td>
                  <td>
                    {{ item.content_type }}<small>{{ size(item.size_bytes) }}</small>
                  </td>
                  <td>
                    {{ time(item.captured_at)
                    }}<small
                      >保留至 {{ time(item.retention_until) }} ·
                      {{ retentionStatus(item.retention_until) }}</small
                    >
                  </td>
                  <td>
                    <button @click="openEvidence(item.id)">详情</button
                    ><button class="secondary" @click="grantDownload(item)">下载</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </template>
          <template #summary="{ row }">
            <span class="responsive-record-summary">
              <strong>{{ row.provider_name }} · {{ size(row.size_bytes) }}</strong>
              <small>{{ row.content_type }} · {{ time(row.captured_at) }}</small>
            </span>
          </template>
          <template #detail="{ row, close }">
            <dl>
              <div>
                <dt>来源</dt>
                <dd>{{ row.provider_name }}</dd>
              </div>
              <div>
                <dt>规范 URL</dt>
                <dd>{{ row.canonical_url }}</dd>
              </div>
              <div>
                <dt>格式 / 大小</dt>
                <dd>{{ row.content_type }} · {{ size(row.size_bytes) }}</dd>
              </div>
              <div>
                <dt>捕获时间</dt>
                <dd>{{ time(row.captured_at) }}</dd>
              </div>
              <div>
                <dt>保留期限</dt>
                <dd>
                  {{ time(row.retention_until) }} · {{ retentionStatus(row.retention_until) }}
                </dd>
              </div>
            </dl>
            <div class="quality-mobile-actions">
              <button
                type="button"
                @click="
                  close();
                  openEvidence(row.id);
                "
              >
                读取完整溯源
              </button>
              <button type="button" class="secondary" @click="grantDownload(row)">下载证据</button>
            </div>
            <details>
              <summary>技术详情</summary>
              <dl>
                <div>
                  <dt>证据 ID</dt>
                  <dd>{{ row.id }}</dd>
                </div>
                <div>
                  <dt>组织 ID</dt>
                  <dd>{{ row.organization_id }}</dd>
                </div>
                <div>
                  <dt>工作区 ID</dt>
                  <dd>{{ row.workspace_id }}</dd>
                </div>
                <div>
                  <dt>内容哈希</dt>
                  <dd>{{ row.content_sha256 }}</dd>
                </div>
                <div>
                  <dt>解析版本</dt>
                  <dd>{{ row.parser_version }}</dd>
                </div>
                <div>
                  <dt>请求 ID</dt>
                  <dd>{{ row.request_id }}</dd>
                </div>
                <div>
                  <dt>链路 ID</dt>
                  <dd>{{ row.trace_id }}</dd>
                </div>
              </dl>
            </details>
          </template>
        </ResponsiveDataView>
        <section v-if="tab === 'issues' && selectedRunId" class="quality-drilldown" role="status">
          <div>
            <strong>异常样本下钻</strong>
            <span>仅显示当前核对运行关联的问题；可继续打开证据查看字段溯源。</span>
          </div>
          <button type="button" class="secondary" @click="clearRunDrilldown">返回全部问题</button>
        </section>
        <section
          v-if="tab === 'issues'"
          class="quality-batch-toolbar"
          aria-label="质量问题批量处理"
        >
          <div>
            <strong>批量处理开放问题</strong>
            <span>已选择 {{ selectedIssues.length }} 个；批量指派仅允许同一组织的活动成员。</span>
          </div>
          <label
            >操作<select v-model="batchAction">
              <option value="attribute">记录归因</option>
              <option value="assign">指派成员</option>
              <option value="close">关闭问题</option>
            </select></label
          >
          <label v-if="batchAction === 'assign'"
            >接收成员<select v-model="batchAssignee">
              <option value="">请选择</option>
              <option v-for="member in batchMembers" :key="member.id" :value="member.id">
                {{ member.label }}
              </option>
            </select></label
          >
          <label class="wide"
            >处理原因<input
              v-model="batchReason"
              maxlength="500"
              placeholder="说明归因、指派或关闭依据"
          /></label>
          <button type="button" :disabled="saving || !selectedIssues.length" @click="previewBatch">
            预览影响范围
          </button>
        </section>
        <ResponsiveDataView
          v-if="tab === 'issues'"
          :rows="filteredIssues"
          :row-key="(item) => item.id"
          title="数据质量问题"
          :detail-title="(item) => metricLabel(item.metric_code)"
        >
          <template #desktop>
            <table>
              <thead>
                <tr>
                  <th>选择</th>
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
                    <input
                      type="checkbox"
                      :aria-label="`选择 ${metricLabel(item.metric_code)}`"
                      :checked="selectedIssueIds.includes(item.id)"
                      :disabled="item.status !== 'open'"
                      @change="toggleIssue(item.id, ($event.target as HTMLInputElement).checked)"
                    />
                  </td>
                  <td>
                    <strong>{{ metricLabel(item.metric_code) }}</strong
                    ><small
                      >{{ item.field_path || "来源级指标" }} · 解析
                      {{ item.parser_version || "未关联" }}</small
                    >
                  </td>
                  <td>{{ item.provider_name }}</td>
                  <td>
                    <b :data-severity="item.severity"
                      >{{ item.severity === "critical" ? "严重" : "警告" }} ·
                      {{ item.status === "open" ? "待处理" : "已解决" }}</b
                    >
                  </td>
                  <td>
                    {{
                      item.actual_value === null ? "—" : `${(item.actual_value * 100).toFixed(1)}%`
                    }}<small>{{
                      item.threshold_value === null
                        ? "—"
                        : `${(item.threshold_value * 100).toFixed(1)}%`
                    }}</small>
                  </td>
                  <td>{{ time(item.updated_at) }}</td>
                  <td>
                    <button
                      v-if="item.raw_evidence_id"
                      class="secondary"
                      @click="openEvidence(item.raw_evidence_id)"
                    >
                      查看证据
                    </button>
                    <button v-if="item.status === 'open'" @click="beginResolve(item)">
                      记录解决
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </template>
          <template #summary="{ row }">
            <span class="responsive-record-summary">
              <strong
                >{{ metricLabel(row.metric_code) }} ·
                {{ row.status === "open" ? "待处理" : "已解决" }}</strong
              >
              <small
                >{{ row.provider_name }} ·
                {{ row.severity === "critical" ? "严重" : "警告" }}</small
              >
            </span>
          </template>
          <template #detail="{ row, close }">
            <dl>
              <div>
                <dt>来源</dt>
                <dd>{{ row.provider_name }}</dd>
              </div>
              <div>
                <dt>字段</dt>
                <dd>{{ row.field_path || "来源级指标" }}</dd>
              </div>
              <div>
                <dt>解析版本</dt>
                <dd>{{ row.parser_version || "未关联" }}</dd>
              </div>
              <div>
                <dt>负责人</dt>
                <dd>{{ row.assigned_member_label || "未指派" }}</dd>
              </div>
              <div v-if="row.attribution_reason">
                <dt>归因</dt>
                <dd>{{ row.attribution_reason }}</dd>
              </div>
              <div>
                <dt>状态</dt>
                <dd>
                  {{ row.severity === "critical" ? "严重" : "警告" }} ·
                  {{ row.status === "open" ? "待处理" : "已解决" }}
                </dd>
              </div>
              <div>
                <dt>实际 / 门槛</dt>
                <dd>
                  {{ row.actual_value === null ? "—" : `${(row.actual_value * 100).toFixed(1)}%` }}
                  /
                  {{
                    row.threshold_value === null
                      ? "—"
                      : `${(row.threshold_value * 100).toFixed(1)}%`
                  }}
                </dd>
              </div>
              <div>
                <dt>更新时间</dt>
                <dd>{{ time(row.updated_at) }}</dd>
              </div>
              <div v-if="row.resolution_reason">
                <dt>解决原因</dt>
                <dd>{{ row.resolution_reason }}</dd>
              </div>
            </dl>
            <button
              v-if="row.raw_evidence_id"
              type="button"
              class="secondary"
              @click="
                close();
                openEvidence(row.raw_evidence_id);
              "
            >
              查看关联证据
            </button>
            <button
              v-if="row.status === 'open'"
              type="button"
              @click="
                close();
                beginResolve(row);
              "
            >
              记录解决
            </button>
            <details>
              <summary>技术详情</summary>
              <dl>
                <div>
                  <dt>问题 ID</dt>
                  <dd>{{ row.id }}</dd>
                </div>
              </dl>
            </details>
          </template>
        </ResponsiveDataView>
        <div v-else-if="tab === 'runs'" class="quality-run-grid">
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
            <button type="button" class="secondary" @click="drillIntoRun(run)">
              查看异常字段与样本
            </button>
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
    <ConfirmDialog
      :open="batchConfirming"
      title="确认批量处理质量问题？"
      description="系统会逐条校验当前版本和开放状态；任一问题已变化时整批失败，不会部分覆盖。"
      :impact="batchImpact"
      confirm-label="确认批量处理"
      confirmation-text="确认处理"
      @cancel="batchConfirming = false"
      @confirm="executeBatch"
    />
  </section>
</template>
