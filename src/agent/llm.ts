import { ModelSettings } from "../types/chat";
import { ChatMessage } from "../router";

interface OpenAICompatChoice {
  delta?: {
    content?: string;
  };
  message?: {
    content?: string;
  };
}

interface OpenAICompatResponse {
  choices?: OpenAICompatChoice[];
}

interface StreamModelParams {
  settings: ModelSettings,
  messages: ChatMessage[],
  onChunk?: (chunk: string) => void,
}

function buildEndpoint(baseUrl: string): string {
  return baseUrl.endsWith("/chat/completions")
    ? baseUrl
    : `${baseUrl.replace(/\/$/, "")}/chat/completions`;
}

export async function generateWithDynamicModel(
  settings: ModelSettings,
  messages: ChatMessage[],
): Promise<string | null> {
  if (!settings.enabled || !settings.baseUrl || !settings.model) {
    return null;
  }

  const endpoint = buildEndpoint(settings.baseUrl);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(settings.apiKey
        ? { Authorization: `Bearer ${settings.apiKey}` }
        : {}),
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        {
          role: "system",
          content: settings.systemPrompt,
        },
        ...messages,
      ],
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    throw new Error(`模型接口调用失败: HTTP ${response.status}`);
  }

  const data = (await response.json()) as OpenAICompatResponse;
  return data.choices?.[0]?.message?.content?.trim() ?? null;
}

function extractChunkContent(payload: string): string {
  if (!payload || payload === "[DONE]") {
    return "";
  }

  try {
    const data = JSON.parse(payload) as OpenAICompatResponse;
    return data.choices?.[0]?.delta?.content ?? data.choices?.[0]?.message?.content ?? "";
  } catch {
    return "";
  }
}

export async function streamWithDynamicModel({
  settings,
  messages,
  onChunk,
}: StreamModelParams): Promise<string | null> {
  if (!settings.enabled || !settings.baseUrl || !settings.model) {
    return null;
  }

  const endpoint = buildEndpoint(settings.baseUrl);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(settings.apiKey
        ? { Authorization: `Bearer ${settings.apiKey}` }
        : {}),
    },
    body: JSON.stringify({
      model: settings.model,
      stream: true,
      messages: [
        {
          role: "system",
          content: settings.systemPrompt,
        },
        ...messages,
      ],
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    throw new Error(`模型接口调用失败: HTTP ${response.status}`);
  }

  if (!response.body) {
    return generateWithDynamicModel(settings, messages);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) {
      const lines = event
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      for (const line of lines) {
        if (!line.startsWith("data:")) {
          continue;
        }

        const payload = line.slice(5).trim();
        if (payload === "[DONE]") {
          return fullText.trim();
        }

        const chunk = extractChunkContent(payload);
        if (!chunk) {
          continue;
        }

        fullText += chunk;
        onChunk?.(chunk);
      }
    }
  }

  const trailingChunk = extractChunkContent(buffer.replace(/^data:\s*/, "").trim());
  if (trailingChunk) {
    fullText += trailingChunk;
    onChunk?.(trailingChunk);
  }

  return fullText.trim();
}
