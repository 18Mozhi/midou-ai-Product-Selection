<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { statusLabel } from "../ui/status-labels";
import ConfirmDialog from "./ConfirmDialog.vue";
const props = defineProps<{ apiBaseUrl: string }>();
const state = ref("loading"),
  data = ref<any>(null),
  org = ref(""),
  workspace = ref(""),
  provider = ref(""),
  timeWindow = ref("24h"),
  errorCode = ref(""),
  requestId = ref(""),
  hint = ref(""),
  selectedDeadLetterIds = ref<string[]>([]),
  batchReason = ref(""),
  batchPreview = ref(false),
  batchId = ref(""),
  batchBusy = ref(false),
  batchNotice = ref("");
const selectedDeadLetters = computed(() =>
    (data.value?.dead_letters ?? []).filter(
      (item: any) => item.status === "open" && selectedDeadLetterIds.value.includes(item.id),
    ),
  ),
  batchImpact = computed(() => {
    const items = selectedDeadLetters.value,
      roots = new Map<string, number>();
    for (const item of items) roots.set(item.error_code, (roots.get(item.error_code) ?? 0) + 1);
    const rootSummary = [...roots.entries()]
        .map(([code, total]) => `${errorLabel(code)} ${total} 条`)
        .join("、"),
      organizationCount = new Set(items.map((item: any) => item.organization_id)).size,
      workspaceCount = new Set(items.map((item: any) => item.workspace_id)).size;
    return `${items.length} 条开放死信；${organizationCount} 个组织；${workspaceCount} 个工作区；根因：${rootSummary || "无"}。`;
  });
async function load() {
  state.value = "loading";
  const q = new URLSearchParams();
  if (org.value) q.set("organization_id", org.value);
  if (workspace.value) q.set("workspace_id", workspace.value);
  if (provider.value) q.set("provider_id", provider.value);
  q.set("window", timeWindow.value);
  if (errorCode.value) q.set("error_code", errorCode.value);
  try {
    const r = await fetch(`${props.apiBaseUrl}/platform/collection/console?${q}`, {
        credentials: "include",
        headers: { accept: "application/json" },
      }),
      b = await r.json().catch(() => null);
    requestId.value = b?.request_id ?? "";
    hint.value = b?.error?.action_hint ?? "";
    if (!r.ok) {
      state.value =
        r.status === 401
          ? "expired"
          : r.status === 403
            ? "forbidden"
            : r.status === 429
              ? "rate_limited"
              : "blocked";
      return;
    }
    data.value = b.data;
    const openIds = new Set(
      b.data.dead_letters.filter((item: any) => item.status === "open").map((item: any) => item.id),
    );
    selectedDeadLetterIds.value = selectedDeadLetterIds.value.filter((id) => openIds.has(id));
    state.value =
      b.data.sources.length +
      b.data.task_states.length +
      b.data.dead_letters.length +
      b.data.quality.length
        ? "ready"
        : "empty";
  } catch {
    state.value = "blocked";
  }
}
onMounted(load);
const when = (v: string | null) =>
    v ? new Date(v).toLocaleString("zh-CN", { hour12: false }) : "未检查",
  linkLabels: Record<string, string> = {
    provider_registry: "来源配置",
    adapter_health: "适配器健康",
    source_catalog: "来源目录",
    task_monitor: "采集任务",
    browser_runtime: "浏览器运行",
    data_quality: "数据质量",
  },
  healthLabel = (value: string) =>
    (
      ({
        ready: "正常",
        healthy: "正常",
        warning: "需要关注",
        degraded: "性能下降",
        critical: "严重异常",
        unknown: "尚未检查",
      }) as Record<string, string>
    )[value] ?? "状态待确认",
  errorLabel = (value: string | null) =>
    value
      ? ((
          {
            network_error: "网络异常",
            dns_error: "域名解析失败",
            timeout: "请求超时",
            rate_limited: "来源限速",
            login_required: "需要登录",
            session_expired: "登录已失效",
            blocked_login: "登录已失效",
            captcha: "验证码受阻",
            blocked_captcha: "验证码受阻",
            robots_disallowed: "站点规则阻止",
            parser_error: "页面解析失败",
            parser_failed: "页面解析失败",
            parse_failed: "页面解析失败",
            source_changed: "页面结构已变化",
            validation_failed: "数据校验失败",
            permission_denied: "权限受阻",
          } as Record<string, string>
        )[value] ?? "其他采集错误")
      : "无错误",
  errorCategory = (value: string) =>
    (
      ({
        network_error: "网络",
        dns_error: "网络",
        timeout: "网络",
        login_required: "登录",
        session_expired: "登录",
        blocked_login: "登录",
        captcha: "验证码",
        blocked_captcha: "验证码",
        parser_error: "解析",
        parser_failed: "解析",
        parse_failed: "解析",
        source_changed: "解析",
      }) as Record<string, string>
    )[value] ?? "其他",
  drillRootCause = async (value: string) => {
    errorCode.value = errorCode.value === value ? "" : value;
    await load();
  };

