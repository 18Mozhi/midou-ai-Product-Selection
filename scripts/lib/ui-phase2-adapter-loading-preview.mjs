import assert from "node:assert/strict";
export const loadingTitle = "正在读取采集状态";
export const loadingDescription = "正在获取来源目录与运行状态，请稍候。";
export function previewAdapterLoading(source) {
  const anchor = '      :kind="state"\n';
  assert.equal(source.split(anchor).length, 2, "Only the original read-state panel may change");
  const panelStart = source.indexOf(anchor),
    panel = source.slice(panelStart, panelStart + 700);
  if (
    panel.includes(loadingTitle) &&
    panel.includes(loadingDescription) &&
    panel.includes("暂时未能读取采集状态") &&
    panel.includes("这次读取未完成。你可以重新读取，获取最新状态。")
  )
    return source;
  assert.ok(
    !panel.includes(":title="),
    "Only the historical panel without explicit state copy may receive the archived proposal",
  );
  assert.ok(
    !panel.includes(":description="),
    "Only the historical panel without explicit state copy may receive the archived proposal",
  );
  return source.replace(
    anchor,
    anchor +
      `      :title="state === 'loading' ? '${loadingTitle}' : ''"\n` +
      `      :description="state === 'loading' ? '${loadingDescription}' : ''"\n`,
  );
}
