<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import UiStatePanel from "./UiStatePanel.vue";
import "../provider-adapters.css";
import "../provider-adapters-contrast.css";
type State =
  "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
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
const filtered = computed(() =>
    items.value.filter(
      (item) =>
        (mode.value === "all" || item.access_mode === mode.value) &&
        (health.value === "all" || item.health_status === health.value),
    ),
  ),
  registered = computed(
    () => items.value.filter((item) => item.adapter_registered).length,
  );
async function load() {
  state.value = "loading";
  message.value = "";
  try {
    const response = await fetch(
        `${props.apiBaseUrl}/platform/provider-adapters`,
        { credentials: "include", headers: { accept: "application/json" } },
      ),
      body = await response.json().catch(() => null);
    requestId.value = body?.request_id ?? "";
    if (!response.ok) {
      state.value = failure(response.status);
      return;
    }
    items.value = body.data;
    state.value = items.value.length ? "ready" : "empty";
  } catch {
    state.value = "blocked";
  }
}
async function probe(item: AdapterSummary) {
  probing.value = item.id;
  message.value = "";
  try {
    const response = await fetch(
        `${props.apiBaseUrl}/platform/provider-adapters/${item.id}/health-check`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            "idempotency-key": crypto.randomUUID(),
          },
        },
      ),
      body = await response.json().catch(() => null);
    requestId.value = body?.request_id ?? "";
    if (!response.ok) {
      message.value = body?.error?.action_hint ?? "健康检查未完成";
      return;
    }
    items.value = items.value.map((current) =>
      current.id === item.id ? body.data : current,
    );
    message.value =
      body.data.health_status === "ready"
        ? `${item.name} 健康检查通过`
        : `${item.name} 已记录受阻原因`;
  } catch {
    message.value = "依赖不可用，未伪造健康结果";
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
        <p>PROVIDER ADAPTER RUNTIME</p>
        <h2>适配器运行时</h2>
        <span
          >统一 collect · normalize · healthCheck 合同；真实实现按 Provider code
          注册。</span
        >
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
          <small>PROVIDERS</small><strong>{{ items.length }}</strong
          ><span>平台全局技术合同</span>
        </article>
        <article>
          <small>REGISTERED</small><strong>{{ registered }}</strong
          ><span>未注册即失败关闭</span>
        </article>
        <article>
          <small>HEALTHY</small
          ><strong>{{
            items.filter((x) => x.health_status === "ready").length
          }}</strong
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
            >
              {{ value }}
            </option>
          </select></label
        ><label
          >健康状态<select v-model="health">
            <option value="all">全部状态</option>
            <option
              v-for="value in ['unknown', 'ready', 'degraded', 'blocked']"
              :key="value"
            >
              {{ value }}
            </option>
          </select></label
        ><span>{{ filtered.length }} 个结果</span>
      </div>
      <section v-if="state === 'empty'" class="adapter-empty">
        <h3>还没有来源可绑定适配器</h3>
        <p>先在来源注册中心登记技术合同；不会创建模拟 Provider。</p>
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
      <div v-else class="adapter-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>运行合同</th>
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
                ><code>{{ item.code }}</code
                ><small>{{ item.provider_status }}</small>
              </td>
              <td>
                <span>{{ item.access_mode }}</span
                ><small>collect · normalize · healthCheck</small>
              </td>
              <td>
                <b :data-registered="item.adapter_registered">{{
                  item.adapter_registered ? "registered" : "not registered"
                }}</b
                ><small>{{ item.adapter_version ?? "等待真实适配器" }}</small>
              </td>
              <td>
                <b :data-health="item.health_status">{{ item.health_status }}</b
                ><small v-if="item.last_error_code"
                  >{{ item.last_error_code }} · 连续
                  {{ item.consecutive_failures }} 次</small
                >
              </td>
              <td>
                {{
                  item.last_checked_at
                    ? item.last_checked_at.slice(0, 19).replace("T", " ")
                    : "尚未检查"
                }}<small v-if="item.last_latency_ms !== null"
                  >{{ item.last_latency_ms }} ms · v{{ item.version }}</small
                >
              </td>
              <td>
                <button
                  type="button"
                  :disabled="probing === item.id"
                  @click="probe(item)"
                >
                  {{ probing === item.id ? "检查中…" : "健康检查" }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="message" class="adapter-message" role="status">
        {{ message }} <code v-if="requestId">{{ requestId }}</code>
      </p>
      <aside class="adapter-boundary">
        <strong>运行边界</strong>
        <p>
          API、RSS、公开页、授权页、导入与手工来源共用同一适配器合同；请求字段来自已注册来源定义，任务租约与凭证使用均由后端控制。
        </p>
      </aside>
    </section>
  </section>
</template>
