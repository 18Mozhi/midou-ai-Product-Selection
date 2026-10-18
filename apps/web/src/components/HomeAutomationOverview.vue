<script setup lang="ts">
interface AutomaticSelectionSummary {
  state: "not_configured" | "running" | "attention";
  candidate_count: number;
  rule_candidate_count: number;
  recommended_count: number;
  awaiting_evidence_count: number;
  adopted_count: number;
  last_collection_at: string | null;
  next_collection_at: string | null;
}

defineProps<{ selection: AutomaticSelectionSummary }>();

const date = (value: string | null) => (value ? new Date(value).toLocaleString("zh-CN") : "未设置");
</script>

<template>
  <section class="home-automation-overview" aria-label="自动选品状态">
    <header class="home-automation-heading">
      <h3>选品库概况</h3>
      <span>当前工作区累计</span>
    </header>
    <div class="home-status-facts">
      <RouterLink to="/opportunities?view=recommended" data-tone="positive">
        <strong>{{ selection.recommended_count }}</strong>
        <span>待你采纳</span>
      </RouterLink>
      <RouterLink to="/opportunities?view=rule_candidates">
        <strong>{{ selection.rule_candidate_count ?? 0 }}</strong>
        <span>选品候选</span>
      </RouterLink>
      <RouterLink to="/opportunities?view=evidence_pending">
        <strong>{{ selection.awaiting_evidence_count }}</strong>
        <span>待补证据</span>
      </RouterLink>
      <RouterLink to="/opportunities?view=all&decision_status=adopted">
        <strong>{{ selection.adopted_count }}</strong>
        <span>累计采纳</span>
      </RouterLink>
    </div>

    <details class="home-runtime-details">
      <summary>
        <span><b>运行详情</b><small>调度记录与累计数量</small></span>
      </summary>
      <div class="home-runtime-panel">
        <header>
          <span>调度与数量</span>
          <h3>采集记录</h3>
        </header>
        <dl>
          <div>
            <dt>上次调度</dt>
            <dd>{{ date(selection.last_collection_at) }}</dd>
          </div>
          <div>
            <dt>计划下次调度</dt>
            <dd>{{ date(selection.next_collection_at) }}</dd>
          </div>
          <div>
            <dt>待决策记录</dt>
            <dd>{{ selection.candidate_count }} 条</dd>
          </div>
          <div>
            <dt>人工已采纳</dt>
            <dd>{{ selection.adopted_count }} 条</dd>
          </div>
        </dl>
        <p>以上仅为调度记录和累计数据，不代表 Worker 实时运行状态。</p>
      </div>
    </details>
  </section>
</template>
