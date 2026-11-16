import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readFile, realpath } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { buildReportExportPath } from "@scoutops/storage";
export type ReportType = "opportunity" | "trend" | "team";
export class ReportServiceError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    readonly actionHint: string,
    message = code,
  ) {
    super(message);
    this.name = "ReportServiceError";
  }
}
const reportType = (v: unknown): ReportType => {
    if (!["opportunity", "trend", "team"].includes(String(v)))
      throw new ReportServiceError("report_type_invalid", 400, "选择机会、趋势或团队报表。");
    return v as ReportType;
  },
  uuid = (v: unknown) => {
    const x = String(v ?? "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x))
      throw new ReportServiceError("report_export_id_invalid", 400, "提交有效导出标识。");
    return x;
  };
export interface ReportRepository {
  report(i: any): Promise<any>;
  listExports(i: any): Promise<any>;
  createExport(i: any): Promise<any>;
  detail(i: any): Promise<any>;
  exportFile?(i: any): Promise<any>;
}
export class ReportService {
  constructor(
    private readonly repo: ReportRepository,
    private readonly exportRoot: string,
    private readonly ttlHours: number,
    private readonly now = () => new Date(),
  ) {}
  report(i: any) {
    return this.repo.report({ ...i, reportType: reportType(i.reportType) });
  }
  listExports(i: any) {
    return this.repo.listExports(i);
  }
  detail(i: any) {
    return this.repo.detail({ ...i, exportId: uuid(i.exportId) });
  }
  createExport(i: any) {
    return this.queueExport(i, "POST:/api/v1/report-exports");
  }
  async regenerate(i: any) {
    const source = await this.detail(i),
      sourceId = uuid(i.exportId),
      expired = new Date(source.expires_at).valueOf() <= this.now().valueOf();
    if (!expired && source.status !== "dead_letter")
      throw new ReportServiceError(
        "report_export_still_available",
        409,
        source.status === "succeeded"
          ? "当前文件仍在有效期内，请直接下载。"
          : "当前导出仍在处理中，请等待完成。",
      );
    return this.queueExport(
      {
        ...i,
        value: { report_type: source.report_type, format: source.format },
        regeneratedFromExportId: sourceId,
      },
      `POST:/api/v1/report-exports/${sourceId}/regenerate`,
    );
  }
  private queueExport(i: any, route: string) {
    const type = reportType(i.value?.report_type);
    if (i.accountOwned && type === "team")
      throw new ReportServiceError(
        "report_type_retired",
        410,
        "团队报表不再生成，历史导出仍可查询。",
      );
    if (i.value?.format !== "csv")
      throw new ReportServiceError("report_format_invalid", 400, "当前只支持 CSV。");
    const id = randomUUID();
    return this.repo.createExport({
      ...i,
      id,
      value: {
        report_type: type,
        format: "csv",
        filename: `scoutops-${type}-${id}.csv`,
        expires_at: new Date(this.now().valueOf() + this.ttlHours * 3600000),
      },
      route,
      ...(i.regeneratedFromExportId ? { regeneratedFromExportId: i.regeneratedFromExportId } : {}),
    });
  }
  async download(i: any) {
    const record = i.accountOwned
      ? await this.repo.exportFile?.({ ...i, exportId: uuid(i.exportId) })
      : null;
    if (i.accountOwned && record?.account_id !== i.actorId)
      throw new ReportServiceError("report_export_not_found", 404, "刷新导出列表。");
    const item = record ?? (await this.detail(i));
    if (item.status !== "succeeded")
      throw new ReportServiceError("report_export_not_ready", 409, "等待导出完成后重试。");
    if (new Date(item.expires_at).valueOf() <= this.now().valueOf())
      throw new ReportServiceError("report_export_expired", 410, "重新创建导出。");
    let content: Buffer;
    try {
      const path = buildReportExportPath(
        this.exportRoot,
        record ?? {
          id: item.id,
          filename: item.filename,
          organization_id: i.organizationId,
          workspace_id: i.workspaceId,
        },
      );
      content = i.accountOwned ? await this.readAccountExport(path) : await readFile(path);
    } catch {
      throw new ReportServiceError(
        "report_export_file_missing",
        503,
        "在宝塔检查共享文件目录或重新导出。",
      );
    }
    if (
      i.accountOwned &&
      (Number(record.byte_size) !== content.byteLength ||
        record.content_sha256 !== createHash("sha256").update(content).digest("hex"))
    )
      throw new ReportServiceError(
        "report_export_integrity_failed",
        409,
        "文件与导出回执不一致，请重新导出。",
      );
    return { item, content };
  }
  private async readAccountExport(path: string) {
    const canonical = resolve(
      await realpath(this.exportRoot),
      relative(resolve(this.exportRoot), path),
    );
    const initial = await lstat(path);
    if (!initial.isFile() || initial.nlink !== 1 || (await realpath(path)) !== canonical)
      throw new Error("report_export_path_invalid");
    const handle = await open(
      path,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0),
    );
    try {
      const same = (other: typeof initial) =>
        other.isFile() &&
        other.nlink === 1 &&
        other.dev === initial.dev &&
        other.ino === initial.ino &&
        other.size === initial.size &&
        other.mtimeMs === initial.mtimeMs &&
        other.ctimeMs === initial.ctimeMs;
      if (!same(await handle.stat())) throw new Error("report_export_file_changed");
      const content = await handle.readFile();
      if (
        content.length !== initial.size ||
        !same(await handle.stat()) ||
        !same(await lstat(path)) ||
        (await realpath(path)) !== canonical
      )
        throw new Error("report_export_file_changed");
      return content;
    } finally {
      await handle.close();
    }
  }
}
