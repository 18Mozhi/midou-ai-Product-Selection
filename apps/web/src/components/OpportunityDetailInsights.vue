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

type DownstreamState = {
  competitors: OpportunityPartialLoadState;
  sourcing: OpportunityPartialLoadState;
};
type DownstreamSource = keyof DownstreamState;

const props = defineProps<{
  tab: OpportunityTab;
  detail: OpportunityDetail;
  profit: OpportunityProfitAnalysis | null;
  downstream: { competitors: number; snapshots: number; searches: number; suppliers: number };
  downstreamState: DownstreamState;
  competitorItems: OpportunityCompetitorSummary[];
  busy: boolean;
  canDecide: boolean;
  canManageCompetitors: boolean;
  canManageSuppliers: boolean;
  canReadCompetitors: boolean;
  canReadSourcing: boolean;
}>();

const emit = defineEmits<{
  discoverCompetitors: [];
  discoverSuppliers: [];
  queueScore: [];
  retryDownstream: [source: DownstreamSource];
  selectTab: [tab: OpportunityTab];
}>();
</script>

<template>
  <section v-if="tab === 'overview'" class="opportunity-insights">
    <header class="opportunity-insights-heading">
      <p>分析概览</p>
      <h3>先看关联事实，再核对质量门</h3>
      <span>各分区独立显示读取权限与状态；数据不足不会补成零，也不会由局部状态代替结论。</span>
    </header>

    <div class="opportunity-insight-grid">
      <article class="opportunity-insight-card opportunity-insight-card--wide">
        <header class="opportunity-insight-card__heading">
          <div>
            <p>关联对象</p>
            <h4>竞品与供应候选</h4>
          </div>
          <span class="opportunity-insight-badge">按权限分别读取</span>
        </header>
        <div class="opportunity-association-grid">
          <section class="opportunity-association">
            <h5>竞品关联</h5>
            <template v-if="!canReadCompetitors">
              <strong>按权限不可见</strong>
              <span>当前角色没有竞品读取权限；页面不请求或展示竞品明细。</span>
            </template>
            <template v-else-if="downstreamState.competitors === 'loading'">
              <strong>正在读取</strong><span>竞品数量尚未返回，暂不能判定为零。</span>
            </template>
            <template v-else-if="downstreamState.competitors === 'error'">
              <strong>本次读取未完成</strong>
              <span>竞品事实暂不可用；不会把上次数据当成本次结果。</span>
              <button
                type="button"
                class="opportunity-insight-button opportunity-insight-button--secondary"
                :disabled="busy"
                @click="emit('retryDownstream', 'competitors')"
              >
                重试读取竞品
              </button>
            </template>
            <template v-else>
              <strong>{{ downstream.competitors }} 个关联竞品</strong>
              <span>{{ downstream.snapshots }} 个快照；仅说明当前关联与采集数量，不代表趋势。</span>
            </template>
            <div class="opportunity-insight-actions">
              <button
                v-if="canManageCompetitors"
                type="button"
                class="opportunity-insight-button"
                :disabled="busy"
                @click="emit('discoverCompetitors')"
              >
                采集 Amazon 竞品
              </button>
              <RouterLink to="/competitors">竞品工作台</RouterLink>
            </div>
          </section>

          <section class="opportunity-association">
            <h5>供应候选</h5>
            <template v-if="!canReadSourcing">
              <strong>按权限不可见</strong>
              <span>当前角色没有供应链读取权限；页面不请求或展示供应搜索数据。</span>
            </template>
            <template v-else-if="downstreamState.sourcing === 'loading'">
              <strong>正在读取</strong><span>供应候选数量尚未返回，暂不能判定为零。</span>
            </template>
            <template v-else-if="downstreamState.sourcing === 'error'">
              <strong>本次读取未完成</strong>
              <span>供应链读取未完成；已成功读取的竞品事实会继续单独显示。</span>
              <button
                type="button"
                class="opportunity-insight-button opportunity-insight-button--secondary"
                :disabled="busy"
                @click="emit('retryDownstream', 'sourcing')"
              >
                重试读取供应候选
              </button>
            </template>
            <template v-else>
              <strong
                >{{ downstream.searches }} 个关联搜索 · {{ downstream.suppliers }} 个候选</strong
              >
              <span
                >候选数为已关联搜索的 candidate_count
                合计，不代表去重供应商数或已核实供货能力。</span
              >
            </template>
            <div class="opportunity-insight-actions">
              <button
                v-if="canManageSuppliers"
                type="button"
                class="opportunity-insight-button"
                :disabled="busy"
                @click="emit('discoverSuppliers')"
              >
                采集公开供应商
              </button>
              <RouterLink to="/sourcing">供应链工作台</RouterLink>
            </div>
          </section>
        </div>
      </article>

      <article class="opportunity-insight-card">
        <header class="opportunity-insight-card__heading">
          <div>
            <p>评分解释</p>
            <h4>最近一次运行</h4>
          </div>
          <span class="opportunity-insight-badge"
            >规则 {{ detail.score_rule_version ?? "未计算" }}</span
          >
        </header>
        <strong class="opportunity-insight-score">{{ detail.overall_score ?? "数据不足" }}</strong>
        <span v-if="detail.latest_score_run" class="opportunity-insight-support">
          覆盖 {{ detail.latest_score_run.coverage_percent }}% ·
          {{ formatOpportunityTime(detail.latest_score_run.scored_at) }}
        </span>
        <span v-else class="opportunity-insight-support"
          >尚无评分运行；缺失输入不会用默认值补齐。</span
        >
        <dl class="opportunity-score-breakdown">
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
        <p v-if="detail.latest_score_run?.missing_fields.length" class="opportunity-insight-note">
          缺失：{{ detail.latest_score_run.missing_fields.join("、") }}
        </p>
        <div class="opportunity-insight-actions">
          <RouterLink to="/opportunities/scoring-rules">规则版本</RouterLink>
          <button
            v-if="canDecide"
            type="button"
            class="opportunity-insight-button"
            :disabled="busy"
            @click="emit('queueScore')"
          >
            重新评分
          </button>
        </div>
      </article>

      <article class="opportunity-insight-card">
        <header class="opportunity-insight-card__heading">
          <div>
            <p>证据覆盖</p>
            <h4>关联证据与来源</h4>
          </div>
          <span class="opportunity-insight-badge">{{
            opportunityStatusLabel(detail.coverage_status)
          }}</span>
        </header>
        <div class="opportunity-metric-pair">
          <div>
            <strong>{{ detail.evidence_count }}</strong
            ><span>条关联证据</span>
          </div>
          <div>
            <strong>{{ detail.source_count }}</strong
            ><span>个来源</span>
          </div>
        </div>
        <p class="opportunity-insight-support">
          这些数量不说明所有证据均为趋势信号，也不能单独推出市场需求、规模或增长结论。
        </p>
        <div class="opportunity-insight-actions">
          <button
            type="button"
            class="opportunity-insight-button opportunity-insight-button--secondary"
            @click="emit('selectTab', 'evidence')"
          >
            查看机会证据
          </button>
          <button
            type="button"
            class="opportunity-insight-button opportunity-insight-button--secondary"
            @click="emit('selectTab', 'market')"
          >
            核对市场事实
          </button>
        </div>
      </article>

      <article class="opportunity-insight-card opportunity-insight-card--compact">
        <p>成本与风险状态</p>
        <dl class="opportunity-status-pair">
          <div>
            <dt>利润</dt>
            <dd>{{ opportunityStatusLabel(detail.profit_status) }}</dd>
          </div>
          <div>
            <dt>已保存风险等级</dt>
            <dd>{{ opportunityStatusLabel(detail.risk_level) }}</dd>
          </div>
          <div>
            <dt>风险评估覆盖</dt>
            <dd>{{ opportunityStatusLabel(detail.section_status.risk) }}</dd>
          </div>
        </dl>
        <p>风险等级与覆盖状态分别展示；任一字段都不替代逐项风险依据。</p>
      </article>
    </div>
  </section>

  <section v-else-if="tab === 'market'" class="opportunity-insights">
    <article class="opportunity-insight-card">
      <header class="opportunity-insight-card__heading">
        <div>
          <p>市场证据</p>
          <h3>先看证据，再判断市场</h3>
        </div>
        <span class="opportunity-insight-badge">{{
          opportunityStatusLabel(detail.section_status.market)
        }}</span>
      </header>
      <div class="opportunity-insight-callout">
        <strong>市场覆盖：{{ opportunityStatusLabel(detail.section_status.market) }}</strong>
        <span>这是已返回的覆盖状态，不是市场规模、销量或增长结论。</span>
      </div>
      <dl class="opportunity-market-facts">
        <div>
          <dt>机会关联证据总数</dt>
          <dd>{{ detail.evidence_count }}</dd>
        </div>
        <div>
          <dt>机会关联来源数</dt>
          <dd>{{ detail.source_count }}</dd>
        </div>
        <div>
          <dt>目标市场</dt>
          <dd>{{ detail.market || "未提供" }}</dd>
        </div>
      </dl>
      <div class="opportunity-fact-explainer">
        <h4>这些数量能说明什么？</h4>
        <dl>
          <div>
            <dt>可以确认</dt>
            <dd>当前机会已关联的证据与来源数量。</dd>
          </div>
          <div>
            <dt>不能推导</dt>
            <dd>不能据此断定全部证据都是趋势信号，或需求已验证、市场规模/增长率已知。</dd>
          </div>
          <div>
            <dt>继续核对</dt>
            <dd>到证据分区查看每条来源、采集时间与原始内容。</dd>
          </div>
        </dl>
      </div>
      <div class="opportunity-insight-actions">
        <button
          type="button"
          class="opportunity-insight-button opportunity-insight-button--secondary"
          @click="emit('selectTab', 'evidence')"
        >
          查看机会证据 →
        </button>
      </div>
    </article>
  </section>

  <section v-else-if="tab === 'competition'" class="opportunity-insights">
    <article class="opportunity-insight-card">
      <header class="opportunity-insight-card__heading">
        <div>
          <p>竞争事实</p>
          <h3>可追溯的竞品快照</h3>
        </div>
        <span class="opportunity-insight-badge">按当前机会严格筛选</span>
      </header>
      <template v-if="!canReadCompetitors">
        <div class="opportunity-insight-state" role="status">
          <strong>竞品内容当前不可查看</strong>
          <span>当前角色没有竞品读取权限；页面未请求或展示竞品数据。</span>
        </div>
      </template>
      <template v-else-if="downstreamState.competitors === 'loading'">
        <div class="opportunity-insight-state" role="status">
          <strong>正在读取竞品事实</strong><span>响应返回前不会把数量当作零。</span>
        </div>
      </template>
      <template v-else-if="downstreamState.competitors === 'error'">
        <div class="opportunity-insight-state opportunity-insight-state--error" role="alert">
          <strong>本次竞品读取未完成</strong>
          <span>当前不展示旧快照或推断为空结果；供应候选读取状态独立显示。</span>
          <button
            type="button"
            class="opportunity-insight-button"
            :disabled="busy"
            @click="emit('retryDownstream', 'competitors')"
          >
            重试读取
          </button>
        </div>
      </template>
      <template v-else>
        <p class="opportunity-insight-support">
          当前机会关联 {{ downstream.competitors }} 个竞品、累计
          {{ downstream.snapshots }} 个快照；这里只展示最近快照，不构造趋势。
        </p>
        <div v-if="competitorItems.length" class="opportunity-competitor-list">
          <article
            v-for="item in competitorItems"
            :key="item.id"
            class="opportunity-competitor-card"
          >
            <header>
              <span class="opportunity-insight-badge"
                >{{ item.source_site }} · {{ item.market }}</span
              >
              <small>当前机会关联记录</small>
            </header>
            <h4>{{ item.title }}</h4>
            <dl v-if="item.latest_snapshot" class="opportunity-competitor-snapshot">
              <div>
                <dt>快照价格</dt>
                <dd>
                  {{
                    item.latest_snapshot.current_price === null
                      ? "未提供"
                      : `${item.latest_snapshot.currency ?? ""} ${item.latest_snapshot.current_price}`
                  }}
                </dd>
              </div>
              <div>
                <dt>评分</dt>
                <dd>{{ item.latest_snapshot.rating_value ?? "未提供" }}</dd>
              </div>
              <div>
                <dt>评论数</dt>
                <dd>{{ item.latest_snapshot.review_count ?? "未提供" }}</dd>
              </div>
            </dl>
            <p v-else class="opportunity-insight-support">
              尚无竞品快照，不展示价格、评分或评论数。
            </p>
            <p v-if="item.latest_snapshot" class="opportunity-insight-support">
              采集于 {{ formatOpportunityTime(item.latest_snapshot.captured_at) }} · 新鲜度
              {{ opportunityStatusLabel(item.latest_snapshot.freshness) }}
            </p>
            <details class="opportunity-technical-details">
              <summary>展开记录标识</summary>
              <small>外部标识 {{ item.external_id }}</small>
            </details>
          </article>
        </div>
        <div v-else class="opportunity-insight-state">
          <strong>当前机会没有已关联竞品</strong>
          <span>这是本次成功读取的空结果；不会从其他机会拼接竞品。</span>
        </div>
      </template>
      <div class="opportunity-insight-actions">
        <button
          v-if="canManageCompetitors"
          type="button"
          class="opportunity-insight-button"
          :disabled="busy"
          @click="emit('discoverCompetitors')"
        >
          采集 Amazon 竞品
        </button>
        <RouterLink to="/competitors">竞品工作台 ↗</RouterLink>
      </div>
    </article>
  </section>

  <section v-else-if="tab === 'risk'" class="opportunity-insights">
    <article class="opportunity-insight-card">
      <header class="opportunity-insight-card__heading">
        <div>
          <p>风险与缺项</p>
          <h3>风险等级，不等于完整评估</h3>
        </div>
        <span class="opportunity-insight-badge">保存值与覆盖度分开</span>
      </header>
      <div class="opportunity-risk-facts">
        <section>
          <span>已保存风险等级</span>
          <strong>{{ opportunityStatusLabel(detail.risk_level) }}</strong>
          <p>只展示当前保存值，不据此补齐其他风险判断。</p>
        </section>
        <section>
          <span>风险评估覆盖</span>
          <strong>{{ opportunityStatusLabel(detail.section_status.risk) }}</strong>
          <p>与风险等级独立呈现，不从覆盖状态推断逐项评估结果。</p>
        </section>
      </div>
      <div class="opportunity-insight-callout opportunity-insight-callout--caution">
        <strong>当前响应没有提供逐项风险评估事实</strong>
        <span>不能把合规、侵权、供应、趋势、利润或数据质量标记为已通过或无风险。</span>
      </div>
      <div class="opportunity-fact-explainer">
        <dl>
          <div>
            <dt>当前可以读取</dt>
            <dd>已保存风险等级及风险评估覆盖状态。</dd>
          </div>
          <div>
            <dt>仍需核对</dt>
            <dd>逐项判断对应的证据、评估范围与时间；这里不生成虚构的逐项清单。</dd>
          </div>
        </dl>
      </div>
      <div class="opportunity-insight-actions">
        <button
          type="button"
          class="opportunity-insight-button opportunity-insight-button--secondary"
          @click="emit('selectTab', 'evidence')"
        >
          查看机会证据 →
        </button>
        <button
          type="button"
          class="opportunity-insight-button opportunity-insight-button--secondary"
          @click="emit('selectTab', 'profit')"
        >
          核对利润与成本 →
        </button>
      </div>
    </article>
  </section>
