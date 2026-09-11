import assert from "node:assert/strict";
import { parse } from "@vue/compiler-sfc";

export function providerPagePreview(original) {
  const header = "<th></th>";
  const panel = "    <UiStatePanel\n";
  assert.equal(original.split(header).length, 2, "P46 action header drift");
  assert.equal(original.split(panel).length, 2, "P46 state panel drift");
  const result = original
    .replace(header, "<th>操作</th>")
    .replace(panel, panel + '      primary-label="重新读取来源"\n');
  assert.deepEqual(parse(result).errors, []);
  assert.equal(
    parse(result).descriptor.scriptSetup.content,
    parse(original).descriptor.scriptSetup.content,
  );
  return result;
}
