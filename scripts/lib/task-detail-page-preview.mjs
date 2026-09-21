import assert from "node:assert/strict";
import path from "node:path";

export const taskDetailReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/task-detail-page-preview.css";

const replaceTemplate = (source, template, label) => {
  const normalized = source.replaceAll("\r\n", "\n"),
    start = normalized.indexOf("<template>"),
    end = normalized.lastIndexOf("</template>");
  assert.ok(start > 0 && end > start, `${label} template bounds`);
  return normalized.slice(0, start) + template + normalized.slice(end + "</template>".length);
};

export function previewTaskDetailWorkspace(source) {
  return replaceTemplate(
    source,
    `<template><section class="task-workspace p24-workspace"><section v-if="state==='loading'" class="p24-state" role="status"><b>正在读取任务详情</b><span>任务事实与负责人目录会按当前工作区分别读取。</span></section><section v-else-if="['error','not_found','forbidden','expired','rate_limited'].includes(state)" class="p24-state" aria-live="assertive"><b>{{state==='expired'?'登录已失效':state==='not_found'?'任务不存在或已删除':state==='forbidden'?'当前没有查看此任务的权限':state==='rate_limited'?'请求过于频繁':'任务服务暂不可用'}}</b><span>{{notice||'请重新读取当前任务。'}}</span><code v-if="requestId">关联编号：{{requestId}}</code><button type="button" @click="load">重新加载</button></section><template v-else><header class="p24-route-header"><div><p>TASK DOSSIER / 任务详情</p><h2>查看事实，再决定下一项操作</h2><span>版本、负责人、期限与活动记录均来自当前任务响应；操作按现有权限显示。</span></div><RouterLink :to="returnPath" class="p24-close" aria-label="返回任务目录">返回目录</RouterLink></header><p v-if="notice" class="p24-notice" role="status">{{notice}}<code v-if="requestId">关联编号：{{requestId}}</code></p><TaskDetailPanel v-if="selected" :task="selected" :return-path="returnPath" :blocking-context="blockingContext" :activity="activity" :action-editor="taskActionEditor" :action-form="taskActionForm" :members="memberOptions" :comment="comment" :assignee-label="assigneeLabel" :can-update="canUpdate" :can-assign="canAssign" :busy="busy" :label="label" :phase="phase" :time="time" :sla-next="slaNext" @action="action" @edit="editTask" @remove="askRemove" @submit-action="submitTaskAction" @close-action="taskActionEditor=null" @add-comment="addComment" @update:comment="comment=$event" @update:action-form="taskActionForm=$event"/></template><dialog ref="deleteDialogElement" class="p24-delete-dialog" aria-label="删除任务" @cancel="handleDeleteCancel"><form @submit.prevent="removeTask"><p>危险操作</p><h3>删除任务</h3><span>任务列表将不再显示该项，但既有审计记录会保留。</span><label>删除原因<textarea v-model="deleteReason" required maxlength="500" placeholder="请填写删除原因"></textarea></label><footer><button type="button" :disabled="busy" @click="closeDeleteDialog">取消</button><button class="p24-danger" type="submit" :disabled="busy">{{busy?'正在删除…':'确认删除'}}</button></footer></form></dialog></section></template>`,
    "P24 workspace",
  );
}

