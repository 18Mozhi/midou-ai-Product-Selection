import assert from "node:assert/strict";
import path from "node:path";
import {
  previewShellVue,
  shellReviewCss,
  shellReviewModule,
} from "./ui-phase2-shell-vue-preview.mjs";

export const backupReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/backup-page-preview.css";
export const backupPageSources = [
  backupReviewCss,
  "apps/web/src/backup-recovery-center-c.css",
  "apps/web/src/components/BackupRecoveryCenter.vue",
  "apps/web/src/components/BackupRecoveryDirectory.vue",
  "apps/web/src/components/ResponsiveDataView.vue",
  "apps/web/src/components/TableViewControls.vue",
  shellReviewCss,
  shellReviewModule,
  "scripts/lib/ui-phase2-shell-vue-preview.mjs",
  "scripts/lib/backup-page-preview.mjs",
];

const once = (source, target, replacement) => {
  assert.equal(source.split(target).length, 2, "P64 unique anchor: " + target);
  return source.replace(target, replacement);
};

export function previewBackupPage(input) {
  const source = input.replaceAll("\r\n", "\n");
  return once(
    source,
    'class="backup-center backup-center--c"',
    'class="backup-center backup-center--c backup-center--review"',
  );
}

export function backupPagePlugin() {
  return {
    name: "p64-actual-vue-review",
    enforce: "pre",
    transform(source, id) {
      const file = id.replaceAll("\\", "/");
      if (
        file ===
        path.resolve("apps/web/src/components/BackupRecoveryCenter.vue").replaceAll("\\", "/")
      )
        return { code: previewBackupPage(source), map: null };
      if (
        file === path.resolve("apps/web/src/components/NavigationShell.vue").replaceAll("\\", "/")
      )
        return { code: previewShellVue(source), map: null };
    },
    transformIndexHtml(html) {
      return once(
        once(html, "<body>", '<body class="shell-vue-c">'),
        "</head>",
        [shellReviewCss, backupReviewCss]
          .map(
            (file) =>
              `<link rel="stylesheet" href="/@fs/${path.resolve(file).replaceAll("\\", "/")}">`,
          )
          .join("") + "</head>",
      );
    },
  };
}
