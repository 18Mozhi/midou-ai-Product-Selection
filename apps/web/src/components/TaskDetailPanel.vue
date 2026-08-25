<script setup lang="ts">
import { useModalDialog } from "../use-modal-dialog";
import type {
  MemberOption,
  Task,
  TaskActionEditor,
  TaskActionForm,
  TaskActivity,
  TaskBlockingContext,
} from "./task-workspace-types";

const props = defineProps<{
  task: Task;
  returnPath: string;
  blockingContext: TaskBlockingContext | null;
  activity: TaskActivity[];
  actionEditor: TaskActionEditor | null;
  actionForm: TaskActionForm;
  members: MemberOption[];
  comment: string;
  assigneeLabel: string;
  canUpdate: boolean;
  canAssign: boolean;
  busy: boolean;
  label: (value: string) => string;
  phase: (task: Task) => string;
  time: (value: string | null) => string;
  slaNext: (task: Task) => string;
}>();

const emit = defineEmits<{
  action: [name: string];
  edit: [];
  remove: [task: Task];
  submitAction: [];
  closeAction: [];
  addComment: [];
  "update:comment": [value: string];
  "update:actionForm": [value: TaskActionForm];
}>();

const { dialogElement, handleCancel } = useModalDialog(
  () => Boolean(props.actionEditor),
  () => emit("closeAction"),
);

const updateActionForm = (field: keyof TaskActionForm, value: string | number) =>
  emit("update:actionForm", { ...props.actionForm, [field]: value });
</script>

