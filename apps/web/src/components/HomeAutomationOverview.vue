<script setup lang="ts">
interface AutomaticSelectionSummary {
  state: "not_configured" | "running" | "attention";
  enabled_rule_count: number;
  candidate_count: number;
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
    <div class="home-status-facts">
      <div data-tone="positive">
        <strong>{{ selection.recommended_count }}</strong>
        <span>待你采纳</span>
      </div>
      <div>
        <strong>{{ selection.awaiting_evidence_count }}</strong>
        <span>自动补证中</span>
      </div>
      <div>
        <strong>{{ selection.enabled_rule_count }}</strong>
        <span>运行规则</span>
      </div>
    </div>

    <details class="home-runtime-details">
      <summary>
        <span><b>运行详情</b><small>采集进度与时间</small></span>
      </summary>
      <div class="home-runtime-panel">
        <header>
          <span>自动流程</span>
          <h3>系统正在做什么</h3>
        </header>
        <ol>
          <li :data-done="selection.enabled_rule_count > 0">
            <i>1</i>
            <div>
              <b>监控平台</b><span>{{ selection.enabled_rule_count }} 条规则运行中</span>
            </div>
          </li>
          <li :data-done="selection.candidate_count > 0">
            <i>2</i>
            <div>
              <b>筛出候选</b><span>已发现 {{ selection.candidate_count }} 条</span>
            </div>
          </li>
          <li :data-done="selection.recommended_count > 0">
            <i>3</i>
            <div>
              <b>补证与评分</b><span>{{ selection.awaiting_evidence_count }} 条仍在补证</span>
            </div>
          </li>
          <li :data-done="selection.adopted_count > 0">
            <i>4</i>
            <div>
              <b>人工采纳</b><span>已确认 {{ selection.adopted_count }} 条</span>
            </div>
          </li>
        </ol>
        <dl>
          <div>
            <dt>上次采集</dt>
            <dd>{{ date(selection.last_collection_at) }}</dd>
          </div>
          <div>
            <dt>下次采集</dt>
            <dd>{{ date(selection.next_collection_at) }}</dd>
          </div>
          <div>
            <dt>规则候选</dt>
            <dd>{{ selection.candidate_count }} 条</dd>
          </div>
          <div>
            <dt>人工已采纳</dt>
            <dd>{{ selection.adopted_count }} 条</dd>
          </div>
        </dl>
      </div>
    </details>
  </section>
</template>
