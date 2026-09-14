import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const folder = "design-plans/ui-phase-2-2026-09-07";
const hash = (value) => createHash("sha256").update(value).digest("hex");
const material = (id, page, title, packet, report, scope, previews) => ({
  id,
  page,
  title,
  directory: `output/playwright/${packet}`,
  report: `${folder}/${report}.md`,
  scope,
  previews: previews.map(([file, label]) => ({ file, label })),
});
const committedPacket = (id, page, title, packet, scope, previews) => ({
  ...material(id, page, title, packet, "unused", scope, previews),
  report: `output/playwright/${packet}/README.md`,
  galleryFile: `output/playwright/${packet}/README.md`,
  galleryLabel: "完整图包目录与审核记录",
  manifestFile: "manifest.json",
  manifestFormat: "raw-sources-images",
});

export const recentReviewMaterials = [
  committedPacket(
    "p57-shell-composition-r2",
    "P57",
    "通知工作台 · C整体组合 r2",
    "p57-shell-composition-r2",
    "实际Vue的审核宿主组合；桌面/手机整体结构仍待审，不扩大此前取消按钮局部批准。来源变更单独显示；不是全部状态、真实发送或生产验收。",
    [
      ["P57-1440-composition-first-viewport.png", "待审 · 桌面首屏结构"],
      ["P57-390-composition-first-viewport.png", "待审 · 手机首屏结构"],
    ],
  ),
  committedPacket(
    "p57-shell-responsive-r3",
    "P57",
    "通知工作台 · 窄桌面排列 r3",
    "p57-shell-responsive-r3",
    "仅841px消息目录/阅读区上下排列及键盘区域待审；不包含所有宽度、整页或真实通知动作。",
    [["P57-841-responsive-bottom-keyboard.png", "待审 · 窄桌面阅读排列"]],
  ),
  committedPacket(
    "p58-page-composition-r1",
    "P58",
    "配额管理 · 双工作区结构 r1",
    "p58-page-composition-r1",
    "目录全局统计与组织配额分区待审。使用原测试样例；o1不是有效业务UUID。原图保留，后续读取文案/提案变更导致来源差异，不据此宣称当前整页验收。",
    [
      ["P58-1440-plans.png", "待审 · 桌面方案目录"],
      ["P58-1440-organization.png", "待审 · 桌面组织配额"],
      ["P58-390-plans-first.png", "待审 · 手机目录首屏"],
      ["P58-390-organization-first.png", "待审 · 手机组织读取首屏"],
    ],
  ),
  committedPacket(
    "p58-read-feedback-r1",
    "P58",
    "配额管理 · 读取反馈 r1",
    "p58-read-feedback-r1",
    "仅读取反馈区域待审；11个选定交付源码摘要不是完整依赖图。首次/保留快照超时区已送审但未批准；429/503手机图底栏边缘不在审核范围。没有真实限流、服务、权限或整页验收。",
    [
      ["P58-390-initial-timeout.png", "待审 · 首次超时与重读焦点"],
      ["P58-390-retained-timeout.png", "待审 · 保留快照时超时"],
      ["P58-390-429.png", "待审 · 请求频繁"],
      ["P58-390-503.png", "待审 · 依赖受阻"],
    ],
  ),
  {
    ...material(
      "p34-app-regions",
      "P34",
      "审批记录与模板状态 · App-r3",
      "p34-pagination-app-c-r3",
      "P34-PAGINATION-FOCUS-IMPLEMENTATION",
      "仅前两图的审批记录区域获批：蓝色工作区说明、白底字段、技术详情和双端排列。后三张模板详情/首版/无差异仍待审；不含导航、分页、整页或生产验收。",
      [
        ["390-requests-pagination-first-focus.png", "已局部批准 · 手机审批记录区域"],
        ["1440-request-technical.png", "已局部批准 · 桌面审批记录区域"],
        ["390-template-detail.png", "待审 · 手机模板详情"],
        ["390-first-version.png", "待审 · 首个版本"],
        ["390-unchanged-version.png", "待审 · 已有版本无差异"],
      ],
    ),
    galleryFile: `${folder}/P34-PAGINATION-FOCUS-IMPLEMENTATION.md`,
    galleryLabel: "完整图包目录与审核记录",
  },
  {
    ...material(
      "p34-template-keyboard",
      "P34",
      "模板键盘与跨页保留 · r1",
      "p34-template-keyboard-c-r1",
      "P34-PAGINATION-FOCUS-IMPLEMENTATION",
      "技术详情展开、蓝色键盘焦点及跨页提示仍待视觉审核。844项本地检查不替代用户批准、完整读屏、真实审批或生产验收。",
      [
        ["390-template-technical-space.png", "待审 · Space展开技术详情"],
        ["390-template-technical-enter.png", "待审 · Enter展开技术详情"],
        ["390-template-cross-page-retained.png", "待审 · 跨页保留提示与模板身份"],
      ],
    ),
    galleryFile: `${folder}/P34-PAGINATION-FOCUS-IMPLEMENTATION.md`,
    galleryLabel: "完整图包目录与审核记录",
  },
  material(
    "p44-directory",
    "P44",
    "可授权账号目录",
    "p44-mobile-directory-implementation/current",
    "P44-MOBILE-DIRECTORY-IMPLEMENTATION-REVIEW",
    "已批准范围仅为手机目录区域；其他路由、详情及整页未批准。",
    [["390-admins-directory.png", "手机目录区域"]],
  ),
  material(
    "p44-controls",
    "P44",
    "角色比较控件",
    "p44-mobile-controls-implementation/current",
    "P44-MOBILE-CONTROLS-IMPLEMENTATION-REVIEW",
    "已批准范围仅为手机比较控件；角色资料、结果及整页分别核对。",
    [
      ["390-admins-default.png", "手机比较控件"],
      ["390-admins-keyboard-focus.png", "键盘焦点状态"],
    ],
  ),
  material(
    "p44-results",
    "P44",
    "同角色的两种结果",
    "p44-mobile-results-implementation/current",
    "P44-MOBILE-RESULTS-IMPLEMENTATION-REVIEW",
    "仅无差异结果与同角色显示全部区域获批；搜索空态、其他结果及整页未批准。",
    [
      ["390-admins-same-role-empty.png", "无差异结果"],
      ["390-admins-same-role-all.png", "同角色显示全部"],
    ],
  ),
  material(
    "p44-facts",
    "P44",
    "角色资料",
    "p44-mobile-role-facts-implementation/current",
    "P44-MOBILE-ROLE-FACTS-IMPLEMENTATION-REVIEW",
    "仅手机两组角色资料获批，不包括下方权限结果或整页。",
    [["390-admins-role-facts.png", "手机角色资料"]],
  ),
  material(
    "p46-structure",
    "P46",
    "来源目录与编辑整体结构",
    "p46-approved-structure-implementation/current",
    "P46-APPROVED-STRUCTURE-IMPLEMENTATION",
    "已批准所展示的桌面/手机整体结构，不等于所有状态、保存或权限验收。",
    [
      ["1440-page-top.png", "桌面默认布局"],
      ["390-page-top.png", "手机默认布局"],
      ["390-edit-step1.png", "手机编辑窗"],
    ],
  ),
  material(
    "p46-feedback",
    "P46",
    "等待保存与重读失败反馈",
    "p46-provider-feedback-implementation/current",
    "P46-APPROVED-FEEDBACK-IMPLEMENTATION",
    "仅两种反馈区域获批；图包还包含其他回归场景，不统一计为批准。",
    [
      ["production-390-late-success-create-pending-new.png", "等待上一项保存"],
      ["production-390-refresh-failure-edit-settled.png", "已保存但列表未刷新"],
    ],
  ),
  material(
    "p47-layout",
    "P47",
    "采集程序 C 方向整合",
    "p47-c-integration",
    "P47-C-INTEGRATION",
    "默认布局及指定详情/反馈区域已有局部批准；后续焦点和空态改动请结合新记录，不把本包视为当前完整源码验收。",
    [
      ["1440-read-success-away-default.png", "桌面默认布局"],
      ["390-read-success-away-default.png", "手机默认布局"],
    ],
  ),
  material(
    "p47-empty",
    "P47",
    "两种手机空态实施",
    "p47-empty-mobile-implementation",
    "P47-EMPTY-MOBILE-IMPLEMENTATION",
    "仅手机尚无来源与筛选无结果区域获批，不包含登记、桌面、其他状态或整页。",
    [
      ["current-390-catalog-empty.png", "尚无来源"],
      ["current-390-search-empty.png", "筛选无结果"],
    ],
  ),
];

