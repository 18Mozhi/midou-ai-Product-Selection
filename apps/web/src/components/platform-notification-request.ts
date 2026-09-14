import { ApiClientError } from "../api-client";
import type {
  PlatformNotificationEnvelopeRequest,
  PlatformNotificationRequest,
} from "./platform-notification-types";

// Writes retain the shared client's error guidance but never mutate read diagnostics.
export function notificationWriteRequest(
  request: PlatformNotificationEnvelopeRequest,
): PlatformNotificationRequest {
  return async <T>(path: string, options?: RequestInit) => {
    try {
      return (await request<T>(path, options)).data;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      const failure = error instanceof ApiClientError ? error : null;
      throw new Error(failure?.actionHint ?? "请求未完成", { cause: failure ?? error });
    }
  };
}
