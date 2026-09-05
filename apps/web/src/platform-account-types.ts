export type AccountTab = "organizations" | "users" | "admins";

export interface AccountData {
  summary: {
    organizations: number;
    active_organizations: number;
    users: number;
    active_users: number;
    platform_admins: number;
  };
  organizations: any[];
  users: any[];
  admins: any[];
}

export interface MembershipInput {
  organization_id: string;
  role_code: string;
  reason: string;
}
