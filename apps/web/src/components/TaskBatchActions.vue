<script setup lang="ts">
import type { BatchTaskAction, MemberOption, Task } from "./task-workspace-types";
import { useModalDialog } from "../use-modal-dialog";

const props = defineProps<{
  open: boolean;
  action: BatchTaskAction;
  targets: Task[];
  eligible: Task[];
  members: MemberOption[];
  reason: string;
  dueAt: string;
  assigneeId: string;
  busy: boolean;
  canAssign: boolean;
}>();

const emit = defineEmits<{
  start: [action: BatchTaskAction];
  close: [];
  confirm: [];
  "update:reason": [value: string];
  "update:dueAt": [value: string];
  "update:assigneeId": [value: string];
}>();

const { dialogElement, handleCancel } = useModalDialog(
  () => props.open,
  () => emit("close"),
);

function handleDialogCancel(event: Event) {
  if (props.busy) {
    event.preventDefault();
    return;
  }
  handleCancel(event);
}

const actionLabel = (action: BatchTaskAction) =>
  ({ pause: "暂停", resume: "继续", delay: "延期", transfer: "调整负责人", cancel: "取消" })[
    action
  ];
</script>

<template>
  <div v-if="targets.length" class="task-batch-bar">
    <span>已选 {{ targets.length }} 项</span>
    <button type="button" :disabled="busy" @click="$emit('start', 'pause')">批量暂停</button>
    <button type="button" :disabled="busy" @click="$emit('start', 'resume')">批量继续</button>
    <button type="button" :disabled="busy" @click="$emit('start', 'delay')">批量延期</button>
    <button v-if="canAssign" type="button" :disabled="busy" @click="$emit('start', 'transfer')">
      批量调整负责人
    </button>
    <button type="button" class="danger" :disabled="busy" @click="$emit('start', 'cancel')">
      批量取消
    </button>
  </div>
  <dialog
    ref="dialogElement"
    class="task-batch-impact"
    aria-label="确认批量任务操作"
    :aria-busy="busy"
    @cancel="handleDialogCancel"
  >
    <form @submit.prevent="$emit('confirm')">
      <h3>确认批量{{ actionLabel(action) }}</h3>
      <p>影响范围会在执行前固定；不符合当前状态的任务不会被修改。</p>
      <dl>
        <div>
          <dt>已选择</dt>
          <dd>{{ targets.length }} 项</dd>
        </div>
        <div>
          <dt>可执行</dt>
          <dd>{{ eligible.length }} 项</dd>
        </div>
        <div>
          <dt>跳过</dt>
          <dd>{{ targets.length - eligible.length }} 项</dd>
        </div>
        <div>
          <dt>关联采集任务</dt>
          <dd>
            {{ eligible.filter((item) => item.collection_task_id).length }}
            项（仅展示关联，不联动取消底层任务）
          </dd>
        </div>
      </dl>
      <label v-if="action !== 'resume'"
        >操作原因<textarea
          :value="reason"
          required
          maxlength="500"
          :disabled="busy"
          @input="$emit('update:reason', ($event.target as HTMLTextAreaElement).value)"
        ></textarea>
      </label>
      <label v-if="action === 'delay'">
        新截止时间<input
          :value="dueAt"
          type="datetime-local"
          required
          :disabled="busy"
          @input="$emit('update:dueAt', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <label v-if="action === 'transfer'">
        新负责人
        <select
          :value="assigneeId"
          required
          :disabled="busy"
          @change="$emit('update:assigneeId', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">请选择当前工作区成员</option>
          <option v-for="member in members" :key="member.id" :value="member.id">
            {{ member.label }}
          </option>
        </select>
      </label>
      <div>
        <button type="button" :disabled="busy" @click="$emit('close')">返回</button
        ><button :disabled="busy || !eligible.length">{{ busy ? "正在执行…" : "确认执行" }}</button>
      </div>
    </form>
  </dialog>
</template>
