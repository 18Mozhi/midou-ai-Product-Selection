import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export const paginationFocusRevision = {
  before: "51c0ba1f86fa1179fcb0d25b9cb327ef8a38f34b0cef53d5a916f0ef2f92a2ee",
  current: "24a3b27fca62f5331bd19c58ba501e2b6b9777d7e59a7b03248286d82a4962a2",
};
export const paginationFocusHandler = `function turnPage(direction: -1 | 1, event: MouseEvent) {
  const trigger = event.currentTarget;
  const reachesBoundary = direction === -1 ? page.value === 2 : page.value === totalPages.value - 1;
  if (
    reachesBoundary &&
    trigger instanceof HTMLButtonElement &&
    document.activeElement === trigger
  ) {
    const status = trigger.closest(".adapter-pagination")?.querySelector<HTMLElement>("span");
    if (status?.isConnected && !status.closest("[inert]")) status.focus({ preventScroll: true });
  }
  page.value += direction;
}
`;
export const paginationBeforeNav = `      <nav v-if="filtered.length" class="adapter-pagination" aria-label="来源适配器分页">
        <button type="button" :disabled="page === 1" @click="page--">上一页</button>
        <span>第 {{ page }} / {{ totalPages }} 页 · 每页 {{ pageSize }} 条</span>
        <button type="button" :disabled="page === totalPages" @click="page++">下一页</button>
      </nav>`;
export const paginationCurrentNav = `      <nav v-if="filtered.length" class="adapter-pagination" aria-label="来源适配器分页">
        <button type="button" :disabled="page === 1" @click="turnPage(-1, $event)">上一页</button>
        <span tabindex="-1" role="status" aria-live="polite" aria-atomic="true"
          >第 {{ page }} / {{ totalPages }} 页 · 每页 {{ pageSize }} 条</span
        >
        <button type="button" :disabled="page === totalPages" @click="turnPage(1, $event)">
          下一页
        </button>
      </nav>`;
const hash = (value) => createHash("sha256").update(value).digest("hex");

// Comparison/composition input only. Never substitute this for the actual current App.
export function beforeAdapterPaginationFocus(source) {
  source = source.replaceAll("\r\n", "\n");
  if (hash(source) === paginationFocusRevision.before) return source;
  assert.equal(hash(source), paginationFocusRevision.current, "Unknown pagination focus revision");
  assert.equal(source.split(paginationFocusHandler).length, 2);
  assert.equal(source.split(paginationCurrentNav).length, 2);
  const before = source
    .replace(paginationFocusHandler, "")
    .replace(paginationCurrentNav, paginationBeforeNav);
  assert.equal(
    hash(before),
    paginationFocusRevision.before,
    "Complete pagination inverse mismatch",
  );
  return before;
}
