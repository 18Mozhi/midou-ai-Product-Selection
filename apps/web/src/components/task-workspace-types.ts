export type Task = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee_id: string;
  due_at: string | null;
  sla_status: string;
  source_type: string;
  source_ref_id: string | null;
  collection_task_id: string | null;
  progress_percent: number;
  progress_note: string | null;
  version: number;
  comments?: Array<{
    id: string;
    body: string;
    created_at: string;
    [key: string]: any;
  }>;
  events?: Array<{
    id: string;
    event_type: string;
    created_at: string;
    payload?: Record<string, any>;
    [key: string]: any;
  }>;
};

export type MemberOption = { id: string; label: string };

export type TaskActionEditor = "pause" | "cancel" | "delay" | "transfer" | "progress";

export type BatchTaskAction = "pause" | "resume" | "cancel" | "delay" | "transfer";

export type TaskActionForm = {
  reason: string;
  due_at: string;
  assignee_id: string;
  progress_percent: number;
  progress_note: string;
};

export type TaskActivity = Record<string, any> & {
  id: string;
  kind: "event" | "comment";
  body: string;
  title: string;
  actorLabel: string;
  created_at: string;
};

export type TaskBlockingContext = { reason: string; nextOwner: string };
