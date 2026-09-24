<script setup lang="ts">
import { computed } from "vue";
import { useModalDialog } from "../use-modal-dialog";
import type { MemberOption, TaskActionEditor, TaskActionForm } from "./task-workspace-types";

const props = defineProps<{
  taskTitle: string;
  taskVersion: number;
  actionEditor: TaskActionEditor | null;
  actionForm: TaskActionForm;
  members: MemberOption[];
  busy: boolean;
}>();

const emit = defineEmits<{
  submit: [];
  close: [];
  "update:actionForm": [value: TaskActionForm];
}>();

const dialogTitle = computed(() => {
  switch (props.actionEditor) {
    case "transfer":
      return "转交任务";
    case "delay":
      return "调整任务期限";
    case "progress":
      return "更新任务进度";
    case "pause":
      return "暂停任务";
    case "cancel":
      return "取消任务";
    default:
      return "任务操作";
  }
});

const { dialogElement, handleCancel } = useModalDialog(
  () => Boolean(props.actionEditor),
  () => emit("close"),
);

const updateActionForm = (field: keyof TaskActionForm, value: string | number) =>
  emit("update:actionForm", { ...props.actionForm, [field]: value });
</script>

<template>
  <dialog
    ref="dialogElement"
    class="task-action-dialog task-action-dialog--detail"
    :aria-labelledby="'task-action-dialog-title'"
    aria-describedby="task-action-context"
    :aria-busy="busy"
    @cancel="handleCancel"
  >
    <form @submit.prevent="emit('submit')">
      <header class="task-action-heading">
        <div>
          <span>任务操作 · 第 {{ taskVersion }} 版</span>
          <h3 id="task-action-dialog-title">{{ dialogTitle }}</h3>
        </div>
        <button
          type="button"
          class="task-action-close"
          aria-label="关闭任务操作窗口"
          @click="emit('close')"
        >
          ×
        </button>
      </header>

      <div class="task-action-body">
        <section id="task-action-context" class="task-action-context" aria-label="提交说明">
          <span>任务对象</span>
          <strong>{{ taskTitle }}</strong>
          <p>提交后会写入任务活动与审计记录，并使用当前任务版本进行冲突校验。</p>
        </section>

        <label v-if="actionEditor === 'transfer'" for="task-action-assignee">
          <span>接收成员 <b>必填</b></span>
          <select
            id="task-action-assignee"
            :value="actionForm.assignee_id"
            required
            aria-describedby="task-action-assignee-help"
            @change="updateActionForm('assignee_id', ($event.target as HTMLSelectElement).value)"
          >
            <option value="" disabled>请选择可访问当前工作区的成员</option>
            <option v-for="member in members" :key="member.id" :value="member.id">
              {{ member.label }}
            </option>
          </select>
          <small id="task-action-assignee-help">仅可选择当前工作区成员。</small>
        </label>

        <label v-if="actionEditor === 'delay'" for="task-action-due-at">
          <span>新截止时间 <b>必填</b></span>
          <input
            id="task-action-due-at"
            :value="actionForm.due_at"
            type="datetime-local"
            required
            aria-describedby="task-action-due-help"
            @input="updateActionForm('due_at', ($event.target as HTMLInputElement).value)"
          />
          <small id="task-action-due-help">选择任务新的完成时限。</small>
        </label>

        <template v-if="actionEditor === 'progress'">
          <label for="task-action-progress">
            <span>完成进度（0–100） <b>必填</b></span>
            <input
              id="task-action-progress"
              :value="actionForm.progress_percent"
              type="number"
              min="0"
              max="100"
              step="1"
              required
              aria-describedby="task-action-progress-help"
              @input="
                updateActionForm(
                  'progress_percent',
                  Number(($event.target as HTMLInputElement).value),
                )
              "
            />
            <small id="task-action-progress-help">请输入 0 至 100 的整数百分比。</small>
          </label>
          <label for="task-action-progress-note">
            <span>本次进展说明 <b>必填 · 最多 500 字</b></span>
            <textarea
              id="task-action-progress-note"
              :value="actionForm.progress_note"
              maxlength="500"
              required
              placeholder="说明已完成内容、当前阻塞和下一步"
              aria-describedby="task-action-progress-note-help"
              @input="
                updateActionForm('progress_note', ($event.target as HTMLTextAreaElement).value)
              "
            ></textarea>
            <small id="task-action-progress-note-help">内容会作为本次进度活动记录。</small>
          </label>
        </template>

        <label v-else for="task-action-reason">
          <span>操作原因 <b>必填 · 最多 500 字</b></span>
          <textarea
            id="task-action-reason"
            :value="actionForm.reason"
            maxlength="500"
            required
            placeholder="请填写可审计的操作原因"
            aria-describedby="task-action-reason-help"
            @input="updateActionForm('reason', ($event.target as HTMLTextAreaElement).value)"
          ></textarea>
          <small id="task-action-reason-help">原因会写入任务活动与审计记录。</small>
        </label>
      </div>

      <footer class="task-action-footer">
        <button type="button" class="task-action-return" @click="emit('close')">返回</button>
        <button
          type="submit"
          class="task-action-submit"
          :data-danger="actionEditor === 'cancel'"
          :disabled="busy"
        >
          {{ busy ? "正在提交…" : "确认提交" }}
        </button>
      </footer>
    </form>
  </dialog>
</template>
