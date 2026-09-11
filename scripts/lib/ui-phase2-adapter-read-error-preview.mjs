import assert from "node:assert/strict";

export const readErrorTitle = "暂时未能读取采集状态";
export const readErrorDescription = "这次读取未完成。你可以重新读取，获取最新状态。";
export function previewAdapterReadError(source) {
  const anchor = '      :kind="state"\n';
  assert.equal(source.split(anchor).length, 2, "Only the original read state panel may change");
  return source.replace(
    anchor,
    anchor +
      `      :title="state === 'error' ? '${readErrorTitle}' : ''"\n` +
      `      :description="state === 'error' ? '${readErrorDescription}' : ''"\n`,
  );
}
