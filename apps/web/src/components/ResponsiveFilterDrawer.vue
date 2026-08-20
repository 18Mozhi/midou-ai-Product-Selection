<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";

withDefaults(defineProps<{ label?: string; activeCount?: number }>(), {
  label: "筛选条件",
  activeCount: 0,
});

const open = ref(false);
const mobile = ref(false);
const triggerButton = ref<HTMLButtonElement | null>(null);
const closeButton = ref<HTMLButtonElement | null>(null);
const sheet = ref<HTMLElement | null>(null);
let mediaQuery: MediaQueryList | null = null;

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
  if (event.key !== "Tab" || !mobile.value || !open.value || !sheet.value) return;
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
  <div class="responsive-filter-drawer" @keydown="handleKeydown">
    <button
      ref="triggerButton"
      type="button"
      class="responsive-filter-drawer__trigger"
      aria-haspopup="dialog"
      :aria-expanded="open"
      @click="show"
    >
      <span>{{ label }}</span>
      <b v-if="activeCount">{{ activeCount }} 项已选</b>
      <i aria-hidden="true">调</i>
    </button>
    <div
      class="responsive-filter-drawer__surface"
      :class="{ 'is-open': open }"
      :aria-hidden="mobile && !open"
    >
      <button
        type="button"
        class="responsive-filter-drawer__scrim"
        aria-label="关闭筛选条件"
        @click="close"
      ></button>
      <section
        ref="sheet"
        class="responsive-filter-drawer__sheet"
        :role="mobile ? 'dialog' : 'group'"
        :aria-modal="mobile && open ? 'true' : undefined"
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
</template>

<style scoped>
.responsive-filter-drawer__trigger,
.responsive-filter-drawer__sheet > header,
.responsive-filter-drawer__scrim {
  display: none;
}

@media (max-width: 760px) {
  .responsive-filter-drawer__trigger {
    width: 100%;
    min-height: var(--so-touch-target);
    padding: 10px 12px;
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: 10px;
    border: 1px solid var(--so-border);
    border-radius: 12px;
    color: var(--so-text);
    background: var(--so-panel);
    text-align: left;
  }

  .responsive-filter-drawer__trigger b,
  .responsive-filter-drawer__sheet small {
    color: var(--so-text-muted);
    font-size: 0.75rem;
  }

  .responsive-filter-drawer__trigger i {
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border-radius: 9px;
    color: var(--so-primary);
    background: color-mix(in srgb, var(--so-primary) 12%, transparent);
    font-style: normal;
  }

  .responsive-filter-drawer__surface {
    position: fixed;
    z-index: 240;
    inset: 0;
    visibility: hidden;
    pointer-events: none;
  }

  .responsive-filter-drawer__surface.is-open {
    visibility: visible;
    pointer-events: auto;
  }

  .responsive-filter-drawer__scrim {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    border: 0;
    background: color-mix(in srgb, var(--so-bg) 78%, transparent);
    opacity: 0;
    transition: opacity 180ms ease;
  }

  .responsive-filter-drawer__surface.is-open .responsive-filter-drawer__scrim {
    opacity: 1;
  }

  .responsive-filter-drawer__sheet {
    position: absolute;
    inset: 0 0 0 auto;
    width: min(370px, calc(100% - 20px));
    max-height: 100dvh;
    padding: 18px;
    overflow-y: auto;
    border-left: 1px solid var(--so-border);
    color: var(--so-text);
    background: var(--so-bg-elevated);
    box-shadow: var(--so-shadow);
    transform: translateX(100%);
    transition: transform 180ms ease;
  }

  .responsive-filter-drawer__surface.is-open .responsive-filter-drawer__sheet {
    transform: translateX(0);
  }

  .responsive-filter-drawer__sheet > header {
    margin-bottom: 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .responsive-filter-drawer__sheet > header div {
    display: grid;
    gap: 3px;
  }

  .responsive-filter-drawer__sheet > header button {
    min-width: var(--so-touch-target);
    min-height: var(--so-touch-target);
    border: 1px solid var(--so-border);
    border-radius: 10px;
    color: var(--so-text);
    background: var(--so-panel-soft);
  }
}

@media (prefers-reduced-motion: reduce) {
  .responsive-filter-drawer__scrim,
  .responsive-filter-drawer__sheet {
    transition: none;
  }
}
</style>
