<script setup lang="ts">
defineProps<{ data: any }>();

const outcomeName = (value: string) =>
  ({
    success: "成功",
    empty: "空结果",
    blocked: "受阻",
    unauthenticated: "未登录受阻",
    unauthorized: "越权拒绝",
    not_run: "未执行",
  })[value] ?? value;
const sourceName = (value: string) => value.replaceAll("_", " · ");
const percent = (value: number, total: number) =>
  total ? `${((value * 100) / total).toFixed(1)}%` : "0.0%";
</script>

<template>
  <section class="api-coverage" data-testid="api-coverage-dashboard">
    <header class="api-coverage__truth" :data-state="data.report_status">
      <div>
        <strong>{{
          data.report_status === "current" ? "当前目录已验收" : "当前目录待验收"
        }}</strong>
        <p v-if="data.report_status === 'missing'">尚无生产验收报告，目录覆盖不等于运行通过。</p>
        <p v-else-if="data.report_status === 'outdated'">
          最近报告与当前 OpenAPI 指纹不一致，不计入实时覆盖率。
        </p>
        <p v-else-if="data.report_status === 'invalid'">
          最近报告无法解析，不计入实时覆盖率；请重新运行生产验收任务。
        </p>
        <p v-else>
          最近验收于 {{ new Date(data.captured_at).toLocaleString("zh-CN") }} 完成，报告年龄
          {{ data.age_seconds }} 秒。
        </p>
      </div>
      <code>{{ data.catalog_fingerprint.slice(0, 12) }}</code>
    </header>

    <div class="api-coverage__kpis">
      <article>
        <small>OpenAPI 路径</small><strong>{{ data.summary.paths }}</strong>
      </article>
      <article>
        <small>操作基线</small><strong>{{ data.summary.operations }}</strong>
      </article>
      <article>
        <small>实时覆盖率</small><strong>{{ data.summary.coverage_percent.toFixed(2) }}%</strong>
      </article>
      <article>
        <small>已有 UI 消费</small><strong>{{ data.summary.ui_consumed }}</strong>
      </article>
      <article>
        <small>爬虫副作用操作</small><strong>{{ data.summary.crawler_side_effects }}</strong>
      </article>
    </div>

    <div class="api-coverage__breakdowns">
      <section>
        <h3>结果覆盖</h3>
        <ul>
          <li v-for="item in data.by_outcome" :key="item.key">
            <span>{{ outcomeName(item.key) }}</span
            ><b>{{ item.count }}</b
            ><small>{{ percent(item.count, data.summary.operations) }}</small>
          </li>
        </ul>
      </section>
      <section>
        <h3>六角色覆盖</h3>
        <ul>
          <li v-for="item in data.by_role" :key="item.key">
            <span>{{ item.key }}</span
            ><b>{{ item.verified }}/{{ item.expected_allowed }}</b
            ><small
              >成功 {{ item.success }} · 空 {{ item.empty }} · 受阻 {{ item.blocked }} · 越权
              {{ item.unauthorized }}</small
            >
          </li>
        </ul>
      </section>
      <section>
        <h3>数据来源</h3>
        <ul>
          <li v-for="item in data.by_data_source" :key="item.key">
            <span>{{ sourceName(item.key) }}</span
            ><b>{{ item.count }}</b>
          </li>
        </ul>
      </section>
      <section>
        <h3>UI 消费方</h3>
        <ul>
          <li v-for="item in data.by_ui_consumer" :key="item.key">
            <span>{{ item.key === "unmapped" ? "尚无声明" : item.key }}</span
            ><b>{{ item.count }}</b>
          </li>
        </ul>
      </section>
      <section>
        <h3>爬虫副作用</h3>
        <ul>
          <li v-for="item in data.by_crawler_side_effect" :key="item.key">
            <span>{{ sourceName(item.key) }}</span
            ><b>{{ item.count }}</b>
          </li>
        </ul>
      </section>
    </div>

    <section class="api-coverage__operations">
      <header>
        <h3>接口明细</h3>
        <span>当前筛选 {{ data.total_filtered }} 项；最多显示 300 项。</span>
      </header>
      <div class="api-coverage__table">
        <table>
          <thead>
            <tr>
              <th>接口</th>
              <th>验收结果</th>
              <th>角色</th>
              <th>数据来源</th>
              <th>UI 消费方</th>
              <th>爬虫副作用</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="operation in data.operations" :key="`${operation.method}:${operation.path}`">
              <td>
                <b>{{ operation.method }}</b
                ><code>{{ operation.path }}</code>
              </td>
              <td>
                <span :data-state="operation.outcome">{{ outcomeName(operation.outcome) }}</span>
              </td>
              <td>
                {{ operation.verification_role || operation.expected_roles.join("、") || "公开" }}
              </td>
              <td>{{ sourceName(operation.data_source) }}</td>
              <td>{{ operation.ui_consumers.join("、") || "尚无声明" }}</td>
              <td>{{ sourceName(operation.crawler_side_effect) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>

<style scoped>
.api-coverage {
  display: grid;
  gap: 18px;
}
.api-coverage__truth,
.api-coverage__kpis article,
.api-coverage__breakdowns section,
.api-coverage__operations {
  border: 1px solid var(--so-border);
  border-radius: 12px;
  background: var(--so-bg-elevated);
}
.api-coverage__truth {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding: 18px;
  border-left: 4px solid var(--so-warning);
}
.api-coverage__truth[data-state="current"] {
  border-left-color: var(--so-success);
}
.api-coverage__truth p {
  margin: 6px 0 0;
  color: var(--so-text-muted);
}
.api-coverage__truth code {
  align-self: start;
  color: var(--so-text-muted);
}
.api-coverage__kpis {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}
.api-coverage__kpis article {
  padding: 15px;
}
.api-coverage__kpis small,
.api-coverage__kpis strong {
  display: block;
}
.api-coverage__kpis small,
.api-coverage__operations header span {
  color: var(--so-text-muted);
}
.api-coverage__kpis strong {
  margin-top: 8px;
  font-size: 24px;
}
.api-coverage__breakdowns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.api-coverage__breakdowns section {
  padding: 16px;
}
.api-coverage__breakdowns h3,
.api-coverage__operations h3 {
  margin: 0 0 12px;
}
.api-coverage__breakdowns ul {
  max-height: 270px;
  margin: 0;
  padding: 0;
  overflow: auto;
  list-style: none;
}
.api-coverage__breakdowns li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 12px;
  padding: 9px 0;
  border-bottom: 1px solid var(--so-border);
}
.api-coverage__breakdowns li small {
  grid-column: 1 / -1;
  color: var(--so-text-muted);
}
.api-coverage__operations {
  min-width: 0;
  padding: 16px;
}
.api-coverage__operations > header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.api-coverage__table {
  overflow: auto;
}
.api-coverage table {
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
}
.api-coverage th,
.api-coverage td {
  padding: 11px 10px;
  border-bottom: 1px solid var(--so-border);
  text-align: left;
  vertical-align: top;
}
.api-coverage td:first-child {
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr);
  gap: 8px;
}
.api-coverage td code {
  overflow-wrap: anywhere;
  color: var(--so-text-muted);
}
.api-coverage [data-state="success"] {
  color: var(--so-success);
}
.api-coverage [data-state="blocked"],
.api-coverage [data-state="unauthorized"],
.api-coverage [data-state="unauthenticated"] {
  color: var(--so-danger);
}
.api-coverage [data-state="empty"],
.api-coverage [data-state="not_run"] {
  color: var(--so-warning);
}
@media (max-width: 760px) {
  .api-coverage__truth,
  .api-coverage__operations > header {
    align-items: flex-start;
    flex-direction: column;
  }
  .api-coverage__kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .api-coverage__breakdowns {
    grid-template-columns: 1fr;
  }
  .api-coverage__table {
    overflow: visible;
  }
  .api-coverage table,
  .api-coverage tbody {
    display: grid;
    min-width: 0;
    gap: 10px;
  }
  .api-coverage thead {
    display: none;
  }
  .api-coverage tr {
    display: grid;
    gap: 8px;
    padding: 12px;
    border: 1px solid var(--so-border);
    border-radius: 10px;
  }
  .api-coverage td {
    display: grid;
    grid-template-columns: 108px minmax(0, 1fr);
    padding: 0;
    border: 0;
  }
  .api-coverage td:first-child {
    grid-template-columns: 108px 54px minmax(0, 1fr);
  }
  .api-coverage td::before {
    color: var(--so-text-muted);
    font-size: var(--so-font-meta);
  }
  .api-coverage td:nth-child(1)::before {
    content: "接口";
  }
  .api-coverage td:nth-child(2)::before {
    content: "验收结果";
  }
  .api-coverage td:nth-child(3)::before {
    content: "角色";
  }
  .api-coverage td:nth-child(4)::before {
    content: "数据来源";
  }
  .api-coverage td:nth-child(5)::before {
    content: "UI 消费方";
  }
  .api-coverage td:nth-child(6)::before {
    content: "爬虫副作用";
  }
}
</style>
