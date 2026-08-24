<script setup lang="ts">
import type {
  OpportunityCompetitorSummary,
  OpportunityDetail,
  OpportunityPartialLoadState,
  OpportunityProfitAnalysis,
  OpportunityTab,
} from "./opportunity-workspace-types";
import {
  formatOpportunityTime,
  opportunityScoreDimensionLabel,
  opportunityStatusLabel,
} from "./opportunity-workspace-presentation";

defineProps<{
  tab: OpportunityTab;
  detail: OpportunityDetail;
  profit: OpportunityProfitAnalysis | null;
  downstream: { competitors: number; snapshots: number; searches: number; suppliers: number };
  downstreamState: OpportunityPartialLoadState;
  competitorItems: OpportunityCompetitorSummary[];
  busy: boolean;
  canDecide: boolean;
  canManageCompetitors: boolean;
  canManageSuppliers: boolean;
  canReadCompetitors: boolean;
  canReadSourcing: boolean;
}>();

defineEmits<{
  discoverCompetitors: [];
  discoverSuppliers: [];
  queueScore: [];
  retryDownstream: [];
}>();
</script>

<template>
  <section v-if="tab === 'overview'" class="opportunity-overview">
    <article class="opportunity-downstream">
      <p>下游补全</p>
      <h4>竞品与供应链数据</h4>
      <template v-if="downstreamState === 'ready'">
        <strong>{{
          canReadCompetitors && canReadSourcing
            ? `${downstream.competitors + downstream.suppliers} 项`
            : "按权限可见"
        }}</strong>
        <span>
          {{
            canReadCompetitors
              ? `${downstream.competitors} 个竞品 · ${downstream.snapshots} 个快照`
              : "竞品：无读取权限"
          }}
          ·
          {{ canReadSourcing ? `${downstream.suppliers} 个供应商候选` : "供应链：无读取权限" }}
        </span>
      </template>
      <template v-else-if="downstreamState === 'loading'">
        <strong>正在读取</strong><span>下游数据尚未返回，当前不能判定数量。</span>
      </template>
      <template v-else>
        <strong>读取失败</strong>
        <span>竞品与供应链接口暂不可用，当前不能判定为 0 项。</span>
      </template>
      <footer>
        <button
          v-if="downstreamState === 'error'"
          type="button"
          :disabled="busy"
          @click="$emit('retryDownstream')"
        >
          重试读取
        </button>
        <button
          v-if="canManageCompetitors"
          type="button"
          :disabled="busy"
          @click="$emit('discoverCompetitors')"
        >
          采集竞品
        </button>
        <button
          v-if="canManageSuppliers"
          type="button"
          :disabled="busy"
          @click="$emit('discoverSuppliers')"
        >
          采集供应商
        </button>
        <RouterLink to="/competitors">查看竞品详情</RouterLink>
        <RouterLink to="/sourcing">查看供应链详情</RouterLink>
      </footer>
    </article>
    <article class="opportunity-score">
      <p>评分解释</p>
      <h4>机会评分解读</h4>
      <strong>{{ detail.overall_score ?? "数据不足" }}</strong>
      <span v-if="detail.latest_score_run">
        规则 {{ detail.score_rule_version }} · 覆盖 {{ detail.latest_score_run.coverage_percent }}%
        ·
        {{ formatOpportunityTime(detail.latest_score_run.scored_at) }}
      </span>
      <span v-else>尚无评分运行；缺失输入不会用默认值补齐。</span>
      <dl>
        <div v-for="item in detail.score_components" :key="item.dimension_code">
          <dt>
            {{ opportunityScoreDimensionLabel(item.dimension_code) }} · {{ item.weight_percent }}%
          </dt>
          <dd>
            {{ item.input_score ?? "缺失" }} <small>{{ item.evidence_ids.length }} 条证据</small>
          </dd>
        </div>
        <div v-if="!detail.score_components.length">
          <dt>缺失项</dt>
          <dd>尚无评分输入</dd>
        </div>
      </dl>
      <aside v-if="detail.latest_score_run?.missing_fields.length">
        缺失：{{ detail.latest_score_run.missing_fields.join("、") }}
      </aside>
      <footer>
        <RouterLink to="/opportunities/scoring-rules">管理规则版本</RouterLink>
        <button v-if="canDecide" type="button" :disabled="busy" @click="$emit('queueScore')">
          重新评分
        </button>
      </footer>
    </article>
    <article>
      <p>证据覆盖</p>
      <h4>证据覆盖</h4>
      <strong>{{ detail.evidence_count }} 条 / {{ detail.source_count }} 个来源</strong>
      <span
        >覆盖状态：{{
          opportunityStatusLabel(detail.coverage_status)
        }}。市场、竞争、成本三类未齐全时不能自动推荐。</span
      >
    </article>
    <article>
      <p>利润</p>
      <h4>利润与成本</h4>
      <strong>{{
        profit?.latest_run?.status === "calculated"
          ? `${profit.latest_run.net_margin_percent}%`
          : opportunityStatusLabel(detail.profit_status)
      }}</strong>
      <span v-if="profit?.latest_run?.status === 'calculated'">
        净利润 {{ profit.latest_run.net_profit }} {{ profit.latest_run.currency }} · 规则
        {{ profit.latest_run.rule_version_code }}
      </span>
      <span v-else>数据不足时不生成投资回报率；缺失项在利润页逐项展示。</span>
    </article>
    <article>
      <p>风险</p>
      <h4>风险</h4>
      <strong>{{ opportunityStatusLabel(detail.risk_level) }}</strong>
      <span
        >评估覆盖：{{
          opportunityStatusLabel(detail.section_status.risk)
        }}。已保存风险等级与覆盖状态分别展示，不用“低风险”代替缺失评估。</span
      >
    </article>
  </section>

  <section v-else-if="tab === 'market'" class="opportunity-section">
    <p>市场证据</p>
    <h4>市场证据</h4>
    <strong>{{ opportunityStatusLabel(detail.section_status.market) }}</strong>
    <span
      >已关联 {{ detail.evidence_count }} 条趋势信号，来自
      {{ detail.source_count }} 个真实来源。</span
    >
  </section>

  <section v-else-if="tab === 'competition'" class="opportunity-section">
    <p>竞争情况</p>
    <h4>竞争对比</h4>
    <template v-if="!canReadCompetitors">
      <strong>无读取权限</strong>
      <span>当前角色未获得竞品读取权限，页面未请求或展示竞品数据。</span>
    </template>
    <template v-else-if="downstreamState === 'ready'">
      <strong>{{ downstream.competitors }} 个竞品 · {{ downstream.snapshots }} 个真实快照</strong>
      <span v-if="downstream.snapshots">快照保留价格、评分、评论、采集时间和原始证据。</span>
      <span v-else>尚未关联竞品快照；可采集公开 Amazon 商品页。</span>
      <div v-if="competitorItems.length" class="opportunity-competitor-facts">
        <article v-for="item in competitorItems" :key="item.id">
          <div>
            <strong>{{ item.title }}</strong
            ><small>{{ item.source_site }} · {{ item.market }} · {{ item.external_id }}</small>
          </div>
          <template v-if="item.latest_snapshot">
            <b
              >{{ item.latest_snapshot.currency || "" }}
              {{ item.latest_snapshot.current_price ?? "价格缺失" }}</b
            >
            <small
              >评分 {{ item.latest_snapshot.rating_value ?? "—" }} · 评论
              {{ item.latest_snapshot.review_count ?? "—" }} ·
              {{ formatOpportunityTime(item.latest_snapshot.captured_at) }}</small
            >
          </template>
          <span v-else>等待首次真实采集</span>
        </article>
      </div>
    </template>
    <template v-else-if="downstreamState === 'loading'">
      <strong>正在读取</strong><span>竞品接口尚未返回，当前不能判定数量。</span>
    </template>
    <template v-else>
      <strong>读取失败</strong><span>竞品接口暂不可用，不能把已有记录展示为 0 条。</span>
    </template>
    <footer>
      <button
        v-if="downstreamState === 'error'"
        type="button"
        :disabled="busy"
        @click="$emit('retryDownstream')"
      >
        重试读取
      </button>
      <button
        v-if="canManageCompetitors"
        type="button"
        :disabled="busy"
        @click="$emit('discoverCompetitors')"
      >
        立即采集竞品
      </button>
      <RouterLink to="/competitors">打开竞品监控详情</RouterLink>
    </footer>
  </section>

  <section v-else-if="tab === 'risk'" class="opportunity-section">
    <p>风险</p>
    <h4>风险分析</h4>
    <strong>当前记录：{{ opportunityStatusLabel(detail.risk_level) }}</strong>
    <span
      >评估覆盖：{{
        opportunityStatusLabel(detail.section_status.risk)
      }}。合规、侵权、供应、趋势、利润和数据质量风险尚未全部评估。</span
    >
  </section>
</template>