function toggleDeadLetter(id: string, checked: boolean) {
  if (!checked) {
    selectedDeadLetterIds.value = selectedDeadLetterIds.value.filter((value) => value !== id);
    return;
  }
  if (selectedDeadLetterIds.value.length >= 20) {
    batchNotice.value = "每批最多选择 20 条开放死信。";
    return;
  }
  selectedDeadLetterIds.value = [...selectedDeadLetterIds.value, id];
}

function previewBatchReplay() {
  if (!selectedDeadLetters.value.length) {
    batchNotice.value = "请先选择要重放的开放死信。";
    return;
  }
  if (batchReason.value.trim().length < 2 || batchReason.value.length > 500) {
    batchNotice.value = "重放原因需要 2–500 字符。";
    return;
  }
  batchId.value = crypto.randomUUID();
  batchPreview.value = true;
}

async function confirmBatchReplay() {
  batchBusy.value = true;
  const succeeded = new Set<string>();
  let failed = 0;
  for (const item of selectedDeadLetters.value) {
    try {
      const response = await fetch(
        `${props.apiBaseUrl}/platform/collection/tasks/${item.task_id}/replay`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            "idempotency-key": `dead-batch:${batchId.value}:${item.task_id}`,
          },
          body: JSON.stringify({ reason: batchReason.value.trim() }),
        },
      );
      if (response.ok) succeeded.add(item.id);
      else failed += 1;
    } catch {
      failed += 1;
    }
  }
  selectedDeadLetterIds.value = selectedDeadLetterIds.value.filter((id) => !succeeded.has(id));
  batchNotice.value = `批量重放完成：成功 ${succeeded.size} 条，失败 ${failed} 条；每条均保留独立任务历史、幂等记录与审计。`;
  batchPreview.value = false;
  batchBusy.value = false;
  await load();
}
</script>
<template>
  <section class="collection-ops">
    <header>
      <div>
        <p>采集运行管理</p>
        <h2>来源与采集控制台</h2>
        <span
          >来源配置、健康、任务尝试、死信和质量问题使用同一事实视图；敏感操作仍进入对应受控页面。</span
        >
      </div>
      <form @submit.prevent="load">
        <input v-model="org" aria-label="组织 ID 筛选" placeholder="组织 ID（可选）" /><input
          v-model="workspace"
          aria-label="工作区 ID 筛选"
          placeholder="工作区 ID（可选）"
        /><select v-model="provider" aria-label="采集来源筛选">
          <option value="">全部来源</option>
          <option v-for="source in data?.source_options ?? []" :key="source.id" :value="source.id">
            {{ source.name }}
          </option></select
        ><select v-model="timeWindow" aria-label="观测时间筛选">
          <option value="24h">最近 24 小时</option>
          <option value="7d">最近 7 天</option>
          <option value="30d">最近 30 天</option>
          <option value="all">全部时间</option></select
        ><button>应用范围</button>
      </form>
    </header>
    <section v-if="state !== 'ready'" class="platform-dashboard-state" :data-kind="state">
      <h3>
        {{
          state === "loading"
            ? "正在读取采集运行事实"
            : state === "empty"
              ? "当前范围没有采集事实"
              : state === "expired"
                ? "登录已失效"
                : state === "forbidden"
                  ? "你没有此项权限"
                  : state === "rate_limited"
                    ? "请求过于频繁"
                    : "采集控制台依赖受阻"
        }}
      </h3>
      <p>{{ hint || "刷新或检查宝塔 Node API 与 MySQL 后重试。" }}</p>
      <code v-if="requestId">request_id: {{ requestId }}</code
      ><button v-if="!['loading', 'expired', 'forbidden'].includes(state)" @click="load">
        重新读取
      </button>
    </section>
    <template v-else-if="data"
      ><nav class="collection-ops-links">
        <a v-for="(path, label) in data.links" :key="path" :href="path">{{
          linkLabels[label] ?? "相关管理页面"
        }}</a>
      </nav>
      <div class="collection-ops-grid">
        <section>
          <h3>来源与健康</h3>
          <table>
            <thead>
              <tr>
                <th>来源</th>
                <th>状态</th>
                <th>健康</th>
                <th>连续失败</th>
                <th>最近检查</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in data.sources" :key="s.id">
                <td>
                  <b>{{ s.name }}</b
                  ><small>{{ s.code }} · {{ s.owner_label }}</small>
                </td>
                <td>{{ statusLabel(s.status) }}</td>
                <td>
                  <i :data-health="s.health_status">{{ healthLabel(s.health_status) }}</i>
                </td>
                <td>{{ s.consecutive_failures }}</td>
                <td>{{ when(s.last_checked_at) }}</td>
              </tr>
            </tbody>
          </table>
        </section>
        <section>
          <h3>任务状态</h3>
          <div class="collection-state-chips">
            <span v-for="t in data.task_states" :key="t.status"
              ><b>{{ t.total }}</b
              >{{ statusLabel(t.status) }}</span
            >
          </div>
          <h3>质量问题</h3>
          <div class="collection-state-chips">
            <span v-for="q in data.quality" :key="q.status + q.severity"
              ><b>{{ q.total }}</b
              >{{ statusLabel(q.status) }} · {{ q.severity === "critical" ? "严重" : "警告" }}</span
            >
          </div>
        </section>
        <section class="collection-root-causes">
          <header>
            <div>
              <h3>错误根因</h3>
              <small>按真实死信错误码聚合失败任务，选择后下钻尝试与死信。</small>
            </div>
            <button
              v-if="errorCode"
              type="button"
              class="collection-clear-root"
              @click="drillRootCause(errorCode)"
            >
              清除根因筛选
            </button>
          </header>
          <div v-if="data.root_causes?.length" class="collection-root-list">
            <article
              v-for="root in data.root_causes ?? []"
              :key="root.error_code"
              :data-selected="errorCode === root.error_code"
            >
              <button
                type="button"
                :aria-pressed="errorCode === root.error_code"
                @click="drillRootCause(root.error_code)"
              >
                <b>{{ errorLabel(root.error_code) }}</b>
                <span>{{ root.total }} 次 · 最近 {{ when(root.latest_at) }}</span>
                <small>告警类别：{{ errorCategory(root.error_code) }}</small>
              </button>
              <details>
                <summary>技术详情</summary>
                <code>{{ root.error_code }}</code>
              </details>
            </article>
          </div>
          <p v-else>当前筛选范围没有采集错误。</p>
        </section>
        <section>
          <h3>最近尝试</h3>
          <table>
            <thead>
              <tr>
                <th>任务</th>
                <th>任务处理器</th>
                <th>状态</th>
                <th>错误</th>
                <th>链路编号</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in data.attempts" :key="a.id">
                <td>{{ a.task_id.slice(0, 8) }}… #{{ a.attempt_number }}</td>
                <td>{{ a.worker_id }}</td>
                <td>{{ statusLabel(a.status) }}</td>
                <td>
                  <span>{{ errorLabel(a.error_code) }}</span>
                  <details v-if="a.error_code">
                    <summary>技术详情</summary>
                    <code>{{ a.error_code }}</code>
                  </details>
                </td>
                <td>
                  <code>{{ a.trace_id.slice(0, 8) }}…</code>
                </td>
              </tr>
            </tbody>
          </table>
        </section>
        <section>
          <h3>开放与已重放死信</h3>
          <p v-if="batchNotice" aria-live="polite">{{ batchNotice }}</p>
          <details>
            <summary>批量安全重放</summary>
            <p>
              只处理明确勾选的开放死信，每批最多 20 条；执行前会固定展示根因、组织和工作区影响范围。
            </p>
            <label v-for="d in data.dead_letters" :key="`select-${d.id}`">
              <input
                type="checkbox"
                :checked="selectedDeadLetterIds.includes(d.id)"
                :disabled="d.status !== 'open' || batchBusy"
                @change="toggleDeadLetter(d.id, ($event.target as HTMLInputElement).checked)"
              />
              选择{{ errorLabel(d.error_code) }}死信 {{ d.task_id.slice(0, 8) }}…
            </label>
            <label>
              批量重放原因
              <textarea
                v-model="batchReason"
                maxlength="500"
                placeholder="说明恢复条件和重放原因（2–500 字）"
              ></textarea>
            </label>
            <button type="button" :disabled="batchBusy" @click="previewBatchReplay">
              预览批量重放
            </button>
          </details>
          <ul>
            <li v-for="d in data.dead_letters" :key="d.id">
              <b>{{ errorLabel(d.error_code) }}</b
              ><span
                >{{ statusLabel(d.status) }} · {{ d.organization_id.slice(0, 8) }}… ·
                {{ when(d.created_at) }}</span
              ><a :href="`/platform-admin/collection?task=${d.task_id}`">查看并受控重放</a>
              <details>
                <summary>技术详情</summary>
                <code>{{ d.error_code }}</code>
              </details>
            </li>
          </ul>
        </section>
      </div>
      <footer>观测时间 {{ when(data.observed_at) }} · request_id {{ requestId }}</footer></template
    >
    <ConfirmDialog
      :open="batchPreview"
      title="确认批量重放开放死信？"
      description="系统将逐条调用既有受控重放事务；并发状态变化或已处理任务会安全失败，不会覆盖原任务。"
      :impact="batchImpact"
      confirm-label="确认批量重放"
      destructive
      confirmation-text="确认重放"
      @cancel="batchPreview = false"
      @confirm="confirmBatchReplay"
    />
  </section>
</template>
