import {
  classifyProviderAdapterFailure,
  type AdapterHealthContext,
  type AdapterInvocationContext,
  type ProviderAdapter,
  type ProviderCollectRequest,
  type ProviderRawRecord,
} from "@scoutops/provider-adapters";
import { Lan1688ImageSearch } from "./lan-1688-image-search.js";

// User-supplied fixed image; a health probe validates transport/schema, never persists offers.
export const LAN_1688_HEALTH_IMAGE =
  "https://m.media-amazon.com/images/I/71AsB3+OA-L._AC_SY300_SX300_QL70_FMwebp_.jpg";

export class Lan1688HealthAdapter implements ProviderAdapter {
  readonly key = "1688_search";
  readonly accessMode = "authenticated_browser" as const;
  readonly version = "1688-lan-health-adapter-v1";
  private readonly client: Lan1688ImageSearch;
  constructor(
    private readonly browserAdapter: ProviderAdapter,
    options: { token: string; timeoutMs: number; fetcher?: typeof fetch },
  ) {
    this.client = new Lan1688ImageSearch(options.token, options.timeoutMs, options.fetcher);
  }
  collect(request: ProviderCollectRequest, signal: AbortSignal) {
    return this.browserAdapter.collect(request, signal);
  }
  normalize(record: ProviderRawRecord, context: AdapterInvocationContext) {
    const value = this.browserAdapter.normalize(record, context);
    return { ...value, provenance: { ...value.provenance, adapter_version: this.version } };
  }
  async healthCheck(_context: AdapterHealthContext, signal: AbortSignal) {
    const started = Date.now();
    try {
      await this.client.collect(LAN_1688_HEALTH_IMAGE, async () => {}, signal);
      return {
        status: "ready" as const,
        latencyMs: Date.now() - started,
        errorCode: null,
        message: "1688 局域网图搜已通过真实响应与数据格式检查；样本结果不计为选品货源。",
      };
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      const failure = classifyProviderAdapterFailure(error);
      return {
        status: failure.status,
        latencyMs: Date.now() - started,
        errorCode: failure.code,
        message: "1688 局域网图搜暂未通过健康检查，保留来源保护。",
      };
    }
  }
}
