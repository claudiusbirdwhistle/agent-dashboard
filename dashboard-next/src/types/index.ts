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
  processStatus: "running" | "sleeping" | "idle";
  phase: string | null;
  stallCount: number;
  totalInvocations: number;
  activeObjectives: number;
  currentDirectiveId: string | null;
  diskUsage: { used: string; available: string; percent: string } | null;
}

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  modified?: string;
  children?: FileNode[];
}

export interface LiveContentBlock {
  type: "text" | "tool_use" | "tool_result" | string;
  text?: string;
  name?: string;
  input?: unknown;
  content?: string | LiveContentBlock[];
  tool_use_id?: string;
}

// Raw Claude Code stream-json event
export interface LiveEvent {
  type: "system" | "assistant" | "user" | "result" | string;
  subtype?: string;
  // system init fields
  model?: string;
  session_id?: string;
  tools?: string[];
  cwd?: string;
  // assistant / user content
  message?: { content?: LiveContentBlock[]; model?: string };
  content?: LiveContentBlock[] | string;
  // result fields
  num_turns?: number;
  cost_usd?: number;
  duration_ms?: number;
  duration_api_ms?: number;
  result?: string;
  is_error?: boolean;
}

export interface SessionData {
  username: string;
  loggedInAt: string;
}
