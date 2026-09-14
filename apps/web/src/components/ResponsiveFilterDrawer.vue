<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from "vue";

const props = withDefaults(
  defineProps<{
    label?: string;
    activeCount?: number;
    appearance?: "default" | "governance" | "content" | "notifications";
    mode?: "responsive" | "dialog";
  }>(),
  {
    label: "筛选条件",
    activeCount: 0,
    appearance: "default",
    mode: "responsive",
  },
);

const panelId = `filter-panel-${useId()}`;
const open = ref(false);
const mobile = ref(false);
const triggerButton = ref<HTMLButtonElement | null>(null);
const closeButton = ref<HTMLButtonElement | null>(null);
const sheet = ref<HTMLElement | null>(null);
let mediaQuery: MediaQueryList | null = null;
const overlay = computed(() => mobile.value || props.mode === "dialog");

watch(
  () => props.activeCount,
  async (count) => {
    if (count || !overlay.value || !open.value) return;
    const focused = document.activeElement;
    if (!(focused instanceof HTMLButtonElement) || !sheet.value?.contains(focused)) return;
    await nextTick();
    if (
      overlay.value &&
      open.value &&
      focused.disabled &&
      (document.activeElement === focused || document.activeElement === document.body)
    )
      closeButton.value?.focus();
  },
);

function syncViewport(event?: MediaQueryListEvent) {
  mobile.value = event?.matches ?? mediaQuery?.matches ?? false;
  if (!mobile.value) open.value = false;
}

async function show() {
  open.value = true;
  await nextTick();
  closeButton.value?.focus();
}

async function close() {
  const shouldRestoreFocus = open.value;
  open.value = false;
  if (shouldRestoreFocus) {
    await nextTick();
    triggerButton.value?.focus();
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    void close();
    return;
  }
  if (event.key !== "Tab" || !overlay.value || !open.value || !sheet.value) return;
  const focusable = [
    ...sheet.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
    ),
  ];
  const first = focusable[0],
    last = focusable.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

onMounted(() => {
  mediaQuery = window.matchMedia("(max-width: 760px)");
  syncViewport();
  mediaQuery.addEventListener("change", syncViewport);
});

onBeforeUnmount(() => mediaQuery?.removeEventListener("change", syncViewport));
</script>

<template>
  <div
    class="responsive-filter-drawer"
    :class="{ 'responsive-filter-drawer--overlay': overlay }"
    @keydown="handleKeydown"
  >
    <button
      ref="triggerButton"
      type="button"
      class="responsive-filter-drawer__trigger"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-controls="panelId"
      @click="show"
    >
      <span>{{ label }}</span>
      <b v-if="activeCount">{{ activeCount }} 项已选</b>
      <i aria-hidden="true">调</i>
    </button>
    <Teleport to="body" :disabled="!overlay">
      <div
        class="responsive-filter-drawer__portal"
        :class="{
          'responsive-filter-drawer--overlay': overlay,
          'responsive-filter-drawer--governance': appearance === 'governance',
          'responsive-filter-drawer--content': appearance === 'content',
          'responsive-filter-drawer--notifications': appearance === 'notifications',
        }"
        @keydown="handleKeydown"
      >
        <div
          class="responsive-filter-drawer__surface"
          :class="{ 'is-open': open }"
          :aria-hidden="overlay && !open"
        >
          <button
            type="button"
            class="responsive-filter-drawer__scrim"
            aria-label="关闭筛选条件"
            @click="close"
          ></button>
          <section
            ref="sheet"
            :id="panelId"
            class="responsive-filter-drawer__sheet"
            :role="overlay ? 'dialog' : 'group'"
            :aria-modal="overlay && open ? 'true' : undefined"
            :aria-label="label"
          >
            <header>
              <div>
                <small>当前列表</small>
                <strong>{{ label }}</strong>
              </div>
              <button ref="closeButton" type="button" aria-label="关闭筛选条件" @click="close">
                ×
              </button>
            </header>
            <div class="responsive-filter-drawer__content" @submit.capture="close">
              <slot />
            </div>
          </section>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
@import "../design/platform-overlay-tokens.css";

.responsive-filter-drawer__portal {
  display: contents;
}

