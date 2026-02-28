"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatContextValue {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  sessionId: string | null;
  setSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  clearChat: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const clearChat = useCallback(() => {
    setMessages([]);
    setSessionId(null);
  }, []);

  return (
    <ChatContext.Provider
      value={{ messages, setMessages, sessionId, setSessionId, clearChat }}
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
