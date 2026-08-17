<script setup lang="ts">
import { onMounted, ref } from 'vue';
import UiStatePanel from './UiStatePanel.vue';

type State = 'loading' | 'blocked';
const props = defineProps<{ apiBaseUrl: string }>();
const state = ref<State>('loading');
const requestId = ref('');

async function resolveLanding() {
  state.value = 'loading';
  requestId.value = '';
  try {
    const response = await fetch(`${props.apiBaseUrl}/me/landing`, { credentials: 'include', headers: { accept: 'application/json' } });
    const body = await response.json().catch(() => null);
    requestId.value = body?.request_id ?? '';
    if (response.status === 401) return window.location.replace('/login');
    if (!response.ok || !body?.data?.route) {
      state.value = 'blocked';
      return;
    }
    window.location.replace(body.data.route);
  } catch {
    state.value = 'blocked';
  }
}

onMounted(resolveLanding);
</script>

<template>
  <main class="landing-redirect" aria-live="polite">
    <UiStatePanel
      :kind="state === 'loading' ? 'loading' : 'blocked'"
      :request-id="requestId"
      :primary-label="state === 'loading' ? '正在进入工作台' : '重新检查'"
      @primary="resolveLanding"
    />
  </main>
</template>
