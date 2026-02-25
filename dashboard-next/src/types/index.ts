export type DirectiveType = "task" | "focus" | "policy";
export type DirectivePriority = "urgent" | "normal" | "background";
export type DirectiveStatus =
  | "pending"
  | "acknowledged"
  | "completed"
  | "deferred"
  | "dismissed";

export interface Directive {
  id: string;
  text: string;
  type: DirectiveType;
  priority: DirectivePriority;
  status: DirectiveStatus;
  created_at: string;
  acknowledged_at: string | null;
  completed_at: string | null;
  agent_notes: string | null;
}

export interface AgentStatus {
  enabled: boolean;
  phase: string;
  current_step: string;
  invocations: number;
  stalls: number;
  disk_usage?: string;
  objectives?: { active: number; completed: number; blocked: number };
}

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  modified?: string;
  children?: FileNode[];
}

export interface LiveEvent {
  type: "system" | "text" | "tool-use" | "result" | "error";
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface SessionData {
  username: string;
  loggedInAt: string;
}
