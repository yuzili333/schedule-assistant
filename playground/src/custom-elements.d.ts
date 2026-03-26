import type * as React from "react";
import type { ChatMessageCardElement } from "./components/chat-message-card";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "chat-message-card": React.DetailedHTMLProps<
        React.HTMLAttributes<ChatMessageCardElement>,
        ChatMessageCardElement
      >;
    }
  }
}

export {};
