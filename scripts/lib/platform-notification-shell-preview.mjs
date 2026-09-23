import assert from "node:assert/strict";
import path from "node:path";
import {
  previewShellVue,
  shellReviewCss,
  shellReviewModule,
} from "./ui-phase2-shell-vue-preview.mjs";

export const notificationShellCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/platform-notification-shell-preview.css";
export const notificationShellSources = [
  notificationShellCss,
  shellReviewCss,
  shellReviewModule,
  "scripts/lib/ui-phase2-shell-vue-preview.mjs",
  "scripts/lib/platform-notification-shell-preview.mjs",
];
const once = (text, from, to) => {
  assert.equal(text.split(from).length, 2, `Unique composition anchor: ${from}`);
  return text.replace(from, to);
};

export function notificationShellPreview(source) {
  const text = previewShellVue(source),
    anchor = "            routePath !== '/platform-admin/redis'";
  return once(
    text,
    anchor,
    `${anchor} &&\n            routePath !== '/platform-admin/notifications'`,
  );
}

export function notificationPagePreview(source) {
  let text = source.replaceAll("\r\n", "\n");
  if (text.includes("platform-notifications--review")) return text;
  const rail = text.match(/    <aside class="platform-notifications__rail"[\s\S]*?    <\/aside>\n/);
  assert.ok(rail);
  text = once(text, rail[0], "");
  text = once(text, "      </header>\n", "      </header>\n" + rail[0]);
  text = once(text, "<h2>通知管理</h2>", "<h1>通知管理</h1>");
  const marker = 'class="platform-notifications"';
  assert.equal(text.split(marker).length, 2, "Unique P57 production marker");
  return text.replace(marker, 'class="platform-notifications platform-notifications--review"');
}

export function notificationShellPlugin() {
  return {
    name: "notification-shell-review-only",
    enforce: "pre",
    transform(source, id) {
      const file = id.replaceAll("\\", "/");
      for (const [name, transform] of [
        ["NavigationShell", notificationShellPreview],
        ["PlatformNotificationCenter", notificationPagePreview],
      ])
        if (file === path.resolve(`apps/web/src/components/${name}.vue`).replaceAll("\\", "/"))
          return { code: transform(source), map: null };
      return null;
    },
    transformIndexHtml(html) {
      let text = once(html, "<body>", '<body class="shell-vue-c">');
      return once(
        text,
        "</head>",
        [shellReviewCss, notificationShellCss]
          .map(
            (file) =>
              `<link rel="stylesheet" href="/@fs/${path.resolve(file).replaceAll("\\", "/")}">`,
          )
          .join("") + "</head>",
      );
    },
  };
}
