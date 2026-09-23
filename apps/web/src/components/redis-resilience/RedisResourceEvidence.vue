<script setup lang="ts">
import type { RedisResilienceDto } from "@scoutops/contracts";

defineProps<{
  data: RedisResilienceDto;
  evictionRisk: { level: "unknown" | "blocked" | "warning" | "ready"; text: string };
  formatBytes: (value: number) => string;
  percent: (basis?: number) => string;
}>();
</script>

<template>
  <div class="p67-operational-layout">
    <section class="p67-resources p67-section" aria-labelledby="p67-resources-title">
      <h2 id="p67-resources-title">资源与累计计数</h2>
      <p>用量、上限、累计错误分别阅读。</p>
      <div
        v-if="data.findings.some((item) => item.code === 'redis_unavailable')"
        class="p67-unmeasured"
      >
        <h3>未取得资源观测</h3>
        <p>本次探针失败。返回的零计数与 100% 比例是占位值，不代表实测用量、满额或运行时长。</p>
      </div>
      <template v-else
        ><div class="p67-resource-grid">
          <article
            class="p67-resource"
            data-resource="memory"
            :data-severity="
              data.findings.some((item) => item.code === 'redis_memory_stop')
                ? 'blocked'
                : data.findings.some((item) => item.code === 'redis_memory_warning')
                  ? 'warning'
                  : 'ready'
            "
          >
            <h3>内存使用</h3>
            <strong>{{
              data.memory.max_bytes > 0 ? percent(data.memory.usage_basis_points) : "未设置上限"
            }}</strong>
            <p>
              {{ formatBytes(data.memory.used_bytes) }} /
              {{ formatBytes(data.memory.max_bytes) }}
            </p>
            <div v-if="data.memory.max_bytes > 0" class="p67-bar" aria-hidden="true">
              <span :style="{ width: percent(data.memory.usage_basis_points) }"></span>
            </div>
            <small v-if="data.memory.max_bytes <= 0">比例是服务占位值，不作为实际使用率。</small>
            <small v-else-if="data.memory.used_bytes > data.memory.max_bytes"
              >用量超过上限；服务比例已封顶为 100%。</small
            >
            <small v-else>比例来自服务计算，不是容量承诺。</small>
          </article>
          <article
            class="p67-resource"
            data-resource="connections"
            :data-severity="
              data.findings.some((item) => item.code === 'redis_connections_stop')
                ? 'blocked'
                : data.findings.some((item) => item.code === 'redis_connections_warning')
                  ? 'warning'
                  : 'ready'
            "
          >
            <h3>连接使用</h3>
            <strong>{{
              data.connections.maximum > 0
                ? percent(data.connections.usage_basis_points)
                : "未设置上限"
            }}</strong>
            <p>{{ data.connections.connected }} / {{ data.connections.maximum }}</p>
            <div v-if="data.connections.maximum > 0" class="p67-bar" aria-hidden="true">
              <span :style="{ width: percent(data.connections.usage_basis_points) }"></span>
            </div>
            <small v-if="data.connections.maximum <= 0">比例是服务占位值，不作为实际使用率。</small>
            <small v-else-if="data.connections.connected > data.connections.maximum"
              >用量超过上限；服务比例已封顶为 100%。</small
            >
            <small v-else>比例来自服务计算，不是容量承诺。</small>
          </article>
        </div>
        <dl class="p67-counts">
          <div>
            <dt>累计拒绝连接</dt>
            <dd>{{ data.connections.rejected }}</dd>
          </div>
          <div>
            <dt>累计淘汰键</dt>
            <dd>{{ data.evicted_keys }}</dd>
          </div>
          <div>
            <dt>实例运行秒数</dt>
            <dd>{{ data.uptime_seconds }}</dd>
          </div>
        </dl>
        <p>
          实例运行 {{ data.uptime_seconds }} 秒；按天向下取整为
          {{ Math.floor(data.uptime_seconds / 86400) }} 天。拒绝与淘汰不是本次新增量。
        </p>
        <aside class="p67-note" :data-severity="evictionRisk.level">
          <b>界面键淘汰风险提示</b>
          <p>{{ evictionRisk.text }}</p>
          <small
            >此提示的内存阈值为 80%；总体判门使用运行
            policy，实际阈值未随本次返回，不能混用。</small
          >
        </aside>
      </template>
    </section>
    <section class="p67-persistence p67-section" aria-labelledby="p67-persistence-title">
      <h2 id="p67-persistence-title">持久化观测</h2>
      <p>是否启用与最近写入／保存结果分别核对。</p>
      <p
        v-if="data.findings.some((item) => item.code === 'redis_unavailable')"
        class="p67-unmeasured"
      >
        本次未取得持久化观测；不能把失败占位解释为已关闭 AOF 或 RDB。
      </p>
      <dl v-else class="p67-persistence-rows">
        <div>
          <dt>AOF</dt>
          <dd>
            {{ data.persistence.aof_enabled ? "已启用" : "未启用" }}<small>CONFIG GET 观测</small>
          </dd>
          <dd>
            {{ data.persistence.aof_last_write_status
            }}<small>写入状态，可能回退为最近重写结果</small>
          </dd>
        </div>
        <div>
          <dt>RDB</dt>
          <dd>
            {{ data.persistence.rdb_enabled ? "已启用" : "未启用" }}<small>CONFIG GET 观测</small>
          </dd>
          <dd>{{ data.persistence.rdb_last_save_status }}<small>最近保存状态</small></dd>
        </div>
      </dl>
      <p class="p67-note">
        AOF everysec 是既有部署目标；当前探针没有读取
        appendfsync，不能标记为本次实测通过。此接口也不提供恢复演练证据。
      </p>
    </section>
    <aside class="p67-policy p67-section" aria-labelledby="p67-policy-title">
      <h2 id="p67-policy-title">边界与未覆盖项</h2>
      <p>这些是部署合同与接口边界，不是一轮新的在线验证。</p>
      <dl>
        <div>
          <dt>淘汰策略 / 实际返回</dt>
          <dd>
            {{
              data.findings.some((item) => item.code === "redis_unavailable")
                ? "未取得观测"
                : data.max_memory_policy
            }}
          </dd>
        </div>
        <div>
          <dt>持久化目标</dt>
          <dd>AOF everysec + RDB 规则</dd>
        </div>
        <div>
          <dt>固定拓扑边界</dt>
          <dd>
            single_instance<br />Sentinel={{ data.sentinel_enabled }}<br />Cluster={{
              data.cluster_enabled
            }}
          </dd>
        </div>
        <div>
          <dt>能力声明</dt>
          <dd>不宣称副本、备用服务器或容量承诺</dd>
        </div>
        <div>
          <dt>当前 GET 未覆盖</dt>
          <dd>appendfsync、bind、protected-mode、真实恢复演练</dd>
        </div>
      </dl>
      <p>重启、配置、恢复只能由宝塔管理。本页没有运维执行入口。</p>
    </aside>
  </div>
</template>
