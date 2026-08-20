<script setup lang="ts">
defineProps<{
  domain: string;
  messages: any[];
  stateName: (value: unknown) => string;
  when: (value: unknown) => string;
}>();

defineEmits<{
  create: [];
  edit: [item: any];
  action: [item: any, action: "publish" | "cancel"];
}>();
</script>

<template>
  <section class="message-workbench">
    <header>
      <div>
        <h3>{{ domain === "email" ? "邮件草稿与发送记录" : "通知草稿与发布记录" }}</h3>
        <span>先保存草稿，确认接收范围和发送方式后再发布；已发布内容不可直接篡改。</span>
      </div>
      <button type="button" @click="$emit('create')">
        ＋ {{ domain === "email" ? "新建邮件草稿" : "新建通知草稿" }}
      </button>
    </header>
    <div class="message-list">
      <article v-for="item in messages" :key="item.id" :data-status="item.status">
        <header>
          <div>
            <small
              >{{ stateName(item.kind) }} · {{ stateName(item.category) }} ·
              {{ stateName(item.severity) }}</small
            >
            <h4>{{ item.title }}</h4>
          </div>
          <b>{{ stateName(item.status) }}</b>
        </header>
        <p>{{ item.body }}</p>
        <dl>
          <div>
            <dt>接收范围</dt>
            <dd>
              {{
                item.audience_type === "all_users"
                  ? "全部活动用户"
                  : item.audience_type === "organization"
                    ? item.organization_name
                    : item.user_email
              }}
            </dd>
          </div>
          <div>
            <dt>发送方式</dt>
            <dd>
              {{
                [item.in_app_enabled ? "站内通知" : "", item.email_enabled ? "邮件" : ""]
                  .filter(Boolean)
                  .join("、")
              }}
            </dd>
          </div>
          <div>
            <dt>更新时间</dt>
            <dd>{{ when(item.updated_at) }}</dd>
          </div>
        </dl>
        <footer v-if="item.status === 'draft'">
          <button @click="$emit('edit', item)">编辑</button>
          <button @click="$emit('action', item, 'publish')">
            {{ item.kind === "email" ? "发送" : "发布" }}
          </button>
          <button @click="$emit('action', item, 'cancel')">取消草稿</button>
        </footer>
      </article>
      <p v-if="!messages.length" class="message-empty">还没有草稿。点击右上角即可创建。</p>
    </div>
  </section>
</template>

<style scoped>
.message-workbench {
  padding: 18px;
  display: grid;
  gap: 14px;
  border: 1px solid var(--so-border);
  border-radius: 14px;
  background: var(--so-panel);
}
.message-workbench > header,
.message-list article > header,
.message-list article > footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}
.message-workbench h3,
.message-list h4 {
  margin: 0 0 5px;
}
.message-workbench header span,
.message-list small,
.message-list dt {
  color: var(--so-text-muted);
}
.message-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.message-list article {
  padding: 15px;
  border: 1px solid var(--so-border);
  border-left: 4px solid var(--so-text-muted);
  border-radius: 11px;
  background: var(--so-panel-soft);
}
.message-list article[data-status="draft"] {
  border-left-color: var(--so-warning);
}
.message-list article[data-status="published"] {
  border-left-color: var(--so-success);
}
.message-list article p {
  min-height: 42px;
  color: var(--so-text);
  white-space: pre-wrap;
}
.message-list dl {
  margin: 12px 0;
  display: grid;
  gap: 7px;
}
.message-list dl div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.message-list dd {
  margin: 0;
  text-align: right;
}
.message-empty {
  grid-column: 1/-1;
  padding: 22px;
  color: var(--so-text-muted);
  text-align: center;
}
button {
  box-sizing: border-box;
  padding: 9px 12px;
  border: 1px solid var(--so-border-strong);
  border-radius: 9px;
  color: var(--so-text);
  background: var(--so-panel);
  cursor: pointer;
  font: inherit;
}
@media (max-width: 700px) {
  .message-list {
    grid-template-columns: 1fr;
  }
}
</style>
