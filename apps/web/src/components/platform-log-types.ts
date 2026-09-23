export interface OperationalLog {
  id: string;
  source: "api" | "worker" | "crawler";
  event_type: string;
  resource_type: string;
  resource_id: string | null;
  status: string;
  error_code: string | null;
  request_id: string;
  trace_id: string;
  occurred_at: string;
  task_id: string | null;
  provider_id: string | null;
  provider_name: string | null;
}

export interface PlatformLogTraceChain {
  traceId: string;
  items: OperationalLog[];
  sources: string[];
  exceptionCount: number;
  startedAt: string;
  endedAt: string;
}
