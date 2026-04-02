import {
  AgentErrorEvent,
  AgentMessage,
  AgentMetaEvent,
  AgentServiceRequest,
  AgentServiceResponse,
  AgentServiceStreamEvent,
} from "./agent-schema";

const DEFAULT_API_BASE = "/api";

export function getAgentServiceBaseUrl(): string {
  return import.meta.env.PUBLIC_AGENT_SERVICE_BASE_URL?.trim() || DEFAULT_API_BASE;
}

function buildUrl(path: string): string {
  const base = getAgentServiceBaseUrl().replace(/\/$/, "");
  return `${base}${path}`;
}

export async function streamAgentResponse(params: {
  messages: AgentMessage[];
  sessionId: string;
  userId?: string;
  onChunk: (chunk: string) => void;
}): Promise<AgentServiceResponse> {
  const payload: AgentServiceRequest = {
    sessionId: params.sessionId,
    userId: params.userId,
    messages: params.messages,
  };

  const response = await fetch(buildUrl("/chat/stream"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Agent service 请求失败，状态码 ${response.status}。`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let meta: AgentServiceResponse | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const line = frame
        .split("\n")
        .find((item) => item.startsWith("data: "));
      if (!line) {
        continue;
      }

      const event = JSON.parse(line.slice(6)) as AgentServiceStreamEvent;
      if (event.type === "chunk") {
        params.onChunk(event.chunk);
      }
      if (event.type === "meta") {
        meta = (event as AgentMetaEvent).payload;
      }
      if (event.type === "error") {
        throw new Error((event as AgentErrorEvent).message);
      }
    }
  }

  if (!meta) {
    throw new Error("Agent service 未返回最终元数据。");
  }

  return meta;
}
