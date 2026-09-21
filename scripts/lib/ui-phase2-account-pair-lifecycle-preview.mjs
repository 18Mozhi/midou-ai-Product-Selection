import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import {
  accountPairCss,
  accountPairSupport,
  previewAccountPair,
} from "./ui-phase2-account-pair-preview.mjs";

export const pairCompositionPacket = "output/playwright/account-pair-app-c-r2/evidence.json";
export const pairCompositionHash =
  "c50588c178dca13d8559c1ce2901fe44161262ceb19ed3f1bb42fe5d44f9ef24";
const hash = (value) => createHash("sha256").update(value).digest("hex");

export async function accountPairLifecyclePreview(read, sources) {
  const manifest = await read(pairCompositionPacket);
  assert.equal(hash(manifest), pairCompositionHash, "Original C r2 review packet changed");
  const evidence = JSON.parse(manifest);
  const targets = {
    "apps/web/src/components/NavigationShell.vue": "shell",
    "apps/web/src/components/PlatformAccountCenter.vue": "parent",
    "apps/web/src/components/PlatformAccountDialogs.vue": "create",
    "apps/web/src/components/PlatformUserDetailDialog.vue": "detail",
  };
  const originals = {},
    transformed = {};
  for (const file of [...accountPairSupport, ...Object.keys(targets)]) {
    const source = await read(file);
    assert.equal(
      hash(source),
      evidence.sourceHashes[file],
      `C r2 composition source drift: ${file}`,
    );
    sources.add(file);
    if (file in targets) {
      originals[file] = source;
      transformed[file] = previewAccountPair(source, targets[file]);
      assert.equal(
        hash(transformed[file]),
        evidence.transformedHashes[file],
        `C r2 transformed source drift: ${file}`,
      );
    }
  }
  for (const file of [
    "scripts/lib/ui-phase2-account-pair-lifecycle-preview.mjs",
    "scripts/lib/ui-phase2-account-pair-lifecycle-driver.mjs",
    "scripts/verify-ui-phase2-account-pair-lifecycle.mjs",
  ])
    sources.add(file);
  return {
    metadata: {
      packet: pairCompositionPacket,
      sha256: pairCompositionHash,
      transformedHashes: evidence.transformedHashes,
    },
    plugin: {
      name: "account-pair-r2-lifecycle-review-only",
      enforce: "pre",
      transform(source, id) {
        const file = Object.keys(targets).find(
          (file) => path.resolve(file).replaceAll("\\", "/") === id.replaceAll("\\", "/"),
        );
        if (!file) return null;
        assert.equal(source.replaceAll("\r\n", "\n"), originals[file]);
        return { code: transformed[file], map: null };
      },
      transformIndexHtml(html) {
        return html
          .replace(
            "<body>",
            '<body class="account-pair-review shell-vue-c p43-page-preview p43-user-form-review p44-role-review p44-assembled">',
          )
          .replace(
            "</head>",
            accountPairCss
              .map(
                (file) =>
                  `<link rel="stylesheet" href="/@fs/${path.resolve(file).replaceAll("\\", "/")}">`,
              )
              .join("\n") + "</head>",
          );
      },
    },
  };
}