export function previewTaskDetailPanel(source) {
  return replaceTemplate(
    source,
    `<template><article class="p24-detail"><header class="p24-detail-header"><div><p>{{task.source_type==='manual'?'手动创建':'系统生成'}} · 第 {{task.version}} 版</p><h3>{{task.title}}</h3><span>{{task.description||'无补充说明'}}</span></div><RouterLink :to="returnPath" aria-label="关闭任务详情">×</RouterLink></header><section class="p24-facts" aria-label="任务事实"><div><span>状态</span><b>{{label(task.status)}}</b></div><div><span>当前阶段</span><b>{{phase(task)}} · {{task.progress_percent}}%</b><progress :value="task.progress_percent" max="100">{{task.progress_percent}}%</progress><small>{{task.progress_note||'尚未记录进展'}}</small></div><div><span>处理时限</span><b>{{label(task.sla_status)}} · {{time(task.due_at)}}</b><small>{{slaNext(task)}}</small></div><div><span>负责人</span><b>{{assigneeLabel}}</b></div></section><section v-if="blockingContext" class="p24-blocking" aria-label="阻塞与下一负责人"><div><span>阻塞原因</span><b>{{blockingContext.reason}}</b></div><div><span>下一负责人</span><b>{{blockingContext.nextOwner}}</b></div></section><section class="p24-source"><span>采集关联</span><RouterLink v-if="task.collection_task_id" :to="\`/platform-admin/collection?task=\${task.collection_task_id}\`">查看关联采集任务</RouterLink><b v-else>当前业务任务未关联采集任务</b></section><details class="p24-technical"><summary>查看技术详情</summary><dl><div><dt>负责人账号编号</dt><dd>{{task.assignee_id}}</dd></div><div><dt>任务编号</dt><dd>{{task.id}}</dd></div></dl></details><p v-if="!canUpdate&&!canAssign" class="p24-readonly" role="status">当前角色仅可查看任务事实与活动记录，修改入口已按权限隐藏。</p><section v-if="canUpdate||canAssign" class="p24-actions" aria-label="任务操作"><div><button v-if="canUpdate&&task.status==='todo'" class="p24-primary" :disabled="busy" @click="$emit('action','start')">开始</button><button v-if="canUpdate&&task.status==='paused'" class="p24-primary" :disabled="busy" @click="$emit('action','resume')">继续</button><button v-if="canUpdate&&['todo','in_progress','paused'].includes(task.status)" :disabled="busy" @click="$emit('action','complete')">完成</button><button v-if="canUpdate&&!['completed','cancelled'].includes(task.status)" :disabled="busy" @click="$emit('action','progress')">更新进度</button></div><details><summary>更多任务操作</summary><div><button v-if="canUpdate&&task.status==='in_progress'" type="button" :disabled="busy" @click="$emit('action','pause')">暂停</button><button v-if="canUpdate&&!['completed','cancelled'].includes(task.status)" type="button" :disabled="busy" @click="$emit('action','delay')">调整期限</button><button v-if="canAssign" type="button" :disabled="busy" @click="$emit('action','transfer')">转交负责人</button><button v-if="canUpdate" type="button" :disabled="busy" @click="$emit('edit')">编辑任务</button><button v-if="canUpdate&&!['completed','cancelled'].includes(task.status)" class="p24-danger" type="button" :disabled="busy" @click="$emit('action','cancel')">取消任务</button><button v-if="canUpdate" class="p24-danger" type="button" :disabled="busy" @click="$emit('remove',task)">删除任务</button></div></details></section><section class="p24-activity"><header><p>ACTIVITY / 审计记录</p><h4>任务活动与评论</h4></header><article v-for="item in activity" :key="\`\${item.kind}-\${item.id}\`" :data-kind="item.kind"><b>{{item.title}}</b><p>{{item.body}}</p><small>{{item.actorLabel}} · {{time(item.created_at)}}</small></article><p v-if="!activity.length" class="p24-empty">暂无任务活动。</p><form v-if="canUpdate" @submit.prevent="$emit('addComment')"><label>添加可审计评论<textarea :value="comment" placeholder="添加可审计评论" required maxlength="2000" :disabled="busy" @input="$emit('update:comment',($event.target).value)"></textarea></label><button class="p24-primary" :disabled="busy">{{busy?'正在提交…':'添加评论'}}</button></form></section></article><dialog ref="dialogElement" class="p24-action-dialog" aria-label="任务操作表单" @cancel="handleCancel"><form @submit.prevent="$emit('submitAction')"><p>任务更新</p><h3>{{actionEditor==='transfer'?'转交任务':actionEditor==='delay'?'调整任务期限':actionEditor==='progress'?'更新任务进度':actionEditor==='pause'?'暂停任务':'取消任务'}}</h3><span>提交会写入任务活动与审计记录，并使用当前任务版本进行冲突校验。</span><label v-if="actionEditor==='transfer'">接收成员<select :value="actionForm.assignee_id" required @change="updateActionForm('assignee_id',($event.target).value)"><option value="" disabled>请选择可访问当前工作区的成员</option><option v-for="member in members" :key="member.id" :value="member.id">{{member.label}}</option></select></label><label v-if="actionEditor==='delay'">新截止时间<input :value="actionForm.due_at" type="datetime-local" required @input="updateActionForm('due_at',($event.target).value)"/></label><template v-if="actionEditor==='progress'"><label>完成进度（0–100）<input :value="actionForm.progress_percent" type="number" min="0" max="100" step="1" required @input="updateActionForm('progress_percent',Number(($event.target).value))"/></label><label>本次进展说明<textarea :value="actionForm.progress_note" maxlength="500" required placeholder="说明已完成内容、当前阻塞和下一步" @input="updateActionForm('progress_note',($event.target).value)"></textarea></label></template><label v-else>操作原因<textarea :value="actionForm.reason" maxlength="500" required placeholder="请填写可审计的操作原因" @input="updateActionForm('reason',($event.target).value)"></textarea></label><footer><button type="button" @click="$emit('closeAction')">返回</button><button class="p24-primary" type="submit" :disabled="busy">{{busy?'正在提交…':'确认提交'}}</button></footer></form></dialog></template>`,
    "P24 detail",
  );
}

export function taskDetailPagePlugin() {
  const workspace = path.resolve("apps/web/src/components/TaskWorkspace.vue").replaceAll("\\", "/"),
    detail = path.resolve("apps/web/src/components/TaskDetailPanel.vue").replaceAll("\\", "/");
  return {
    name: "p24-actual-vue-review",
    enforce: "pre",
    transform(source, id) {
      const normalized = id.replaceAll("\\", "/");
      if (normalized === workspace) return { code: previewTaskDetailWorkspace(source), map: null };
      if (normalized === detail) return { code: previewTaskDetailPanel(source), map: null };
    },
    transformIndexHtml(html) {
      return html
        .replace("<body>", '<body class="p24-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(taskDetailReviewCss).replaceAll("\\", "/")}"></head>`,
        );
    },
  };
}
