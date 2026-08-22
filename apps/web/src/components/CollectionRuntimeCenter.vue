<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ApiClientError, createApiClient, type ApiFailureKind } from "../api-client";
import UiStatePanel from "./UiStatePanel.vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import ResponsiveDataView from "./ResponsiveDataView.vue";
import "../crawler-runtime.css";
type State = "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
type RunStatus =
  "running" | "succeeded" | "succeeded_empty" | "blocked" | "failed" | "timed_out" | "cancelled";
interface Lease {
  run_id: string;
  lease_owner: string;
  leased_at: string;
  heartbeat_at: string;
  expires_at: string;
}
interface Profile {
  id: string;
  code: string;
  name: string;
  provider_id: string;
  provider_name: string;
  status: string;
  target_domain: string;
  credential_expires_at: string | null;
  login_status: "valid" | "expired" | "unknown";
  last_failure: null | { status: string; error_code: string | null; occurred_at: string };
  lease: Lease | null;
}
interface Run {
  id: string;
  organization_id: string;
  workspace_id: string;
  provider_id: string;
  crawler_profile_id: string;
  status: RunStatus;
  page_count: number;
  item_count: number;
  detail_count: number;
  duration_ms: number | null;
  error_code: string | null;
  request_id: string;
  trace_id: string;
  started_at: string;
  finished_at: string | null;
}
const props = defineProps<{ apiBaseUrl: string }>(),
  request = createApiClient(props.apiBaseUrl),
  state = ref<State>("loading"),
  profiles = ref<Profile[]>([]),
  runs = ref<Run[]>([]),
  requestId = ref(""),
  message = ref(""),
  query = ref(""),
  status = ref("all"),
  observedAt = ref(""),
  confirming = ref(false),
  saving = ref(false);
const activeLeases = computed(() => profiles.value.filter((item) => item.lease)),
  expiredLeaseRisks = computed(() =>
    profiles.value.filter(
      (item) =>
        item.lease &&
        observedAt.value &&
        new Date(item.lease.expires_at).getTime() <= new Date(observedAt.value).getTime(),
    ),
  ),
  duplicateRiskRuns = computed(() =>
    runs.value.filter((item) => item.error_code === "lease_expired"),
  ),
  blockedRuns = computed(() =>
    runs.value.filter((item) => ["blocked", "failed", "timed_out"].includes(item.status)),
  ),
  filtered = computed(() =>
    runs.value.filter(
      (item) =>
        (status.value === "all" || item.status === status.value) &&
        (!query.value ||
          [item.id, item.error_code, item.trace_id].some((value) =>
            value?.toLowerCase().includes(query.value.toLowerCase()),
          )),
    ),
  );
const failure = (kind: ApiFailureKind): State =>
  kind === "expired" || kind === "forbidden"
    ? kind
    : kind === "blocked" || kind === "rate_limited"
      ? "blocked"
      : "error";
async function load() {
  state.value = "loading";
  message.value = "";
  try {
    const response = await request<{ profiles: Profile[]; runs: Run[]; observed_at: string }>(
      "/platform/crawler-runtime",
    );
    requestId.value = response.request_id;
    profiles.value = response.data.profiles;
    runs.value = response.data.runs;
    observedAt.value = response.data.observed_at;
    state.value = profiles.value.length || runs.value.length ? "ready" : "empty";
  } catch (error) {
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      message.value = error.actionHint;
      state.value = failure(error.kind);
    } else state.value = "blocked";
  }
}
async function recover() {
  saving.value = true;
  try {
    const response = await request<{ recovered: number }>(
      "/platform/crawler-runtime/recover-expired",
      { method: "POST", body: {} },
    );
    requestId.value = response.request_id;
    message.value = `已回收 ${response.data.recovered} 个过期租约`;
    await load();
  } catch (error) {
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      message.value = error.actionHint;
    } else message.value = "依赖不可用，未执行回收";
  } finally {
    saving.value = false;
    confirming.value = false;
  }
}
const time = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(value))
    : "—";
const statusText = (value: string) =>
  (
    ({
      running: "运行中",
      succeeded: "成功",
      succeeded_empty: "成功但无结果",
      blocked: "已拦截",
      failed: "失败",
      timed_out: "已超时",
      cancelled: "已取消",
    }) as Record<string, string>
  )[value] ?? value;
