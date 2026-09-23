import type { FileResilienceDto } from "@scoutops/contracts";

type RootKind = FileResilienceDto["directories"][number]["kind"];

export const rootLabel = (kind: RootKind) =>
  ({ evidence: "证据目录", export: "导出目录", temp: "临时目录" })[kind];

export const rootPurpose = (kind: RootKind) =>
  ({ evidence: "不可变证据", export: "限时导出", temp: "运行临时文件" })[kind];

export const formatFileBytes = (value: number) =>
  value >= 1099511627776
    ? `${(value / 1099511627776).toFixed(2)} TiB`
    : value >= 1073741824
      ? `${(value / 1073741824).toFixed(1)} GiB`
      : `${(value / 1048576).toFixed(1)} MiB`;

export const formatFilePercent = (value: number) => `${(value / 100).toFixed(1)}%`;

export const formatFileObservedAt = (value: string) =>
  new Date(value).toLocaleString("zh-CN", { hour12: false });
