<script setup lang="ts">
defineProps<{ opportunityId: string }>();
</script>
<template>
  <section class="opportunity-mobile-shell">
    <header>
      <RouterLink to="/opportunities">← 返回机会</RouterLink><span>机会暂无详情</span>
    </header>
    <section>
      <div class="opportunity-signal">
        <i>◇</i>
        <p>机会编号</p>
        <strong>{{ opportunityId }}</strong
        ><small>当前机会没有可用详情；评分、利润、风险与证据不会被猜测或伪造。</small>
      </div>
      <nav aria-label="机会详情分区">
        <button type="button" aria-current="page">概览</button
        ><button type="button" disabled>市场</button><button type="button" disabled>竞争</button
        ><button type="button" disabled>利润</button><button type="button" disabled>风险</button>
      </nav>
      <div class="opportunity-skeleton-grid">
        <article>
          <p>决策摘要</p>
          <div></div>
          <div></div>
          <small>等待真实数据</small>
        </article>
        <article>
          <p>证据与来源</p>
          <div></div>
          <div></div>
          <small>等待证据写入</small>
        </article>
        <article>
          <p>下一步</p>
          <span>当来源采集和机会分析完成后，此处才会出现决策操作。</span>
        </article>
      </div>
    </section>
  </section>
</template>
