import assert from "node:assert/strict";

export const shellReviewRoot = "design-plans/ui-phase-2-2026-09-07/implementation";
export const shellReviewModule = `${shellReviewRoot}/shell-review-navigation.ts`;
export const shellReviewCss = `${shellReviewRoot}/shell-vue-c-preview.css`;
export const shellReviewImport = `import { useShellReviewNavigation } from "../../../../${shellReviewModule}";\n`;
export const shellReviewSetup =
  "const { reviewNavigation, reviewCompact, reviewKeydown } = useShellReviewNavigation(menuOpen);\n";

// Review-host transformation only. Keep the actual dispatcher, requests, capabilities and handlers.
export function previewShellVue(source) {
  let result = source.replaceAll("\r\n", "\n");
  const replace = (before, after, alreadyCurrent) => {
    const count = result.split(before).length - 1;
    if (count === 1) result = result.replace(before, after);
    else {
      assert.equal(count, 0, `Inspect shell anchor: ${before}`);
      assert.ok(
        result.includes(alreadyCurrent),
        `Current shell contract missing: ${alreadyCurrent}`,
      );
    }
  };
  replace(
    'import AppIcon from "./AppIcon.vue";\n',
    'import AppIcon from "./AppIcon.vue";\n' + shellReviewImport,
  );
  replace(
    "const allCapabilities = computed",
    shellReviewSetup + "const allCapabilities = computed",
  );
  replace(
    'class="role-shell"',
    'class="role-shell role-shell--review"',
    'class="role-shell role-shell--c"',
  );
  if (!result.includes('class="role-shell role-shell--review"'))
    replace(
      'class="role-shell role-shell--c"',
      'class="role-shell role-shell--c role-shell--review"',
      'class="role-shell role-shell--c"',
    );
  replace(
    '    <nav\n      id="role-navigation"',
    '    <dialog ref="reviewNavigation" class="role-navigation-frame" aria-label="工作台导航"\n' +
      '      @cancel.prevent="menuOpen = false" @close="menuOpen = false" @keydown="reviewKeydown">\n' +
      '      <button v-if="reviewCompact" type="button" class="role-navigation-close"\n' +
      '        aria-label="关闭导航菜单" @click="menuOpen = false">关闭菜单</button>\n' +
      '    <nav\n      id="role-navigation"',
    '<dialog\n      ref="navigationDialog"',
  );
  replace(
    '    </nav>\n    <section class="role-content">',
    '    </nav>\n    </dialog>\n    <section class="role-content">',
    '</nav>\n    </dialog>\n    <section class="role-content">',
  );
  replace(
    "(menuOpen && group.items.some((item) => activeItem?.path === item.path))",
    "group.items.some((item) => activeItem?.path === item.path)",
    "group.items.some((item) => activeItem?.path === item.path)",
  );
  replace(
    '          <b class="role-page-folio" aria-hidden="true">{{ pageFolio }}</b>\n',
    "",
    'class="role-page-title"',
  );
  replace(
    "{{ activeItem?.group || shellTitle }} / SIGNAL LEDGER",
    "{{ activeItem?.group || shellTitle }}",
    "{{ activeItem?.group || shellTitle }}",
  );
  replace(
    "          <div>\n            <small>信号状态</small>\n" +
      '            <strong class="role-signal-status">已连接 · 可复核</strong>\n          </div>\n',
    "",
    'class="role-context-rail"',
  );
  replace(
    "            <span\n              ><small>信号状态</small\n" +
      '              ><strong class="role-signal-status">已连接 · 可复核</strong></span\n            >\n',
    "",
    'class="role-context-rail"',
  );
  return result;
}
