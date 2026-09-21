import path from "node:path";
import { previewTaskWorkspace } from "./task-page-preview.mjs";

export const allTaskReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/all-task-page-preview.css";

export function previewAllTaskWorkspace(source) {
  return previewTaskWorkspace(source)
    .replace("正在读取我的工作队列", "正在读取工作区任务目录")
    .replace("PERSONAL QUEUE / 今日工作", "TASK DIRECTORY / 全部任务")
    .replace("先决定下一项需要推进的工作", "在任务目录中定位下一项工作")
    .replace(
      "这里是当前工作区中分配给你的全部任务，不等同于仅今天到期。",
      "这里展示当前工作区任务；下方本人汇总只用于提示优先事项，不代表目录总量。",
    )
    .replace("我的任务队列", "工作区任务目录")
    .replace("按状态筛选，再打开需要处理的任务", "按状态、搜索与排序定位任务，再进入真实详情")
    .replace("查看任务队列", "查看任务目录");
}

export function allTaskPagePlugin() {
  const workspace = path.resolve("apps/web/src/components/TaskWorkspace.vue").replaceAll("\\", "/");
  return {
    name: "p23-actual-vue-review",
    enforce: "pre",
    transform(source, id) {
      if (id.replaceAll("\\", "/") === workspace)
        return { code: previewAllTaskWorkspace(source), map: null };
    },
    transformIndexHtml(html) {
      return html
        .replace("<body>", '<body class="p13-review p23-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(allTaskReviewCss).replaceAll("\\", "/")}"></head>`,
        );
    },
  };
}
