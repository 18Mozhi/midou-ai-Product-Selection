window.FILES_LOGIC = function () {
  const percent = (value) => `${(value / 100).toFixed(1)}%`;
  const rootLabel = (kind) =>
    ({ evidence: "证据目录", export: "导出目录", temp: "临时目录" })[kind];
  const rootPurpose = (kind) =>
    ({ evidence: "不可变证据", export: "限时导出", temp: "运行临时文件" })[kind];
  return { rootLabel, rootPurpose, percent };
};
