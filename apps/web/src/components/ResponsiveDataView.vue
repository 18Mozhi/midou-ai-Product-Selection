<script setup lang="ts" generic="DataRow extends Record<string, any>">
import { computed, nextTick, onBeforeUnmount, onDeactivated, shallowRef, watch } from "vue";
import TableViewControls from "./TableViewControls.vue";

const props = defineProps<{
  rows: DataRow[];
  rowKey: (row: DataRow) => string;
  title: string;
  detailTitle: (row: DataRow) => string;
  emptyMessage?: string;
  columnLabels?: boolean;
  columnHelp?: string;
  appearance?: "default" | "governance" | "content" | "security";
  focusFallback?: () => HTMLElement | null;
}>();

const selectedKey = shallowRef<string | null>(null),
  selected = computed(() =>
    selectedKey.value === null
      ? null
      : (props.rows.find((row) => props.rowKey(row) === selectedKey.value) ?? null),
  ),
  viewRoot = shallowRef<HTMLDivElement | null>(null),
  mobileList = shallowRef<HTMLDivElement | null>(null),
  overlay = shallowRef<HTMLDivElement | null>(null),
  drawer = shallowRef<HTMLElement | null>(null),
  closeButton = shallowRef<HTMLButtonElement | null>(null);
let trigger: HTMLButtonElement | null = null;
const background = new Map<HTMLElement, boolean>();
let confirmationObserver: MutationObserver | null = null;

function releaseBackground() {
  confirmationObserver?.disconnect();
  confirmationObserver = null;
  for (const [element, inert] of background) element.inert = inert;
  background.clear();
}
onBeforeUnmount(() => {
  const fallback = props.focusFallback?.();
  // Only the owning caller opts into an unmount handoff; never reclaim unrelated focus.
  if (fallback && overlay.value?.contains(document.activeElement)) void restoreFocus([fallback]);
});
onBeforeUnmount(releaseBackground);
onDeactivated(() => {
  selectedKey.value = null;
  trigger = null;
  releaseBackground();
});

function show(row: DataRow, event: Event) {
  trigger = event.currentTarget as HTMLButtonElement;
  trigger.focus({ preventScroll: true });
  selectedKey.value = props.rowKey(row);
}

function close() {
  selectedKey.value = null;
}

async function restoreFocus(candidates: Array<HTMLElement | null>) {
  await nextTick();
  // A handoff may already have focused a newer dialog. Never steal that focus.
  const activeDialog = document.activeElement?.closest(
    '[role="dialog"], [role="alertdialog"], dialog[open]',
  );
  if (activeDialog) return;
  const target = candidates.find(
    (element) =>
      element?.isConnected &&
      !element.matches(":disabled") &&
      !element.closest("[inert]") &&
      element.checkVisibility({ visibilityProperty: true }),
  );
  target?.focus({ preventScroll: true });
}

watch(
  () => Boolean(selected.value),
  async (open, wasOpen) => {
    if (open) {
      await nextTick();
      if (!selected.value || !overlay.value) return;
      // Keep body-level confirmation dialogs opened later operable above this drawer.
      for (const element of document.body.children) {
        if (
          !(element instanceof HTMLElement) ||
          element === overlay.value ||
          element.matches("dialog")
        )
          continue;
        if (!background.has(element)) background.set(element, element.inert);
        element.inert = true;
      }
      // ConfirmDialog is a body-level custom layer at z-index 100, not a native dialog.
      const syncConfirmation = () => {
        if (!overlay.value) return;
        const suspended = Boolean(document.body.querySelector(":scope > .confirm-backdrop"));
        overlay.value.inert = suspended;
        overlay.value.classList.toggle("responsive-data-view__overlay--suspended", suspended);
      };
      confirmationObserver = new MutationObserver(syncConfirmation);
      confirmationObserver.observe(document.body, { childList: true });
      syncConfirmation();
      closeButton.value?.focus({ preventScroll: true });
      return;
    }
    releaseBackground();
    if (!wasOpen) return;
    selectedKey.value = null;
    await restoreFocus([
      trigger,
      mobileList.value,
      viewRoot.value,
      props.focusFallback?.() ?? null,
    ]);
  },
);

