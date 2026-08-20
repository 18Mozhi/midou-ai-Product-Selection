export type ApiFailureKind =
  "expired" | "forbidden" | "conflict" | "rate_limited" | "blocked" | "error";

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
    readonly userMessage: string,
    readonly actionHint: string,
    readonly requestId: string,
    readonly traceId: string,
  ) {
    super(userMessage);
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

async function requestResponse(
  baseUrl: string,
  path: string,
  options: ApiRequestOptions,
): Promise<Response> {
  const method = (options.method ?? "GET").toUpperCase();
  const requestId = options.requestId ?? crypto.randomUUID();
  const traceId = options.traceId ?? requestId;
  const headers = new Headers(options.headers);
  headers.set("accept", headers.get("accept") ?? "application/json");
  headers.set("x-request-id", requestId);
  headers.set("x-trace-id", traceId);
  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    headers.set("content-type", headers.get("content-type") ?? "application/json");
    body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  }
  if (!["GET", "HEAD"].includes(method)) {
    headers.set("idempotency-key", options.idempotencyKey ?? crypto.randomUUID());
  }
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    method,
    body,
    headers,
    credentials: "include",
  });
  if (!response.ok) {
    const payload = await response
      .clone()
      .json()
      .catch(() => null);
    throw new ApiClientError(
      response.status,
      payload?.error?.code ?? `http_${response.status}`,
      failureKind(response.status),
      payload?.error?.message ?? "请求暂时失败。",
      payload?.error?.action_hint ?? "请求未完成，请稍后重试。",
      payload?.request_id ?? requestId,
      payload?.trace_id ?? payload?.request_id ?? traceId,
    );
  }
  return response;
}

export function createApiResponseClient(baseUrl: string) {
  return (path: string, options: ApiRequestOptions = {}) => requestResponse(baseUrl, path, options);
}

export function createApiClient(baseUrl: string) {
  const requestRaw = createApiResponseClient(baseUrl);
  return async function request<T>(
    path: string,
    options: ApiRequestOptions = {},
  ): Promise<ApiEnvelope<T>> {
    const requestId = options.requestId ?? crypto.randomUUID();
    const traceId = options.traceId ?? requestId;
    const response = await requestRaw(path, { ...options, requestId, traceId });
    const payload = await response.json().catch(() => null);
    return {
      data: payload?.data as T,
      request_id: payload?.request_id ?? requestId,
      trace_id: payload?.trace_id ?? payload?.request_id ?? traceId,
      ...(payload?.meta === undefined ? {} : { meta: payload.meta }),
    };
  };
}
