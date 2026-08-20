<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ApiClientError, createApiClient } from "../api-client";
import ResponsiveDataView from "./ResponsiveDataView.vue";
import UiStatePanel from "./UiStatePanel.vue";
import "../provider-adapters.css";
import "../provider-adapters-contrast.css";
type State = "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
interface AdapterSummary {
  id: string;
  code: string;
  name: string;
  access_mode: string;
  provider_status: string;
  adapter_registered: boolean;
  adapter_version: string | null;
  health_status: "unknown" | "ready" | "degraded" | "blocked";
  last_checked_at: string | null;
  last_latency_ms: number | null;
  last_error_code: string | null;
  consecutive_failures: number;
  version: number;
  updated_at: string;
}
const props = defineProps<{ apiBaseUrl: string }>(),
  request = createApiClient(props.apiBaseUrl),
  state = ref<State>("loading"),
  items = ref<AdapterSummary[]>([]),
  requestId = ref(""),
  mode = ref("all"),
  health = ref("all"),
  probing = ref<string | null>(null),
  message = ref("");
const failure = (status: number): State =>
  status === 401
    ? "expired"
    : status === 403
      ? "forbidden"
      : [408, 425, 429, 502, 503, 504].includes(status)
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
  healthText = (value: AdapterSummary["health_status"]) =>
    ({ unknown: "待检查", ready: "健康", degraded: "降级", blocked: "受阻" })[value],
  errorText = (value: string | null) =>
    value === "adapter_not_registered"
      ? "尚未登记适配器"
      : value
        ? "检查失败，详见技术详情"
        : "无错误";
const filtered = computed(() =>
    items.value.filter(
      (item) =>
        (mode.value === "all" || item.access_mode === mode.value) &&
        (health.value === "all" || item.health_status === health.value),
    ),
  ),
  registered = computed(() => items.value.filter((item) => item.adapter_registered).length);
