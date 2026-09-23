<script setup lang="ts">
import type { ApiCoverageOperation } from "./api-coverage-types";

defineProps<{ operation: ApiCoverageOperation }>();

const outcomeName = (value: string) =>
  ({
    success: "成功",
    empty: "空结果",
    blocked: "受阻",
    unauthenticated: "未登录受阻",
    unauthorized: "越权拒绝",
    not_run: "未执行",
  })[value] ?? value;
const dimensionName = (value: string) =>
  ({
    normal: "正常请求",
    authorization: "鉴权拒绝",
    parameters: "参数校验",
    idempotency: "幂等 / 并发",
    fault: "故障注入",
  })[value] ?? value;
const evidenceStatusName = (value: string) =>
  ({ passed: "通过", failed: "失败", not_run: "未执行", not_applicable: "不适用" })[value] ?? value;
</script>

<template>
  <article class="p63-operation" :data-outcome="operation.outcome">
    <header class="p63-operation__head">
      <div class="p63-operation__identity">
        <b class="p63-operation__method">{{ operation.method }}</b>
        <code>{{ operation.path }}</code>
        <small>{{ operation.operation_id }}</small>
      </div>
      <span class="p63-operation__outcome" :data-state="operation.outcome">
        {{ outcomeName(operation.outcome) }}
        <template v-if="operation.http_status !== null">
          · HTTP {{ operation.http_status }}</template
        >
      </span>
    </header>

    <dl class="p63-operation__facts">
      <div>
        <dt>所需能力</dt>
        <dd>{{ operation.required_capability || "公开接口" }}</dd>
      </div>
      <div>
        <dt>记录角色</dt>
        <dd>{{ operation.verification_role || "暂无已记录角色" }}</dd>
      </div>
      <div>
        <dt>预期可访问角色</dt>
        <dd>{{ operation.expected_roles.join("、") || "公开" }}</dd>
      </div>
      <div>
        <dt>数据来源</dt>
        <dd>{{ operation.data_source.replaceAll("_", " · ") }}</dd>
      </div>
      <div>
        <dt>UI 消费方</dt>
        <dd>{{ operation.ui_consumers.join("、") || "尚无声明" }}</dd>
      </div>
      <div>
        <dt>爬虫副作用</dt>
        <dd>{{ operation.crawler_side_effect.replaceAll("_", " · ") }}</dd>
      </div>
    </dl>

    <details class="p63-operation__evidence">
      <summary :aria-label="`查看 ${operation.method} ${operation.path} 的五维证据`">
        查看五维证据
      </summary>
      <ul>
        <li v-for="(item, key) in operation.evidence" :key="key" :data-state="item.status">
          <b>{{ dimensionName(String(key)) }} · {{ evidenceStatusName(item.status) }}</b>
          <span>{{ item.applicable ? "适用" : "不适用" }}</span>
          <p>测试 ID：{{ item.test_id || "尚无测试 ID" }}</p>
          <p>最近结果：{{ item.latest_result || "尚无结果记录" }}</p>
        </li>
      </ul>
    </details>

    <details class="p63-operation__trace">
      <summary :aria-label="`查看 ${operation.method} ${operation.path} 的技术追踪编号`">
        技术追踪编号
      </summary>
      <dl>
        <div>
          <dt>请求编号</dt>
          <dd>{{ operation.request_id || "暂无" }}</dd>
        </div>
        <div>
          <dt>追踪编号</dt>
          <dd>{{ operation.trace_id || "暂无" }}</dd>
        </div>
      </dl>
    </details>
  </article>
</template>

<style scoped>
.p63-operation {
  min-width: 0;
  padding: 18px;
  border: 1px solid var(--p63-line);
  background: #fff;
}
.p63-operation + .p63-operation {
  margin-top: 12px;
}
.p63-operation__head,
.p63-operation__identity {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 10px;
}
.p63-operation__head {
  justify-content: space-between;
}
.p63-operation__identity {
  flex-wrap: wrap;
}
.p63-operation__method {
  flex: 0 0 auto;
  padding: 2px 7px;
  background: #edf4ff;
  color: #1748a0;
  font-size: 13px;
}
.p63-operation code,
.p63-operation dd,
.p63-operation p {
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.p63-operation__identity code {
  color: #182d4a;
}
.p63-operation__identity small {
  min-width: 0;
  flex-basis: 100%;
  overflow-wrap: anywhere;
  color: var(--p63-muted);
}
.p63-operation__outcome {
  flex: 0 0 auto;
  color: #52647b;
}
.p63-operation [data-state="success"],
.p63-operation [data-state="passed"] {
  color: #185f47;
}
.p63-operation [data-state="blocked"],
.p63-operation [data-state="unauthorized"],
.p63-operation [data-state="unauthenticated"],
.p63-operation [data-state="failed"] {
  color: #9a3f36;
}
.p63-operation [data-state="not_run"],
.p63-operation [data-state="not_applicable"],
.p63-operation [data-state="empty"] {
  color: #805300;
}
.p63-operation__facts,
.p63-operation__trace dl {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 14px 0 0;
}
.p63-operation__facts div,
.p63-operation__trace dl div {
  min-width: 0;
  padding: 10px;
  background: #f7f9fc;
}
.p63-operation dt {
  color: var(--p63-muted);
  font-size: 13px;
}
.p63-operation dd {
  margin: 3px 0 0;
  color: #182d4a;
}
.p63-operation details {
  margin-top: 10px;
  border-top: 1px solid var(--p63-line);
}
.p63-operation summary {
  min-height: 44px;
  padding: 10px 2px;
  color: #1748a0;
  cursor: pointer;
}
.p63-operation summary:focus-visible {
  outline: 3px solid #2465d7;
  outline-offset: 2px;
}
.p63-operation__evidence ul {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
  padding: 0 0 10px;
  list-style: none;
}
.p63-operation__evidence li {
  min-width: 0;
  padding: 12px;
  background: #f7f9fc;
}
.p63-operation__evidence li > span {
  display: block;
  margin-top: 3px;
  color: var(--p63-muted);
  font-size: 13px;
}
.p63-operation__evidence p {
  margin: 7px 0 0;
  color: #182d4a;
}
.p63-operation__trace dl {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-bottom: 10px;
}
@media (max-width: 760px) {
  .p63-operation {
    padding: 14px;
  }
  .p63-operation__head {
    flex-direction: column;
  }
  .p63-operation__facts,
  .p63-operation__evidence ul,
  .p63-operation__trace dl {
    grid-template-columns: 1fr;
  }
}
</style>
