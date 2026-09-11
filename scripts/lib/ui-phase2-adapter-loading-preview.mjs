import assert from "node:assert/strict";
export const loadingTitle = "正在读取采集状态";
export const loadingDescription = "正在获取来源目录与运行状态，请稍候。";
export function previewAdapterLoading(source) {
  const anchor = '      :kind="state"\n';
  assert.equal(source.split(anchor).length, 2, "Only the original read-state panel may change");
  return source.replace(
    anchor,
    anchor +
      `      :title="state === 'loading' ? '${loadingTitle}' : ''"\n` +
      `      :description="state === 'loading' ? '${loadingDescription}' : ''"\n`,
  );
}
