import assert from "node:assert/strict";
import path from "node:path";
import { baseParse } from "@vue/compiler-dom";
import {
  previewShellVue,
  shellReviewCss,
  shellReviewModule,
} from "./ui-phase2-shell-vue-preview.mjs";

export const releaseReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/release-page-preview.css";
export const releasePageSources = [
  releaseReviewCss,
  shellReviewCss,
  shellReviewModule,
  "scripts/lib/ui-phase2-shell-vue-preview.mjs",
  "scripts/lib/release-page-preview.mjs",
];
const once = (source, target, replacement) => {
  assert.equal(source.split(target).length, 2, "P65 unique anchor: " + target.slice(0, 80));
  return source.replace(target, replacement);
};

export function releaseNodes(source) {
  const template = source.slice(
    source.indexOf("<template>") + 10,
    source.lastIndexOf("</template>"),
  );
  const nodes = [];
  const walk = (node) => {
    nodes.push(node);
    for (const child of node.children ?? []) walk(child);
  };
  walk(baseParse(template));
  const byClass = (name) => {
    const found = nodes.filter(
      (node) =>
        node.type === 1 &&
        node.props.some(
          (prop) => prop.name === "class" && prop.value?.content?.split(/\s+/u).includes(name),
        ),
    );
    assert.equal(found.length, 1, "P65 unique class " + name);
    return found[0];
  };
  return { nodes, byClass };
}

export function previewReleasePage(input) {
  const source = input.replaceAll("\r\n", "\n");
  releaseNodes(source).byClass("release-center");
  let review = once(
    source,
    '<section class="release-center release-center--c">',
    '<section class="release-center release-center--c release-center--review">',
  );
  review = once(
    review,
    '<div class="p65-layout">',
    '<p class="p65-review-note">实际 Vue 审核版 · 本地测试样例 · 未执行发布或回滚 · 尚未部署</p><div class="p65-layout">',
  );
  return review;
}

export function releasePagePlugin() {
  return {
    name: "p65-actual-vue-review",
    enforce: "pre",
    transform(source, id) {
      const file = id.replaceAll("\\", "/"),
        absolute = (candidate) => path.resolve(candidate).replaceAll("\\", "/");
      if (file === absolute("apps/web/src/components/ReleaseRolloutCenter.vue"))
        return { code: previewReleasePage(source), map: null };
      if (file === absolute("apps/web/src/components/NavigationShell.vue"))
        return { code: previewShellVue(source), map: null };
    },
    transformIndexHtml(html) {
      return once(
        once(html, "<body>", '<body class="shell-vue-c">'),
        "</head>",
        [shellReviewCss, releaseReviewCss]
          .map(
            (file) =>
              `<link rel="stylesheet" href="/@fs/${path.resolve(file).replaceAll("\\", "/")}">`,
          )
          .join("") + "</head>",
      );
    },
  };
}
