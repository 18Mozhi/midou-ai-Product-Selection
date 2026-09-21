import assert from "node:assert/strict";
import path from "node:path";
import { baseParse } from "@vue/compiler-dom";
import {
  previewShellVue,
  shellReviewCss,
  shellReviewModule,
} from "./ui-phase2-shell-vue-preview.mjs";

export const fileReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/file-page-preview.css";
export const filePageSources = [
  fileReviewCss,
  shellReviewCss,
  shellReviewModule,
  "scripts/lib/ui-phase2-shell-vue-preview.mjs",
  "scripts/lib/file-page-preview.mjs",
];
const once = (value, before, after) => {
  assert.equal(value.split(before).length, 2, "P69 unique anchor: " + before.slice(0, 80));
  return value.replace(before, after);
};

// Review-only transformation: production request, snapshot and lifecycle code remain byte-for-byte intact.
export function previewFilePage(input) {
  const source = input.replaceAll("\r\n", "\n");
  const template = source.slice(
    source.indexOf("<template>") + 10,
    source.lastIndexOf("</template>"),
  );
  const nodes = [];
  const walk = (node) => {
    nodes.push(node);
    for (const child of node.children ?? []) walk(child);
  };
  walk(baseParse(template));
  const get = (name) => {
    const matches = nodes.filter(
      (node) =>
        node.type === 1 &&
        node.props.some((prop) => prop.name === "class" && prop.value?.content === name),
    );
    assert.equal(matches.length, 1, name);
    return matches[0].loc.source;
  };
  const root = get("file-resilience");
  let hero = once(get("file-resilience__hero"), "<h2>本机文件韧性</h2>", "<h1>文件存储核验</h1>");
  hero = once(hero, "<p>本机受管存储</p>", "<p>ScoutOps / 文件存储</p>");
  const pending = once(get("file-resilience__state"), "<i></i>", "");
  const failure = once(
    get("file-resilience__state file-resilience__state--danger"),
    "<strong>!</strong>",
    "",
  );
  const validUsage =
    "root.available && root.total_bytes > 0 && root.usage_basis_points >= 0 && root.usage_basis_points <= 10000";
  const next = `<section class="file-resilience file-resilience--review" :data-state="state">
    ${hero}
    <p class="p69-review-note">实际 Vue C 审核版 · 本地样例 · 未读取受控目录或执行恢复 · 尚未部署</p>
    <aside class="p69-boundary" aria-label="运行边界"><b>惠州同机 / 宝塔受管</b><span>证据、导出与临时文件均在当前主机；不使用共享存储或备用服务器。</span></aside>
    ${get("file-resilience__refresh-notice")}
    ${pending}
    ${failure}
    <template v-else-if="data">
      <section class="p69-paper"><section class="p69-conclusion" :data-verdict="state"><div><small>S0 / {{ state }}</small><h2>{{ state === 'ready' ? '当前文件韧性门满足' : state === 'warning' ? '当前观测存在预警' : '当前文件韧性门阻断' }}</h2><p>返回 {{ data.findings.length }} 项发现；ready 不替代真实恢复或生产验收。</p></div><div><b>观测时间</b><time :datetime="data.observed_at">{{ time(data.observed_at) }}</time></div></section>
      <section v-if="data.findings.length" class="p69-findings"><h2>当前发现 <small>{{ data.findings.length }} 项</small></h2><article v-for="item in data.findings" :key="item.code" :data-severity="item.severity"><b>{{ item.severity === 'blocked' ? '阻断' : '预警' }}</b><code>{{ item.code }}</code><p>{{ item.action_hint }}</p></article><small>提示仅供人工通过宝塔核对，不会浏览、下载、删除、备份或恢复文件。</small></section>
      <section class="p69-directories"><header><h2>目录水位与活动索引</h2><p>文件系统水位与活动资产索引分开；同盘读数不能相加。</p></header><article v-for="root in data.directories" :key="root.kind" class="p69-directory" :data-root="root.kind"><header><div><h3>{{ rootLabel(root.kind) }}</h3><p>{{ rootPurpose(root.kind) }} · {{ root.available && root.writable ? '可读写' : '不可用或不可写' }}</p></div><b>{{ root.kind === 'temp' ? '不建立持久索引' : root.active_files + ' 个活动文件' }}</b></header><div class="p69-root-evidence"><section><small>目录所在文件系统水位</small><strong>{{ !root.available ? '未取得观测' : ${validUsage} ? percent(root.usage_basis_points) : '上限 / 容量未知' }}</strong><p>{{ bytes(root.used_bytes) }} / {{ bytes(root.total_bytes) }}</p><progress v-if="${validUsage}" :aria-label="rootLabel(root.kind) + '所在文件系统已用比例'" :aria-valuetext="percent(root.usage_basis_points)" :value="root.usage_basis_points" max="10000"></progress><small v-else>接口比例为失败或未知约定，不是实测满额；不会绘制有效水位条。</small></section><section class="p69-index"><small>活动索引证据</small><b>{{ root.kind === 'temp' ? '不适用' : bytes(root.indexed_bytes) }}</b><p>{{ root.kind === 'temp' ? '临时目录不建立持久索引；0不表示目录为空。' : '索引体积来自活动证据与未过期导出，不是目录递归体积。' }}</p></section></div></article><small class="p69-note">同一文件系统的三个读数可能相同；不能相加当成总磁盘用量。</small></section>
      <div class="p69-evidence"><section class="p69-integrity"><header><h2>抽样完整性</h2><p>证据优先、剩余名额再取有效导出；不是随机全覆盖。</p></header><div class="p69-sample-total"><b>{{ data.integrity.verified_files }} / {{ data.integrity.sampled_files }}</b><span>{{ data.integrity.sampled_files ? '已核验样本' : '尚无样本' }}</span></div><dl><div><dt>不一致</dt><dd>{{ data.integrity.mismatch_files }}</dd></div><div><dt>缺失</dt><dd>{{ data.integrity.missing_files }}</dd></div></dl><p class="p69-note">{{ data.integrity.sampled_files ? '已核验样本不能外推为全部活动文件。' : '零样本可以是ready；不能显示100%通过。' }}</p></section><aside class="p69-recovery"><header><h2>同机恢复证据</h2><p>与目录读数独立核对，不是高可用或异地容灾。</p></header><b class="p69-recovery-state">{{ data.recovery.status }}</b><dl><div><dt>加密恢复副本</dt><dd>{{ data.recovery.encrypted_same_host_copy ? '已核验' : '未核验' }}</dd></div><div><dt>隔离恢复</dt><dd>{{ data.recovery.isolated_restore_verified ? '已核验' : '未核验' }}</dd></div><div><dt>演练距今</dt><dd>{{ data.recovery.drill_age_days ?? '未记录' }}<small>{{ data.recovery.drill_age_days == null ? '未知不填0' : '天' }}</small></dd></div></dl><p class="p69-note">恢复证据不足可阻断，过期演练在文件模块为预警；页面不发起恢复。</p></aside></div></section>
      ${get("file-resilience__footer")}
    </template>
  </section>`;
  return once(source, root, next);
}
export function filePagePlugin() {
  return {
    name: "p69-actual-vue-review",
    enforce: "pre",
    transform(source, id) {
      const file = id.replaceAll("\\", "/"),
        absolute = (value) => path.resolve(value).replaceAll("\\", "/");
      if (file === absolute("apps/web/src/components/FileResilienceCenter.vue"))
        return { code: previewFilePage(source), map: null };
      if (file === absolute("apps/web/src/components/NavigationShell.vue"))
        return {
          code: once(
            previewShellVue(source),
            '<header v-if="!opportunityId" class="role-page-title">',
            '<header v-if="!opportunityId && routePath !== \'/platform-admin/files\'" class="role-page-title">',
          ),
          map: null,
        };
    },
    transformIndexHtml(html) {
      return once(
        once(html, "<body>", '<body class="shell-vue-c">'),
        "</head>",
        [shellReviewCss, fileReviewCss]
          .map(
            (file) =>
              `<link rel="stylesheet" href="/@fs/${path.resolve(file).replaceAll("\\", "/")}">`,
          )
          .join("") + "</head>",
      );
    },
  };
}
