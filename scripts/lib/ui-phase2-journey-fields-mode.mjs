import assert from "node:assert/strict";

export function journeyFieldsMode(args) {
  assert.ok(
    args.length <= 1 && args.every((arg) => ["--smoke", "--capture", "--current"].includes(arg)),
    "Use no arguments, --smoke, --capture or --current; flags cannot be combined or repeated.",
  );
  return {
    smoke: args[0] === "--smoke",
    capture: args[0] === "--capture",
    current: args[0] === "--current",
  };
}
