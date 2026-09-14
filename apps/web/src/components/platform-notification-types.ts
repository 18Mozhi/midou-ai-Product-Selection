export type NotificationCategory = "system" | "task" | "approval" | "competitor";
export type NotificationSeverity = "info" | "warning" | "critical";
export type NotificationAudience = "all_users" | "organization" | "user";
export type NotificationMessageStatus = "draft" | "published" | "cancelled";
export type NotificationSection = "messages" | "deliveries" | "configuration";

export interface PlatformNotificationMessage {
  id: string;
  kind: "notification" | "email";
  title: string;
  body: string;
  status: NotificationMessageStatus;
  version: number;
  category: NotificationCategory;
  severity: NotificationSeverity;
  audience_type: NotificationAudience;
  organization_id?: string | null;
  organization_name?: string | null;
  user_id?: string | null;
  user_email?: string | null;
  in_app_enabled: boolean;
  email_enabled: boolean;
  updated_at: string;
}

export interface PlatformNotificationForm {
  kind: "notification" | "email";
  title: string;
  body: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  audience_type: NotificationAudience;
  organization_id: string;
  user_id: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
  reason: string;
  expected_version: number;
}

export interface NotificationPaginationData {
  page: number;
  page_size?: number;
  total: number;
  total_pages: number;
}

export type PlatformNotificationRequest = <T>(path: string, options?: RequestInit) => Promise<T>;