</template>

<style scoped>
.opportunity-insights {
  display: grid;
  gap: 16px;
  color: var(--so-opportunity-review-ink);
}

.opportunity-insights h3,
.opportunity-insights h4,
.opportunity-insights h5,
.opportunity-insights p {
  margin: 0;
}

.opportunity-insights h3 {
  font-size: 23px;
  line-height: 1.35;
}

.opportunity-insights h4 {
  font-size: 18px;
  line-height: 1.4;
}

.opportunity-insights h5 {
  font-size: 16px;
}

.opportunity-insights p,
.opportunity-insight-support,
.opportunity-association > span,
.opportunity-insight-state > span,
.opportunity-risk-facts p {
  color: var(--so-opportunity-review-muted);
  font-size: 15px;
  line-height: 1.65;
}

.opportunity-insights-heading {
  display: grid;
  gap: 8px;
  padding: 2px 0 14px;
  border-bottom: 1px solid var(--so-opportunity-review-line);
}

.opportunity-insights-heading > p,
.opportunity-insight-card__heading p,
.opportunity-insight-card--compact > p:first-child {
  color: var(--so-opportunity-review-blue);
  font-size: 13px;
  font-weight: 750;
}

.opportunity-insight-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.opportunity-insight-card {
  min-width: 0;
  padding: 20px;
  display: grid;
  align-content: start;
  gap: 16px;
  border: 1px solid var(--so-opportunity-review-line);
  background: var(--so-opportunity-review-surface);
}

