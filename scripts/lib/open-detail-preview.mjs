import assert from "node:assert/strict";
import path from "node:path";

export const openDetailCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/platform-open-detail-preview.css";
export const openDetailGroups = [
  {
    view: "clients",
    groups: ["权限与限额", "访问状态"],
    split: 2,
    fields: ["授权范围", "每分钟限额", "当前状态", "有效期", "最近调用"],
    technical: ["账号 ID", "账号前缀", "组织 ID"],
  },
  {
    view: "webhooks",
    groups: ["目标与事件", "状态与时间"],
    split: 2,
    fields: ["安全网址", "订阅事件", "当前状态", "最近更新"],
    technical: ["回调 ID", "组织 ID", "签名指纹"],
  },
  {
    view: "deliveries",
    groups: ["投递结果", "调度信息"],
    split: 4,
    fields: ["事件", "当前状态", "尝试次数", "响应状态", "下次可用", "更新时间"],
    technical: ["投递 ID", "回调 ID", "组织 ID", "错误代码"],
  },
];

// Applied after the page review transform. Keep all original facts, conditionals and handlers.
export function previewOpenDetails(source) {
  let count = 0;
  const result = source
    .replaceAll("\r\n", "\n")
    .replace(/<ResponsiveDataView[\s\S]*?<\/ResponsiveDataView>/g, (block) => {
      const meta = openDetailGroups[count++];
      assert.ok(meta, "Unexpected P60 data collection");
      assert.ok(block.includes(`:rows="data.${meta.view}"`));
      const start = block.indexOf('<template #detail="{ row }"');
      assert.ok(start >= 0);
      const bodyStart = block.indexOf(">", start) + 1,
        bodyEnd = block.lastIndexOf("</template");
      let body = block.slice(bodyStart, bodyEnd);
      const facts = body.match(/^<dl>[\s\S]*?<\/dl>/)?.[0];
      assert.ok(facts, "Original first fact list missing");
      const fields = facts.match(/<div>[\s\S]*?<\/div>/g);
      assert.equal(fields.length, meta.fields.length);
      assert.deepEqual(
        fields.map((field) => field.match(/<dt>(.*?)<\/dt>/)[1]),
        meta.fields,
      );
      const groups = [fields.slice(0, meta.split), fields.slice(meta.split)]
        .map(
          (parts, index) =>
            `<section class="p60-detail-section" aria-label="${meta.groups[index]}"><h3>${meta.groups[index]}</h3><dl>${parts.join("\n")}</dl></section>`,
        )
        .join("\n");
      body = body.replace(facts, groups);
      const technicalEnd = body.indexOf("</details>") + "</details>".length;
      assert.ok(technicalEnd > "</details>".length);
      body =
        body.slice(0, technicalEnd) +
        '\n<div class="p60-detail-actions" role="group" aria-label="记录操作">' +
        body.slice(technicalEnd) +
        "</div>\n";
      return block.slice(0, bodyStart) + body + block.slice(bodyEnd);
    });
  assert.equal(count, 3, "Exactly three P60 original collections required");
  return result;
}
export function openDetailPlugin() {
  return {
    name: "open-details-c-review-only",
    enforce: "pre",
    transform(source, id) {
      if (
        id.replaceAll("\\", "/") ===
        path.resolve("apps/web/src/components/OpenPlatformCenter.vue").replaceAll("\\", "/")
      )
        return { code: previewOpenDetails(source), map: null };
      return null;
    },
    transformIndexHtml(html) {
      assert.equal(html.split("</head>").length, 2);
      return html.replace(
        "</head>",
        `<link rel="stylesheet" href="/@fs/${path.resolve(openDetailCss).replaceAll("\\", "/")}"></head>`,
      );
    },
  };
}
