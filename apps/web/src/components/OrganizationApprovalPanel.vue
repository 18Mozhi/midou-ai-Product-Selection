<script setup lang="ts">
defineProps<{
  templates: any[];
  approvals: any[];
  summary: Record<string, number>;
  statusText: (value: string) => string;
  summaryText: (value: string) => string;
  formatTime: (value: string) => string;
}>();
</script>

<template>
  <section class="org-admin-card">
    <header class="org-admin-section-header">
      <div>
        <p>组织治理</p>
        <h3>审批模板</h3>
      </div>
      <small>模板按所属工作区展示；发布与修改继续使用既有审批合同。</small>
    </header>
    <div class="org-admin-template-grid">
      <article v-for="template in templates" :key="template.id">
        <i>{{ statusText(template.status) }}</i
        ><b>{{ template.name }}</b>
        <small
          >{{ template.workspace_name }} · {{ template.node_count }} 个节点 · 当前第
          {{ template.current_version }} 版</small
        >
        <details class="org-admin-template-diff">
          <summary v-if="template.version_diff.from_version">
            预览 v{{ template.version_diff.from_version }} → v{{
              template.version_diff.to_version
            }}
            差异（{{ template.version_diff.change_count }} 个节点）
          </summary>
          <summary v-else>版本差异预览</summary>
          <p v-if="!template.version_diff.from_version">这是首个版本，没有上一版本可比较。</p>
          <p v-else-if="!template.version_diff.changes.length">
            节点顺序、审批人、时限和超时接收人均未变化。
          </p>
          <div
            v-for="change in template.version_diff.changes"
            :key="`${template.id}-${change.ordinal}`"
            class="org-admin-template-change"
            :data-kind="change.kind"
          >
            <b>第 {{ change.ordinal }} 节点 · {{ change.node_name }}</b>
            <p v-if="change.kind === 'added'">当前版本新增</p>
            <p v-else-if="change.kind === 'removed'">当前版本移除</p>
            <dl v-else>
              <div v-for="field in change.fields" :key="field.field">
                <dt>{{ field.label }}</dt>
                <dd>{{ field.before ?? "未设置" }} → {{ field.after ?? "未设置" }}</dd>
              </div>
            </dl>
          </div>
        </details>
      </article>
    </div>
    <h3 class="org-admin-subheading">审批记录</h3>
    <div class="org-admin-summary-row">
      <span v-for="(value, key) in summary" :key="key"
        ><b>{{ value }}</b
        ><small>{{ summaryText(String(key)) }}</small></span
      >
    </div>
    <div v-for="approval in approvals" :key="approval.id" class="org-admin-line">
      <div>
        <b>{{ approval.title }}</b
        ><small
          >当前第 {{ approval.current_node_ordinal }} 阶段 · 提交于
          {{ formatTime(approval.created_at) }}</small
        >
        <details class="org-admin-technical">
          <summary>技术详情</summary>
          <code>记录 ID：{{ approval.resource_id }}</code
          ><code>模板 ID：{{ approval.template_id }}</code>
        </details>
      </div>
      <i>{{ statusText(approval.status) }}</i>
    </div>
    <p v-if="!approvals.length">暂无组织级审批记录。</p>
  </section>
</template>
