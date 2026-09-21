import assert from "node:assert/strict";
import path from "node:path";
export const trendReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/trend-page-preview.css";
const replaceTemplate = (source, template, label) => {
  const normalized = source.replaceAll("\r\n", "\n"),
    start = normalized.indexOf("<template>"),
    end = normalized.lastIndexOf("</template>");
  assert.ok(start > 0 && end > start, `${label} template bounds`);
  return normalized.slice(0, start) + template + normalized.slice(end + "</template>".length);
};
export function previewTrendDashboard(source) {
  return replaceTemplate(
    source,
    `<template><section class="trend-dashboard p14-trend"><header class="p14-hero"><div><p>EVIDENCE DESK / 热点趋势</p><h2>先核对证据，再决定是否持续监控</h2><span>热度仅代表当前信号数；候选和建议采纳之间仍须通过五项质量门。</span></div><dl><div><dt>主题</dt><dd>{{total}}</dd></div><div><dt>运行规则</dt><dd>{{enabledRules.length}}</dd></div><div><dt>失败来源</dt><dd>{{failedRuleSources.length}}</dd></div></dl></header><nav class="p14-tabs" aria-label="热点趋势工作区"><button :aria-current="tab==='topics'?'page':undefined" type="button" @click="setTab('topics')">` +
      `主题与证据</button><button :aria-current="tab==='rules'?'page':undefined" type="button" @click="setTab('rules')">监控规则 <b>{{rules.length}}</b></button><button v-if="canManageTrends" :aria-current="tab==='governance'?'page':undefined" type="button" @click="setTab('governance')">合并与拆分 <b>{{changeRequests.filter(item=>item.status==='pending').length}}</b></button></nav><p v-if="message" class="p14-message" role="status">{{message}}<code v-if="requestId">关联编号：{{requestId}}</code></p><template ` +
      `v-if="tab==='topics'"><section class="p14-actions"><button v-if="canManageTrends" class="p14-primary" type="button" @click="showRule=true">{{enabledRules.length?'创建趋势监控':'创建第一条监控规则'}}</button><button type="button" :disabled="Boolean(busy)" @click="refreshHotspots">{{busy==='/provider-sources/refresh'?'正在启动…':'立即刷新来源'}}</button><button type="button" @click="saveViewLink">保存当前视图</button></section><TrendFilterPanel :filters="filters" :sort="sort" :active-count="activeFilterCount" ` +
      `@apply="applyFilters" @clear="clearFilters" @save-view="saveViewLink" @update-filters="Object.assign(filters,$event)" @update-sort="sort=$event"/><section v-if="state!=='ready'" class="p14-state" aria-live="assertive"><b>{{state==='empty'?'当前筛选下没有趋势主题':state==='expired'?'登录已失效':state==='forbidden'?'当前没有趋势访问权限':'趋势读取暂时受阻'}}</b><span>{{message||'请恢复当前工作区读取后再继续核对。'}}</span><code v-if="requestId">关联编号：{{requestId}}</code><button type="button" @click="recoverTopics">` +
      `{{state==='empty'?'清除筛选并恢复':'重新加载'}}</button></section><section v-else class="p14-workbench" :class="{'is-mobile-detail-open':mobileDetailOpen}"><section id="trend-list" class="trend-list"><header><div><p>主题检索</p><h3>当前页 {{topics.length}} 个主题</h3></div><span>{{sort==='impact'?'按影响程度排序':'按当前视图排序'}}</span></header><button v-for="topic in sortedTopics" :key="topic.id" type="button" :aria-pressed="selected?.id===topic.id" @click="selectTopic(topic)"><i :data-followed="topic.followed"></i><span><b>` +
      `{{topic.title}}</b><small>{{topic.market}} · {{topic.category||'未分类'}} · {{statusLabel(topic.status)}}</small><small>{{topic.source_count}} 个来源 · {{confidenceLabel(topic)}}</small></span><strong>{{topic.heat.value}}<small>信号</small></strong><em>{{topic.followed?'已关注':'核对'}}</em></button><footer class="trend-pagination" aria-label="趋势分页"><button type="button" :disabled="page<=1" @click="goPage(page-1)">上一页</button><span>第 {{page}} / {{pageCount}} 页</span><button type="button" ` +
      `:disabled="page>=pageCount" @click="goPage(page+1)">下一页</button></footer></section><TrendDetailPanel v-if="selected" :detail="selected" :busy="busy" :quality-issue-ids="qualityIssueIds" :opportunity-route="opportunityRoute" :can-manage="canManageTrends" @back="returnToTopicList" @follow="follow" @create-rule="showRule=true" @change-relevance="openRelevance" @report-anomaly="openAnomaly"/></section><details class="p14-truth"><summary>查看趋势事实说明</summary><div><span>热度为实际信号数，不是搜索热度估计。</span><span>` +
      `证据和来源不足时明确显示数据不足，不补默认分数。</span></div></details></template><section v-else-if="tab==='rules'" class="p14-rules"><header><div><p>持续监控</p><h3>趋势监控规则</h3><span>来源门槛只形成规则命中候选；五项质量门全部通过后才显示建议采纳。</span></div><button v-if="canManageTrends" class="p14-primary" type="button" @click="showRule=true">创建规则</button></header><div v-if="!rules.length" class="p14-empty"><b>还没有监控规则</b><span>按关键词、市场和语言建立第一条规则。</span></div><article v-for="item in rules" :key="item.id"><header><div><b>` +
      `{{item.status==='enabled'?'运行中':'已暂停'}}</b><h4>{{item.name}}</h4><span>{{item.market}} · {{item.language}} · {{item.category||'全部分类'}}</span></div><span>v{{item.version}}</span></header><p><strong>包含</strong> {{item.include_keywords.join(' · ')}}<small v-if="item.negative_keywords.length">排除：{{item.negative_keywords.join(' · ')}}</small></p><dl><div><dt>周期</dt><dd>每 {{item.collection_interval_minutes}} 分钟</dd></div><div><dt>来源门槛</dt><dd>至少 {{item.recommendation_min_source_count}} 个</dd></div>` +
      `<div><dt>最后评估</dt><dd>{{item.last_evaluated_at?freshness(item.last_evaluated_at):'尚未评估'}}</dd></div></dl><footer><button v-if="canManageTrends" type="button" @click="toggleRule(item)">{{item.status==='enabled'?'暂停':'启用'}}</button><button type="button" @click="viewRuleTopics(item)">查看趋势结果</button></footer></article></section><TrendChangeQueue v-else-if="canManageTrends" :topics="topics" :selected="selected" :requests="changeRequests" :busy="busy" @propose="proposeTopicChange" ` +
      `@decide="decideTopicChange"/><TrendRuleDialog v-if="showRule&&canManageTrends" :busy="Boolean(busy)" @close="showRule=false" @submit="createRule"/><div v-if="anomalyEvidence&&canManageTrends" class="trend-modal p14-modal" role="dialog" aria-modal="true"><form @submit.prevent="createQualityIssue"><header><div><p>异常证据</p><h3>创建数据质量工单</h3></div><button type="button" aria-label="关闭异常报告" @click="anomalyEvidence=null">×</button></header><p>{{anomalyEvidence.title}}</p><label>风险等级<select ` +
      `v-model="anomalySeverity"><option value="warning">需要复核</option><option value="critical">严重异常</option></select></label><label>异常说明<textarea v-model="anomalyReason" required minlength="2" maxlength="500"></textarea></label><footer><button type="button" @click="anomalyEvidence=null">取消</button><button type="submit" :disabled="anomalyReason.trim().length<2||Boolean(busy)">创建质量工单</button></footer></form></div><div v-if="relevanceDialog&&canManageTrends" class="trend-modal p14-modal" role="dialog" ` +
      `aria-modal="true"><form @submit.prevent="markIrrelevant"><header><div><p>相关性治理</p><h3>{{relevanceDialog==='irrelevant'?'标记为无关':'恢复为相关'}}</h3></div><button type="button" aria-label="关闭相关性变更" @click="relevanceDialog=null">×</button></header><p>原始证据、时间线和历史原因不会删除。</p><label>变更原因<textarea v-model="relevanceReason" required minlength="2" maxlength="500"></textarea></label><footer><button type="button" @click="relevanceDialog=null">取消</button><button type="submit" ` +
      `:disabled="relevanceReason.trim().length<2||Boolean(busy)">确认并记录</button></footer></form></div></section></template>`,
    "P14 dashboard",
  );
}
export function trendPagePlugin() {
  const dashboard = path
    .resolve("apps/web/src/components/TrendDashboard.vue")
    .replaceAll("\\", "/");
  return {
    name: "p14-actual-vue-review",
    enforce: "pre",
    transform(source, id) {
      if (id.replaceAll("\\", "/") === dashboard)
        return { code: previewTrendDashboard(source), map: null };
    },
    transformIndexHtml(html) {
      return html
        .replace("<body>", '<body class="p14-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(trendReviewCss).replaceAll("\\", "/")}"></head>`,
        );
    },
  };
}