<template>
  <aside class="task-detail">
    <header class="task-detail-header">
      <div>
        <p>
          {{ task.source_type === "manual" ? "手动创建" : "系统生成" }} · 第 {{ task.version }} 版
        </p>
        <h3>{{ task.title }}</h3>
        <span>{{ task.description || "无补充说明" }}</span>
      </div>
      <RouterLink :to="returnPath" aria-label="关闭任务详情">×</RouterLink>
    </header>
    <dl class="task-detail-facts">
      <div>
        <dt>状态</dt>
        <dd>{{ label(task.status) }}</dd>
      </div>
      <div>
        <dt>当前阶段</dt>
        <dd>
          <span>{{ phase(task) }} · {{ task.progress_percent }}%</span>
          <progress :value="task.progress_percent" max="100">{{ task.progress_percent }}%</progress>
          <small>{{ task.progress_note || "尚未记录进展" }}</small>
        </dd>
      </div>
      <div>
        <dt>处理时限</dt>
        <dd>
          {{ label(task.sla_status) }} · {{ time(task.due_at) }}<br /><small>{{
            slaNext(task)
          }}</small>
        </dd>
      </div>
      <div>
        <dt>负责人</dt>
        <dd>{{ assigneeLabel }}</dd>
      </div>
      <div>
        <dt>底层采集任务</dt>
        <dd v-if="task.collection_task_id">
          <RouterLink :to="`/platform-admin/collection?task=${task.collection_task_id}`"
            >查看关联采集任务</RouterLink
          >
        </dd>
        <dd v-else>当前业务任务未关联采集任务</dd>
      </div>
    </dl>
    <section v-if="blockingContext" class="task-blocking-context" aria-label="阻塞与下一负责人">
      <div>
        <span>阻塞原因</span><strong>{{ blockingContext.reason }}</strong>
      </div>
      <div>
        <span>下一负责人</span><strong>{{ blockingContext.nextOwner }}</strong>
      </div>
    </section>
    <details class="task-technical">
      <summary>技术详情</summary>
      <dl>
        <div>
          <dt>负责人账号编号</dt>
          <dd>{{ task.assignee_id }}</dd>
        </div>
        <div>
          <dt>任务编号</dt>
          <dd>{{ task.id }}</dd>
        </div>
      </dl>
    </details>
    <p v-if="!canUpdate && !canAssign" class="task-detail-readonly" role="status">
      当前角色仅可查看任务事实与活动记录，修改入口已按权限隐藏。
    </p>
    <div v-if="canUpdate || canAssign" class="task-actions" aria-label="任务操作">
      <button
        v-if="canUpdate && task.status === 'todo'"
        :disabled="busy"
        @click="$emit('action', 'start')"
      >
        开始
      </button>
      <button
        v-if="canUpdate && task.status === 'in_progress'"
        :disabled="busy"
        @click="$emit('action', 'pause')"
      >
        暂停
      </button>
      <button
        v-if="canUpdate && task.status === 'paused'"
        :disabled="busy"
        @click="$emit('action', 'resume')"
      >
        继续
      </button>
      <button
        v-if="canUpdate && ['todo', 'in_progress', 'paused'].includes(task.status)"
        :disabled="busy"
        @click="$emit('action', 'complete')"
      >
        完成
      </button>
      <button
        v-if="canUpdate && !['completed', 'cancelled'].includes(task.status)"
        :disabled="busy"
        @click="$emit('action', 'delay')"
      >
        延期
      </button>
      <button
        v-if="canUpdate && !['completed', 'cancelled'].includes(task.status)"
        class="danger"
        :disabled="busy"
        @click="$emit('action', 'cancel')"
      >
        取消任务
      </button>
      <button v-if="canAssign" :disabled="busy" @click="$emit('action', 'transfer')">转交</button>
      <button v-if="canUpdate" :disabled="busy" @click="$emit('action', 'progress')">
        更新进度
      </button>
      <button v-if="canUpdate" :disabled="busy" @click="$emit('edit')">编辑</button>
      <details v-if="canUpdate" class="task-detail-more">
        <summary>更多任务操作</summary>
        <button class="danger" type="button" :disabled="busy" @click="$emit('remove', task)">
          删除任务
        </button>
      </details>
    </div>
    <section class="task-activity">
      <h4>任务活动</h4>
      <article v-for="item in activity" :key="`${item.kind}-${item.id}`" :data-kind="item.kind">
        <b>{{ item.title }}</b>
        <p>{{ item.body }}</p>
        <small>{{ item.actorLabel }} · {{ time(item.created_at) }}</small>
      </article>
      <p v-if="!activity.length">暂无任务活动。</p>
      <form v-if="canUpdate" @submit.prevent="$emit('addComment')">
        <textarea
          :value="comment"
          placeholder="添加可审计评论"
          required
          maxlength="2000"
          :disabled="busy"
          @input="$emit('update:comment', ($event.target as HTMLTextAreaElement).value)"
        ></textarea
        ><button :disabled="busy">{{ busy ? "正在提交…" : "添加评论" }}</button>
      </form>
    </section>
  </aside>
  <dialog
    ref="dialogElement"
    class="task-action-dialog"
    aria-label="任务操作表单"
    @cancel="handleCancel"
  >
    <form @submit.prevent="$emit('submitAction')">
      <h3>
        {{
          actionEditor === "transfer"
            ? "转交任务"
            : actionEditor === "delay"
              ? "调整任务期限"
              : actionEditor === "progress"
                ? "更新任务进度"
                : actionEditor === "pause"
                  ? "暂停任务"
                  : "取消任务"
        }}
      </h3>
      <p>提交后会写入任务活动与审计记录，并使用当前任务版本进行冲突校验。</p>
      <label v-if="actionEditor === 'transfer'">
        接收成员
        <select
          :value="actionForm.assignee_id"
          required
          @change="updateActionForm('assignee_id', ($event.target as HTMLSelectElement).value)"
        >
          <option value="" disabled>请选择可访问当前工作区的成员</option>
          <option v-for="member in members" :key="member.id" :value="member.id">
            {{ member.label }}
          </option>
        </select>
      </label>
      <label v-if="actionEditor === 'delay'">
        新截止时间
        <input
          :value="actionForm.due_at"
          type="datetime-local"
          required
          @input="updateActionForm('due_at', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <template v-if="actionEditor === 'progress'">
        <label>
          完成进度（0–100）
          <input
            :value="actionForm.progress_percent"
            type="number"
            min="0"
            max="100"
            step="1"
            required
            @input="
              updateActionForm(
                'progress_percent',
                Number(($event.target as HTMLInputElement).value),
              )
            "
          />
        </label>
        <label>
          本次进展说明
          <textarea
            :value="actionForm.progress_note"
            maxlength="500"
            required
            placeholder="说明已完成内容、当前阻塞和下一步"
            @input="updateActionForm('progress_note', ($event.target as HTMLTextAreaElement).value)"
          ></textarea>
        </label>
      </template>
      <label v-else>
        操作原因
        <textarea
          :value="actionForm.reason"
          maxlength="500"
          required
          placeholder="请填写可审计的操作原因"
          @input="updateActionForm('reason', ($event.target as HTMLTextAreaElement).value)"
        ></textarea>
      </label>
      <div>
        <button type="button" @click="$emit('closeAction')">返回</button
        ><button type="submit" :disabled="busy">{{ busy ? "正在提交…" : "确认提交" }}</button>
      </div>
    </form>
  </dialog>
</template>
