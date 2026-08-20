<script setup lang="ts">
import { useModalDialog } from "../use-modal-dialog";
import "./platform-message-editor.css";

const props = defineProps<{
  open: boolean;
  editor: any | null;
  form: any;
  saving: boolean;
  audienceOptions?: { organizations?: any[]; users?: any[] };
}>();
const emit = defineEmits<{ close: []; save: [] }>();
const { dialogElement, handleCancel } = useModalDialog(
  () => props.open,
  () => emit("close"),
);
</script>

<template>
  <dialog
    ref="dialogElement"
    class="message-dialog"
    :aria-label="editor?.id ? '编辑平台消息草稿' : '新建平台消息草稿'"
    @cancel="handleCancel"
  >
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
