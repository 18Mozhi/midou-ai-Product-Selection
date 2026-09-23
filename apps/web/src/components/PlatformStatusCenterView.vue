<script setup lang="ts">
import type { RealtimeClientMetrics } from "../realtime-client-metrics";
import PlatformStatusWorkspace from "./PlatformStatusWorkspace.vue";

defineProps<{
  data: any;
  warningCount: number;
  observedAt: string;
  topologyLanes: any[];
  propagationWarnings: any[];
  realtimeMetrics: RealtimeClientMetrics;
  realtimeReconnectRate: string;
  summaryEntries: Array<[string, unknown]>;
  stateName: (value: unknown) => string;
  summaryName: (key: string) => string;
  when: (value: unknown) => string;
}>();
</script>

<template>
  <PlatformStatusWorkspace :warning-count="warningCount" :observed-at="observedAt">
    <template #dependencies>
      <section class="platform-service-topology">
        <header class="platform-topology-header">
          <div>
            <h3>依赖关系与最新观测</h3>
            <span>状态来自最新运行观测；5 分钟外的观测标记为已过期。</span>
          </div>
          <RouterLink to="/platform-admin/topology">查看实时拓扑</RouterLink>
        </header>
        <div class="platform-topology-lanes">
          <section v-for="lane in topologyLanes" :key="lane.code">
            <h4>
              <span>{{ lane.name }}</span
              ><small>{{ lane.description }}</small>
            </h4>
            <RouterLink
              v-for="node in lane.nodes"
              :key="node.code"
              class="platform-topology-node"
              :data-state="node.status"
              :to="node.href"
            >
              <span class="platform-topology-node__title"
                ><b>{{ node.name }}</b
                ><i :data-state="node.status">{{ stateName(node.status) }}</i></span
              >
              <small>{{ node.detail }} · {{ when(node.observedAt) }}</small>
              <dl>
                <div>
                  <dt>依赖</dt>
                  <dd>{{ node.dependencyNames.join("、") || "基础资源" }}</dd>
                </div>
                <div>
                  <dt>异常影响</dt>
                  <dd>{{ node.impact }}</dd>
                </div>
              </dl>
            </RouterLink>
          </section>
        </div>
      </section>
    </template>
    <template #attention>
      <section class="platform-propagation" aria-live="polite">
        <h3>当前需核查的传播范围</h3>
        <article
          v-for="node in propagationWarnings"
          :key="node.code"
          class="platform-propagation-alert"
          :data-state="node.status"
        >
          <div>
            <b>{{ node.name }}当前{{ stateName(node.status) }}</b
            ><RouterLink :to="node.href">进入处理</RouterLink>
          </div>
          <p>
            如异常持续，优先核查{{ node.impact
            }}<template v-if="node.affectedNames.length"
              >；关联服务：{{ node.affectedNames.join("、") }}</template
            >。关联关系不代表下游服务已发生故障。
          </p>
        </article>
        <p v-if="!propagationWarnings.length" class="platform-propagation-empty">
          当前未观测到需要核查的异常传播链。
        </p>
      </section>
    </template>
    <template #session>
      <section class="platform-realtime-degradation" aria-label="实时连接退化统计">
        <header>
          <div>
            <h3>实时连接退化</h3>
            <span>仅统计当前浏览器标签页会话，不代表全站或其他用户。</span>
          </div>
          <i :data-state="realtimeMetrics.reconnecting ? 'warning' : 'ready'">
            {{ realtimeMetrics.reconnecting ? "正在自动重连" : "当前未处于重连" }}
          </i>
        </header>
        <div>
          <article>
            <small>SSE 重连率</small>
            <strong>{{ realtimeReconnectRate }}</strong>
            <span
              >{{ realtimeMetrics.reconnect_count }} 次重连 /
              {{ realtimeMetrics.connection_open_count + realtimeMetrics.reconnect_count }}
              次连接事件</span
            >
          </article>
          <article>
            <small>降级轮询次数</small>
            <strong>{{ realtimeMetrics.fallback_poll_count }}</strong>
            <span>连接异常时刷新一次通知事实</span>
          </article>
        </div>
        <small
          >会话开始 {{ when(realtimeMetrics.session_started_at) }} · 最近重连
          {{ when(realtimeMetrics.last_reconnect_at) }} · 最近降级轮询
          {{ when(realtimeMetrics.last_fallback_poll_at) }}</small
        >
      </section>
    </template>
    <template #activity>
      <div class="platform-management-kpis">
        <article v-for="[key, value] in summaryEntries" :key="key">
          <small>{{ summaryName(key) }}</small
          ><strong :data-state="value">{{ stateName(value) }}</strong>
        </article>
      </div>
      <div class="p61-activity-groups">
        <section>
          <h3>采集任务状态</h3>
          <p v-if="!data.collections.length" class="platform-status-empty">
            当前没有采集任务状态记录。
          </p>
          <div v-for="item in data.collections" :key="item.status">
            <span>{{ stateName(item.status) }}</span
            ><strong>{{ item.total }}</strong>
          </div>
          <RouterLink to="/platform-admin/collection/overview">查看任务详情</RouterLink>
        </section>
        <section>
          <h3>来源状态</h3>
          <p v-if="!data.sources.length" class="platform-status-empty">当前没有来源配置记录。</p>
          <div v-for="item in data.sources" :key="item.status">
            <span>{{ stateName(item.status) }}</span
            ><strong>{{ item.total }}</strong>
          </div>
          <RouterLink to="/platform-admin/providers/sources">管理来源配置</RouterLink>
        </section>
      </div>
    </template>
  </PlatformStatusWorkspace>
</template>
