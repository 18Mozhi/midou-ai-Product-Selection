import { readFile, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";

const rawQuery = process.argv.slice(2).join(" ").trim();
if (!rawQuery) {
  console.error('Usage: node scripts/locate_flow_v4.mjs "keyword"');
  process.exitCode = 1;
} else {
  const root = process.cwd();
  const mapPath = resolve(root, "docs", "feature-map.json");
  const map = JSON.parse(await readFile(mapPath, "utf8"));
  const aliasCatalog = {
    发布中心: ["发布管理", "release", "rollout", "deployment"],
    发布门禁: ["release", "gate", "版本", "迁移", "config fingerprint"],
    健康检查: ["health", "readiness", "业务可用性"],
    监督进程: ["supervisor", "process", "就绪"],
    队列调度器: ["queue", "scheduler", "worker"],
    自动采集: ["automatic source", "collection scheduler", "自动来源"],
    爬虫调度: ["crawler scheduler", "采集调度"],
    来源管理: ["provider", "source", "来源"],
    来源注册: ["provider registry", "来源设置"],
    数据质量: ["data quality", "evidence", "质量"],
    今日行动: ["home dashboard", "work", "首页"],
    趋势详情: ["trend dashboard", "trends", "热点趋势"],
    机会详情: ["opportunity workspace", "opportunities", "选品机会"],
    供应链找货: ["sourcing", "supplier", "报价"],
    任务详情: ["task workspace", "business task", "任务中心"],
    平台账号: ["platform account", "账号与组织"],
    系统状态: ["platform status", "runtime topology", "系统运维"],
  };
  const normalizedQuery = rawQuery.toLocaleLowerCase("zh-CN");
  const terms = new Set([normalizedQuery]);
  for (const [alias, values] of Object.entries(aliasCatalog)) {
    if (normalizedQuery.includes(alias.toLocaleLowerCase("zh-CN")))
      values.forEach((value) => terms.add(value.toLocaleLowerCase("zh-CN")));
  }

  const candidates = [];
  for (const [key, value] of Object.entries(map.implementation ?? {})) {
    if (value && typeof value === "object" && !Array.isArray(value))
      candidates.push({ section: "implementation", key, value });
  }
  for (const section of ["routes", "apiGroups", "runtime", "externalDependencies"])
    for (const [index, value] of (map[section] ?? []).entries())
      candidates.push({ section, key: String(index), value });

  const testFiles = (
    await readdir(resolve(root, "tests"), { recursive: true, withFileTypes: true })
  )
    .filter((entry) => entry.isFile() && /\.(?:mjs|ts)$/u.test(entry.name))
    .map((entry) => relative(root, resolve(entry.parentPath, entry.name)).replaceAll("\\", "/"));
  const matches = [];
  for (const candidate of candidates) {
    const haystack = `${candidate.key} ${JSON.stringify(candidate.value)}`.toLocaleLowerCase(
      "zh-CN",
    );
    if (![...terms].some((term) => haystack.includes(term))) continue;
    const entrypoints = Array.isArray(candidate.value.entrypoints)
      ? candidate.value.entrypoints.map((path) => String(path).replace(/^\.\.\//u, ""))
      : [];
    const moduleId = String(candidate.value.module ?? "");
    const routeValues = [
      candidate.value.path,
      candidate.value.prefix,
      ...(candidate.value.routes ?? []),
    ]
      .filter(Boolean)
      .map(String);
    const sourceFiles = entrypoints.filter(
      (path) => !path.startsWith("apps/api/") && !path.startsWith("tests/"),
    );
    const apiFiles = entrypoints.filter((path) => path.startsWith("apps/api/"));
    const relatedTests = testFiles.filter((path) => {
      const normalizedPath = path.toLocaleLowerCase("zh-CN");
      return (
        (moduleId && normalizedPath.includes(moduleId.toLocaleLowerCase("zh-CN"))) ||
        [...terms].some((term) => normalizedPath.includes(term.replaceAll(" ", "-")))
      );
    });
    matches.push({
      section: candidate.section,
      key: candidate.key,
      module: moduleId || null,
      sourceFiles,
      apiFiles,
      apiRoutes: routeValues.filter((value) => value.startsWith("/api/")),
      pageRoutes: routeValues.filter((value) => !value.startsWith("/api/")),
      testFiles: [
        ...new Set([...entrypoints.filter((path) => path.startsWith("tests/")), ...relatedTests]),
      ],
      status: candidate.value.status ?? null,
      statusDetail: candidate.value.statusDetail ?? null,
    });
  }

  console.log(
    JSON.stringify(
      {
        query: rawQuery,
        expandedTerms: [...terms],
        source: "docs/feature-map.json",
        matches,
      },
      null,
      2,
    ),
  );
  if (matches.length === 0) process.exitCode = 2;
}