async function load() {
  state.value = "loading";
  message.value = "";
  try {
    const response = await request<AdapterSummary[]>("/platform/provider-adapters");
    requestId.value = response.request_id;
    items.value = response.data;
    state.value = items.value.length ? "ready" : "empty";
  } catch (error) {
    const apiError = error instanceof ApiClientError ? error : null;
    requestId.value = apiError?.requestId ?? "";
    state.value = apiError ? failure(apiError.status) : "blocked";
  }
}
async function probe(item: AdapterSummary) {
  probing.value = item.id;
  message.value = "";
  try {
    const response = await request<AdapterSummary>(
      `/platform/provider-adapters/${item.id}/health-check`,
      { method: "POST" },
    );
    requestId.value = response.request_id;
    items.value = items.value.map((current) => (current.id === item.id ? response.data : current));
    message.value =
      response.data.health_status === "ready"
        ? `${item.name} 健康检查通过`
        : `${item.name} 已记录受阻原因`;
  } catch (error) {
    const apiError = error instanceof ApiClientError ? error : null;
    requestId.value = apiError?.requestId ?? "";
    message.value = apiError?.actionHint ?? "依赖不可用，未伪造健康结果";
  } finally {
    probing.value = null;
  }
}
onMounted(load);
</script>
<template>
  <section class="adapter-center">
    <header class="adapter-heading">
      <div>
        <p>来源适配器运行状态</p>
        <h2>适配器运行时</h2>
        <span>统一采集、标准化与健康检查合同；真实实现按来源代码注册。</span>
      </div>
      <a href="/platform-admin/providers">返回来源定义</a>
    </header>
    <UiStatePanel
      v-if="!['ready', 'empty'].includes(state)"
      :kind="state"
      :request-id="requestId"
      @primary="load"
    />
    <section v-else>
      <div class="adapter-metrics">
        <article>
          <small>来源总数</small><strong>{{ items.length }}</strong
          ><span>平台全局技术合同</span>
        </article>
        <article>
          <small>已注册</small><strong>{{ registered }}</strong
          ><span>未注册即失败关闭</span>
        </article>
        <article>
          <small>健康</small
          ><strong>{{ items.filter((x) => x.health_status === "ready").length }}</strong
          ><span>仅真实探针可变为 ready</span>
        </article>
      </div>
      <div class="adapter-toolbar">
        <label
          >接入模式<select v-model="mode">
            <option value="all">全部模式</option>
            <option
              v-for="value in [
                'public_page',
                'public_rss',
                'authenticated_browser',
                'import',
                'manual',
              ]"
              :key="value"
              :value="value"
            >
              {{ accessModeText(value) }}
            </option>
          </select></label
        ><label
          >健康状态<select v-model="health">
            <option value="all">全部状态</option>
            <option value="unknown">待检查</option>
            <option value="ready">健康</option>
            <option value="degraded">降级</option>
            <option value="blocked">受阻</option>
          </select></label
        ><span>{{ filtered.length }} 个结果</span>
      </div>
      <section v-if="state === 'empty'" class="adapter-empty">
        <h3>还没有来源可绑定适配器</h3>
        <p>先在来源注册中心登记技术合同；不会创建模拟来源。</p>
        <a href="/platform-admin/providers">登记来源</a>
      </section>
      <section v-else-if="!filtered.length" class="adapter-empty">
        <h3>没有符合筛选条件的适配器</h3>
        <p>调整模式或健康状态筛选，不会扩大查询范围。</p>
        <button
          type="button"
          @click="
            mode = 'all';
            health = 'all';
          "
        >
          清除筛选
        </button>
      </section>
      <ResponsiveDataView
        v-else
        :rows="filtered"
        :row-key="(item) => item.id"
        title="来源适配器"
        :detail-title="(item) => item.name"
      >
        <template #desktop>
          <div class="adapter-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>来源</th>
                  <th>运行方式</th>
                  <th>实现</th>
                  <th>健康</th>
                  <th>最近检查</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in filtered" :key="item.id">
                  <td>
                    <strong>{{ item.name }}</strong
                    ><small>{{ providerStatusText(item.provider_status) }}</small>
                  </td>
                  <td>
                    <span>{{ accessModeText(item.access_mode) }}</span
                    ><small>采集 · 标准化 · 健康检查</small>
                  </td>
                  <td>
                    <b :data-registered="item.adapter_registered">{{
                      item.adapter_registered ? "已登记" : "待登记"
                    }}</b>
                    <small>{{ item.adapter_version ?? "等待真实适配器" }}</small>
                  </td>
                  <td>
                    <b :data-health="item.health_status">{{ healthText(item.health_status) }}</b>
                    <small v-if="item.last_error_code"
                      >{{ errorText(item.last_error_code) }} · 连续
                      {{ item.consecutive_failures }} 次</small
                    >
                  </td>
                  <td>
                    {{
                      item.last_checked_at
                        ? item.last_checked_at.slice(0, 19).replace("T", " ")
                        : "尚未检查"
                    }}
                    <small v-if="item.last_latency_ms !== null"
                      >{{ item.last_latency_ms }} ms · 版本 {{ item.version }}</small
                    >
                  </td>
                  <td>
                    <button type="button" :disabled="probing === item.id" @click="probe(item)">
                      {{ probing === item.id ? "检查中…" : "健康检查" }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
        <template #summary="{ row }">
          <span class="responsive-record-summary">
            <strong>{{ row.name }} · {{ healthText(row.health_status) }}</strong>
            <small
              >{{ accessModeText(row.access_mode) }} ·
              {{ row.adapter_registered ? "已登记" : "待登记" }}</small
            >
          </span>
        </template>
        <template #detail="{ row }">
          <dl>
            <div>
              <dt>运行方式</dt>
              <dd>{{ accessModeText(row.access_mode) }}</dd>
            </div>
            <div>
              <dt>来源状态</dt>
              <dd>{{ providerStatusText(row.provider_status) }}</dd>
            </div>
            <div>
              <dt>适配器</dt>
              <dd>{{ row.adapter_registered ? "已登记" : "待登记" }}</dd>
            </div>
            <div>
              <dt>健康状态</dt>
              <dd>{{ healthText(row.health_status) }}</dd>
            </div>
            <div>
              <dt>最近检查</dt>
              <dd>
                {{
                  row.last_checked_at
                    ? row.last_checked_at.slice(0, 19).replace("T", " ")
                    : "尚未检查"
                }}
              </dd>
            </div>
            <div>
              <dt>检查结果</dt>
              <dd>{{ errorText(row.last_error_code) }}</dd>
            </div>
          </dl>
          <button type="button" :disabled="probing === row.id" @click="probe(row)">
            {{ probing === row.id ? "检查中…" : "执行健康检查" }}
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
                <dt>接入模式代码</dt>
                <dd>{{ row.access_mode }}</dd>
              </div>
              <div>
                <dt>适配器版本</dt>
                <dd>{{ row.adapter_version ?? "—" }}</dd>
              </div>
              <div>
                <dt>错误码</dt>
                <dd>{{ row.last_error_code ?? "—" }}</dd>
              </div>
            </dl>
          </details>
        </template>
      </ResponsiveDataView>
      <div v-if="message" class="adapter-message" role="status">
        <span>{{ message }}</span>
        <details v-if="requestId">
          <summary>技术详情</summary>
          <code>{{ requestId }}</code>
        </details>
      </div>
      <aside class="adapter-boundary">
        <strong>运行边界</strong>
        <p>
          API、RSS、公开页、授权页、导入与手工来源共用同一适配器合同；请求字段来自已注册来源定义，任务租约与凭证使用均由后端控制。
        </p>
      </aside>
    </section>
  </section>
</template>
