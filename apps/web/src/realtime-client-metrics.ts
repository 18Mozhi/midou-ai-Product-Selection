export type RealtimeClientMetrics = {
  session_started_at: string;
  connection_open_count: number;
  reconnect_count: number;
  fallback_poll_count: number;
  last_open_at: string | null;
  last_reconnect_at: string | null;
  last_fallback_poll_at: string | null;
  reconnecting: boolean;
};

const storageKey = "scoutops:realtime-client-metrics";
export const realtimeMetricsEvent = "scoutops:realtime-metrics-changed";

const nowIso = () => new Date().toISOString();
const nonNegativeInteger = (value: unknown) =>
  Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : 0;
const timestamp = (value: unknown) =>
  typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;

const emptyMetrics = (): RealtimeClientMetrics => ({
  session_started_at: nowIso(),
  connection_open_count: 0,
  reconnect_count: 0,
  fallback_poll_count: 0,
  last_open_at: null,
  last_reconnect_at: null,
  last_fallback_poll_at: null,
  reconnecting: false,
});

export function readRealtimeClientMetrics(): RealtimeClientMetrics {
  if (typeof sessionStorage === "undefined") return emptyMetrics();
  try {
    const parsed = JSON.parse(
      sessionStorage.getItem(storageKey) ?? "null",
    ) as Partial<RealtimeClientMetrics> | null;
    if (!parsed) return emptyMetrics();
    return {
      session_started_at: timestamp(parsed.session_started_at) ?? nowIso(),
      connection_open_count: nonNegativeInteger(parsed.connection_open_count),
      reconnect_count: nonNegativeInteger(parsed.reconnect_count),
      fallback_poll_count: nonNegativeInteger(parsed.fallback_poll_count),
      last_open_at: timestamp(parsed.last_open_at),
      last_reconnect_at: timestamp(parsed.last_reconnect_at),
      last_fallback_poll_at: timestamp(parsed.last_fallback_poll_at),
      reconnecting: parsed.reconnecting === true,
    };
  } catch {
    return emptyMetrics();
  }
}

function updateRealtimeClientMetrics(
  update: (current: RealtimeClientMetrics) => RealtimeClientMetrics,
) {
  const next = update(readRealtimeClientMetrics());
  if (typeof sessionStorage !== "undefined")
    sessionStorage.setItem(storageKey, JSON.stringify(next));
  if (typeof window !== "undefined")
    window.dispatchEvent(
      new CustomEvent<RealtimeClientMetrics>(realtimeMetricsEvent, { detail: next }),
    );
  return next;
}

export function recordRealtimeOpen() {
  return updateRealtimeClientMetrics((current) => ({
    ...current,
    connection_open_count: current.connection_open_count + 1,
    last_open_at: nowIso(),
    reconnecting: false,
  }));
}

export function beginRealtimeReconnect() {
  if (readRealtimeClientMetrics().reconnecting) return false;
  updateRealtimeClientMetrics((current) => ({
    ...current,
    reconnect_count: current.reconnect_count + 1,
    last_reconnect_at: nowIso(),
    reconnecting: true,
  }));
  return true;
}

export function recordRealtimeFallbackPoll() {
  return updateRealtimeClientMetrics((current) => ({
    ...current,
    fallback_poll_count: current.fallback_poll_count + 1,
    last_fallback_poll_at: nowIso(),
  }));
}

export function realtimeReconnectRateBasisPoints(metrics: RealtimeClientMetrics) {
  const events = metrics.connection_open_count + metrics.reconnect_count;
  return events ? Math.round((metrics.reconnect_count * 10_000) / events) : 0;
}
