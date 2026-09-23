export interface PersonalProfile {
  id: string;
  email: string;
  email_verified_at: string | null;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  phone: string | null;
  phone_verified_at: string | null;
  locale: string;
  timezone: string;
  version: number;
}

export type PersonalProfileDraft = Pick<
  PersonalProfile,
  "username" | "display_name" | "avatar_url" | "phone" | "locale" | "timezone"
> & { reason: string };

export interface PersonalAuthorization {
  roles: string[];
  capabilities: string[];
  data_scopes: { scope: string; scope_key: string | null }[];
}

export interface PersonalSession {
  id: string;
  device_label: string;
  status: string;
  last_seen_at: string | null;
}

export interface NotificationPreferences {
  version: number;
  in_app_enabled: boolean;
  email_enabled: boolean;
  task_enabled: boolean;
  approval_enabled: boolean;
  competitor_enabled: boolean;
}

export interface PersonalAssets {
  followed_trends: { id: string; title: string; market: string; created_at: string | null }[];
  decisions: {
    id: string;
    opportunity_id: string;
    opportunity_name: string;
    action: string;
    created_at: string | null;
  }[];
  tasks: {
    id: string;
    title: string;
    status: string;
    priority: string;
    due_at: string | null;
  }[];
}

export interface SectionResource<T> {
  status: "loading" | "ready" | "error";
  data: T | null;
  message: string;
  snapshotRequestId: string;
  snapshotTraceId: string;
  readFailureId: string;
  readFailureTraceId: string;
}

export interface ActionFeedback {
  status: "success" | "error";
  message: string;
  requestId: string;
  traceId: string;
}

export type ProfileField = keyof PersonalProfileDraft;
export type PasswordField = "current_password" | "new_password" | "confirm_password";
export type PasswordDraft = Record<PasswordField, string>;
export type PersonalSection = "profile" | "permissions" | "security" | "notifications" | "assets";
