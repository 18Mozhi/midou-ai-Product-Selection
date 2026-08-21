import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { buildScopedFilePath } from "@scoutops/storage";
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
    const item = await this.detail(i);
    if (item.status !== "succeeded")
      throw new ReportServiceError("report_export_not_ready", 409, "等待导出完成后重试。");
    if (new Date(item.expires_at).valueOf() <= this.now().valueOf())
      throw new ReportServiceError("report_export_expired", 410, "重新创建导出。");
    const path = buildScopedFilePath(this.exportRoot, {
      organization_id: i.organizationId,
      workspace_id: i.workspaceId,
      category: "export",
      resource_id: item.id,
      filename: item.filename,
    });
    try {
      return { item, content: await readFile(path) };
    } catch {
      throw new ReportServiceError(
        "report_export_file_missing",
        503,
        "在宝塔检查共享文件目录或重新导出。",
      );
    }
  }
}
