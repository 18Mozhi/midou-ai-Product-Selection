<script setup lang="ts">
import ApiCoverageOperationCard from "./ApiCoverageOperationCard.vue";
import type { ApiCoverageDashboardData } from "./api-coverage-types";

defineProps<{ data: ApiCoverageDashboardData }>();

const outcomeName = (value: string) =>
  ({
    success: "成功",
    empty: "空结果",
    blocked: "受阻",
    unauthenticated: "未登录受阻",
    unauthorized: "越权拒绝",
    not_run: "未执行",
  })[value] ?? value;
const sourceName = (value: string) =>
  value === "unmapped" ? "尚无声明" : value.replaceAll("_", " · ");
const dimensionName = (value: string) =>
  ({
    normal: "正常请求",
    authorization: "鉴权拒绝",
    parameters: "参数校验",
    idempotency: "幂等 / 并发",
    fault: "故障注入",
  })[value] ?? value;
const countRatio = (value: number, total: number) => `${value} / ${total}`;
</script>

<template>
  <section class="api-coverage api-coverage--c" data-testid="api-coverage-dashboard">
    <header class="p63-hero">
      <p>PLATFORM OPERATIONS / P63</p>
      <h1>接口覆盖核验</h1>
      <span>核对当前接口目录、既有运行记录与逐项验证证据。</span>
    </header>

    <aside class="p63-boundary" aria-label="数据范围说明">
      <b>平台超级管理员 · 只读证据</b>
      <span
        >报告可关联只代表目录指纹相符，不代表构建版本一致或验证项均已通过；报告本身不等于全量生产验收。</span
      >
    </aside>

    <section class="p63-paper" aria-label="接口目录与运行证据">
      <section class="p63-truth" :data-state="data.report_status" aria-labelledby="p63-truth-title">
        <div>
          <small>报告状态 · {{ data.report_status }}</small>
          <h2 id="p63-truth-title">
            {{ data.report_status === "current" ? "当前目录证据可关联" : "当前目录证据待补充" }}
          </h2>
          <p v-if="data.report_status === 'current'">
            <template v-if="data.captured_at">
              最近证据生成于 {{ new Date(data.captured_at).toLocaleString("zh-CN")
              }}<template v-if="data.age_seconds !== null"
                >，报告年龄 {{ data.age_seconds }} 秒</template
              >。
            </template>
            <template v-else>报告与当前目录可关联，但没有可显示的生成时间。</template>
          </p>
          <p v-else-if="data.report_status === 'missing'">
            未发现可读取的生产验收报告；当前目录条目按未执行统计。
          </p>
          <p v-else-if="data.report_status === 'invalid'">
            报告内容无法解析；当前目录条目按未执行统计。
          </p>
          <p v-else>报告与当前目录不匹配；不会计入当前运行记录或验证覆盖。</p>
        </div>
        <div class="p63-fingerprint">
          <small>method / path 指纹</small>
          <code>{{ data.catalog_fingerprint.slice(0, 12) }}</code>
        </div>
      </section>

      <section class="p63-summary" aria-label="全目录摘要">
        <article>
          <small>OpenAPI 路径</small>
          <b>{{ data.summary.paths }}</b>
        </article>
        <article>
          <small>接口操作</small>
          <b>{{ data.summary.operations }}</b>
        </article>
        <article>
          <small>已有结果记录</small>
          <b>{{ countRatio(data.summary.verified, data.summary.operations) }}</b>
          <span>{{ data.summary.coverage_percent.toFixed(2) }}% · 含受阻与拒绝</span>
        </article>
        <article>
          <small>五维证据通过</small>
          <b>{{ countRatio(data.summary.evidence_passed, data.summary.evidence_applicable) }}</b>
          <span>{{ data.summary.evidence_coverage_percent.toFixed(2) }}% · 仅适用项为分母</span>
        </article>
        <article>
          <small>有 UI 消费的操作</small>
          <b>{{ data.summary.ui_consumed }}</b>
        </article>
        <article>
          <small>声明有爬虫副作用</small>
          <b>{{ data.summary.crawler_side_effects }}</b>
        </article>
      </section>

      <section class="p63-breakdowns" aria-label="全目录分布">
        <section aria-labelledby="p63-outcome-title">
          <h2 id="p63-outcome-title">运行结果记录</h2>
          <ul>
            <li v-for="item in data.by_outcome" :key="item.key">
              <span>{{ outcomeName(item.key) }}</span>
              <b>{{ item.count }}</b>
            </li>
          </ul>
        </section>
        <section aria-labelledby="p63-evidence-title">
          <h2 id="p63-evidence-title">五维验证证据</h2>
          <ul>
            <li v-for="item in data.evidence_dimensions" :key="item.key">
              <span>{{ dimensionName(item.key) }}</span>
              <b>{{ item.passed }} / {{ item.applicable }}</b>
              <small
                >失败 {{ item.failed }} · 未执行 {{ item.not_run }} · 不适用
                {{ item.not_applicable }}</small
              >
            </li>
          </ul>
        </section>
        <section aria-labelledby="p63-role-title">
          <h2 id="p63-role-title">角色验证记录</h2>
          <p class="p63-section-note">
            记录可能包含成功、受阻或拒绝，不等于允许/拒绝矩阵已全部通过。
          </p>
          <ul>
            <li v-for="item in data.by_role" :key="item.key">
              <span>{{ item.key }}</span>
              <b>{{ item.verified }} / {{ item.expected_allowed }}</b>
              <small
                >成功 {{ item.success }} · 空 {{ item.empty }} · 受阻 {{ item.blocked }} · 越权
                {{ item.unauthorized }}</small
              >
            </li>
          </ul>
        </section>
        <section aria-labelledby="p63-source-title">
          <h2 id="p63-source-title">数据来源声明</h2>
          <ul>
            <li v-for="item in data.by_data_source" :key="item.key">
              <span>{{ sourceName(item.key) }}</span>
              <b>{{ item.count }}</b>
            </li>
          </ul>
        </section>
        <section aria-labelledby="p63-consumer-title">
          <h2 id="p63-consumer-title">UI 消费方声明</h2>
          <ul>
            <li v-for="item in data.by_ui_consumer" :key="item.key">
              <span>{{ item.key === "unmapped" ? "尚无声明" : item.key }}</span>
              <b>{{ item.count }}</b>
            </li>
          </ul>
        </section>
        <section aria-labelledby="p63-crawler-title">
          <h2 id="p63-crawler-title">爬虫副作用声明</h2>
          <ul>
            <li v-for="item in data.by_crawler_side_effect" :key="item.key">
              <span>{{ sourceName(item.key) }}</span>
              <b>{{ item.count }}</b>
            </li>
          </ul>
        </section>
      </section>

      <section class="p63-operations" aria-labelledby="p63-operations-title">
        <header>
          <div>
            <h2 id="p63-operations-title">逐操作证据目录</h2>
            <p>目录统计始终对应全部接口；搜索和结果筛选只影响下方明细。</p>
          </div>
          <span
            >筛选命中 {{ data.total_filtered }} 项 · 当前返回 {{ data.operations.length }} 项</span
          >
        </header>
        <p v-if="data.total_filtered > data.operations.length" class="p63-limit-note">
          单次最多返回 {{ data.operations.length }} 项；请缩小搜索范围以查看其他匹配操作。
        </p>
        <div v-if="data.operations.length" class="p63-operation-list">
          <ApiCoverageOperationCard
            v-for="operation in data.operations"
            :key="operation.operation_id"
            :operation="operation"
          />
        </div>
        <p v-else class="p63-empty" role="status">
          当前筛选没有匹配操作；上方统计仍对应整个接口目录。
        </p>
      </section>
    </section>
  </section>
