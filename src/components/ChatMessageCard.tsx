import { useEffect, useRef } from "react";
import "./chat-message-card";
import { ChatItem } from "../types/chat";

type ChatMessageCardElement = HTMLElement & {
  role: ChatItem["role"];
  content: string;
  meta?: ChatItem["meta"];
  createdAt: string;
  isStreaming?: boolean;
};

export function ChatMessageCard({ message }: { message: ChatItem }) {
  const ref = useRef<ChatMessageCardElement | null>(null);

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    ref.current.role = message.role;
    ref.current.content = message.content;
    ref.current.meta = message.meta;
    ref.current.createdAt = message.createdAt;
    ref.current.isStreaming = message.isStreaming;
  }, [message]);

  return <chat-message-card ref={ref} />;
}
