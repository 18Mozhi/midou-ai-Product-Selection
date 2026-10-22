<script setup lang="ts">
import type { OpportunityDetail } from "./opportunity-workspace-types";
import { opportunityStatusLabel } from "./opportunity-workspace-presentation";
defineProps<{ decisions: OpportunityDetail["decisions"] }>();
</script>
<template>
  <section class="opportunity-decisions" aria-labelledby="decision-history-title">
    <header>
      <h3 id="decision-history-title">决策记录</h3>
      <span>{{ decisions.length }} 条</span>
    </header>
    <p v-if="!decisions.length" class="opportunity-empty-copy">尚无决策记录。</p>
    <div v-else class="decision-history-table">
      <table>
        <caption class="decision-history-caption">
          已保存的决策记录，按接口原顺序展示；不代表当前评分或最新建议。
        </caption>
        <thead>
          <tr>
            <th scope="col">决定</th>
            <th scope="col">原因</th>
            <th scope="col">记录时间（原始时间）</th>
            <th scope="col">商品版本</th>
            <th scope="col">操作者编号</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in decisions" :key="item.id">
            <th scope="row">{{ opportunityStatusLabel(item.action) }}</th>
            <td data-label="原因">{{ item.reason || "原因未知" }}</td>
            <td data-label="记录时间">
              <time v-if="item.created_at" :datetime="item.created_at">{{ item.created_at }}</time
              ><span v-else>时间未知</span>
            </td>
            <td data-label="商品版本">
              {{ item.opportunity_version == null ? "版本未知" : `v${item.opportunity_version}` }}
            </td>
            <td data-label="操作者编号">
              <code>{{ item.actor_id || "操作者未知" }}</code>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
<style scoped>
.opportunity-decisions h3 {
  margin: 0 0 14px;
  font-size: 18px;
  font-weight: 500;
}
.decision-history-table {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 14px;
}
.decision-history-caption {
  text-align: left;
  padding: 0 0 14px;
  color: var(--so-text-muted);
  line-height: 1.6;
}
th,
td {
  padding: 12px 14px;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid var(--so-border);
  overflow-wrap: anywhere;
  font-weight: 400;
}
thead {
  color: var(--so-text-muted);
  background: var(--so-panel-soft);
}
tbody th {
  color: var(--so-text);
  font-weight: 500;
}
code {
  white-space: normal;
  overflow-wrap: anywhere;
}
@media (max-width: 760px) {
  .decision-history-caption {
    display: block;
    width: 100%;
  }
  table,
  tbody {
    display: block;
  }
  thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  tbody tr {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    padding: 14px 0;
    border-bottom: 1px solid var(--so-border);
  }
  th,
  td {
    padding: 0;
    border: 0;
    min-width: 0;
  }
  tbody th,
  td[data-label="原因"],
  td[data-label="操作者编号"] {
    grid-column: 1 / -1;
  }
  td::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 5px;
    color: var(--so-text-muted);
  }
}
</style>
