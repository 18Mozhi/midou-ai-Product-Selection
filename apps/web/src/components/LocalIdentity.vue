<script setup lang="ts">
import { computed, ref } from 'vue';
import { publicConfig } from '../config';

type IdentityMode = 'login' | 'register' | 'forgot' | 'verify' | 'reset' | 'sessions';
type RequestState = 'idle' | 'loading' | 'success' | 'error' | 'expired';
const params = new URLSearchParams(window.location.search);
const mode = ref<IdentityMode>((params.get('mode') as IdentityMode) || 'login');
const requestState = ref<RequestState>(params.get('state') === 'expired' ? 'expired' : 'idle');
const email = ref(''); const password = ref(''); const confirmPassword = ref(''); const message = ref(''); const sessions = ref<Array<{id:string;device_label:string;status:string;last_seen_at:string}>>([]);
const title = computed(() => ({login:'欢迎回到 ScoutOps',register:'创建本地账号',forgot:'找回密码',verify:'验证邮箱',reset:'设置新密码',sessions:'我的设备会话'})[mode.value]);

function switchMode(next: IdentityMode) { mode.value=next; requestState.value='idle'; message.value=''; if(next==='sessions')void loadSessions(); }
const idempotency = () => crypto.randomUUID();
async function request(path:string,body?:Record<string,string>,method='POST') {
  requestState.value='loading';message.value='';
  try{const response=await fetch(`${publicConfig.apiBaseUrl}${path}`,{method,credentials:'include',headers:{accept:'application/json',...(body?{'content-type':'application/json'}:{}),...(['POST','DELETE'].includes(method)?{'idempotency-key':idempotency()}: {})},...(body?{body:JSON.stringify(body)}:{})});const payload=response.status===204?null:await response.json();if(!response.ok)throw new Error(payload?.error?.message||'请求暂时失败');requestState.value='success';return payload;}
  catch(error){requestState.value='error';message.value=error instanceof Error?error.message:'请求暂时失败';return null;}
}
async function submit() {
  if(mode.value==='register'&&password.value!==confirmPassword.value){requestState.value='error';message.value='两次输入的密码不一致。';return;}
  if(mode.value==='login'){const result=await request('/auth/login',{email:email.value,password:password.value});if(result)message.value='登录成功，会话已安全写入浏览器。';}
  if(mode.value==='register'){const result=await request('/auth/register',{email:email.value,password:password.value});if(result){mode.value='verify';message.value='验证邮件已进入受控投递队列。';}}
  if(mode.value==='forgot'){const result=await request('/auth/password-reset/request',{email:email.value});if(result)message.value='如账号存在，重置邮件会进入受控投递队列。';}
  if(mode.value==='reset'){const token=params.get('token')||'';const result=await request('/auth/password-reset/confirm',{token,new_password:password.value});if(result===null&&requestState.value==='success')message.value='密码已更新，请重新登录。';}
}
async function loadSessions(){const result=await request('/me/sessions',undefined,'GET');sessions.value=result?.data||[];}
async function revoke(id:string){const result=await request(`/me/sessions/${id}`,undefined,'DELETE');if(result===null&&requestState.value==='success')await loadSessions();}
</script>

