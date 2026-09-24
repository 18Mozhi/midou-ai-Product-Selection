<script setup lang="ts">
import TaskActionDialog from "./TaskActionDialog.vue";
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
        class="primary"
        :disabled="busy"
        @click="$emit('action', 'start')"
      >
        开始
      </button>
      <button
        v-if="canUpdate && task.status === 'paused'"
        class="primary"
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
        @click="$emit('action', 'progress')"
      >
        更新进度
      </button>
      <details v-if="canUpdate || canAssign" class="task-detail-more">
        <summary>更多任务操作</summary>
        <div>
          <button
            v-if="canUpdate && task.status === 'in_progress'"
            type="button"
            :disabled="busy"
            @click="$emit('action', 'pause')"
          >
            暂停
          </button>
          <button
            v-if="canUpdate && !['completed', 'cancelled'].includes(task.status)"
            type="button"
            :disabled="busy"
            @click="$emit('action', 'delay')"
          >
            调整期限
          </button>
          <button
            v-if="canAssign"
            type="button"
            :disabled="busy"
            @click="$emit('action', 'transfer')"
          >
            转交负责人
          </button>
          <button v-if="canUpdate" type="button" :disabled="busy" @click="$emit('edit')">
            编辑任务
          </button>
          <button
            v-if="canUpdate && !['completed', 'cancelled'].includes(task.status)"
            class="danger"
            type="button"
            :disabled="busy"
            @click="$emit('action', 'cancel')"
          >
            取消任务
          </button>
          <button
            v-if="canUpdate"
            class="danger"
            type="button"
            :disabled="busy"
            @click="$emit('remove', task)"
          >
            删除任务
          </button>
        </div>
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
  <TaskActionDialog
    :task-title="task.title"
    :task-version="task.version"
    :action-editor="actionEditor"
    :action-form="actionForm"
    :members="members"
    :busy="busy"
    @submit="emit('submitAction')"
    @close="emit('closeAction')"
    @update:action-form="emit('update:actionForm', $event)"
  />
</template>
