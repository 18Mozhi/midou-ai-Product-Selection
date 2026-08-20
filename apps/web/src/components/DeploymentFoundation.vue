<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { createApiClient } from "../api-client";

type State = "checking" | "healthy" | "blocked" | "rollback";

interface ReadyEnvelope {
  data?: {
    status?: string;
    dependencies?: { mysql?: string; redis?: string };
  };
  meta?: { observed_at?: string };
}

interface VersionEnvelope {
  data?: {
    version?: string;
    build_sha?: string;
    config_fingerprint?: string;
  };
}

const props = defineProps<{ apiBaseUrl: string }>();
const request = createApiClient(props.apiBaseUrl);
const requested = new URLSearchParams(window.location.search).get("state");
const forcedState = requested === "blocked" || requested === "rollback" ? requested : null;
const state = ref<State>(forcedState ?? "checking");
const version = ref<VersionEnvelope["data"] | null>(null);
const observedAt = ref("");
const requestId = ref("");

const copy = computed(
  () =>
    ({
      checking: [
        "检查中 · 生产核验",
        "正在读取 S0 生产状态",
        "同时核验后端就绪状态与脱敏发布身份；不会从浏览器读取宝塔凭据或运行配置。",
      ],
      healthy: [
        "健康 · 已部署",
        "宝塔 S0 同步服务健康",
        "网站与后端已由宝塔管理，数据库与缓存服务就绪检查通过，发布身份可核验。",
      ],
      blocked: [
        "已阻断 · 依赖受阻",
        "生产同步服务暂不可用",
        "未获得完整 readiness 或发布身份；页面保持阻塞，不把进程存活误报为生产健康。",
      ],
      rollback: [
        "回滚 · 恢复模式",
        "回到上一稳定构建",
        "在宝塔切换稳定发布与受限环境，按迁移说明恢复后重新核验 live、ready、版本和异步心跳。",
      ],
    })[state.value],
);

const environment = computed(() => {
  if (state.value === "healthy") return "S0 单机 · 已部署";
  if (state.value === "blocked") return "S0 单机 · 已阻塞";
  if (state.value === "rollback") return "S0 单机 · 恢复中";
  return "S0 单机 · 核验中";
});

const buildIdentity = computed(() => version.value?.build_sha?.slice(0, 12) || "不可用");
const configIdentity = computed(() => version.value?.config_fingerprint?.slice(0, 12) || "不可用");

async function checkProduction() {
  state.value = "checking";
  version.value = null;
  observedAt.value = "";
  const id = crypto.randomUUID();
  requestId.value = id;
  try {
    const [readyResponse, versionResponse] = await Promise.all([
      request<NonNullable<ReadyEnvelope["data"]>>("/health/ready", {
        requestId: id,
      }),
      request<NonNullable<VersionEnvelope["data"]>>("/health/version", {
        requestId: id,
      }),
    ]);
    const dependencies = readyResponse.data.dependencies;
    const release = versionResponse.data;
    if (
      readyResponse.data.status !== "ready" ||
      dependencies?.mysql !== "available" ||
      dependencies.redis !== "available" ||
      !release?.version ||
      !release.build_sha ||
      !/^[a-f0-9]{64}$/.test(release.config_fingerprint ?? "")
    ) {
      throw new Error("production_not_ready");
    }
    version.value = release;
    observedAt.value = (readyResponse.meta as ReadyEnvelope["meta"] | undefined)?.observed_at ?? "";
    state.value = "healthy";
  } catch {
    state.value = "blocked";
  }
}

onMounted(() => {
  if (!forcedState) void checkProduction();
});
</script>

<template>
  <header class="topbar">
    <div>
      <p class="eyebrow">生产环境</p>
      <h1>宝塔单机生产部署</h1>
    </div>
    <span class="environment">{{ environment }}</span>
  </header>

  <section
    class="status-card"
    :data-state="state === 'healthy' ? 'ready' : state === 'checking' ? 'loading' : 'error'"
    aria-live="polite"
  >
    <div class="status-heading">
      <span class="status-dot" aria-hidden="true"></span>
      <div>
        <p class="status-kicker">{{ copy[0] }}</p>
        <h2>{{ copy[1] }}</h2>
      </div>
    </div>

    <div v-if="state === 'checking'" class="state-panel" data-testid="deployment-checking">
      <span class="spinner" aria-hidden="true"></span>
      <p>{{ copy[2] }}</p>
    </div>
    <dl v-else-if="state === 'healthy'" class="metric-grid" data-testid="deployment-healthy">
      <div>
        <dt>应用版本</dt>
        <dd>{{ version?.version }}</dd>
      </div>
      <div>
        <dt>构建身份</dt>
        <dd>{{ buildIdentity }}</dd>
      </div>
      <div>
        <dt>配置指纹</dt>
        <dd>{{ configIdentity }}</dd>
      </div>
      <div>
        <dt>观测时间</dt>
        <dd>{{ observedAt || "已核验" }}</dd>
      </div>
    </dl>
    <div
      v-else
      class="state-panel state-panel--error redis-state"
      :data-testid="state === 'rollback' ? 'deployment-rollback' : 'deployment-blocked'"
    >
      <div>
        <p>{{ copy[2] }}</p>
        <small v-if="state === 'blocked'">请求标识：{{ requestId || "状态演练" }}</small>
      </div>
      <div class="state-actions">
        <button v-if="state !== 'rollback'" type="button" @click="state = 'rollback'">
          回滚模式
        </button>
        <button type="button" @click="checkProduction">
          {{ state === "rollback" ? "恢复实时状态" : "重新核验" }}
        </button>
      </div>
    </div>
  </section>

  <section class="verification-grid config-grid" aria-label="S0 生产边界">
    <article>
      <span
        class="state-label"
        :class="state === 'healthy' ? 'state-label--passed' : 'state-label--blocked'"
        >网站与后端</span
      >
      <h3>网站与同步服务</h3>
      <p>加密站点反向代理本机后端；存活、就绪与版本身份分离核验。</p>
    </article>
    <article>
      <span class="state-label state-label--blocked">宝塔心跳</span>
      <h3>任务处理器与采集执行器</h3>
      <p>异步进程由宝塔结构化心跳监测；页面不会把后端就绪状态 当成异步进程健康。</p>
    </article>
    <article>
      <span
        class="state-label"
        :class="state === 'healthy' ? 'state-label--passed' : 'state-label--blocked'"
        >数据库与缓存服务</span
      >
      <h3>本机依赖</h3>
      <p>数据库 5.7 项目专用库与本机缓存服务必须同时通过就绪检查。</p>
    </article>
    <article>
      <span class="state-label state-label--blocked">恢复演练</span>
      <h3>备份与恢复</h3>
      <p>备份任务由宝塔管理；仅展示当前主机内的加密副本与隔离恢复，不声明异地灾备。</p>
    </article>
  </section>

  <section class="verification-footnote">
    <strong>容量声明</strong>
    <p>当前只运行惠州这一台服务器；不启用负载均衡、备用服务器或多节点。</p>
  </section>
</template>
