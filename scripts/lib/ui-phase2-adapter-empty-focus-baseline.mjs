import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export const adapterEmptyFocusRevision = {
  file: "apps/web/src/components/ProviderAdapterCenter.vue",
  before: "66b064c2135275b9d173ef316692366823ef4f6276002796d9ed112183218cef",
  after: "ea3eaecf5bb8a6ec5e8e701dd8743cac61a35c6806a8a0d35079ba64be3b5e40",
};
const hash = (value) => createHash("sha256").update(value).digest("hex");

// Exact inverse for historical review only; never present this as the current runtime source.
export function beforeAdapterEmptyFocus(source) {
  source = source.replaceAll("\r\n", "\n");
  if (hash(source) !== adapterEmptyFocusRevision.after) return source;
  const start = source.indexOf("async function resetEmptyFilters("),
    end = source.indexOf("onMounted(load);", start);
  assert.ok(start >= 0 && end > start);
  const previous = (source.slice(0, start) + source.slice(end))
    .replace("computed, nextTick, onMounted", "computed, onMounted")
    .replace('@click="resetEmptyFilters">清除筛选', '@click="resetFilters">清除筛选');
  assert.equal(hash(previous), adapterEmptyFocusRevision.before);
  return previous;
}
