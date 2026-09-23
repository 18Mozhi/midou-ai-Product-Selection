<script setup lang="ts">
import type { AcceptanceSnapshot } from "./provider-1688-acceptance-types";

defineProps<{
  data: AcceptanceSnapshot;
  passedGateCount: number;
  title: string;
  conclusion: string;
}>();

const gateName = { login: "登录态", captcha: "验证码", parser: "字段解析" } as const;
const gateState = { passed: "已通过", blocked: "已阻断", pending: "待验收" } as const;
const gateAction = {
  login: "配置有效登录档案，并完成一次真实登录态运行。",
  captcha: "由同一次真实登录运行自动确认未被验证码阻断。",
  parser: "固定真实样本，完成当前解析器回放和第二人审批。",
} as const;
const matrixName = { search: "搜索结果", detail: "商品详情", pagination: "翻页覆盖" } as const;
const matrixState = {
  covered: "已覆盖",
  not_observed: "未观测",
  not_exercised: "未演练",
  invalid: "合同异常",
} as const;
const sourceState = { draft: "草稿", disabled: "已停用", enabled: "已启用" } as const;
const time = (value: string | null) =>
  value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "尚无证据";
</script>

<template>
  <section
    class="acceptance-1688__verdict"
    :data-overall="data.overall"
    aria-labelledby="acceptance-1688-verdict-title"
  >
    <div class="acceptance-1688__verdict-copy">
      <span>当前结论（由服务端判定）</span>
      <h3 id="acceptance-1688-verdict-title">{{ title }}</h3>
      <p>{{ conclusion }}</p>
    </div>
    <dl>
      <div>
        <dt>来源状态</dt>
        <dd>{{ sourceState[data.source_status] }}</dd>
      </div>
      <div>
        <dt>通过门禁</dt>
        <dd>{{ passedGateCount }} / 3</dd>
      </div>
      <div>
        <dt>责任人</dt>
        <dd>{{ data.owner_label }}</dd>
      </div>
    </dl>
  </section>

  <section class="acceptance-1688__section" aria-labelledby="acceptance-1688-gates-title">
    <header>
      <div>
        <p>启用门禁 · 独立证据</p>
        <h3 id="acceptance-1688-gates-title">三项必须逐项有证据</h3>
      </div>
      <small>全部通过仍需负责人显式启用</small>
    </header>
    <div class="acceptance-1688__gates" aria-label="1688 启用条件">
      <article v-for="gate in data.gates" :key="gate.key" :data-gate-state="gate.state">
        <div class="acceptance-1688__card-title">
          <span>{{ gateName[gate.key] }}</span
          ><strong>{{ gateState[gate.state] }}</strong>
        </div>
        <p>{{ gate.reason }}</p>
        <small>{{ gateAction[gate.key] }}</small>
        <time :datetime="gate.evidence_at || undefined"
          >证据时间：{{ time(gate.evidence_at) }}</time
        >
      </article>
    </div>
  </section>

  <section class="acceptance-1688__section" aria-labelledby="acceptance-1688-matrix-title">
    <header>
      <div>
        <p>真实作业覆盖 · 不计入启用门禁</p>
        <h3 id="acceptance-1688-matrix-title">搜索、详情与翻页矩阵</h3>
      </div>
      <small
        >解析器 {{ data.coverage_matrix.parser_version }} ·
        {{ time(data.coverage_matrix.observed_at) }}</small
      >
    </header>
    <div class="acceptance-1688__matrix">
      <article
        v-for="row in data.coverage_matrix.rows"
        :key="row.key"
        :data-matrix-state="row.state"
      >
        <div class="acceptance-1688__card-title">
          <span>{{ matrixName[row.key] }}</span
          ><strong>{{ matrixState[row.state] }}</strong>
        </div>
        <p>{{ row.reason }}</p>
        <small>{{ row.contract }} · {{ row.observed_count }} 项</small>
      </article>
    </div>
  </section>
</template>