</template>

<style scoped>
:global(.role-shell:has(.api-coverage--c) .role-page-title) {
  display: none;
}
:global(.role-shell:has(.api-coverage--c) .platform-management) {
  gap: 16px;
}
:global(.role-shell:has(.api-coverage--c) .platform-management-hero) {
  min-width: 0;
  padding: 18px 20px;
  border: 1px solid #dce4ee;
  border-left: 4px solid #1748a0;
  border-radius: 0;
  background: #fff;
  box-shadow: none;
}
:global(.role-shell:has(.api-coverage--c) .platform-management-hero p) {
  color: #1748a0;
  font:
    700 12px/1.5 "Microsoft YaHei",
    sans-serif;
  letter-spacing: 0.04em;
}
:global(.role-shell:has(.api-coverage--c) .platform-management-hero h2) {
  margin: 4px 0;
  color: #182d4a;
  font:
    700 22px/1.4 "Microsoft YaHei",
    sans-serif;
}
:global(.role-shell:has(.api-coverage--c) .platform-management-hero span) {
  color: #52647b;
}
:global(.role-shell:has(.api-coverage--c) .platform-management-hero button) {
  min-height: 44px;
  border: 1px solid #1748a0;
  border-radius: 0;
  background: #1748a0;
  color: #fff;
  box-shadow: none;
}
:global(
  .role-shell:has(.api-coverage--c)
    .responsive-filter-drawer--overlay
    .responsive-filter-drawer__trigger
) {
  border-color: #dce4ee;
  border-radius: 0;
  color: #182d4a;
  background: #fff;
  box-shadow: none;
}
:global(
  .role-shell:has(.api-coverage--c)
    .responsive-filter-drawer--overlay
    .responsive-filter-drawer__trigger
    i
) {
  border-radius: 0;
  color: #1748a0;
  background: #edf4ff;
}
.api-coverage--c {
  --p63-blue: #1748a0;
  --p63-ink: #182d4a;
  --p63-line: #dce4ee;
  --p63-muted: #52647b;
  display: grid;
  gap: 20px;
  min-width: 0;
  max-width: 100%;
  color: var(--p63-ink);
  font:
    16px/1.65 "Microsoft YaHei",
    sans-serif;
}
.api-coverage--c :is(h1, h2, p, ul) {
  margin: 0;
}
.api-coverage--c h1 {
  font-size: 30px;
  line-height: 1.35;
}
.api-coverage--c h2 {
  font-size: 20px;
  line-height: 1.4;
}
.p63-hero {
  padding: 24px 28px;
  background: var(--p63-blue);
  color: #fff;
}
.p63-hero p {
  margin-bottom: 6px;
  color: #d9e6ff;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.06em;
}
.p63-hero h1 {
  color: #fff;
}
.p63-hero span {
  display: block;
  margin-top: 8px;
  color: #e2ebff;
}
.p63-boundary {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 12px 16px;
  border-left: 3px solid var(--p63-blue);
  background: #edf4ff;
}
.p63-boundary span {
  color: var(--p63-muted);
}
.p63-paper {
  min-width: 0;
  border: 1px solid var(--p63-line);
  background: #fff;
}
.p63-truth {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 24px 28px;
  border-bottom: 1px solid var(--p63-line);
  background: #f6f9ff;
}
.p63-truth small,
.p63-fingerprint small,
.p63-summary small {
  display: block;
  color: var(--p63-muted);
  font-size: 13px;
}
.p63-truth h2 {
  margin-top: 5px !important;
}
.p63-truth p {
  margin-top: 6px !important;
  color: var(--p63-muted);
}
.p63-truth[data-state="current"] {
  border-top: 3px solid #276247;
}
.p63-truth[data-state="missing"],
.p63-truth[data-state="invalid"],
.p63-truth[data-state="outdated"] {
  border-top: 3px solid #8a5900;
}
.p63-fingerprint {
  min-width: 0;
  text-align: right;
}
.p63-fingerprint code {
  overflow-wrap: anywhere;
  color: var(--p63-ink);
}
.p63-summary {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 1px;
  border-bottom: 1px solid var(--p63-line);
  background: var(--p63-line);
}
.p63-summary article {
  min-width: 0;
  padding: 15px;
  background: #fff;
}
.p63-summary b {
  display: block;
  margin-top: 4px;
  color: var(--p63-ink);
  font-size: 22px;
  line-height: 1.35;
  overflow-wrap: anywhere;
}
.p63-summary span {
  display: block;
  margin-top: 3px;
  color: var(--p63-muted);
  font-size: 13px;
}
.p63-breakdowns {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-bottom: 1px solid var(--p63-line);
}
.p63-breakdowns > section {
  min-width: 0;
  padding: 22px 24px;
}
.p63-breakdowns > section:nth-child(3n + 2),
.p63-breakdowns > section:nth-child(3n) {
  background: #f9fbfe;
}
.p63-breakdowns > section:not(:nth-child(3n + 1)) {
  border-left: 1px solid var(--p63-line);
}
.p63-breakdowns > section:nth-child(n + 4) {
  border-top: 1px solid var(--p63-line);
}
.p63-breakdowns h2 {
  margin-bottom: 10px !important;
}
.p63-breakdowns ul {
  max-height: 270px;
  padding: 0;
  overflow: auto;
  list-style: none;
}
.p63-breakdowns li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 3px 10px;
  align-items: start;
  padding: 8px 0;
  border-bottom: 1px solid var(--p63-line);
}
.p63-breakdowns li span,
.p63-breakdowns li small {
  min-width: 0;
  overflow-wrap: anywhere;
}
.p63-breakdowns li small {
  grid-column: 1 / -1;
  color: var(--p63-muted);
  font-size: 13px;
}
.p63-section-note {
  margin: -3px 0 6px !important;
  color: var(--p63-muted);
  font-size: 13px;
}
.p63-operations {
  min-width: 0;
  padding: 22px 28px;
}
.p63-operations > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.p63-operations > header h2 {
  margin-bottom: 3px !important;
}
.p63-operations > header p,
.p63-operations > header > span {
  color: var(--p63-muted);
  font-size: 13px;
}
.p63-operations > header > span {
  flex: 0 0 auto;
}
.p63-limit-note,
.p63-empty {
  margin-top: 12px !important;
  padding: 12px 14px;
  color: var(--p63-muted);
  background: #f1f5fa;
}
.p63-operation-list {
  margin-top: 12px;
}
@media (max-width: 1100px) {
  .p63-summary {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .p63-breakdowns {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .p63-breakdowns > section:nth-child(n) {
    border-left: 0;
  }
  .p63-breakdowns > section:nth-child(even) {
    border-left: 1px solid var(--p63-line);
  }
  .p63-breakdowns > section:nth-child(n + 3) {
    border-top: 1px solid var(--p63-line);
  }
}
@media (max-width: 760px) {
  .p63-hero,
  .p63-boundary,
  .p63-truth {
    flex-direction: column;
    gap: 12px;
    padding: 20px 18px;
  }
  .api-coverage--c h1 {
    font-size: 25px;
  }
  .p63-fingerprint {
    text-align: left;
  }
  .p63-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .p63-breakdowns {
    grid-template-columns: 1fr;
  }
  .p63-breakdowns > section:nth-child(n) {
    border-top: 1px solid var(--p63-line);
    border-left: 0;
  }
  .p63-breakdowns > section:first-child {
    border-top: 0;
  }
  .p63-breakdowns > section {
    padding: 20px 18px;
  }
  .p63-operations {
    padding: 20px 16px;
  }
  .p63-operations > header {
    flex-direction: column;
  }
}
</style>
