import assert from "node:assert/strict";
import { parse } from "@vue/compiler-sfc";

// P45 isolated review only: move intact sections, preserving all scripts and controls.
export function permissionPagePreview(original) {
  let source = original;
  const between = (start, end) => {
    assert.equal(source.split(start).length, 2, "P45 section start drift");
    assert.equal(source.split(end).length, 2, "P45 section end drift");
    return source.slice(source.indexOf(start), source.indexOf(end));
  };
  const selectors = between(
    '    <div class="role-comparison__selectors">',
    '    <div class="role-comparison__filters"',
  );
  const summaries = between(
    '    <div class="role-comparison__summaries">',
    '    <p class="role-comparison__result"',
  );
  source = source.replace(summaries, "");
  source = source.replace(
    selectors,
    '<div class="p45-workspace"><aside class="p45-role-context">' +
      selectors +
      summaries +
      '</aside><div class="p45-reading">',
  );
  const end = "    </div>\n  </section>";
  assert.equal(source.split(end).length, 2, "P45 matrix end drift");
  source = source.replace(end, "    </div></div></div>\n  </section>");
  assert.equal(
    parse(source).descriptor.scriptSetup.content,
    parse(original).descriptor.scriptSetup.content,
  );
  assert.deepEqual(parse(source).errors, []);
  return source;
}
