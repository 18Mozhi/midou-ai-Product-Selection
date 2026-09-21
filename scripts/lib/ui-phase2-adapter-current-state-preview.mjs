import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  beforeAdapterEmptyFocus,
  adapterEmptyFocusRevision,
} from "./ui-phase2-adapter-empty-focus-baseline.mjs";
import { previewAdapterAccess, accessHandler } from "./ui-phase2-adapter-access-preview.mjs";
import {
  previewAdapterFilterPagination,
  pageTurnHandler,
} from "./ui-phase2-adapter-filter-pagination-preview.mjs";
import {
  beforeAdapterRefreshFocus,
  refreshFocusFunction,
} from "./ui-phase2-adapter-refresh-focus-baseline.mjs";
import {
  beforeAdapterEmptyMobile,
  emptyMobileChanges,
} from "./ui-phase2-adapter-empty-mobile-baseline.mjs";
import {
  beforeAdapterPaginationFocus,
  paginationFocusRevision,
  paginationFocusHandler,
  paginationBeforeNav,
  paginationCurrentNav,
} from "./ui-phase2-adapter-pagination-focus-baseline.mjs";

// Preserve all verified production focus fixes when composing the archived proposals.
function compose(source, preview, handler, needsTick) {
  source = source.replaceAll("\r\n", "\n");
  const hasPaginationFocus =
    createHash("sha256").update(source).digest("hex") === paginationFocusRevision.current;
  if (hasPaginationFocus) source = beforeAdapterPaginationFocus(source);
  let emptyFocusSource, presentationSource;
  try {
    presentationSource =
      createHash("sha256").update(source).digest("hex") === adapterEmptyFocusRevision.after
        ? source
        : beforeAdapterEmptyMobile(source);
    emptyFocusSource = beforeAdapterRefreshFocus(presentationSource);
  } catch {
    assert.fail("Current P47 proposal requires an explicitly verified production revision");
  }
  assert.equal(
    createHash("sha256").update(emptyFocusSource).digest("hex"),
    adapterEmptyFocusRevision.after,
    "Current P47 proposal requires an explicitly verified production revision",
  );
  const previous = beforeAdapterEmptyFocus(emptyFocusSource);
  const start = source.indexOf("async function resetEmptyFilters("),
    end = source.indexOf("onMounted(load);", start),
    focus = source.slice(start, end);
  let result = preview(previous);
  assert.equal(result.split(handler).length, 2);
  result = result.replace(handler, focus + handler);
  assert.equal(result.split('@click="resetFilters">清除筛选').length, 2);
  result = result.replace('@click="resetFilters">清除筛选', '@click="resetEmptyFilters">清除筛选');
  if (needsTick) {
    assert.equal(result.split("computed, onMounted").length, 2);
    result = result.replace("computed, onMounted", "computed, nextTick, onMounted");
  }
  if (presentationSource !== emptyFocusSource) {
    const anchor = "async function resetEmptyFilters(";
    assert.equal(result.split(anchor).length, 2);
    result = result.replace(anchor, refreshFocusFunction + anchor);
    const oldHeading = '<header class="adapter-heading">';
    const focusHeading = '<header class="adapter-heading" tabindex="-1">';
    assert.equal(result.split(oldHeading).length + result.split(focusHeading).length - 2, 1);
    result = result.replace(oldHeading, focusHeading);
    assert.equal(result.split('@click="load"').length, 2);
    result = result.replace('@click="load"', '@click="refreshFromButton"');
  }
  if (source !== presentationSource) {
    for (const [before, after] of emptyMobileChanges) {
      const anchor = before || 'import "../provider-adapters-c-feedback.css";\n';
      assert.equal(result.split(anchor).length, 2, "Unique current mobile composition anchor");
      result = result.replace(anchor, before ? after : anchor + after);
    }
  }
  if (hasPaginationFocus) {
    if (handler === pageTurnHandler) {
      assert.equal(result.split(pageTurnHandler).length, 2);
      result = result.replace(pageTurnHandler, paginationFocusHandler);
    } else {
      assert.equal(result.split("function refreshFromButton(").length, 2);
      result = result.replace(
        "function refreshFromButton(",
        paginationFocusHandler + "function refreshFromButton(",
      );
      assert.equal(result.split(paginationBeforeNav).length, 2);
      result = result.replace(paginationBeforeNav, paginationCurrentNav);
    }
  }
  return result;
}

export const previewCurrentAdapterAccess = (source) =>
  compose(source, previewAdapterAccess, accessHandler, true);
export const previewCurrentAdapterFilterPagination = (source) =>
  compose(source, previewAdapterFilterPagination, pageTurnHandler, false);
