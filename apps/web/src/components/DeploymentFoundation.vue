<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

type State = 'checking' | 'healthy' | 'blocked' | 'rollback';

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
const requested = new URLSearchParams(window.location.search).get('state');
const forcedState = requested === 'blocked' || requested === 'rollback' ? requested : null;
const state = ref<State>(forcedState ?? 'checking');
const version = ref<VersionEnvelope['data'] | null>(null);
const observedAt = ref('');
const requestId = ref('');

const copy = computed(() => ({
  checking: ['CHECKING · 生产核验', '正在读取 S0 生产状态', '同时核验 API readiness 与脱敏发布身份；不会从浏览器读取宝塔凭据或运行配置。'],
  healthy: ['HEALTHY · 已部署', '宝塔 S0 同步服务健康', '网站与 API 已由宝塔管理，MySQL 与 Redis readiness 通过，发布身份可核验。'],
  blocked: ['BLOCKED · 依赖受阻', '生产同步服务暂不可用', '未获得完整 readiness 或发布身份；页面保持阻塞，不把进程存活误报为生产健康。'],
  rollback: ['ROLLBACK · 恢复模式', '回到上一稳定构建', '在宝塔切换稳定发布与受限环境，按迁移说明恢复后重新核验 live、ready、版本和异步心跳。'],
}[state.value]));

const environment = computed(() => {
  if (state.value === 'healthy') return 'S0 单机 · 已部署';
  if (state.value === 'blocked') return 'S0 单机 · 已阻塞';
  if (state.value === 'rollback') return 'S0 单机 · 恢复中';
  return 'S0 单机 · 核验中';
});

const buildIdentity = computed(() => version.value?.build_sha?.slice(0, 12) || '不可用');
const configIdentity = computed(() => version.value?.config_fingerprint?.slice(0, 12) || '不可用');

async function checkProduction() {
  state.value = 'checking';
  version.value = null;
  observedAt.value = '';
  const id = crypto.randomUUID();
  requestId.value = id;
  try {
    const headers = { accept: 'application/json', 'x-request-id': id };
    const [readyResponse, versionResponse] = await Promise.all([
      fetch(`${props.apiBaseUrl}/health/ready`, { headers }),
      fetch(`${props.apiBaseUrl}/health/version`, { headers }),
    ]);
    const readyBody = await readyResponse.json() as ReadyEnvelope;
    const versionBody = await versionResponse.json() as VersionEnvelope;
    const dependencies = readyBody.data?.dependencies;
    const release = versionBody.data;
    if (!readyResponse.ok || !versionResponse.ok
      || readyBody.data?.status !== 'ready'
      || dependencies?.mysql !== 'available'
      || dependencies.redis !== 'available'
      || !release?.version
      || !release.build_sha
      || !/^[a-f0-9]{64}$/.test(release.config_fingerprint ?? '')) {
      throw new Error('production_not_ready');
    }
    version.value = release;
    observedAt.value = readyBody.meta?.observed_at ?? '';
    state.value = 'healthy';
  } catch {
    state.value = 'blocked';
  }
}

onMounted(() => {
  if (!forcedState) void checkProduction();
});
</script>

<template>
  <header class="topbar">
    <div>
      <p class="eyebrow">PRODUCTION / M07-03</p>
      <h1>宝塔 S0 生产部署</h1>
    </div>
    <span class="environment">{{ environment }}</span>
  </header>

  <section class="status-card" :data-state="state === 'healthy' ? 'ready' : state === 'checking' ? 'loading' : 'error'" aria-live="polite">
    <div class="status-heading">
      <span class="status-dot" aria-hidden="true"></span>
      <div><p class="status-kicker">{{ copy[0] }}</p><h2>{{ copy[1] }}</h2></div>
    </div>

    <div v-if="state === 'checking'" class="state-panel" data-testid="deployment-checking">
      <span class="spinner" aria-hidden="true"></span><p>{{ copy[2] }}</p>
    </div>
    <dl v-else-if="state === 'healthy'" class="metric-grid" data-testid="deployment-healthy">
      <div><dt>应用版本</dt><dd>{{ version?.version }}</dd></div>
      <div><dt>构建身份</dt><dd>{{ buildIdentity }}</dd></div>
      <div><dt>配置指纹</dt><dd>{{ configIdentity }}</dd></div>
      <div><dt>观测时间</dt><dd>{{ observedAt || '已核验' }}</dd></div>
    </dl>
    <div v-else class="state-panel state-panel--error redis-state" :data-testid="state === 'rollback' ? 'deployment-rollback' : 'deployment-blocked'">
      <div><p>{{ copy[2] }}</p><small v-if="state === 'blocked'">请求标识：{{ requestId || '状态演练' }}</small></div>
      <div class="state-actions">
        <button v-if="state !== 'rollback'" type="button" @click="state = 'rollback'">回滚模式</button>
        <button type="button" @click="checkProduction">{{ state === 'rollback' ? '恢复实时状态' : '重新核验' }}</button>
      </div>
    </div>
  </section>

  <section class="verification-grid config-grid" aria-label="S0 生产边界">
    <article>
      <span class="state-label" :class="state === 'healthy' ? 'state-label--passed' : 'state-label--blocked'">SITE + API</span>
      <h3>网站与同步服务</h3><p>HTTPS 站点反代本机 API；live、ready 与版本身份分离核验。</p>
    </article>
    <article>
      <span class="state-label state-label--blocked">BAOTA HEARTBEAT</span>
      <h3>Worker 与 Crawler</h3><p>异步进程由宝塔结构化心跳监测；页面不会把 API readiness 当成异步进程健康。</p>
    </article>
    <article>
      <span class="state-label" :class="state === 'healthy' ? 'state-label--passed' : 'state-label--blocked'">MYSQL + REDIS</span>
      <h3>本机依赖</h3><p>MySQL 5.7/product_scout/utf8mb4 与本机 Redis 必须同时通过 readiness。</p>
    </article>
    <article>
      <span class="state-label state-label--blocked">RESTORE DRILL · M07-04</span>
      <h3>备份与恢复</h3><p>备份任务已由宝塔管理；恢复演练及深圳恢复证据在 M07-04 验收后签发。</p>
    </article>
  </section>

  <section class="verification-footnote">
    <strong>容量声明</strong>
    <p>当前仅为 S0 单机 100 用户、5–20 并发业务用户基线；P08 前不宣称多节点或 10,000 用户能力。</p>
  </section>
</template>