function handleTab(event: KeyboardEvent) {
  if (event.key !== "Tab" || !drawer.value || !selected.value) return;
  const controls = [
    ...drawer.value.querySelectorAll<HTMLElement>(
      'button, a[href], input, select, textarea, summary, [tabindex], [contenteditable="true"]',
    ),
  ].filter(
    (element) =>
      !element.matches(":disabled") &&
      element.tabIndex >= 0 &&
      !element.closest("[inert]") &&
      element.checkVisibility({ visibilityProperty: true }),
  );
  const first = controls[0],
    last = controls.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
</script>

<template>
  <div
    ref="viewRoot"
    class="responsive-data-view"
    :data-appearance="appearance || 'default'"
    role="group"
    :aria-label="title"
    tabindex="-1"
  >
    <TableViewControls
      class="responsive-data-view__desktop"
      :column-labels="columnLabels"
      :column-help="columnHelp"
      ><slot name="desktop" :show="show"
    /></TableViewControls>
    <div ref="mobileList" class="responsive-data-view__mobile" :aria-label="title" tabindex="-1">
      <p v-if="!rows.length" class="responsive-data-view__empty">
        {{ emptyMessage || "暂无记录" }}
      </p>
      <article v-for="row in rows" :key="props.rowKey(row)">
        <button type="button" aria-haspopup="dialog" @click="show(row, $event)">
          <span class="responsive-data-view__summary"><slot name="summary" :row="row" /></span>
          <span class="responsive-data-view__action">查看详情</span>
        </button>
      </article>
    </div>
    <Teleport to="body">
      <div
        v-if="selected"
        ref="overlay"
        class="responsive-data-view__overlay"
        :class="{
          'responsive-data-view__overlay--governance': appearance === 'governance',
          'responsive-data-view__overlay--content': appearance === 'content',
          'responsive-data-view__overlay--security': appearance === 'security',
        }"
        @keydown.esc="close"
        @keydown="handleTab"
      >
        <button
          type="button"
          class="responsive-data-view__scrim"
          aria-label="关闭详情"
          tabindex="-1"
          @click="close"
        ></button>
        <section
          ref="drawer"
          class="responsive-data-view__drawer"
          role="dialog"
          aria-modal="true"
          :aria-label="detailTitle(selected)"
        >
          <header>
            <div>
              <small>记录详情</small>
              <strong>{{ detailTitle(selected) }}</strong>
            </div>
            <button ref="closeButton" type="button" aria-label="关闭详情" @click="close">×</button>
          </header>
          <div class="responsive-data-view__details">
            <slot name="detail" :row="selected" :close="close" />
          </div>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
@import "../design/platform-overlay-tokens.css";

.responsive-data-view:focus-visible {
  outline: 3px solid var(--so-focus);
  outline-offset: 3px;
}

.responsive-data-view__mobile {
  display: none;
}

.responsive-data-view__overlay {
  position: fixed;
  z-index: 260;
  inset: 0;
}

.responsive-data-view__overlay--governance {
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
  --so-shadow: 0 16px 40px color-mix(in srgb, var(--so-workspace-overlay-text) 16%, transparent);
}

.responsive-data-view__overlay--content {
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
  --so-shadow: 0 16px 40px color-mix(in srgb, var(--so-workspace-overlay-text) 16%, transparent);
}

.responsive-data-view__overlay--suspended {
  z-index: 99;
}

.responsive-data-view__scrim {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  background: color-mix(in srgb, var(--so-bg) 78%, transparent);
}

.responsive-data-view__drawer {
  position: absolute;
  inset: 0 0 0 auto;
  width: min(390px, calc(100% - 20px));
  max-height: 100dvh;
  padding: 18px;
  overflow-y: auto;
  border-left: 1px solid var(--so-border);
  color: var(--so-text);
  background: var(--so-bg-elevated);
  box-shadow: var(--so-shadow);
}

.responsive-data-view__drawer > header {
  margin-bottom: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.responsive-data-view__drawer > header div,
.responsive-data-view__details,
.responsive-data-view__details :deep(dl) {
  display: grid;
  gap: 10px;
}

.responsive-data-view__drawer small,
.responsive-data-view__details :deep(dt) {
  color: var(--so-text-muted);
}

.responsive-data-view__details :deep(button) {
  min-height: var(--so-touch-target);
  padding: 10px 14px;
  border: 0;
  border-radius: 10px;
  color: var(--so-on-primary);
  background: var(--so-primary-strong);
  font: inherit;
  font-weight: 750;
}

.responsive-data-view__details :deep(button.secondary) {
  border: 1px solid var(--so-border);
  color: var(--so-primary);
  background: var(--so-panel-soft);
}

.responsive-data-view__details :deep(details) {
  padding-top: 4px;
}

.responsive-data-view__details :deep(summary) {
  min-height: var(--so-touch-target);
  display: flex;
  align-items: center;
  color: var(--so-primary);
  cursor: pointer;
}

.responsive-data-view__drawer > header button {
  min-width: var(--so-touch-target);
  min-height: var(--so-touch-target);
  border: 1px solid var(--so-border);
  border-radius: 10px;
  color: var(--so-text);
  background: var(--so-panel-soft);
}

.responsive-data-view__details :deep(dl),
.responsive-data-view__details :deep(dd) {
  margin: 0;
}

.responsive-data-view__details :deep(dl div) {
  padding-bottom: 10px;
  border-bottom: 1px solid var(--so-border);
}

.responsive-data-view__details :deep(dd) {
  margin-top: 4px;
  overflow-wrap: anywhere;
}

@media (max-width: 760px) {
  .responsive-data-view__desktop {
    display: none;
  }

  .responsive-data-view__mobile {
    display: grid;
    gap: 10px;
  }

  .responsive-data-view__empty {
    margin: 0;
    padding: 14px;
    border: 1px dashed var(--so-border);
    border-radius: 12px;
    color: var(--so-text-muted);
  }

  .responsive-data-view__mobile article {
    border: 1px solid var(--so-border);
    border-radius: 12px;
    background: var(--so-panel-soft);
    overflow: hidden;
  }

  .responsive-data-view__mobile article > button {
    width: 100%;
    min-height: var(--so-touch-target);
    padding: 14px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    border: 0;
    color: var(--so-text);
    background: transparent;
    text-align: left;
  }

  .responsive-data-view__summary,
  .responsive-data-view__summary :deep(.responsive-record-summary) {
    min-width: 0;
    display: grid;
    gap: 5px;
  }

  .responsive-data-view__summary :deep(small),
  .responsive-data-view__action {
    color: var(--so-text-muted);
  }

  .responsive-data-view__action {
    white-space: nowrap;
  }
}
</style>
