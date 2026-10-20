<template>
  <details class="trend-explainer">
    <summary>帮助：热点趋势怎么看</summary>
    <div>
      <p>热点趋势怎么看</p>
      <h3>指标说明</h3>
    </div>
    <ol>
      <li><b>热度</b><span>当前收集到的相关信号数</span></li>
      <li><b>增速</b><span>近期相对上一周期的变化</span></li>
      <li><b>来源</b><span>支持结论的独立站点数量</span></li>
      <li><b>可信度</b><span>按证据数量与新鲜度计算</span></li>
    </ol>
  </details>
</template>

<style scoped>
.trend-explainer > div {
  padding: 12px 0;
}
.trend-explainer p {
  margin: 0;
  color: var(--so-text-muted);
}
.trend-explainer h3 {
  margin: 4px 0 0;
  font-size: 16px;
}
.trend-explainer ol {
  margin: 0 0 14px;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.trend-explainer li {
  padding: 12px;
  border: 1px solid var(--so-border);
  border-radius: 4px;
  background: var(--so-panel-soft);
}
.trend-explainer li b,
.trend-explainer li span {
  display: block;
}
.trend-explainer li span {
  color: var(--so-text-muted);
}
@media (max-width: 900px) {
  .trend-explainer ol {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 560px) {
  .trend-explainer ol {
    grid-template-columns: 1fr;
  }
}
</style>
