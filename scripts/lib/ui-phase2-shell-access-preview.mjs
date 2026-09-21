import assert from "node:assert/strict";
import { previewShellVue } from "./ui-phase2-shell-vue-preview.mjs";

export const shellAccessCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/shell-access-c-preview.css";
export const shellAccessCopy = [
  [
    "expired",
    ["登录已失效", "重新登录后返回当前页面。"],
    ["请重新登录", "当前登录状态已失效，请重新登录后继续。"],
  ],
  [
    "forbidden",
    ["无权进入此工作台", "服务端已拒绝该壳层；返回有权访问的工作台。"],
    ["当前暂时无法进入这个工作台", "当前账号还不能访问这个工作台，可以返回成员工作台继续。"],
  ],
  [
    "context_required",
    ["尚未选择组织与工作区", "完成租户选择后才能进入成员或组织后台。"],
    ["先选择组织与工作区", "选择本次使用的组织与工作区后，再继续进入工作台。"],
  ],
  [
    "rate_limited",
    ["请求过于频繁", "稍后重试；不要连续刷新。"],
    ["请稍等片刻再试", "当前请求较多，稍后可以重新检查工作台访问状态。"],
  ],
  [
    "blocked",
    ["导航服务暂不可用", "检查网络后重试；运维可在宝塔查看 Node API。"],
    ["暂时无法读取工作台", "这次读取没有完成。你可以检查网络后重新尝试。"],
  ],
  [
    "loading",
    ["正在核验工作台权限", "菜单只会在服务端确认后显示。"],
    ["正在确认工作台访问权限", "确认后将显示可访问的菜单，请稍候。"],
  ],
];
export const shellAccessFocus = `function reviewRecheck(event: MouseEvent) {
  const trigger = event.currentTarget;
  if (trigger instanceof HTMLButtonElement && document.activeElement === trigger) {
    trigger.closest(".role-gate-state")?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  }
  void load();
}
`;
export function previewShellAccess(source) {
  let result = previewShellVue(source);
  const replace = (before, after) => {
    assert.equal(result.split(before).length, 2, `Inspect access anchor: ${before}`);
    result = result.replace(before, after);
  };
  for (const [key, before, after] of shellAccessCopy) {
    replace(
      `${key}: [${before.map(JSON.stringify).join(", ")}],`,
      `${key}: [${after.map(JSON.stringify).join(", ")}],`,
    );
  }
  replace("let navigationSequence = 0;", shellAccessFocus + "let navigationSequence = 0;");
  replace("<h1>{{ stateCopy[0] }}</h1>", '<h1 tabindex="-1">{{ stateCopy[0] }}</h1>');
  replace(
    'type="button" @click="load">重新检查</button>',
    'type="button" @click="reviewRecheck">重新检查</button>',
  );
  return result;
}
