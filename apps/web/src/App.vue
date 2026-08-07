<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import VerificationFramework from './components/VerificationFramework.vue';
import ConfigBoundary from './components/ConfigBoundary.vue';
import { publicConfig } from './config';

type ViewState = 'loading' | 'ready' | 'error';

interface LiveResponse {
  data: {
    status: 'ok';
    service: string;
    version: string;
    build_sha: string;
  };
  meta: { observed_at: string };
  request_id: string;
  trace_id: string;
}

const state = ref<ViewState>('loading');
const health = ref<LiveResponse | null>(null);
const errorRequestId = ref('');
const apiBase = publicConfig.apiBaseUrl;
const selectedView = new URLSearchParams(window.location.search).get('view');
const isVerificationView = selectedView === 'verification';
const isConfigView = selectedView === 'config';

const statusCopy = computed(() => {
  if (state.value === 'loading') return '正在确认 API 进程状态';
  if (state.value === 'ready') return 'API 进程运行正常';
  return '暂时无法确认 API 进程状态';
});

async function loadHealth() {
  state.value = 'loading';
  const clientRequestId = crypto.randomUUID();
  try {
    const response = await fetch(`${apiBase}/health/live`, {
      headers: { accept: 'application/json', 'x-request-id': clientRequestId },
    });
    const body = (await response.json()) as LiveResponse;
    if (!response.ok || body.data?.status !== 'ok') throw new Error('health_not_ready');
    health.value = body;
    state.value = 'ready';
  } catch {
    health.value = null;
    errorRequestId.value = clientRequestId;
    state.value = 'error';
  }
}

onMounted(() => {
  if (!isVerificationView && !isConfigView) void loadHealth();
});
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar" aria-label="基础导航">
      <a class="brand" href="/" aria-label="ScoutOps 首页">
        <span class="brand-mark">S</span>
        <span>ScoutOps</span>
      </a>
      <nav>
        <a class="nav-link" :class="{ 'nav-link--active': !isVerificationView && !isConfigView }" href="/">运行状态</a>
        <a class="nav-link" :class="{ 'nav-link--active': isVerificationView }" href="/?view=verification">自动验收</a>
        <a class="nav-link" :class="{ 'nav-link--active': isConfigView }" href="/?view=config">配置边界</a>
      </nav>
      <p class="phase-label">P00 · 基础框架</p>
    </aside>

    <main v-if="!isVerificationView && !isConfigView" id="runtime" class="content">
      <header class="topbar">
        <div>
          <p class="eyebrow">FOUNDATION / M00-01</p>
          <h1>运行基座</h1>
        </div>
        <span class="environment">本地开发</span>
      </header>

      <section class="status-card" :data-state="state" aria-live="polite">
        <div class="status-heading">
          <span class="status-dot" aria-hidden="true"></span>
          <div>
            <p class="status-kicker">API LIVENESS</p>
            <h2>{{ statusCopy }}</h2>
          </div>
        </div>

        <div v-if="state === 'loading'" class="state-panel" data-testid="loading-state">
          <span class="spinner" aria-hidden="true"></span>
          <p>正在读取 `/api/v1/health/live`，不会访问数据库、Redis 或任何密钥。</p>
        </div>

        <dl v-else-if="state === 'ready' && health" class="metric-grid" data-testid="ready-state">
          <div><dt>服务</dt><dd>{{ health.data.service }}</dd></div>
          <div><dt>版本</dt><dd>{{ health.data.version }}</dd></div>
          <div><dt>构建</dt><dd>{{ health.data.build_sha }}</dd></div>
          <div><dt>观测时间</dt><dd>{{ health.meta.observed_at }}</dd></div>
        </dl>

        <div v-else class="state-panel state-panel--error" data-testid="error-state">
          <div>
            <strong>连接失败</strong>
            <p>确认本机 Node API 已启动后重试。错误不会被伪装为可用。</p>
            <small>请求标识：{{ errorRequestId }}</small>
          </div>
          <button type="button" @click="loadHealth">重新检查</button>
        </div>
      </section>

      <section class="runtime-grid" aria-label="运行边界">
        <article>
          <span>01</span><h3>Node API</h3><p>仅监听本机端口，由宝塔网站反向代理。</p>
        </article>
        <article>
          <span>02</span><h3>Node Worker</h3><p>异步工作独立运行，保留组织范围与 trace_id。</p>
        </article>
        <article>
          <span>03</span><h3>Python Crawler</h3><p>采集任务与用户请求进程分离，不绕过来源限制。</p>
        </article>
      </section>
    </main>
    <main v-else id="verification" class="content">
      <VerificationFramework v-if="isVerificationView" />
      <ConfigBoundary v-else :api-base-url="apiBase" />
    </main>
  </div>
</template>
