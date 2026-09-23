<script setup lang="ts">
import type { RedisResilienceDto } from "@scoutops/contracts";

defineProps<{
  data: RedisResilienceDto;
  state: RedisResilienceDto["state"];
  verdict: readonly [string, string];
  formatObservedAt: (value?: string) => string;
}>();
</script>

<template>
  <div class="p67-summary-layout">
    <section class="p67-conclusion" :data-verdict="state" aria-labelledby="p67-conclusion-title">
      <div>
        <small>S0 / {{ state }}</small>
        <h2 id="p67-conclusion-title">
          {{
            state === "ready"
              ? "当前韧性门满足"
              : state === "warning"
                ? "运行观测存在预警"
                : "当前韧性门阻断"
          }}
        </h2>
        <p>服务返回 {{ data.findings.length }} 项发现；不等于恢复演练、所有任务或高可用已验证。</p>
      </div>
      <div>
        <b>观测时间</b
        ><time :datetime="data.observed_at">{{ formatObservedAt(data.observed_at) }}</time
        ><small>单实例 · 容量能力未验证</small>
      </div>
    </section>
    <section class="p67-findings p67-section" aria-labelledby="p67-findings-title">
      <h2 id="p67-findings-title">
        告警与阻断项 <small>{{ data.findings.length }} 项</small>
      </h2>
      <div v-if="data.findings.length" class="p67-finding-list">
        <article v-for="item in data.findings" :key="item.code" :data-severity="item.severity">
          <b>{{ item.severity === "blocked" ? "阻断" : "预警" }}</b
          ><code>{{ item.code }}</code>
          <p>{{ item.action_hint }}</p>
        </article>
      </div>
      <p v-else>当前返回未列出告警或阻断。不据此推定所有缓存、队列或实时消息功能均已实测可用。</p>
    </section>
  </div>
</template>
