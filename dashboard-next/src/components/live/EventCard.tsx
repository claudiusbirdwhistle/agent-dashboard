"use client";

import { useState } from "react";
import type { LiveEvent, LiveContentBlock } from "@/types";

function truncate(s: string | undefined, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function getContent(event: LiveEvent): LiveContentBlock[] | string | null {
  if (event.message?.content) return event.message.content;
  if (event.content) return event.content as LiveContentBlock[] | string;
  return null;
}

interface Display {
  tag: string;
  styleClass: string;
  summary: string;
}

function getDisplay(event: LiveEvent): Display {
  const content = getContent(event);
  const arr = Array.isArray(content) ? content : null;

  if (event.type === "system") {
    const parts: string[] = [];
    if (event.subtype === "init") {
      const model = event.message?.model ?? event.model;
      if (model) parts.push("model: " + model);
      if (event.session_id) parts.push("session: " + event.session_id.slice(0, 12));
      if (event.tools) parts.push(event.tools.length + " tools");
    }
    return {
      tag: "system",
      styleClass: "border-blue-800 bg-blue-950/40 text-blue-300",
      summary: parts.length ? parts.join(" | ") : (event.subtype ?? "system"),
    };
  }

  if (event.type === "assistant") {
    const toolBlock = arr?.find((c) => c.type === "tool_use");
    if (toolBlock) {
      const inputStr = toolBlock.input
        ? typeof toolBlock.input === "string"
          ? toolBlock.input
          : JSON.stringify(toolBlock.input)
        : "";
      return {
        tag: "tool call",
        styleClass: "border-violet-800 bg-violet-950/40 text-violet-300",
        summary: truncate((toolBlock.name ?? "tool") + " " + inputStr, 120),
      };
    }
    const texts =
      arr?.filter((c) => c.type === "text").map((c) => c.text ?? "").join("") ??
      (typeof content === "string" ? content : "");
    return {
      tag: "text",
      styleClass: "border-zinc-700 bg-zinc-800/40 text-zinc-300",
      summary: truncate(texts, 120),
    };
  }

  if (event.type === "user") {
    const resultBlock = arr?.find((c) => c.type === "tool_result");
    let summary = "";
    if (resultBlock) {
      const rc = resultBlock.content;
      summary =
        typeof rc === "string"
          ? rc
          : Array.isArray(rc)
          ? rc.map((c) => (c as LiveContentBlock).text ?? "").join("")
          : "";
    } else {
      summary = truncate(JSON.stringify(content), 120);
    }
    return {
      tag: "tool result",
      styleClass: "border-zinc-600 bg-zinc-900/40 text-zinc-400",
      summary: truncate(summary, 120),
    };
  }

  if (event.type === "result") {
    const parts: string[] = [];
    if (event.num_turns) parts.push(event.num_turns + " turns");
    if (event.cost_usd != null) parts.push("$" + event.cost_usd.toFixed(4));
    if (event.duration_ms) parts.push((event.duration_ms / 1000).toFixed(1) + "s");
    const isError = event.subtype === "error" || event.is_error;
    return {
      tag: isError ? "error" : "done",
      styleClass: isError
        ? "border-red-800 bg-red-950/40 text-red-300"
        : "border-green-800 bg-green-950/40 text-green-300",
      summary: parts.length ? parts.join(" | ") : truncate(event.result, 80) ?? "done",
    };
  }

  return {
    tag: event.type ?? "event",
    styleClass: "border-zinc-700 bg-zinc-800/40 text-zinc-400",
    summary: event.subtype ?? truncate(JSON.stringify(event), 80),
  };
}

function getBody(event: LiveEvent): string {
  const content = getContent(event);
  const arr = Array.isArray(content) ? content : null;

  if (event.type === "system" && event.subtype === "init") {
    const model = event.message?.model ?? event.model;
    const lines: string[] = [];
    if (model) lines.push("Model: " + model);
    if (event.session_id) lines.push("Session: " + event.session_id);
    if (event.tools)
      lines.push(
        "Tools: " +
          event.tools.slice(0, 10).join(", ") +
          (event.tools.length > 10 ? " …" : "")
      );
    if (event.cwd) lines.push("Working dir: " + event.cwd);
    return lines.join("\n") || JSON.stringify(event, null, 2);
  }

  if (event.type === "assistant" && arr) {
    const toolBlock = arr.find((c) => c.type === "tool_use");
    if (toolBlock) {
      const parts: string[] = ["Tool: " + (toolBlock.name ?? "unknown")];
      if (toolBlock.input)
        parts.push(
          "Input:\n" +
            (typeof toolBlock.input === "string"
              ? toolBlock.input
              : JSON.stringify(toolBlock.input, null, 2))
        );
      const texts = arr
        .filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join("");
      if (texts) parts.push("Message: " + texts);
      return parts.join("\n\n");
    }
    return (
      arr
        .filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join("") ||
      (typeof content === "string" ? content : JSON.stringify(event, null, 2))
    );
  }

  if (event.type === "user" && arr) {
    const resultBlock = arr.find((c) => c.type === "tool_result");
    if (resultBlock) {
      const rc = resultBlock.content;
      return typeof rc === "string"
        ? rc
        : Array.isArray(rc)
        ? rc.map((c) => (c as LiveContentBlock).text ?? "").join("")
        : JSON.stringify(rc, null, 2);
    }
    return arr.map((c) => c.text ?? "").join("") || JSON.stringify(content, null, 2);
  }

  if (event.type === "result") {
    const parts: string[] = [];
    if (event.num_turns) parts.push("Turns: " + event.num_turns);
    if (event.cost_usd != null) parts.push("Cost: $" + event.cost_usd.toFixed(4));
    if (event.duration_ms) parts.push("Duration: " + (event.duration_ms / 1000).toFixed(1) + "s");
    if (event.duration_api_ms)
      parts.push("API time: " + (event.duration_api_ms / 1000).toFixed(1) + "s");
    if (event.result) parts.push("Result:\n" + event.result);
    return parts.join("\n") || JSON.stringify(event, null, 2);
  }

  return JSON.stringify(event, null, 2);
}

interface EventCardProps {
  event: LiveEvent;
}

export default function EventCard({ event }: EventCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { tag, styleClass, summary } = getDisplay(event);

  return (
    <div
      className={`rounded border text-sm cursor-pointer select-none ${styleClass}`}
      onClick={() => setExpanded((e) => !e)}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70 shrink-0">
          {tag}
        </span>
        <span className="flex-1 truncate text-xs opacity-80">{summary}</span>
        <span
          className="text-[10px] opacity-40 transition-transform duration-150"
          style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
        >
          ▶
        </span>
      </div>
      {expanded && (
        <div className="px-3 pb-3 border-t border-current/10">
          <pre className="mt-2 text-xs whitespace-pre-wrap break-words leading-snug opacity-90 max-h-64 overflow-y-auto">
            {getBody(event)}
          </pre>
        </div>
      )}
    </div>
  );
}
