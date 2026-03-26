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
  onApplyDraft,
}: {
  message: ChatItem;
  onSelectCandidate?: (detail: {
    candidateId: string;
    role: "attendee" | "cc";
    sourceName: string;
  }) => void;
  onApplyDraft?: () => void;
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
      const customEvent = event as CustomEvent<{
        candidateId: string;
        role: "attendee" | "cc";
        sourceName: string;
      }>;
      onSelectCandidate(customEvent.detail);
    };

    element.addEventListener("person-select", handler as EventListener);

    return () => {
      element.removeEventListener("person-select", handler as EventListener);
    };
  }, [onSelectCandidate]);

  useEffect(() => {
    const element = ref.current;
    if (!element || !onApplyDraft) {
      return;
    }

    const handler = () => {
      onApplyDraft();
    };

    element.addEventListener("draft-apply", handler as EventListener);

    return () => {
      element.removeEventListener("draft-apply", handler as EventListener);
    };
  }, [onApplyDraft]);

  return <chat-message-card ref={ref} />;
}
