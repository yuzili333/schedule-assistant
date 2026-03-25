import { ModelSettings } from "../types/chat";
import { ChatMessage } from "../router";

interface OpenAICompatChoice {
  message?: {
    content?: string;
  };
}

interface OpenAICompatResponse {
  choices?: OpenAICompatChoice[];
}

export async function generateWithDynamicModel(
  settings: ModelSettings,
  messages: ChatMessage[],
): Promise<string | null> {
  if (!settings.enabled || !settings.baseUrl || !settings.model) {
    return null;
  }

  const endpoint = settings.baseUrl.endsWith("/chat/completions")
    ? settings.baseUrl
    : `${settings.baseUrl.replace(/\/$/, "")}/chat/completions`;

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
