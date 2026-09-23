import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compileScript, compileTemplate, parse } from "@vue/compiler-sfc";
import {
  previewLogPage,
  originalLogChain,
  logReviewComponent,
} from "../../scripts/lib/platform-log-page-preview.mjs";
import { logReviewFixtures } from "../../scripts/lib/log-review-fixtures.mjs";

const pageFile = "apps/web/src/components/PlatformLogCenter.vue",
  pageSource = readFileSync(pageFile, "utf8").replaceAll("\r\n", "\n"),
  review = previewLogPage(pageSource);

function compile(file, source) {
  const { descriptor, errors } = parse(source);
  assert.deepEqual(errors, [], `${file}: SFC parse`);
  const script = compileScript(descriptor, { id: "p62" });
  assert.deepEqual(
    compileTemplate({
      source: descriptor.template.content,
      filename: file,
      id: "p62",
      compilerOptions: { bindingMetadata: script.bindings },
    }).errors,
    [],
    `${file}: template compile`,
  );
}

test("P62 review composes the actual production page without changing its business script", () => {
  assert.equal(
    parse(review).descriptor.scriptSetup.content,
    parse(pageSource).descriptor.scriptSetup.content,
  );
  assert.match(review, /platform-log-center--c platform-log-center--review/);
  assert.match(review, /P62 \/ 事件检索/);
  assert.doesNotMatch(review, /尚未部署|本地合成日志/);
});

test("P62 retains all original columns, event detail fields, and evidence-based links", () => {
  const chain = originalLogChain(pageSource);
  assert.equal((chain.match(/<th>/g) || []).length, 7);
  assert.ok(chain.includes(':rows="chain.items"'));
  assert.ok(chain.includes("查看关联任务"));
  assert.ok(chain.includes("查看关联来源"));
  assert.ok(chain.includes("技术详情"));
  assert.ok(chain.includes("row.request_id"));
  assert.ok(chain.includes("row.resource_id"));
});

test("P62 production page and trace workspace compile as separate Vue components", () => {
  compile(pageFile, pageSource);
  compile(logReviewComponent, readFileSync(logReviewComponent, "utf8"));
});

test("P62 visual preview fails closed if the production C root anchor drifts", () =>
  assert.throws(() =>
    previewLogPage(
      pageSource.replace(
        'class="platform-log-center platform-log-center--c"',
        'class="platform-log-center changed"',
      ),
    ),
  ));

test("P62 directory is local-only, named, keyboard-operable, and keeps chain controls mounted", () => {
  const source = readFileSync(logReviewComponent, "utf8");
  assert.match(source, /type="button"/);
  assert.match(source, /:aria-pressed=/);
  assert.match(source, /:aria-controls=/);
  assert.match(source, /v-show=/);
  assert.match(source, /selectedTraceId/);
  assert.doesNotMatch(source, /fetch\(|localStorage|sessionStorage|router|setInterval|setTimeout/);
});

test("P62 original local fixture remains three events across two trace IDs", async () => {
  const { fixture, nav } = await logReviewFixtures();
  assert.equal(fixture.domain, "logs");
  assert.equal(fixture.items.length, 3);
  assert.equal(new Set(fixture.items.map((item) => item.trace_id)).size, 2);
  assert.deepEqual(nav.platform_capabilities, ["platform:operate"]);
});