export async function buildRecentReviewMaterials(
  repo,
  entries = recentReviewMaterials,
  read = readFile,
) {
  const root = path.resolve(repo);
  const seen = new Set();
  const cache = new Map();
  function resolve(relative) {
    assert.equal(typeof relative, "string");
    assert.ok(!relative.includes("\\") && !path.isAbsolute(relative), `Unsafe path: ${relative}`);
    const absolute = path.resolve(root, relative);
    assert.ok(absolute.startsWith(root + path.sep), `Out-of-repository path: ${relative}`);
    return absolute;
  }
  async function bytes(relative) {
    const absolute = resolve(relative);
    if (!cache.has(absolute)) cache.set(absolute, read(absolute));
    return await cache.get(absolute);
  }
  function link(relative) {
    return path
      .relative(path.resolve(root, folder), resolve(relative))
      .split(path.sep)
      .map(encodeURIComponent)
      .join("/");
  }
  const materials = [];
  for (const entry of entries) {
    assert.match(entry.page, /^P(?:0[1-9]|[1-6]\d|7[0-3])$/);
    assert.ok(!seen.has(entry.id), `Duplicate material: ${entry.id}`);
    seen.add(entry.id);
    const format = entry.manifestFormat ?? "lf-evidence";
    assert.ok(["lf-evidence", "raw-sources-images"].includes(format), "Unknown manifest format");
    const manifestFile = entry.manifestFile ?? "evidence.json";
    assert.match(manifestFile, /^(?:evidence|manifest)\.json$/);
    const manifestPath = `${entry.directory}/${manifestFile}`;
    const raw = await bytes(manifestPath);
    const manifest = JSON.parse(raw.toString("utf8"));
    const sources = Object.entries(
      (format === "raw-sources-images" ? manifest.sources : manifest.sourceHashes) ?? {},
    );
    assert.ok(sources.length, `Missing source provenance: ${entry.id}`);
    const sourceDifferences = [];
    for (const [file, expected] of sources) {
      assert.match(expected, /^[a-f0-9]{64}$/);
      let actual;
      try {
        const content = await bytes(file);
        actual = hash(
          format === "raw-sources-images"
            ? content
            : content.toString("utf8").replaceAll("\r\n", "\n"),
        );
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        actual = null;
      }
      if (actual !== expected) sourceDifferences.push({ file, expected, actual });
    }
    const shots =
      format === "raw-sources-images"
        ? manifest.images
        : (manifest.screenshots ?? manifest.pictures);
    assert.ok(Array.isArray(shots) && shots.length, `Missing images: ${entry.id}`);
    const images = new Map();
    for (const shot of shots) {
      assert.match(shot.file, /^[\w.-]+\.png$/);
      assert.ok(!images.has(shot.file), `Duplicate image: ${shot.file}`);
      assert.equal(
        hash(await bytes(`${entry.directory}/${shot.file}`)),
        shot.sha256,
        `Image drift: ${entry.id}/${shot.file}`,
      );
      images.set(shot.file, shot);
    }
    assert.ok(entry.previews.length > 0);
    const previews = entry.previews.map(({ file, label }) => {
      assert.ok(images.has(file), `Unknown preview: ${entry.id}/${file}`);
      return { file: link(`${entry.directory}/${file}`), label, sha256: images.get(file).sha256 };
    });
    const galleryFile = entry.galleryFile ?? `${entry.directory}/index.html`;
    const galleryLabel = entry.galleryLabel ?? "完整实施图册";
    assert.ok(typeof galleryLabel === "string" && galleryLabel.trim().length > 0);
    await bytes(galleryFile);
    await bytes(entry.report);
    materials.push({
      id: entry.id,
      page: entry.page,
      title: entry.title,
      scope: entry.scope,
      manifestSha256: hash(raw),
      sourceStatus: sourceDifferences.length
        ? "historical-source-differs"
        : "source-matched-at-index-build",
      sourceCount: sources.length,
      sourceDifferences,
      packetImages: shots.length,
      previews,
      gallery: link(galleryFile),
      galleryLabel,
      report: link(entry.report),
      evidence: link(manifestPath),
      approval: "not-full-page-acceptance",
    });
  }
  return { schemaVersion: 1, scope: "supplemental-review-links-not-acceptance", materials };
}