<template>
  <main class="identity-page" :data-mode="mode" :data-state="requestState">
    <header class="identity-header">
      <a class="identity-brand" href="/"><span>S</span>ScoutOps</a>
      <p>本地账号 · P01 / M01-01</p>
    </header>
    <section class="identity-shell">
      <aside class="identity-story" aria-label="ScoutOps 产品说明">
        <p class="identity-kicker">SECURE LOCAL IDENTITY</p>
        <h1>让增长，<em>更有确定性</em></h1>
        <p>账号、密码和会话只在受控后端处理。浏览器不保存认证 Token，也不接触数据库或密钥。</p>
        <div class="identity-orbit" aria-hidden="true"><span>S</span><i></i><i></i><i></i></div>
        <ul>
          <li><strong>Argon2id</strong><small>密码单向哈希</small></li>
          <li><strong>单次令牌</strong><small>验证与重置可追踪</small></li>
          <li><strong>会话可撤销</strong><small>设备级安全控制</small></li>
        </ul>
      </aside>

      <section class="identity-card" aria-live="polite">
        <div class="identity-card__head">
          <p>{{ mode === 'sessions' ? 'SECURITY CENTER' : 'SCOUTOPS ACCOUNT' }}</p>
          <h2>{{ title }}</h2>
          <span v-if="mode==='login'">使用已验证的邮箱和本地密码登录</span>
          <span v-else-if="mode==='register'">先创建账号，再完成邮箱验证</span>
          <span v-else-if="mode==='forgot'">无论账号是否存在，页面提示保持一致</span>
        </div>

        <div v-if="requestState==='expired'" class="identity-notice identity-notice--warning" data-testid="expired">
          <strong>链接已过期</strong><p>验证与重置令牌均为单次使用。请重新申请，不要继续提交旧链接。</p>
        </div>
        <div v-if="requestState==='error'" class="identity-notice identity-notice--error" data-testid="error"><strong>操作未完成</strong><p>{{ message }}</p></div>
        <div v-if="requestState==='success' && message" class="identity-notice identity-notice--success"><strong>操作已受理</strong><p>{{ message }}</p></div>

        <form v-if="['login','register','forgot','reset'].includes(mode)" @submit.prevent="submit">
          <label v-if="mode!=='reset'">邮箱<input v-model="email" type="email" autocomplete="email" required maxlength="254" placeholder="name@company.com"></label>
          <label v-if="mode!=='forgot'">{{ mode==='reset' ? '新密码' : '密码' }}<input v-model="password" type="password" :autocomplete="mode==='login'?'current-password':'new-password'" required minlength="12" maxlength="128" placeholder="输入安全密码"></label>
          <label v-if="mode==='register'">确认密码<input v-model="confirmPassword" type="password" autocomplete="new-password" required minlength="12" maxlength="128" placeholder="再次输入密码"></label>
          <div v-if="mode==='login'" class="identity-form-row"><span>会话关闭浏览器后失效</span><button type="button" class="text-button" @click="switchMode('forgot')">忘记密码？</button></div>
          <button class="identity-primary" type="submit" :disabled="requestState==='loading'">{{ requestState==='loading' ? '正在安全处理…' : mode==='login'?'登录':mode==='register'?'创建账号':mode==='forgot'?'发送重置说明':'更新密码' }}</button>
        </form>

        <div v-else-if="mode==='verify'" class="identity-centered" data-testid="verify">
          <span class="mail-icon" aria-hidden="true">✉</span><h3>检查验证邮件</h3><p>邮件 Provider 未确认时，生产投递会明确显示受阻，不会假报已发送。</p><button type="button" @click="switchMode('login')">返回登录</button>
        </div>

        <div v-else class="session-list" data-testid="sessions">
          <div v-if="requestState==='loading'" class="identity-loading">正在读取本人会话…</div>
          <p v-else-if="sessions.length===0" class="identity-empty">暂无可显示的活动会话；登录失效时请重新登录。</p>
          <article v-for="session in sessions" :key="session.id"><div><strong>{{ session.device_label }}</strong><small>{{ session.status }} · {{ session.last_seen_at }}</small></div><button type="button" @click="revoke(session.id)">撤销</button></article>
        </div>

        <footer class="identity-card__foot">
          <button v-if="mode!=='register'" type="button" class="text-button" @click="switchMode('register')">创建本地账号</button>
          <button v-if="mode!=='login'" type="button" class="text-button" @click="switchMode('login')">返回登录</button>
          <button type="button" class="text-button" @click="switchMode('sessions')">查看安全会话</button>
        </footer>
      </section>
    </section>
    <footer class="identity-footer"><span>安全状态均有文字说明</span><span>邮件 Provider：待确认</span><span>生产运行：仅宝塔管理</span></footer>
  </main>
</template>