.opportunity-insight-card--wide {
  grid-column: 1 / -1;
}

.opportunity-insight-card--compact {
  align-content: start;
}

.opportunity-insight-card__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--so-opportunity-review-line);
}

.opportunity-insight-card__heading > div {
  display: grid;
  gap: 6px;
}

.opportunity-insight-badge {
  width: fit-content;
  max-width: 100%;
  padding: 5px 8px;
  color: var(--so-opportunity-review-blue);
  background: var(--so-opportunity-review-pale);
  font-size: 13px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.opportunity-association-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.opportunity-association {
  min-width: 0;
  padding: 4px 18px 4px 0;
  display: grid;
  align-content: start;
  justify-items: start;
  gap: 10px;
}

.opportunity-association + .opportunity-association {
  padding: 4px 0 4px 18px;
  border-left: 1px solid var(--so-opportunity-review-line);
}

.opportunity-association > strong {
  font-size: 25px;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.opportunity-association > span {
  min-height: 48px;
}

.opportunity-insight-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
}

.opportunity-insight-actions > a,
.opportunity-insight-actions > button:not(.opportunity-insight-button) {
  color: var(--so-opportunity-review-blue);
  font-weight: 650;
  text-underline-offset: 3px;
}

.opportunity-insight-button {
  min-width: 44px;
  min-height: 44px;
  padding: 9px 13px;
  border: 1px solid var(--so-opportunity-review-blue);
  color: var(--so-opportunity-review-surface);
  background: var(--so-opportunity-review-blue);
  font: inherit;
  font-weight: 650;
  cursor: pointer;
}

.opportunity-insight-button--secondary {
  color: var(--so-opportunity-review-blue);
  background: var(--so-opportunity-review-surface);
}

.opportunity-insight-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.opportunity-insight-button:focus-visible,
.opportunity-insight-actions a:focus-visible {
  outline: 3px solid var(--so-opportunity-review-focus);
  outline-offset: 3px;
}

.opportunity-insight-score {
  font-size: 38px;
  line-height: 1.15;
}

.opportunity-insight-support {
  display: block;
}

.opportunity-score-breakdown,
.opportunity-status-pair,
.opportunity-fact-explainer dl {
  margin: 0;
  display: grid;
}

.opportunity-score-breakdown {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.opportunity-score-breakdown > div {
  min-width: 0;
  padding: 10px;
  background: var(--so-opportunity-review-canvas);
}

.opportunity-score-breakdown dt,
.opportunity-status-pair dt,
.opportunity-market-facts dt,
.opportunity-competitor-snapshot dt {
  color: var(--so-opportunity-review-muted);
  font-size: 13px;
}

.opportunity-score-breakdown dd,
.opportunity-status-pair dd,
.opportunity-market-facts dd,
.opportunity-competitor-snapshot dd {
  margin: 5px 0 0;
  font-size: 16px;
  font-weight: 650;
  overflow-wrap: anywhere;
}

.opportunity-score-breakdown small {
  display: block;
  margin-top: 3px;
  color: var(--so-opportunity-review-muted);
  font-size: 13px;
  font-weight: 400;
}

.opportunity-insight-note,
.opportunity-insight-callout,
.opportunity-insight-state {
  padding: 14px 16px;
  border-left: 3px solid var(--so-opportunity-review-blue);
  background: var(--so-opportunity-review-pale);
}

.opportunity-insight-callout,
.opportunity-insight-state {
  display: grid;
  gap: 7px;
}

.opportunity-insight-callout--caution {
  border-left-color: var(--so-opportunity-review-warning);
  background: var(--so-opportunity-review-warning-pale);
}

.opportunity-insight-state--error {
  border-left-color: var(--so-opportunity-review-danger);
  background: var(--so-opportunity-review-danger-pale);
}

.opportunity-metric-pair,
.opportunity-market-facts,
.opportunity-risk-facts,
.opportunity-competitor-snapshot {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.opportunity-metric-pair > div,
.opportunity-market-facts > div,
.opportunity-risk-facts > section,
.opportunity-competitor-snapshot > div {
  min-width: 0;
  padding: 4px 14px;
  display: grid;
  align-content: start;
  gap: 5px;
  border-left: 1px solid var(--so-opportunity-review-line);
}

.opportunity-metric-pair > div:first-child,
.opportunity-market-facts > div:first-child,
.opportunity-risk-facts > section:first-child,
.opportunity-competitor-snapshot > div:first-child {
  padding-left: 0;
  border-left: 0;
}

.opportunity-metric-pair strong,
.opportunity-market-facts dd,
.opportunity-risk-facts strong {
  font-size: 27px;
  line-height: 1.25;
}

.opportunity-metric-pair span,
.opportunity-risk-facts > section > span {
  color: var(--so-opportunity-review-muted);
  font-size: 14px;
}

.opportunity-status-pair {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.opportunity-status-pair > div {
  padding: 10px;
  background: var(--so-opportunity-review-canvas);
}

.opportunity-fact-explainer {
  display: grid;
  gap: 10px;
}

.opportunity-fact-explainer h4 {
  padding-bottom: 10px;
  border-bottom: 1px solid var(--so-opportunity-review-line);
}

.opportunity-fact-explainer dl {
  grid-template-columns: 1fr;
}

.opportunity-fact-explainer dl > div {
  padding: 11px 0;
  display: grid;
  grid-template-columns: minmax(130px, 0.32fr) minmax(0, 1fr);
  gap: 12px;
  border-bottom: 1px solid var(--so-opportunity-review-line);
}

.opportunity-fact-explainer dt {
  color: var(--so-opportunity-review-muted);
}

.opportunity-fact-explainer dd {
  margin: 0;
  line-height: 1.6;
}

.opportunity-competitor-list {
  display: grid;
  gap: 10px;
}

.opportunity-competitor-card {
  min-width: 0;
  padding: 16px;
  display: grid;
  gap: 12px;
  border: 1px solid var(--so-opportunity-review-line);
  background: var(--so-opportunity-review-surface);
}

.opportunity-competitor-card > header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.opportunity-competitor-card > header small {
  color: var(--so-opportunity-review-muted);
}

.opportunity-competitor-card > h4 {
  overflow-wrap: anywhere;
}

.opportunity-technical-details {
  padding-top: 10px;
  border-top: 1px solid var(--so-opportunity-review-line);
}

.opportunity-technical-details > summary {
  min-height: 44px;
  display: flex;
  align-items: center;
  color: var(--so-opportunity-review-blue);
  cursor: pointer;
}

.opportunity-technical-details > small {
  display: block;
  padding: 8px 0;
  color: var(--so-opportunity-review-muted);
  overflow-wrap: anywhere;
}

@media (max-width: 760px) {
  .opportunity-insight-grid,
  .opportunity-association-grid,
  .opportunity-risk-facts {
    grid-template-columns: minmax(0, 1fr);
  }

  .opportunity-insight-card {
    padding: 16px;
  }

  .opportunity-insight-card--wide {
    grid-column: auto;
  }

  .opportunity-association,
  .opportunity-association + .opportunity-association {
    padding: 14px 0;
    border-left: 0;
  }

  .opportunity-association + .opportunity-association {
    border-top: 1px solid var(--so-opportunity-review-line);
  }

  .opportunity-association > span {
    min-height: 0;
  }

  .opportunity-insight-card__heading {
    flex-direction: column;
    align-items: flex-start;
  }

  .opportunity-score-breakdown,
  .opportunity-status-pair,
  .opportunity-market-facts,
  .opportunity-competitor-snapshot {
    grid-template-columns: minmax(0, 1fr);
  }

  .opportunity-metric-pair {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .opportunity-metric-pair > div:nth-child(odd),
  .opportunity-market-facts > div,
  .opportunity-risk-facts > section,
  .opportunity-competitor-snapshot > div {
    padding: 12px 0;
    border-left: 0;
    border-top: 1px solid var(--so-opportunity-review-line);
  }

  .opportunity-market-facts > div:first-child,
  .opportunity-risk-facts > section:first-child,
  .opportunity-competitor-snapshot > div:first-child {
    border-top: 0;
  }

  .opportunity-fact-explainer dl > div {
    grid-template-columns: minmax(0, 1fr);
    gap: 5px;
  }
}
</style>
