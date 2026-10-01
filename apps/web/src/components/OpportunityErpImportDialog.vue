<script setup lang="ts">
import { useModalDialog } from "../use-modal-dialog";
import { containDialogTab } from "../ui/contain-dialog-tab";

defineProps<{ busy: boolean }>();
const emit = defineEmits<{
  importBrowser: [];
  importFile: [event: Event];
}>();
const open = defineModel<boolean>("open", { required: true });
const importLimit = defineModel<number>("importLimit", { required: true });
const { dialogElement, handleCancel } = useModalDialog(
  () => open.value,
  () => (open.value = false),
);
</script>

<template>
  <dialog
    v-if="open"
    ref="dialogElement"
    class="opportunity-modal"
    aria-labelledby="erp-import-title"
    @cancel="handleCancel"
    @keydown="containDialogTab($event, dialogElement)"
  >
    <form class="so-dialog-manifest" @submit.prevent="emit('importBrowser')">
      <header>
        <div>
          <p>使用已有商品数据补齐系统</p>
          <h3 id="erp-import-title">从米豆 ERP 商品列表导入</h3>
        </div>
        <button
          class="so-action-quiet"
          type="button"
          aria-label="关闭 ERP 导入"
          @click="open = false"
        >
          ×
        </button>
      </header>
      <aside class="erp-import-guide">
        <strong>真实数据流</strong>
        <span
          >浏览器助手在本机读取 ERP 登录令牌并请求商品列表；令牌不会发送给
          智能选品。商品原始记录、来源网址和采集时间会保存为可追溯证据。</span
        >
      </aside>
      <label
        >本次导入数量<input v-model.number="importLimit" type="number" min="1" max="500" required
      /></label>
      <label class="erp-file-fallback"
        >没有安装助手时上传 ERP JSON<input
          type="file"
          accept=".json,application/json"
          @change="emit('importFile', $event)"
        /><small>接受接口返回的 list 数组或商品数组。</small></label
      >
      <footer>
        <a href="/browser-helper/scoutops-browser-helper.zip">下载浏览器助手</a>
        <button class="so-action-secondary" type="button" @click="open = false">取消</button>
        <button class="so-action-primary" type="submit" :disabled="busy">
          {{ busy ? "读取并导入中…" : "从当前浏览器读取" }}
        </button>
      </footer>
    </form>
  </dialog>
</template>
