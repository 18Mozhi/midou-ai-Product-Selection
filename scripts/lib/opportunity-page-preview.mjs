import assert from "node:assert/strict";
import path from "node:path";

export const opportunityReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/opportunity-page-preview.css";

const replaceTemplate = (source, template, label) => {
  const normalized = source.replaceAll("\r\n", "\n"),
    start = normalized.indexOf("<template>"),
    end = normalized.lastIndexOf("</template>");
  assert.ok(start > 0 && end > start, `${label} template bounds`);
  return normalized.slice(0, start) + template + normalized.slice(end + "</template>".length);
};

export function previewOpportunityWorkspace(source) {
  return replaceTemplate(
    source,
    `<template>
  <section class="opportunity-workspace p15-opportunity">
    <header v-if="!opportunityId" class="p15-hero">
      <div>
        <p>OPPORTUNITY DESK / 选品机会</p>
        <h2>先核对质量门，再由人决定采纳</h2>
        <span>规则命中只是候选。评分、市场、竞争、成本、风险五项均通过，才进入待你采纳。</span>
      </div>
      <dl aria-label="当前机会队列摘要">
        <div><dt>当前队列</dt><dd>{{ selectionView === 'recommended' ? '待采纳' : selectionView === 'rule_candidates' ? '候选' : selectionView === 'evidence_pending' ? '采集' : '全部' }}</dd></div>
        <div><dt>当前范围</dt><dd>{{ total }}</dd></div>
        <div><dt>每页</dt><dd>20</dd></div>
      </dl>
    </header>
    <nav v-else class="p15-return" aria-label="机会详情返回路径"><RouterLink :to="returnPath">← 返回来源列表</RouterLink><span>机会详情</span></nav>
    <section v-if="!opportunityId" class="p15-command-bar" aria-label="选品机会操作">
      <RouterLink v-if="canDecide" class="p15-primary" to="/opportunities/start">创建选品</RouterLink>
      <RouterLink v-if="canDecide" to="/trends?section=rules">管理选品规则</RouterLink>
      <button v-if="canDecide && selectionView === 'all'" type="button" @click="showErpImport = true">从 ERP 导入</button>
      <button v-if="canDecide && selectionView === 'all'" type="button" @click="showCreate = true">手工添加</button>
      <span v-if="!canDecide">可查看机会事实；写入操作需要“机会决策”权限。</span>
      <small>“建议采纳”不等于已采纳，所有最终决定必须保留人工原因。</small>
    </section>
    <p v-if="message" class="p15-message" role="status">{{ message }}<code v-if="requestId">关联编号：{{ requestId }}</code></p>
    <OpportunityListPanel
      v-if="!opportunityId"
      :selection-view="selectionView"
      :items="items"
      :total="total"
      :state="state"
      :request-id="requestId"
      :filters="filters"
      :member-options="memberOptions"
      :selected-ids="selectedOpportunityIds"
      :page="page"
      :can-decide="canDecide"
      :automation-readiness="automationReadiness"
      @apply="applyListFilters"
      @batch="openBatch"
      @create="showCreate = true"
      @manage-setup="router.push($event)"
      @page="goListPage"
      @reset="resetListFilters"
      @view="setSelectionView"
      @update:selected-ids="selectedOpportunityIds = $event"
    />
    <template v-else><UiStatePanel v-if="state !== 'ready' || !detail" :kind="state === 'ready' ? 'empty' : state" :request-id="requestId" @primary="load"/><article v-else class="opportunity-detail"><header><div><p>{{ statusLabel(detail.lifecycle_status) }} · {{ detail.market }} · {{ detail.category || '未分类' }}</p><h3>{{ detail.name }}</h3><span>更新 {{ freshness(detail.updated_at) }} · 来源 {{ opportunityStatusLabel(detail.source_type) }}</span></div></header><OpportunityDecisionPanel :detail="detail" :busy="busy" :can-decide="canDecide" @decide="startDecision" @create-evidence-task="createEvidenceTask"/><nav class="opportunity-tabs" aria-label="机会详情分区"><button v-for="item in primaryTabs" :key="item[0]" type="button" :aria-current="tab === item[0] ? 'page' : undefined" @click="setTab(item[0])">{{ item[1] }}</button></nav><OpportunityDetailInsights v-if="['overview','market','competition','risk'].includes(tab)" :tab="tab" :detail="detail" :profit="profit" :downstream="downstream" :downstream-state="downstreamLoadState" :competitor-items="competitorItems" :busy="busy" :can-decide="canDecide" :can-manage-competitors="canManageCompetitors" :can-manage-suppliers="canManageSuppliers" :can-read-competitors="canReadCompetitors" :can-read-sourcing="canReadSourcing" @discover-competitors="discoverCompetitors" @discover-suppliers="discoverSuppliers" @queue-score="queueScore" @retry-downstream="loadDownstream"/><OpportunityLineagePanel v-else-if="tab === 'lineage'" :lineage="detail.lineage"/><OpportunityFeedbackPanel v-else-if="tab === 'feedback'" :feedback="detail.operating_feedback" :form="feedbackForm" :busy="busy" :can-write="canDecide" @submit="submitOperatingFeedback"/><OpportunityProfitPanel v-else-if="tab === 'profit'" :profit="profit" :cost-form="costForm" :reviewer-options="costReviewerOptions" :can-confirm-cost="canConfirmCost" :busy="busy" @confirm-cost="confirmCost" @review-cost="reviewCost" @queue-profit="queueProfit"/><OpportunityAiPanel v-else-if="tab === 'ai'" :analyses="aiAnalyses" :load-state="aiLoadState" :busy="busy" :can-decide="canDecide" @queue="queueAi" @retry="loadAi" @review="reviewAi"/><OpportunityEvidencePanel v-else-if="tab === 'evidence'" :evidence="detail.evidence" :opportunity-id="detail.id"/><section v-else class="opportunity-decisions"><header><h4>决策历史</h4><span>{{ detail.decisions.length }} 条</span></header><p v-if="!detail.decisions.length">尚无决策记录。</p></section></article></template>
    <OpportunityWorkspaceDialogs v-if="canDecide" v-model:erp-import-open="showErpImport" v-model:create-open="showCreate" v-model:decision-open="showDecision" v-model:erp-import-limit="erpImportLimit" v-model:decision-reason="decisionReason" :busy="busy" :form="form" :decision-action="decisionAction" :has-detail="Boolean(detail)" @create="create" @decide="decide" @import-browser="importFromErpBrowser" @import-file="importErpFile"/>
    <dialog v-if="canDecide" ref="batchDialogElement" class="opportunity-modal opportunity-batch-dialog" aria-label="机会批量操作影响预览" @cancel="handleBatchCancel"><form @submit.prevent="confirmBatch"><header><p>影响预览</p><h3>批量{{ batchAction === 'assign' ? '指派' : batchAction === 'archive' ? '归档' : '复核' }}</h3></header><p>仅提交当前页已选条目；每项会保留独立事件和原因。</p><label v-if="batchAction === 'assign'">负责人<select v-model="batchAssigneeId" required><option value="">请选择负责人</option><option v-for="member in memberOptions" :key="member.id" :value="member.id">{{ member.label }}</option></select></label><label>操作原因<textarea v-model="batchReason" required maxlength="1000"></textarea></label><footer><button type="button" @click="showBatch = false">返回</button><button type="submit" :disabled="busy">确认执行</button></footer></form></dialog>
    <AuditedReasonDialog :open="aiReviewReasonOpen" :title="aiReviewReasonRequest?.title || '填写复核说明'" :description="aiReviewReasonRequest?.description || ''" :initial-value="aiReviewReasonRequest?.initialValue" :minimum-length="aiReviewReasonRequest?.minimumLength" @submit="submitAiReviewReason" @cancel="cancelAiReviewReason"/>
  </section>
</template>`,
    "P15 workspace",
  );
}

export function opportunityPagePlugin() {
  const workspace = path
    .resolve("apps/web/src/components/OpportunityWorkspace.vue")
    .replaceAll("\\", "/");
  return {
    name: "p15-actual-vue-review",
    enforce: "pre",
    transform(source, id) {
      if (id.replaceAll("\\", "/") === workspace)
        return { code: previewOpportunityWorkspace(source), map: null };
    },
    transformIndexHtml(html) {
      return html
        .replace("<body>", '<body class="p15-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(opportunityReviewCss).replaceAll("\\", "/")}"></head>`,
        );
    },
  };
}
