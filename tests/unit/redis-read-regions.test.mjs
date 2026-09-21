import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "@vue/compiler-sfc";

const source = readFileSync("apps/web/src/components/RedisResilienceCenter.vue", "utf8");
const template = parse(source).descriptor.template.content;

test("P67 reads and refresh feedback are named, announced regions", () => {
  for (const name of [
    "redis-resilience__state",
    "redis-resilience__state redis-resilience__state--danger",
  ]) {
    const start = template.indexOf(`class=\"${name}\"`);
    const region = template.slice(start, template.indexOf("</section>", start));
    assert.notEqual(start, -1, `${name} region is present`);
    assert.match(region, /aria-live="polite"/);
    assert.match(region, /aria-labelledby="redis-read-title"/);
    assert.match(region, /:aria-busy="refreshing"/);
    assert.match(region, /<h3 id="redis-read-title">{{ verdict\[0\] }}<\/h3>/);
  }
});

test("P67 retained refresh feedback has its own label and keeps failed-read trace", () => {
  const start = template.indexOf('class="redis-resilience__refresh-notice"');
  const region = template.slice(start, template.indexOf("</section>", start));
  assert.notEqual(start, -1, "refresh notice is present");
  assert.match(region, /aria-live="polite"/);
  assert.match(region, /aria-labelledby="redis-refresh-title"/);
  assert.match(region, /:aria-busy="refreshing"/);
  assert.match(region, /<h3 id="redis-refresh-title">/);
  assert.match(region, /:request-id="readFailureId"/);
});

test("P67 state headings retain native retry controls and valid Vue compilation", () => {
  assert.match(template, /ref="refreshButton"[\s\S]*:aria-disabled="refreshing"/);
  assert.match(template, /ref="retryButton" type="button" :disabled="refreshing" @click="load"/);
  assert.match(
    readFileSync("apps/web/src/redis-resilience.css", "utf8"),
    /\.redis-resilience__state h3/,
  );
  assert.doesNotThrow(() => parse(source));
});
