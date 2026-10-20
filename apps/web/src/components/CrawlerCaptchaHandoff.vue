<script setup lang="ts">
import { onActivated, onBeforeUnmount, onDeactivated, onMounted, ref } from "vue";
import { createApiClient, ApiClientError } from "../api-client";
interface Handoff {
  id: string;
  run_id: string;
  hostname: string;
  expires_at: string;
  width: number;
  height: number;
}
const props = defineProps<{ apiBaseUrl: string }>(),
  request = createApiClient(props.apiBaseUrl),
  items = ref<Handoff[]>([]),
  selected = ref<Handoff | null>(null),
  notice = ref(""),
  answer = ref(""),
  busy = ref(false),
  frameVersion = ref(0),
  hidden = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined,
  active = false,
  reading = false;
const base = "/platform/crawler-handoffs";
async function refresh() {
  if (!active || reading || document.hidden || hidden.value) return;
  reading = true;
  try {
    const r = await request<{ items: Handoff[] }>(base);
    if (!active) return;
    items.value = r.data.items;
    if (selected.value && !items.value.some((x) => x.id === selected.value?.id)) {
      selected.value = null;
      answer.value = "";
      notice.value = "接管会话已结束。采集器会依据真实验证结果继续或记录受阻，请核对运行记录。";
    }
    frameVersion.value++;
  } catch (e) {
    if (e instanceof ApiClientError && [401, 403].includes(e.status)) {
      hidden.value = true;
      stop();
    } else notice.value = "暂时无法读取验证码会话，请刷新页面重试。";
  } finally {
    reading = false;
  }
}
function schedule() {
  timer = setTimeout(() => {
    void refresh().then(() => {
      if (active) schedule();
    });
  }, 1500);
}
function start() {
  if (active || hidden.value) return;
  active = true;
  void refresh();
  schedule();
}
function stop() {
  active = false;
  if (timer) clearTimeout(timer);
  timer = undefined;
}
async function claim(item: Handoff) {
  busy.value = true;
  try {
    await request(base + "/" + item.id + "/claim", { method: "POST", body: {} });
    selected.value = item;
    answer.value = "";
    notice.value = "已连接服务器的真实采集页面。验证通过后自动继续，无需另行点击恢复。";
  } catch (e) {
    notice.value = e instanceof ApiClientError ? e.userMessage : "连接失败，请刷新后重试。";
  } finally {
    busy.value = false;
  }
}
async function command(body: Record<string, unknown>) {
  if (!selected.value || busy.value) return;
  busy.value = true;
  try {
    await request(base + "/" + selected.value.id + "/commands", { method: "POST", body });
    if (body.kind === "text") answer.value = "";
  } catch (e) {
    notice.value = e instanceof ApiClientError ? e.userMessage : "操作结果未知，请核对画面后继续。";
  } finally {
    busy.value = false;
  }
}
function clickFrame(event: MouseEvent) {
  if (!selected.value || event.detail === 0) return;
  const b = (event.currentTarget as HTMLElement).getBoundingClientRect();
  void command({
    kind: "click",
    x: Math.min(1279, Math.floor(((event.clientX - b.left) * 1280) / b.width)),
    y: Math.min(719, Math.floor(((event.clientY - b.top) * 720) / b.height)),
  });
}
onMounted(start);
onActivated(start);
onDeactivated(stop);
onBeforeUnmount(stop);
</script>
<template>
  <section v-if="!hidden" class="captcha-handoff" aria-labelledby="captcha-handoff-heading">
    <h2 id="captcha-handoff-heading">验证码人工接管</h2>
    <p>
      这里显示服务器正在等待处理的真实采集会话。每次最多保留5分钟；验证通过后，同一会话自动继续采集。
    </p>
    <p role="status" aria-live="polite">{{ notice }}</p>
    <p v-if="!items.length">当前没有等待处理的验证码。</p>
    <ul v-else>
      <li v-for="item in items" :key="item.id">
        <span>{{ item.hostname }} · 截止 {{ new Date(item.expires_at).toLocaleTimeString() }}</span>
        <button type="button" :disabled="busy || selected?.id === item.id" @click="claim(item)">
          {{ selected?.id === item.id ? "已接管" : "接管验证码" }}
        </button>
      </li>
    </ul>
    <template v-if="selected">
      <p id="captcha-controls-help">
        点击画面中的输入框后填写验证码，也可用“远程Tab”切换焦点。仅处理验证码，请勿登录账号。
      </p>
      <button
        type="button"
        class="captcha-frame"
        aria-label="服务器验证码画面，点击对应位置操作；键盘用户使用下方远程Tab按钮"
        aria-describedby="captcha-controls-help"
        :disabled="busy"
        @click="clickFrame"
      >
        <img
          :src="`${apiBaseUrl}${base}/${selected.id}/frame?v=${frameVersion}`"
          alt="当前服务器采集浏览器的实时验证码页面"
          width="1280"
          height="720"
          @error="notice = '画面暂不可用或会话已结束，正在核对状态。'"
        />
      </button>
      <form class="captcha-controls" @submit.prevent="command({ kind: 'text', text: answer })">
        <label
          >验证码<input v-model="answer" autocomplete="off" maxlength="100" :disabled="busy"
        /></label>
        <button type="submit" :disabled="busy || !answer.trim()">输入到远程页面</button>
        <button type="button" :disabled="busy" @click="command({ kind: 'key', key: 'Tab' })">
          远程Tab
        </button>
        <button type="button" :disabled="busy" @click="command({ kind: 'key', key: 'Backspace' })">
          远程退格
        </button>
        <button type="button" :disabled="busy" @click="command({ kind: 'key', key: 'Enter' })">
          远程回车
        </button>
        <button type="button" :disabled="busy" @click="command({ kind: 'scroll', delta: 500 })">
          向下滚动
        </button>
        <button type="button" :disabled="busy" @click="command({ kind: 'scroll', delta: -500 })">
          向上滚动
        </button>
        <button type="button" :disabled="busy" @click="command({ kind: 'cancel' })">
          结束接管并保留受阻记录
        </button>
      </form>
    </template>
  </section>
</template>
<style scoped>
.captcha-handoff {
  padding: 20px;
  border: 1px solid var(--border-color, #d4d8df);
  border-radius: 8px;
  margin-block: 16px;
}
.captcha-handoff h2 {
  margin-top: 0;
}
.captcha-handoff li,
.captcha-controls {
  display: flex;
  align-items: end;
  flex-wrap: wrap;
  gap: 12px;
  margin-block: 12px;
}
.captcha-handoff button,
.captcha-handoff input {
  min-height: 44px;
  font-size: 16px;
}
.captcha-frame {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: crosshair;
}
.captcha-frame img {
  display: block;
  width: 100%;
  height: auto;
}
.captcha-controls label {
  display: grid;
  gap: 6px;
}
.captcha-handoff :focus-visible {
  outline: 3px solid var(--accent-color, #186bb0);
  outline-offset: 3px;
}
</style>
