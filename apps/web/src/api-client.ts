export type ApiFailureKind =
  | "expired"
  | "forbidden"
  | "conflict"
  | "rate_limited"
  | "blocked"
  | "error";

export interface ApiEnvelope<T> {
  data: T;
  request_id: string;
  trace_id: string;
  meta?: unknown;
}

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly kind: ApiFailureKind,
    readonly actionHint: string,
    readonly requestId: string,
    readonly traceId: string,
  ) {
    super(code);
    this.name = "ApiClientError";
  }
}

const failureKind = (status: number): ApiFailureKind =>
  status === 401
    ? "expired"
    : status === 403
      ? "forbidden"
      : status === 409
        ? "conflict"
        : status === 429
          ? "rate_limited"
          : [408, 425, 502, 503, 504].includes(status)
            ? "blocked"
            : "error";

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  idempotencyKey?: string;
  requestId?: string;
  traceId?: string;
}

export function createApiClient(baseUrl: string) {
  return async function request<T>(
    path: string,
    options: ApiRequestOptions = {},
  ): Promise<ApiEnvelope<T>> {
    const method = (options.method ?? "GET").toUpperCase();
    const requestId = options.requestId ?? crypto.randomUUID();
    const traceId = options.traceId ?? requestId;
    const headers = new Headers(options.headers);
    headers.set("accept", "application/json");
    headers.set("x-request-id", requestId);
    headers.set("x-trace-id", traceId);
    let body: BodyInit | undefined;
    if (options.body !== undefined) {
      headers.set("content-type", "application/json");
      body = JSON.stringify(options.body);
    }
    if (!["GET", "HEAD"].includes(method)) {
      headers.set(
        "idempotency-key",
        options.idempotencyKey ?? crypto.randomUUID(),
      );
    }
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      method,
      body,
      headers,
      credentials: "include",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new ApiClientError(
        response.status,
        payload?.error?.code ?? `http_${response.status}`,
        failureKind(response.status),
        payload?.error?.action_hint ?? "请求未完成，请稍后重试。",
        payload?.request_id ?? requestId,
        payload?.trace_id ?? traceId,
      );
    }
    return {
      data: payload?.data as T,
      request_id: payload?.request_id ?? requestId,
      trace_id: payload?.trace_id ?? traceId,
      ...(payload?.meta === undefined ? {} : { meta: payload.meta }),
    };
  };
}