const errorText = (value: string | null) =>
  value
    ? ((
        {
          blocked_login: "登录已失效",
          blocked_captcha: "需要验证码",
          blocked_robots: "网站限制采集",
          lease_expired: "运行租约已过期",
        } as Record<string, string>
      )[value] ?? "查看详情获取原因")
    : "无错误";
const expiryForecast = (profile: Profile) => {
  if (!profile.credential_expires_at || !observedAt.value) return "未提供有效期，无法预测";
  const remainingMs =
    new Date(profile.credential_expires_at).getTime() - new Date(observedAt.value).getTime();
  if (!Number.isFinite(remainingMs)) return "有效期不可用";
  if (remainingMs <= 0) return `已到期 · ${time(profile.credential_expires_at)}`;
  const remainingDays = Math.max(1, Math.ceil(remainingMs / 86_400_000));
  return `${remainingDays <= 7 ? "即将到期" : "预计到期"} · ${remainingDays} 天后 · ${time(profile.credential_expires_at)}`;
};
const leaseExpired = (profile: Profile) =>
  Boolean(
    profile.lease &&
    observedAt.value &&
    new Date(profile.lease.expires_at).getTime() <= new Date(observedAt.value).getTime(),
  );
onMounted(load);
</script>
<template>
  <section class="crawler-center" aria-labelledby="crawler-title">
    <header class="crawler-title">
      <div>
        <p>网页采集运行中心</p>
        <h2 id="crawler-title">采集运行监控</h2>
        <span>查看哪些网页登录档案正在使用、哪些运行失败，以及失败发生的时间和原因。</span>
      </div>
      <button type="button" :disabled="saving" @click="confirming = true">回收过期运行</button>
    </header>
    <UiStatePanel
      v-if="state !== 'ready'"
      :kind="state"
      :request-id="requestId"
      @primary="load"
    /><template v-else
      ><div class="crawler-metrics">
        <article>
          <small>浏览器档案</small><strong>{{ profiles.length }}</strong
          ><span>仅展示元数据</span>
        </article>
        <article>
          <small>活动租约</small><strong>{{ activeLeases.length }}</strong
          ><span>同一档案仅一个</span>
        </article>
        <article>
          <small>异常运行</small><strong>{{ blockedRuns.length }}</strong
          ><span>重复执行风险 {{ duplicateRiskRuns.length }} 条</span>
        </article>
        <article>
          <small>过期占用</small><strong>{{ expiredLeaseRisks.length }}</strong
          ><span>过期租约形成的僵尸风险</span>
        </article>
      </div>
      <section class="crawler-leases">
        <header>
          <h3>档案与租约</h3>
          <span>{{ message || "租约令牌与凭证明文从不返回页面" }}</span>
        </header>
        <div class="crawler-profile-grid">
          <article
            v-for="profile in profiles"
            :key="profile.id"
            :data-leased="Boolean(profile.lease)"
          >
            <i></i>
            <div>
              <strong>{{ profile.name }}</strong
              ><small>{{ profile.provider_name }} · {{ profile.code }}</small>
            </div>
            <span>{{
              profile.lease
                ? leaseExpired(profile)
                  ? "过期占用"
                  : "使用中"
                : profile.status === "active"
                  ? "可用"
                  : "已停用"
            }}</span>
            <dl v-if="profile.lease">
              <div>
                <dt>占用实例</dt>
                <dd>{{ profile.lease.lease_owner }}</dd>
              </div>
              <div>
                <dt>占用来源</dt>
                <dd>{{ profile.provider_name }} · {{ profile.target_domain }}</dd>
              </div>
              <div>
                <dt>到期</dt>
                <dd>{{ time(profile.lease.expires_at) }}</dd>
              </div>
            </dl>
            <p v-if="profile.lease && leaseExpired(profile)" class="crawler-lease-warning">
              租约已过期，存在僵尸占用风险；先核对占用实例，再使用“回收过期运行”。
            </p>
            <p>
              登录状态：{{
                profile.login_status === "valid"
                  ? "有效"
                  : profile.login_status === "expired"
                    ? "已失效"
                    : "未设置检测期限"
              }}
              · 绑定站点：{{ profile.target_domain }}
            </p>
            <p>登录档案到期预警：{{ expiryForecast(profile) }}</p>
            <p v-if="profile.last_failure">
              最近失败：{{ errorText(profile.last_failure.error_code) }} ·
              {{ time(profile.last_failure.occurred_at) }}
            </p>
            <RouterLink
              v-if="profile.login_status === 'expired'"
              to="/platform-admin/collection?status=blocked_login"
              >处理续期任务</RouterLink
            >
          </article>
        </div>
      </section>
      <section class="crawler-runs">
        <header>
          <div>
            <h3>最近运行</h3>
            <span>每次运行、拦截和失败都保留可追查的关联编号</span>
          </div>
          <div>
            <input
              v-model="query"
              aria-label="搜索运行"
              placeholder="运行 ID / 错误码 / trace_id"
            /><select v-model="status" aria-label="运行状态">
              <option value="all">全部状态</option>
              <option value="running">运行中</option>
              <option value="succeeded">成功</option>
              <option value="succeeded_empty">成功但无结果</option>
              <option value="blocked">已拦截</option>
              <option value="failed">失败</option>
              <option value="timed_out">已超时</option>
              <option value="cancelled">已取消</option>
            </select>
          </div>
        </header>
        <ResponsiveDataView
          :rows="filtered"
          :row-key="(item) => item.id"
          title="最近采集运行"
          :detail-title="(item) => `${statusText(item.status)} · ${time(item.started_at)}`"
        >
          <template #desktop>
            <table>
              <thead>
                <tr>
                  <th>运行</th>
                  <th>范围</th>
                  <th>状态</th>
                  <th>采集量</th>
                  <th>耗时</th>
                  <th>开始时间</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in filtered" :key="item.id">
                  <td>
                    <strong>{{ time(item.started_at) }}</strong
                    ><small>{{ errorText(item.error_code) }}</small>
                  </td>
                  <td><span>已绑定组织与工作区</span></td>
                  <td>
                    <b :data-status="item.status">{{ statusText(item.status) }}</b>
                  </td>
                  <td>
                    {{ item.item_count }} 条<small
                      >{{ item.page_count }} 页 · {{ item.detail_count }} 详情</small
                    >
                  </td>
                  <td>
                    {{ item.duration_ms === null ? "—" : `${item.duration_ms} 毫秒` }}
                  </td>
                  <td>{{ time(item.started_at) }}</td>
                </tr>
                <tr v-if="!filtered.length">
                  <td colspan="6">当前筛选没有运行记录。</td>
                </tr>
              </tbody>
            </table>
          </template>
          <template #summary="{ row }">
            <span class="responsive-record-summary">
              <strong>{{ statusText(row.status) }} · {{ row.item_count }} 条</strong>
              <small>{{ errorText(row.error_code) }} · {{ time(row.started_at) }}</small>
            </span>
          </template>
          <template #detail="{ row }">
            <dl>
              <div>
                <dt>状态</dt>
                <dd>{{ statusText(row.status) }}</dd>
              </div>
              <div>
                <dt>采集量</dt>
                <dd>
                  {{ row.item_count }} 条 · {{ row.page_count }} 页 · {{ row.detail_count }} 个详情
                </dd>
              </div>
              <div>
                <dt>耗时</dt>
                <dd>{{ row.duration_ms === null ? "—" : `${row.duration_ms} 毫秒` }}</dd>
              </div>
              <div>
                <dt>开始时间</dt>
                <dd>{{ time(row.started_at) }}</dd>
              </div>
              <div>
                <dt>结束时间</dt>
                <dd>{{ time(row.finished_at) }}</dd>
              </div>
              <div>
                <dt>重复执行风险</dt>
                <dd>
                  {{
                    row.error_code === "lease_expired"
                      ? "租约过期前可能已在目标站执行；重放前核对证据"
                      : "未发现租约过期信号"
                  }}
                </dd>
              </div>
            </dl>
            <details>
              <summary>技术详情</summary>
              <dl>
                <div>
                  <dt>运行 ID</dt>
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
                  <dt>错误码</dt>
                  <dd>{{ row.error_code || "—" }}</dd>
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
      </section></template
    ><ConfirmDialog
      :open="confirming"
      title="回收所有已过期租约？"
      description="仅回收服务端确认已经过期的档案租约，并把对应运行标记为超时。"
      impact="不会终止有效租约，不会删除运行历史、浏览器档案或凭证。"
      confirm-label="确认回收"
      confirmation-text="确认回收"
      @cancel="confirming = false"
      @confirm="recover"
    />
  </section>
</template>
