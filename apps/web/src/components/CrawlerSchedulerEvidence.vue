<script setup lang="ts">
type SchedulerEvidenceDto = {
  topology: {
    worker_instances: number;
    maximum_workers: number;
    crawler_instances: number;
    maximum_crawlers: number;
  };
  leases: { active_worker: number; active_crawler: number; duplicate_count: number };
  profiles: Array<{ id: string; active_leases: number }>;
  active_leases: Array<{
    slot_type: "worker" | "crawler" | "provider";
    provider_name: string | null;
    task_id: string | null;
    task_status: string | null;
    run_id: string | null;
    process_role: "node_worker" | "python_crawler";
    process_ref: string;
    heartbeat_at: string;
    expires_at: string;
  }>;
  trend: Array<{
    bucket_at: string;
    total: number;
    succeeded: number;
    failed: number;
    failure_rate_basis_points: number;
  }>;
  resource: {
    load_basis_points: number;
    available_memory_mb: number;
    free_disk_mb: number;
    observed_at: string;
  };
  receipt_spool: null | {
    pending_count: number;
    pending_bytes: number;
    quarantined_count: number;
    quarantined_bytes: number;
    oldest_pending_at: string | null;
    retention_days: number;
    max_bytes: number;
    minimum_free_disk_mb: number;
    free_disk_mb: number;
    observed_at: string;
  };
};

type Props = {
  data: SchedulerEvidenceDto;
  time: (value: string) => string;
  bytes: (value: number) => string;
  rate: (value: number | null) => string;
  processLabel: (value: "node_worker" | "python_crawler") => string;
  statusLabel: (value: string | null | undefined) => string;
};

const props = defineProps<Props>();
</script>

<template>
  <div class="p70-evidence">
    <section class="p70-receipts">
      <header>
        <div>
          <h2>完成回执水位</h2>
          <p>
            {{
              props.data.receipt_spool
                ? `观测于 ${props.time(props.data.receipt_spool.observed_at)}`
                : "等待 Python Crawler 上报"
            }}
          </p>
        </div>
      </header>
      <template v-if="props.data.receipt_spool">
        <dl>
          <div>
            <dt>待回写</dt>
            <dd>
              {{ props.data.receipt_spool.pending_count }} /
              {{ props.bytes(props.data.receipt_spool.pending_bytes) }}
            </dd>
          </div>
          <div>
            <dt>隔离待审阅</dt>
            <dd>
              {{ props.data.receipt_spool.quarantined_count }} /
              {{ props.bytes(props.data.receipt_spool.quarantined_bytes) }}
            </dd>
          </div>
          <div>
            <dt>最老待回写</dt>
            <dd>
              {{
                props.data.receipt_spool.oldest_pending_at
                  ? props.time(props.data.receipt_spool.oldest_pending_at)
                  : "时间未知"
              }}
            </dd>
          </div>
          <div>
            <dt>目录可用</dt>
            <dd>{{ props.data.receipt_spool.free_disk_mb }} MB</dd>
          </div>
        </dl>
        <p class="p70-note">
          保留期 {{ props.data.receipt_spool.retention_days }} 天；到期只告警，不授权自动删除。
        </p>
      </template>
      <p v-else class="p70-note">尚无回执水位；调度保持阻断，重新核验不会读取回执内容或路径。</p>
    </section>

    <section class="p70-leases">
      <header>
        <div>
          <h2>活动租约与进程</h2>
          <p>{{ props.data.active_leases.length }} 个活动槽位；任务标识按需展开。</p>
        </div>
      </header>
      <article
        v-for="(item, index) in props.data.active_leases"
        :key="`${item.slot_type}:${item.task_id}:${item.run_id}:${index}`"
      >
        <b>{{ props.processLabel(item.process_role) }}</b>
        <span>{{ item.provider_name || "全局调度槽位" }}</span>
        <p>
          槽位 {{ item.slot_type }} · 采集任务：{{ props.statusLabel(item.task_status) }} · 心跳
          {{ props.time(item.heartbeat_at) }} · 到期 {{ props.time(item.expires_at) }}
        </p>
        <details>
          <summary>查看技术详情</summary>
          <code>任务 UUID {{ item.task_id || "未关联" }}</code>
          <code>进程标识 {{ item.process_ref }}</code>
          <code v-if="item.run_id">运行 UUID {{ item.run_id }}</code>
        </details>
      </article>
      <p v-if="!props.data.active_leases.length" class="p70-note">当前没有活动租约。</p>
    </section>
  </div>

  <section class="p70-trend">
    <header>
      <div>
        <h2>最近 24 小时运行样本</h2>
        <p>总量可含尚未终态运行，不称为完整等待基线。</p>
      </div>
    </header>
    <article v-for="item in props.data.trend" :key="item.bucket_at">
      <time>{{ props.time(item.bucket_at) }}</time>
      <span>吞吐 {{ item.total }}</span>
      <span>成功 {{ item.succeeded }}</span>
      <span>失败 {{ item.failed }}</span>
      <b>{{ props.rate(item.failure_rate_basis_points) }}</b>
    </article>
    <p v-if="!props.data.trend.length" class="p70-note">最近 24 小时暂无浏览器运行样本。</p>
  </section>
</template>
