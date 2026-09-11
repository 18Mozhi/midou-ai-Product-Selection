import assert from "node:assert/strict";
import { parse } from "@vue/compiler-sfc";
import { adminPageAssemblyPreview } from "./ui-phase2-admin-page-assembly-preview.mjs";

export function adminDetailPreview(original) {
  let source = adminPageAssemblyPreview(original, "detail");
  const marker = '<button :disabled="busy" @click="$emit(\'toggleStatus\', selected)">';
  assert.equal(source.split(marker).length, 2, "P44 status action source drift");
  source = source.replace(
    marker,
    "<button :class=\"{ 'p44-detail-reenable': selected?.status !== 'active' }\" :disabled=\"busy\" @click=\"$emit('toggleStatus', selected)\">",
  );
  assert.equal(
    parse(source).descriptor.scriptSetup.content,
    parse(original).descriptor.scriptSetup.content,
  );
  assert.deepEqual(parse(source).errors, []);
  return source;
}
