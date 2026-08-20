<script setup lang="ts">
defineProps<{
  open: boolean;
  editor: any | null;
  form: any;
  saving: boolean;
  audienceOptions?: { organizations?: any[]; users?: any[] };
}>();
defineEmits<{ close: []; save: [] }>();
</script>

<template>
  <dialog :open="open" class="message-dialog">
    <form @submit.prevent="$emit('save')">
      <header>
        <div>
          <small>{{ editor?.id ? "编辑草稿" : "新建草稿" }}</small>
          <h3>{{ form.kind === "email" ? "平台邮件" : "平台通知" }}</h3>
        </div>
        <button type="button" aria-label="关闭" @click="$emit('close')">×</button>
      </header>
      <label
        >标题<input
          v-model="form.title"
          required
          minlength="2"
          maxlength="200"
          placeholder="接收人看到的标题"
      /></label>
      <label>
        正文
        <textarea
          v-model="form.body"
          required
          minlength="2"
          maxlength="2000"
          rows="7"
          placeholder="写清楚事项、影响和需要采取的行动"
        ></textarea>
      </label>
      <div class="message-form-grid">
        <label
          >消息类型<select v-model="form.category">
            <option value="system">系统通知</option>
            <option value="task">任务通知</option>
            <option value="approval">审批通知</option>
            <option value="competitor">竞品通知</option>
          </select></label
        >
        <label
          >重要程度<select v-model="form.severity">
            <option value="info">普通</option>
            <option value="warning">重要</option>
            <option value="critical">严重</option>
          </select></label
        >
      </div>
      <label
        >接收范围<select v-model="form.audience_type">
          <option value="all_users">全部活动用户</option>
          <option value="organization">指定组织</option>
          <option value="user">指定用户</option>
        </select></label
      >
      <label v-if="form.audience_type === 'organization'"
        >选择组织<select v-model="form.organization_id" required>
          <option value="">请选择</option>
          <option
            v-for="item in audienceOptions?.organizations || []"
            :key="item.id"
            :value="item.id"
          >
            {{ item.name }}
          </option>
        </select></label
      >
      <label v-if="form.audience_type === 'user'"
        >选择用户<select v-model="form.user_id" required>
          <option value="">请选择</option>
          <option v-for="item in audienceOptions?.users || []" :key="item.id" :value="item.id">
            {{ item.email }}
          </option>
        </select></label
      >
      <fieldset>
        <legend>发送方式</legend>
        <label
          ><input
            v-model="form.in_app_enabled"
            type="checkbox"
            :disabled="form.kind === 'email'"
          />站内通知</label
        >
        <label
          ><input v-model="form.email_enabled" type="checkbox" disabled />邮件（服务未接入）</label
        >
      </fieldset>
      <label v-if="editor?.id"
        >修改原因<input v-model="form.reason" required minlength="2" maxlength="300"
      /></label>
      <p class="dialog-help">
        邮件服务尚未接入，当前只能发布站内通知；历史邮件记录仍保留审计事实。
      </p>
      <footer>
        <button type="button" @click="$emit('close')">取消</button>
        <button :disabled="saving">{{ saving ? "保存中…" : "保存草稿" }}</button>
      </footer>
    </form>
  </dialog>
</template>

<style scoped>
dialog {
  position: fixed;
  inset: 0;
  width: min(620px, calc(100% - 28px));
  margin: auto;
  border: 1px solid var(--so-border-strong);
  border-radius: 16px;
  color: var(--so-text);
  background: var(--so-panel);
  box-shadow: 0 24px 80px color-mix(in srgb, var(--so-shadow-color) 60%, transparent);
}
form {
  min-width: min(430px, 80vw);
  padding: 10px;
  display: grid;
  gap: 12px;
}
header,
footer {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
footer {
  justify-content: flex-end;
}
label {
  display: grid;
  gap: 6px;
}
input,
select,
textarea,
button {
  padding: 9px 12px;
  border: 1px solid var(--so-border-strong);
  border-radius: 9px;
  color: var(--so-text);
  background: var(--so-panel);
  font: inherit;
}
header button {
  border: 0;
  background: transparent;
  font-size: 24px;
}
footer button:last-child {
  border-color: var(--so-primary);
  color: var(--so-on-primary);
  background: var(--so-primary);
  font-weight: 800;
}
.message-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
fieldset {
  padding: 10px 12px;
  display: flex;
  gap: 18px;
  border: 1px solid var(--so-border-strong);
  border-radius: 9px;
}
fieldset label {
  display: flex;
  align-items: center;
  gap: 7px;
}
fieldset input {
  width: auto;
}
.dialog-help {
  color: var(--so-text-muted);
  font-size: 11px;
}
@media (max-width: 700px) {
  .message-form-grid {
    grid-template-columns: 1fr;
  }
  form {
    min-width: 0;
  }
}
</style>
