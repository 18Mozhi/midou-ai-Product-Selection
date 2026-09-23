<script setup lang="ts">
import type { RedisResilienceDto } from "@scoutops/contracts";

defineProps<{
  sample: RedisResilienceDto["keyspace_sample"];
  formatBytes: (value: number) => string;
  percent: (basis?: number) => string;
  purposeLabel: Record<"cache" | "queue" | "rate" | "sse", string>;
  resourceLabel: Record<"collection_ready" | "collection_task" | "other", string>;
  statusLabel: Record<"sampled" | "partial" | "empty" | "unavailable", string>;
}>();
</script>

<template>
  <section class="p67-sampling p67-section" aria-labelledby="p67-sampling-title">
    <header>
      <div>
        <h2 id="p67-sampling-title">有界键空间采样</h2>
        <p>只比较成功测得的字节，不是总 Redis 内存占比或访问频率。</p>
      </div>
      <b>{{ statusLabel[sample.status] }}</b>
    </header>
    <dl class="p67-counts">
      <div>
        <dt>已扫描去重键</dt>
        <dd>{{ sample.scanned_keys }}</dd>
      </div>
      <div>
        <dt>成功测量</dt>
        <dd>{{ sample.measured_keys }}</dd>
      </div>
      <div>
        <dt>忽略 / 测量失败</dt>
        <dd>
          {{ sample.ignored_keys }} /
          {{ sample.failed_measurements }}
        </dd>
      </div>
      <div>
        <dt>成功测得字节</dt>
        <dd>{{ formatBytes(sample.total_sampled_bytes) }}</dd>
      </div>
    </dl>
    <p>
      采样上限 {{ sample.sample_limit }} 个键；{{
        sample.truncated ? "已达到有界采样范围" : "本次未标记截断"
      }}。SCAN COUNT 32 为提示，最多 32 轮；测量每批最多 16。
    </p>
    <div v-if="sample.hotspots.length" class="p67-sample-list">
      <article v-for="item in sample.hotspots" :key="item.purpose + ':' + item.resource">
        <div>
          <h3>{{ purposeLabel[item.purpose] }} / {{ resourceLabel[item.resource] }}</h3>
          <small>{{ item.sampled_keys }} 个成功测量键</small>
        </div>
        <div>
          <b>{{ formatBytes(item.sampled_bytes) }}</b
          ><small>采样字节</small>
        </div>
        <div>
          <b>{{
            sample.total_sampled_bytes > 0 ? percent(item.sampled_share_basis_points) : "无比例分母"
          }}</b
          ><small>成功测得字节的占比</small>
        </div>
        <div v-if="sample.total_sampled_bytes > 0" class="p67-bar" aria-hidden="true">
          <span :style="{ width: percent(item.sampled_share_basis_points) }"></span>
        </div>
      </article>
    </div>
    <div v-else class="p67-sample-empty">
      <h3>{{ statusLabel[sample.status] }}</h3>
      <p v-if="sample.status === 'partial'">
        已扫描到受限键，但本次未完成有效内存测量；不能据此判断没有业务键。
      </p>
      <p v-else-if="sample.unavailable_reason === 'command_unsupported'">
        当前客户端不支持受限 SCAN 与 MEMORY USAGE。
      </p>
      <p v-else-if="sample.unavailable_reason === 'scan_failed'">
        本次采样失败；总体韧性结论仍由独立运行事实决定。
      </p>
      <p v-else>本次有界采样没有可归类的结果，不代表整个 Redis 没有业务键。</p>
    </div>
    <p class="p67-note">
      只显示用途与资源类别，不返回键名、组织、工作区、载荷或连接信息。采样是否成功，不直接改变总体韧性判门。
    </p>
  </section>
</template>