.responsive-filter-drawer--governance {
  --so-bg: var(--so-workspace-overlay-canvas);
  --so-bg-elevated: var(--so-workspace-overlay-surface);
  --so-panel: var(--so-workspace-overlay-surface);
  --so-panel-soft: var(--so-workspace-overlay-surface-soft);
  --so-text: var(--so-workspace-overlay-text);
  --so-text-muted: var(--so-workspace-overlay-text-muted);
  --so-border: var(--so-workspace-overlay-border);
  --so-primary: var(--so-workspace-overlay-governance-primary);
  --so-primary-strong: var(--so-workspace-overlay-governance-primary-strong);
  --so-on-primary: var(--so-workspace-overlay-surface);
}

.responsive-filter-drawer--content,
.responsive-filter-drawer--notifications {
  --so-bg: var(--so-workspace-overlay-canvas);
  --so-bg-elevated: var(--so-workspace-overlay-surface);
  --so-panel: var(--so-workspace-overlay-surface);
  --so-panel-soft: var(--so-workspace-overlay-surface-soft);
  --so-text: var(--so-workspace-overlay-text);
  --so-text-muted: var(--so-workspace-overlay-text-muted);
  --so-border: var(--so-workspace-overlay-border);
  --so-primary: var(--so-workspace-overlay-content-primary);
  --so-primary-strong: var(--so-workspace-overlay-content-primary-strong);
  --so-on-primary: var(--so-workspace-overlay-surface);
}

.responsive-filter-drawer__trigger,
.responsive-filter-drawer__sheet > header,
.responsive-filter-drawer__scrim {
  display: none;
}

.responsive-filter-drawer--overlay .responsive-filter-drawer__trigger {
  width: 100%;
  min-height: var(--so-touch-target);
  padding: 10px 12px;
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--so-border);
  color: var(--so-text);
  background: var(--so-panel);
  text-align: left;
}

.responsive-filter-drawer--overlay .responsive-filter-drawer__trigger b,
.responsive-filter-drawer--overlay .responsive-filter-drawer__sheet small {
  color: var(--so-text-muted);
  font-size: var(--so-font-meta);
}

.responsive-filter-drawer--overlay .responsive-filter-drawer__trigger i {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  color: var(--so-primary);
  background: color-mix(in srgb, var(--so-primary) 12%, transparent);
  font-style: normal;
}

.responsive-filter-drawer--overlay .responsive-filter-drawer__surface {
  position: fixed;
  z-index: 240;
  inset: 0;
  visibility: hidden;
  pointer-events: none;
}

.responsive-filter-drawer--overlay .responsive-filter-drawer__surface.is-open {
  visibility: visible;
  pointer-events: auto;
}

.responsive-filter-drawer--overlay .responsive-filter-drawer__scrim {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  border: 0;
  background: color-mix(in srgb, var(--so-bg) 78%, transparent);
  opacity: 0;
  transition: opacity 220ms ease;
}

.responsive-filter-drawer--overlay
  .responsive-filter-drawer__surface.is-open
  .responsive-filter-drawer__scrim {
  opacity: 1;
}

.responsive-filter-drawer--overlay .responsive-filter-drawer__sheet {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100dvh;
  padding: 18px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  border: 0;
  color: var(--so-text);
  background: var(--so-bg-elevated);
  transform: translateX(100%);
  transition: transform 220ms ease;
}

.responsive-filter-drawer--overlay .responsive-filter-drawer__content {
  min-height: 0;
  flex: 1;
  display: grid;
  grid-template-rows: minmax(0, 1fr);
}

.responsive-filter-drawer--overlay
  .responsive-filter-drawer__surface.is-open
  .responsive-filter-drawer__sheet {
  transform: translateX(0);
}

.responsive-filter-drawer--overlay .responsive-filter-drawer__sheet > header {
  margin-bottom: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.responsive-filter-drawer--overlay .responsive-filter-drawer__sheet > header div {
  display: grid;
  gap: 3px;
}

.responsive-filter-drawer--overlay .responsive-filter-drawer__sheet > header button {
  min-width: var(--so-touch-target);
  min-height: var(--so-touch-target);
  border: 1px solid var(--so-border);
  color: var(--so-text);
  background: var(--so-panel-soft);
}

@media (prefers-reduced-motion: reduce) {
  .responsive-filter-drawer__surface,
  .responsive-filter-drawer__surface :deep(*),
  .responsive-filter-drawer__scrim,
  .responsive-filter-drawer__sheet {
    transition: none;
  }
}
</style>
