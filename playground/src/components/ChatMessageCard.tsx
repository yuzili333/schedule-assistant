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

export function ChatMessageCard({
  message,
  onSelectCandidate,
}: {
  message: ChatItem;
  onSelectCandidate?: (candidateId: string) => void;
}) {
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

  useEffect(() => {
    const element = ref.current;
    if (!element || !onSelectCandidate) {
      return;
    }

    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ candidateId: string }>;
      onSelectCandidate(customEvent.detail.candidateId);
    };

    element.addEventListener("person-select", handler as EventListener);

    return () => {
      element.removeEventListener("person-select", handler as EventListener);
    };
  }, [onSelectCandidate]);

  return <chat-message-card ref={ref} />;
}
