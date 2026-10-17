// Compatibility tombstone: the member-created selection journey has been retired.
process.stderr.write(
  JSON.stringify({
    module: "M07-06",
    status: "retired",
    code: "manual_selection_acceptance_retired",
    production_verified: false,
    message:
      "手动选品旅程验收已停用；请按 docs/selection-retired-acceptance-tools.md 验证自动整链与每日完成数。",
  }) + "\n",
);
process.exit(2);
