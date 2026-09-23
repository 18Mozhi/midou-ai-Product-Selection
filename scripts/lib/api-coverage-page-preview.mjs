import assert from "node:assert/strict";
import path from "node:path";
import { baseParse } from "@vue/compiler-dom";

export const apiCoverageReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/api-coverage-page-preview.css";
export const apiCoveragePageSources = ["scripts/lib/api-coverage-page-preview.mjs"];
const once = (value, before, after) => {
  assert.equal(value.split(before).length, 2, "P63 unique anchor: " + before.slice(0, 80));
  return value.replace(before, after);
};

// Review-only transformation: production report fields, filtering and parent request behavior are preserved.
export function previewApiCoveragePage(input) {
  if (input.includes('class="api-coverage api-coverage--c"')) return input;
  const source = input.replaceAll("\r\n", "\n"),
    template = source.slice(source.indexOf("<template>") + 10, source.lastIndexOf("</template>"));
  const nodes = [],
    walk = (node) => {
      nodes.push(node);
      for (const child of node.children ?? []) walk(child);
    };
  walk(baseParse(template));
  const get = (name) => {
    const matches = nodes.filter(
      (node) =>
        node.type === 1 &&
        node.props.some((prop) => prop.name === "class" && prop.value?.content === name),
    );
    assert.equal(matches.length, 1, name);
    return matches[0].loc.source;
  };
  const root = get("api-coverage");
  const next = `<section class="api-coverage api-coverage--review" data-testid="api-coverage-dashboard">
    <header class="p63-hero"><div><p>ScoutOps / 接口覆盖证据</p><h1>接口覆盖核验</h1><span>目录关联状态与逐操作五维证据分开呈现；报告不等于全量生产验收。</span></div></header>
    <p class="p63-review-note">实际 Vue C 审核版 · 本地报告样例 · 不读取受限报告或发起接口探测 · 尚未部署</p>
    <aside class="p63-boundary"><b>平台超级管理员 / 只读报告</b><span>目录指纹只关联 method/path；不证明构建、权限或每个维度已完成。</span></aside>
    <section class="p63-paper"><section class="p63-truth" :data-state="data.report_status"><div><small>报告状态</small><h2>{{ data.report_status === 'current' ? '当前目录证据可关联' : '当前目录证据待补充' }}</h2><p v-if="data.report_status === 'current'">最近证据于 {{ new Date(data.captured_at).toLocaleString('zh-CN') }} 生成，距今 {{ data.age_seconds }} 秒。</p><p v-else>报告缺失、无效或与当前目录不匹配时，不能计入当前覆盖率。</p></div><code>{{ data.catalog_fingerprint.slice(0, 12) }}</code></section>
      <section class="p63-summary"><article><small>OpenAPI 路径</small><b>{{ data.summary.paths }}</b></article><article><small>操作基线</small><b>{{ data.summary.operations }}</b></article><article><small>路由探测率</small><b>{{ data.summary.coverage_percent.toFixed(2) }}%</b></article><article><small>证据维度覆盖</small><b>{{ data.summary.evidence_coverage_percent.toFixed(2) }}%</b></article><article><small>已有 UI 消费</small><b>{{ data.summary.ui_consumed }}</b></article><article><small>爬虫副作用</small><b>{{ data.summary.crawler_side_effects }}</b></article></section>
      <section class="p63-breakdowns"><section><h2>结果覆盖</h2><ul><li v-for="item in data.by_outcome" :key="item.key"><span>{{ outcomeName(item.key) }}</span><b>{{ item.count }}</b><small>{{ percent(item.count, data.summary.operations) }}</small></li></ul></section><section><h2>五维证据</h2><ul><li v-for="item in data.evidence_dimensions" :key="item.key"><span>{{ dimensionName(item.key) }}</span><b>{{ item.passed }}/{{ item.applicable }}</b><small>失败 {{ item.failed }} · 未执行 {{ item.not_run }}</small></li></ul></section><section><h2>六角色记录</h2><ul><li v-for="item in data.by_role" :key="item.key"><span>{{ item.key }}</span><b>{{ item.verified }}/{{ item.expected_allowed }}</b><small>成功 {{ item.success }} · 空 {{ item.empty }} · 受阻 {{ item.blocked }} · 越权 {{ item.unauthorized }}</small></li></ul></section></section>
      <section class="p63-operations"><header><div><h2>逐操作证据</h2><p>当前筛选 {{ data.total_filtered }} 项；最多显示300项。展开项读取五维测试ID和最近结果。</p></div></header><article v-for="operation in data.operations" :key="operation.method + ':' + operation.path"><header><b>{{ operation.method }}</b><code>{{ operation.path }}</code></header><small>{{ operation.operation_id }}</small><dl><div><dt>运行结果</dt><dd>{{ outcomeName(operation.outcome) }}</dd></div><div><dt>角色</dt><dd>{{ operation.verification_role || operation.expected_roles.join('、') || '公开' }}</dd></div><div><dt>数据来源</dt><dd>{{ sourceName(operation.data_source) }}</dd></div><div><dt>UI 消费方</dt><dd>{{ operation.ui_consumers.join('、') || '尚无声明' }}</dd></div></dl><details><summary>查看五维证据</summary><ul><li v-for="(item,key) in operation.evidence" :key="key"><b>{{ dimensionName(String(key)) }}：{{ evidenceStatusName(item.status) }}</b><span>{{ item.test_id || '尚无测试 ID' }}{{ item.latest_result ? ' · ' + item.latest_result : '' }}</span></li></ul></details></article><p v-if="!data.operations.length" class="p63-empty">当前筛选没有匹配操作；上方统计仍对应整个目录。</p></section></section>
  </section>`;
  return once(source, root, next);
}
export function apiCoveragePagePlugin() {
  return {
    name: "p63-actual-vue-review",
    enforce: "pre",
    transform(source, id) {
      const file = id.replaceAll("\\", "/"),
        absolute = (value) => path.resolve(value).replaceAll("\\", "/");
      if (file === absolute("apps/web/src/components/ApiCoverageDashboard.vue"))
        return { code: previewApiCoveragePage(source), map: null };
    },
  };
}
