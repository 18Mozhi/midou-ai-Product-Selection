<script setup lang="ts">
defineProps<{
  notice: string;
  writeRequestId: string;
  readRequestId: string;
  loading: boolean;
  disabled: boolean;
}>();
defineEmits<{ reload: [] }>();
</script>

<template>
  <section class="team-create-read-failure" :aria-busy="loading">
    <p class="team-create-read-eyebrow">创建结果</p>
    <h3>团队已创建，列表暂未更新</h3>
    <p>创建请求已完成。下面是本次读取未完成的说明：</p>
    <p class="team-create-read-explanation">{{ notice }}</p>
    <details>
      <summary>技术详情</summary>
      <dl>
        <div>
          <dt>创建请求</dt>
          <dd>
            <code>{{ writeRequestId }}</code>
          </dd>
        </div>
        <div>
          <dt>读取请求</dt>
          <dd>
            <code>{{ readRequestId || "暂无追踪编号" }}</code>
          </dd>
        </div>
      </dl>
    </details>
    <footer>
      <span>这里只重新读取列表，不会再次创建团队。</span>
      <button type="button" :disabled="disabled" @click="$emit('reload')">
        {{ loading ? "正在读取…" : "重新读取列表" }}
      </button>
    </footer>
  </section>
</template>

<style scoped>
:global(
  html body.teams-vue-c #app .org-admin-center .org-admin-notice.team-create-read-warning[data-kind]
) {
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}
html body.teams-vue-c #app .org-admin-center .team-create-read-failure {
  padding: 24px;
  border: 1px solid #dbe4f0;
  border-top: 3px solid #254a9c;
  background: #fff;
  color: #17366f;
  font-size: 14px;
  line-height: 1.6;
}
html body.teams-vue-c #app .org-admin-center .team-create-read-failure p {
  margin: 0 0 12px;
  background: transparent;
  color: #17366f;
}
html body.teams-vue-c #app .org-admin-center .team-create-read-failure .team-create-read-eyebrow {
  color: #52627c;
  font-size: 12px;
}
html body.teams-vue-c #app .org-admin-center .team-create-read-failure h3 {
  margin: 0 0 12px;
  color: #142b50;
  font-size: 20px;
}
html
  body.teams-vue-c
  #app
  .org-admin-center
  .team-create-read-failure
  .team-create-read-explanation {
  padding: 12px 16px;
  background: #edf2fa;
}
html body.teams-vue-c #app .org-admin-center .team-create-read-failure summary {
  padding: 8px 0;
  cursor: pointer;
}
html body.teams-vue-c #app .org-admin-center .team-create-read-failure dl {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin: 12px 0 20px;
}
html body.teams-vue-c #app .org-admin-center .team-create-read-failure dt {
  font-size: 12px;
  color: #52627c;
}
html body.teams-vue-c #app .org-admin-center .team-create-read-failure dd {
  margin: 0;
  overflow-wrap: anywhere;
}
html body.teams-vue-c #app .org-admin-center .team-create-read-failure code {
  padding: 0;
  border: 0;
  color: #17366f;
  background: transparent;
}
html body.teams-vue-c #app .org-admin-center .team-create-read-failure footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #dbe4f0;
}
html body.teams-vue-c #app .org-admin-center .team-create-read-failure footer span {
  color: #52627c;
  font-size: 12px;
}
html body.teams-vue-c #app .org-admin-center .team-create-read-failure button {
  min-height: 44px;
  padding: 10px 20px;
  border: 1px solid #254a9c;
  border-radius: 4px;
  background: #254a9c;
  color: #fff;
  font: inherit;
  cursor: pointer;
}
html body.teams-vue-c #app .org-admin-center .team-create-read-failure button:disabled {
  background: #e4e9f0;
  border-color: #dbe1e9;
  color: #52627c;
  cursor: default;
}
html
  body.teams-vue-c
  #app
  .org-admin-center
  .team-create-read-failure
  :is(button, summary):focus-visible {
  outline: 3px solid #1855d8;
  outline-offset: 3px;
}
@media (max-width: 840px) {
  html body.teams-vue-c #app .org-admin-center .team-create-read-failure {
    padding: 20px;
  }
  html body.teams-vue-c #app .org-admin-center .team-create-read-failure dl {
    grid-template-columns: 1fr;
  }
  html body.teams-vue-c #app .org-admin-center .team-create-read-failure footer {
    align-items: stretch;
    flex-direction: column;
  }
  html body.teams-vue-c #app .org-admin-center .team-create-read-failure button {
    width: 100%;
  }
}
</style>
