import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { baseParse } from "@vue/compiler-dom";
import { compileTemplate, parse } from "@vue/compiler-sfc";

const componentPath = "apps/web/src/components/ProviderRegistry.vue";
const component = readFileSync(componentPath, "utf8").replaceAll("\r\n", "\n");
const staticRequired = new Set([
  "code",
  "name",
  "target_url",
  "owner_label",
  "markets",
  "languages",
  "fields",
  "dedupe_key",
  "parser_version",
  "schedule_minutes",
  "concurrency_limit",
  "timeout_ms",
  "retry_limit",
  "circuit_failure_threshold",
  "retention_days",
  "failure_rules",
]);
const conditionalRequired = new Set(["terms_reference_url", "terms_version", "terms_expires_at"]);

test("P46 required semantics compile and match only fields currently required by validation", () => {
  const parsed = parse(component);
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(
    compileTemplate({
      source: parsed.descriptor.template.content,
      filename: componentPath,
      id: "p46-required-field-semantics",
    }).errors,
    [],
  );

  const foundStatic = new Set();
  const foundConditional = new Set();
  const visit = (node) => {
    if (node.type === 1 && node.tag === "input") {
      const label = node.props.find((prop) => prop.type === 6 && prop.name === "aria-labelledby");
      if (label) {
        const field = label.value.content.match(/^provider-field-(.+)-label$/)?.[1];
        const required = node.props.find(
          (prop) =>
            (prop.type === 6 && prop.name === "aria-required") ||
            (prop.type === 7 && prop.name === "bind" && prop.arg?.content === "aria-required"),
        );
        if (required?.type === 6 && required.value.content === "true") foundStatic.add(field);
        if (required?.type === 7 && required.exp.content === "publicTermsRequired")
          foundConditional.add(field);
      }
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(baseParse(parsed.descriptor.template.content));

  assert.deepEqual(foundStatic, staticRequired);
  assert.deepEqual(foundConditional, conditionalRequired);
  assert.match(
    parsed.descriptor.scriptSetup.content,
    /const publicTermsRequired = computed\(\s*\(\) => \["public_page", "public_rss"\]\.includes\(form\.access_mode\) && form\.status === "enabled",\s*\);/,
  );
});
