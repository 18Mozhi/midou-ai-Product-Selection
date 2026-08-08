export class RealtimeServiceError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    readonly actionHint: string,
    message = code,
  ) {
    super(message);
    this.name = "RealtimeServiceError";
  }
}
export function parseLastEventId(value: unknown) {
  if (value == null || value === "") return 0;
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || !/^\d{1,20}$/.test(raw))
    throw new RealtimeServiceError(
      "realtime_cursor_invalid",
      400,
      "移除无效 Last-Event-ID 后重连。",
    );
  const result = Number(raw);
  if (!Number.isSafeInteger(result) || result < 0)
    throw new RealtimeServiceError(
      "realtime_cursor_invalid",
      400,
      "移除无效 Last-Event-ID 后重连。",
    );
  return result;
}
export interface RealtimeRepository {
  replay(i: any): Promise<any[]>;
  auditConnect(i: any): Promise<void>;
}
export class RealtimeService {
  constructor(
    private readonly repo: RealtimeRepository,
    private readonly replayLimit: number,
  ) {}
  async replay(i: any) {
    const items = await this.repo.replay({ ...i, limit: this.replayLimit + 1 });
    if (items.length > this.replayLimit)
      throw new RealtimeServiceError(
        "realtime_replay_window_exceeded",
        409,
        "刷新页面获取最新状态后重新连接。",
      );
    return items;
  }
  auditConnect(i: any) {
    return this.repo.auditConnect(i);
  }
}
