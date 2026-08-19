<script setup lang="ts">
defineProps<{
  open: boolean;
  detail: any | null;
  selected: any | null;
  statusText: (value: string) => string;
  roleText: (value: string) => string;
}>();

defineEmits<{
  close: [];
  resetPassword: [user: any];
  revokeSessions: [user: any, sessionId: string | null];
}>();
</script>

<template>
  <dialog :open="open" class="detail-dialog">
    <section v-if="detail">
      <header>
        <div><small>账号详情</small><h3>{{ detail.user.email }}</h3></div>
        <button aria-label="关闭账号详情" title="关闭账号详情" @click="$emit('close')">×</button>
      </header>
      <div class="detail-grid">
        <article><small>账号状态</small><strong>{{ statusText(detail.user.status) }}</strong></article>
        <article><small>首次安全设置</small><strong>{{ detail.user.must_change_password || detail.user.must_enroll_mfa ? "待完成" : "已完成" }}</strong></article>
        <article><small>组织关系</small><strong>{{ detail.memberships.length }}</strong></article>
        <article><small>活动会话</small><strong>{{ detail.sessions.filter((item: any) => item.status === "active").length }}</strong></article>
      </div>
      <h4>组织与角色</h4>
      <p v-if="!detail.memberships.length">尚未加入组织。</p>
      <ul>
        <li v-for="item in detail.memberships" :key="item.id">
          <span>{{ item.organization_name }}</span><b>{{ item.roles.map(roleText).join("、") }}</b><small>{{ statusText(item.status) }}</small>
        </li>
      </ul>
      <h4>登录会话</h4>
      <p v-if="!detail.sessions.length">暂无会话。</p>
      <ul>
        <li v-for="session in detail.sessions" :key="session.id">
          <span>{{ session.device_label }}</span><b>{{ statusText(session.status) }}</b><small>{{ new Date(session.last_seen_at).toLocaleString() }}</small>
          <button v-if="session.status === 'active'" @click="$emit('revokeSessions', selected, session.id)">撤销</button>
        </li>
      </ul>
      <footer>
        <button @click="$emit('resetPassword', selected)">强制改密</button>
        <button @click="$emit('revokeSessions', selected, null)">撤销全部会话</button>
        <button @click="$emit('close')">关闭</button>
      </footer>
    </section>
    <section v-else class="account-state">正在读取账号详情…</section>
  </dialog>
</template>

<style scoped>
dialog {
  position:fixed;
  inset:0;
  z-index:10;
  width:min(760px,calc(100% - 28px));
  max-height:84vh;
  overflow:auto;
  margin:auto;
  border:1px solid #31506b;
  border-radius:16px;
  color:#eef5ff;
  background:#10243a;
  box-shadow:0 24px 80px #0006;
}
.detail-dialog > section > header { display:flex; justify-content:space-between; align-items:start; }
.detail-dialog > section > header button { border:0; color:#eef5ff; background:transparent; font-size:26px; }
.detail-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin:16px 0; }
.detail-grid article { padding:12px; border:1px solid #29465f; border-radius:10px; background:#0b1d2e; }
.detail-grid small,.detail-grid strong { display:block; }
.detail-dialog ul { padding:0; display:grid; gap:8px; list-style:none; }
.detail-dialog li {
  padding:10px;
  display:grid;
  grid-template-columns:minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr) auto;
  align-items:center;
  gap:10px;
  border:1px solid #29465f;
  border-radius:9px;
}
.detail-dialog li small { color:#9aadc1; }
footer { display:flex; justify-content:flex-end; gap:8px; }
.account-state { padding:18px; text-align:center; }
@media(max-width:700px) { dialog { width:calc(100% - 28px); } .detail-grid { grid-template-columns:1fr 1fr; } .detail-dialog li { grid-template-columns:1fr; } }
</style>
