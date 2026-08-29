<script setup lang="ts">
import ResponsiveDataView from "./ResponsiveDataView.vue";

const props = defineProps<{
  domain: "content" | "email";
  items: any[];
  busy: string;
  stateName: (value: unknown) => string;
  when: (value: unknown) => string;
}>();

const emit = defineEmits<{
  review: [item: any, status: "active" | "irrelevant" | "stale"];
  emailAction: [item: any, action: "retry" | "suppress"];
}>();

const emailKindText = (value: unknown) =>
  (
    ({
      email_verification: "邮箱验证",
      password_reset: "密码重置",
    }) as Record<string, string>
  )[String(value)] ?? "业务通知";
const canRetry = (item: any) =>
  (item.source_type === "account" &&
    ["blocked_provider", "dead_letter", "retry_scheduled"].includes(item.status)) ||
  (item.source_type === "notification" &&
    ["failed", "dead_letter", "suppressed"].includes(item.status));
const canSuppress = (item: any) =>
  item.source_type === "notification" && !["delivered", "suppressed"].includes(item.status);
const emailTitle = (item: any) => item.title || emailKindText(item.kind);
</script>

<template>
  <ResponsiveDataView
    v-if="domain === 'content'"
    class="platform-management-table"
    :rows="items"
    :row-key="(item) => item.id"
    title="热点内容记录"
    :detail-title="(item) => item.title"
    empty-message="没有符合条件的热点内容。"
  >
    <template #desktop>
      <table>
        <thead>
          <tr>
            <th>热点主题</th>
            <th>组织 / 工作区</th>
            <th>市场</th>
            <th>信号 / 来源</th>
            <th>置信度 / 最近观测</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id">
            <td>
              <strong>{{ item.title }}</strong
              ><small>{{ item.category || "未分类" }} · 热度 {{ item.heat_value }}</small>
            </td>
            <td>
              {{ item.organization_name }}<small>{{ item.workspace_name }}</small>
            </td>
            <td>{{ item.market }} · {{ item.language }}</td>
            <td>{{ item.signal_count }} / {{ item.source_count }}</td>
            <td>
              {{ stateName(item.confidence_status) }}<small>{{ when(item.last_seen_at) }}</small>
            </td>
            <td>
              <b :data-state="item.status">{{ stateName(item.status) }}</b>
            </td>
            <td>
              <button
                :disabled="busy === item.id || item.status === 'active'"
                title="设为展示中"
                @click="emit('review', item, 'active')"
              >
                展示</button
              ><button
                :disabled="busy === item.id || item.status === 'irrelevant'"
                title="标记为无关"
                @click="emit('review', item, 'irrelevant')"
              >
                无关</button
              ><button
                :disabled="busy === item.id || item.status === 'stale'"
                title="标记为过期"
                @click="emit('review', item, 'stale')"
              >
                过期
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </template>
    <template #summary="{ row }">
      <span class="responsive-record-summary"
        ><strong>{{ row.title }}</strong
        ><small>{{ stateName(row.status) }} · {{ row.organization_name }}</small></span
      >
    </template>
    <template #detail="{ row, close }">
      <dl>
        <div>
          <dt>分类与热度</dt>
          <dd>{{ row.category || "未分类" }} · {{ row.heat_value }}</dd>
        </div>
        <div>
          <dt>组织 / 工作区</dt>
          <dd>{{ row.organization_name }} / {{ row.workspace_name }}</dd>
        </div>
        <div>
          <dt>市场与语言</dt>
          <dd>{{ row.market }} · {{ row.language }}</dd>
        </div>
        <div>
          <dt>信号 / 来源</dt>
          <dd>{{ row.signal_count }} / {{ row.source_count }}</dd>
        </div>
        <div>
          <dt>状态</dt>
          <dd>{{ stateName(row.status) }}</dd>
        </div>
        <div>
          <dt>置信度 / 最近观测</dt>
          <dd>{{ stateName(row.confidence_status) }} / {{ when(row.last_seen_at) }}</dd>
        </div>
      </dl>
      <div class="record-actions">
        <button
          :disabled="row.status === 'active'"
          @click="
            emit('review', row, 'active');
            close();
          "
        >
          设为展示中
        </button>
        <button
          class="secondary"
          :disabled="row.status === 'irrelevant'"
          @click="
            emit('review', row, 'irrelevant');
            close();
          "
        >
          标记无关
        </button>
        <button
          class="secondary"
          :disabled="row.status === 'stale'"
          @click="
            emit('review', row, 'stale');
            close();
          "
        >
          标记过期
        </button>
      </div>
      <details>
        <summary>技术详情</summary>
        <dl>
          <div>
            <dt>内容 ID</dt>
            <dd>{{ row.id }}</dd>
          </div>
          <div>
            <dt>记录版本</dt>
            <dd>{{ row.version }}</dd>
          </div>
        </dl>
      </details>
    </template>
  </ResponsiveDataView>

  <ResponsiveDataView
    v-else
    class="platform-management-table"
    :rows="items"
    :row-key="(item) => item.id"
    title="邮件投递记录"
    :detail-title="emailTitle"
    empty-message="没有符合条件的邮件记录。"
  >
    <template #desktop>
      <table>
        <thead>
          <tr>
            <th>邮件</th>
            <th>接收邮箱</th>
            <th>类别</th>
            <th>状态</th>
            <th>尝试</th>
            <th>最近错误 / 更新时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id">
            <td>
              <strong>{{ emailTitle(item) }}</strong
              ><small>{{ item.source }}</small>
            </td>
            <td>{{ item.email }}</td>
            <td>{{ emailKindText(item.kind) }}</td>
            <td>
              <b :data-state="item.status">{{ stateName(item.status) }}</b>
            </td>
            <td>{{ item.attempt_count }}</td>
            <td>
              {{ item.last_error_code ? "存在投递错误" : "无错误"
              }}<small>{{ when(item.updated_at) }}</small>
            </td>
            <td>
              <button
                v-if="canRetry(item)"
                title="将失败邮件重新放入投递队列"
                :disabled="busy === item.id"
                @click="emit('emailAction', item, 'retry')"
              >
                重新投递
              </button>
              <button
                v-if="canSuppress(item)"
                title="停止本条业务通知邮件继续投递"
                :disabled="busy === item.id"
                @click="emit('emailAction', item, 'suppress')"
              >
                抑制投递
              </button>
              <span v-if="!canRetry(item) && !canSuppress(item)">无需处理</span>
            </td>
          </tr>
        </tbody>
      </table>
    </template>
    <template #summary="{ row }">
      <span class="responsive-record-summary"
        ><strong>{{ emailTitle(row) }}</strong
        ><small>{{ stateName(row.status) }} · {{ row.email }}</small></span
      >
    </template>
    <template #detail="{ row, close }">
      <dl>
        <div>
          <dt>接收邮箱</dt>
          <dd>{{ row.email }}</dd>
        </div>
        <div>
          <dt>来源</dt>
          <dd>{{ row.source }}</dd>
        </div>
        <div>
          <dt>类别</dt>
          <dd>{{ emailKindText(row.kind) }}</dd>
        </div>
        <div>
          <dt>状态</dt>
          <dd>{{ stateName(row.status) }}</dd>
        </div>
        <div>
          <dt>投递尝试</dt>
          <dd>{{ row.attempt_count }} 次</dd>
        </div>
        <div>
          <dt>最近错误</dt>
          <dd>{{ row.last_error_code ? "存在投递错误" : "无错误" }}</dd>
        </div>
        <div>
          <dt>更新时间</dt>
          <dd>{{ when(row.updated_at) }}</dd>
        </div>
      </dl>
      <div v-if="canRetry(row) || canSuppress(row)" class="record-actions">
        <button
          v-if="canRetry(row)"
          :disabled="busy === row.id"
          @click="
            emit('emailAction', row, 'retry');
            close();
          "
        >
          重新投递
        </button>
        <button
          v-if="canSuppress(row)"
          class="secondary"
          :disabled="busy === row.id"
          @click="
            emit('emailAction', row, 'suppress');
            close();
          "
        >
          抑制投递
        </button>
      </div>
      <p v-else>当前记录无需人工处理。</p>
      <details>
        <summary>技术详情</summary>
        <dl>
          <div>
            <dt>投递 ID</dt>
            <dd>{{ row.id }}</dd>
          </div>
          <div>
            <dt>来源类型</dt>
            <dd>{{ row.source_type }}</dd>
          </div>
          <div v-if="row.kind">
            <dt>原始类别</dt>
            <dd>{{ row.kind }}</dd>
          </div>
          <div v-if="row.last_error_code">
            <dt>错误代码</dt>
            <dd>{{ row.last_error_code }}</dd>
          </div>
        </dl>
      </details>
    </template>
  </ResponsiveDataView>
</template>

<style scoped>
.platform-management-table {
  min-width: 0;
  padding: 17px;
  border: 1px solid var(--so-border);
  border-radius: 14px;
  background: var(--so-panel);
}
table {
  width: 100%;
  min-width: 860px;
  border-collapse: collapse;
}
th,
td {
  padding: 12px 9px;
  text-align: left;
  border-bottom: 1px solid var(--so-border);
  font-size: 13px;
}
td strong,
td small {
  display: block;
}
td strong {
  max-width: 260px;
  overflow-wrap: anywhere;
}
td small {
  margin-top: 4px;
  color: var(--so-text-muted);
}
td button {
  margin: 2px;
  padding: 6px 9px;
}
b[data-state="active"],
b[data-state="delivered"],
b[data-state="succeeded"] {
  color: var(--so-success);
}
b[data-state="irrelevant"],
b[data-state="stale"],
b[data-state="archived"],
b[data-state="dead_letter"],
b[data-state="failed"] {
  color: var(--so-danger);
}
.record-actions {
  display: grid;
  gap: 8px;
}
button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
@media (max-width: 760px) {
  .platform-management-table {
    padding: 0;
    border: 0;
    background: transparent;
  }
}
</style>
