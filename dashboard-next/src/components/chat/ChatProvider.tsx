"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export type ChatModel = "sonnet" | "opus" | "haiku";
export type EffortLevel = "low" | "medium" | "high";

export interface ChatSession {
  id: string;
  preview: string;
  model: string;
  createdAt: string;
  lastActive: string;
  messageCount: number;
}

interface ChatContextValue {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  sessionId: string | null;
  setSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  model: ChatModel;
  setModel: React.Dispatch<React.SetStateAction<ChatModel>>;
  effort: EffortLevel;
  setEffort: React.Dispatch<React.SetStateAction<EffortLevel>>;
  clearChat: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [model, setModel] = useState<ChatModel>("sonnet");
  const [effort, setEffort] = useState<EffortLevel>("high");

  const clearChat = useCallback(() => {
    setMessages([]);
    setSessionId(null);
  }, []);

  return (
    <ChatContext.Provider
      value={{
        messages,
        setMessages,
        sessionId,
        setSessionId,
        model,
        setModel,
        effort,
        setEffort,
        clearChat,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
