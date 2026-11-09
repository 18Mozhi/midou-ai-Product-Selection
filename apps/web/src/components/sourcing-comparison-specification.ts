import type { SourcingComparisonQuote } from "./sourcing-workspace-types";

export const specificationHint = (quotes: SourcingComparisonQuote[]) => {
  const raw = [...new Set(quotes.map((item) => item.specification.trim()))];
  const formatted = new Set(
    raw.map((value) => value.normalize("NFKC").replace(/\s+/g, " ").toLocaleLowerCase()),
  );
  if (raw.length === 1)
    return {
      status: "aligned",
      title: "规格文本一致",
      detail: "仍需按各自证据核对型号、容量、包装和计量单位。",
    };
  if (formatted.size === 1)
    return {
      status: "format_only",
      title: "规格仅存在格式差异",
      detail: "大小写、空格或全半角不同；保存新报价时可统一书写。",
    };
  return {
    status: "needs_review",
    title: `存在 ${raw.length} 种规格文本，尚未归一`,
    detail: "请先统一型号、容量、包装和计量单位再比较价格；系统不会自动换算或判断等价。",
  };
};
