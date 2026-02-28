"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { useChat } from "./ChatProvider";
import type { ChatModel, EffortLevel, ChatSession } from "./ChatProvider";

const MODEL_OPTIONS: { value: ChatModel; label: string }[] = [
  { value: "haiku", label: "Haiku" },
  { value: "sonnet", label: "Sonnet" },
  { value: "opus", label: "Opus" },
];

const EFFORT_OPTIONS: { value: EffortLevel; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Med" },
  { value: "high", label: "High" },
];

export default function ChatPanel() {
  const {
    messages,
    setMessages,
    sessionId,
    setSessionId,
    model,
    setModel,
    effort,
    setEffort,
    clearChat,
  } = useChat();
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingResume, setLoadingResume] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    }
  }, [input]);

  // Fetch sessions when history panel opens
  useEffect(() => {
    if (!showHistory) return;
    setLoadingSessions(true);
    fetch("/api/chat/sessions")
      .then((r) => r.json())
      .then((data) => setSessions(Array.isArray(data) ? data : []))
      .catch(() => setSessions([]))
      .finally(() => setLoadingSessions(false));
  }, [showHistory]);

  const resumeSession = useCallback(
    async (session: ChatSession) => {
      setLoadingResume(session.id);
      try {
        const res = await fetch(`/api/chat/sessions/${session.id}/messages`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          throw new Error("Invalid response");
        }
        const data = await res.json();
        const msgs = Array.isArray(data.messages) ? data.messages : [];
        setMessages(msgs);
        setSessionId(session.id);
        setShowHistory(false);
        setError(msgs.length === 0 ? "Session has no messages" : null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load session");
      } finally {
        setLoadingResume(null);
      }
    },
    [setMessages, setSessionId]
  );

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setIsStreaming(true);

    let assistantContent = "";

    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId, model, effort }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = "";

      // Add empty assistant message
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split("\n");
        sseBuffer = lines.pop() || "";

        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ") && eventType) {
            try {
              const data = JSON.parse(line.slice(6));
              if (eventType === "init" && data.sessionId) {
                setSessionId(data.sessionId);
              } else if (eventType === "text" && data.delta) {
                assistantContent += data.delta;
                const content = assistantContent;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content,
                  };
                  return updated;
                });
              } else if (eventType === "error" && data.message) {
                setError(data.message);
              } else if (eventType === "result" && data.sessionId) {
                setSessionId(data.sessionId);
              }
            } catch {
              // skip malformed JSON
            }
            eventType = "";
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, sessionId, model, effort, setMessages, setSessionId]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleClear() {
    clearChat();
    setError(null);
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60_000) return "just now";
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isStreaming ? "bg-blue-400 animate-pulse" : "bg-green-400"}`} />
          <span className="text-sm font-medium text-zinc-300">Claude Chat</span>
          {sessionId && (
            <span className="text-[10px] text-zinc-600 font-mono">
              {sessionId.slice(0, 8)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className={`text-xs transition-colors px-2 py-1 rounded ${
              showHistory
                ? "text-blue-400 bg-blue-400/10"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            }`}
            title="Session history"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            onClick={handleClear}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded hover:bg-zinc-800 flex items-center gap-1"
            title="New chat"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            New Chat
          </button>
        </div>
      </div>

      {/* Model & Effort selectors */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-b border-zinc-800/50 bg-zinc-900/50">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Model</span>
          <div className="flex rounded-md overflow-hidden border border-zinc-700">
            {MODEL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setModel(opt.value)}
                disabled={isStreaming}
                className={`px-2 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-50 ${
                  model === opt.value
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Thinking</span>
          <div className="flex rounded-md overflow-hidden border border-zinc-700">
            {EFFORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setEffort(opt.value)}
                disabled={isStreaming}
                className={`px-2 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-50 ${
                  effort === opt.value
                    ? "bg-amber-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Session History Panel */}
      {showHistory && (
        <div className="border-b border-zinc-800 bg-zinc-900/80 max-h-64 overflow-y-auto">
          <div className="px-4 py-2 text-[10px] uppercase tracking-wider text-zinc-500 font-medium border-b border-zinc-800/50">
            Past Sessions
          </div>
          {loadingSessions ? (
            <div className="px-4 py-3 text-xs text-zinc-500">Loading...</div>
          ) : sessions.length === 0 ? (
            <div className="px-4 py-3 text-xs text-zinc-500">No past sessions</div>
          ) : (
            <div>
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => resumeSession(s)}
                  disabled={loadingResume === s.id || isStreaming}
                  className={`w-full text-left px-4 py-2 hover:bg-zinc-800 transition-colors border-b border-zinc-800/30 disabled:opacity-50 ${
                    sessionId === s.id ? "bg-zinc-800/60" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-zinc-300 truncate flex-1">
                      {loadingResume === s.id ? "Loading..." : s.preview}
                    </span>
                    <span className="text-[10px] text-zinc-600 shrink-0">
                      {formatTime(s.lastActive)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-zinc-600 font-mono">
                      {s.id.slice(0, 8)}
                    </span>
                    <span className="text-[10px] text-zinc-600">
                      {s.model}
                    </span>
                    <span className="text-[10px] text-zinc-600">
                      {s.messageCount} msg{s.messageCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
            Start a conversation with Claude
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 text-zinc-200"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_pre]:bg-zinc-900 [&_pre]:rounded [&_pre]:p-2 [&_code]:text-emerald-400 [&_code]:text-xs [&_p]:my-1">
                  {msg.content ? (
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  ) : isStreaming && i === messages.length - 1 ? (
                    <span className="inline-block w-2 h-4 bg-zinc-400 animate-pulse" />
                  ) : null}
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-1">
          <p className="text-xs text-red-400 truncate">{error}</p>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-zinc-800 p-3">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Claude..."
            rows={1}
            disabled={isStreaming}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 resize-none focus:outline-none focus:border-zinc-500 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={isStreaming || !input.trim()}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {isStreaming ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
