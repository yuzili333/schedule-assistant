import { FormEvent, useEffect, useRef, useState } from "react";
import { ChatMessageCard } from "./components/ChatMessageCard";
import { loadModelSettings } from "./agent/storage";
import { ChatItem, ModelSettings } from "./types/chat";
import { runScheduleAgent } from "./agent/runtime";

const suggestionPrompts = [
  "帮我安排明天下午的客户回访和内部复盘",
  "分析一下我今天的会议和待办，给一个更合理的节奏",
  "把今天的日程摘要发给 alice@example.com",
];

function createMessage(
  role: ChatItem["role"],
  content: string,
  meta?: ChatItem["meta"],
): ChatItem {
  return {
    id: `${role}-${crypto.randomUUID()}`,
    role,
    content,
    createdAt: new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    meta,
  };
}

export default function App() {
  const [input, setInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [settings] = useState<ModelSettings>(() => loadModelSettings());
  const [messages, setMessages] = useState<ChatItem[]>([
    createMessage(
      "assistant",
      "我是你的日程 AI 助手。我会先通过 Router 判断请求属于查询、技能编排、工具执行还是 LLM 泛化推理，再返回安排建议或执行草案。",
      {
        route: "system",
        confidence: 1,
        latencyMs: 0,
        requiresConfirm: false,
        target: "agent_bootstrap",
      },
    ),
  ]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const canSubmit = input.trim().length > 0 && !isSubmitting;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    const userMessage = createMessage("user", input.trim());
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setIsSubmitting(true);

    try {
      const nextMessages = [...messages, userMessage];
      const result = await runScheduleAgent(nextMessages, settings);
      setMessages((current) => [
        ...current,
        createMessage("assistant", result.content, {
          route: result.decision.route,
          target: result.decision.target,
          confidence: result.decision.confidence,
          latencyMs: result.latencyMs,
          requiresConfirm: result.decision.risk.requiresHumanConfirm,
        }),
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        createMessage(
          "assistant",
          error instanceof Error
            ? error.message
            : "模型请求失败，请检查接口地址和跨域策略。",
          {
            route: "error",
            confidence: 1,
            latencyMs: 0,
            requiresConfirm: false,
            target: "model_gateway",
          },
        ),
      ]);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen px-4 py-6 text-[var(--text)] md:px-6 lg:px-8">
      <main className="mx-auto flex min-h-[88vh] max-w-6xl flex-col overflow-hidden rounded-[32px] border border-[var(--line)] bg-[rgba(255,250,241,0.72)] shadow-[0_24px_70px_rgba(92,62,23,0.12)] backdrop-blur-xl">
        <div className="border-b border-[var(--line)] px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--brand)]">
                Schedule AI Assistant
              </div>
              <h1 className="mt-2 text-2xl font-semibold text-[var(--text)]">
                日程助手 Chatbox
              </h1>
            </div>
            <div className="rounded-full border border-[var(--line)] bg-[rgba(255,250,241,0.88)] px-4 py-2 text-sm text-[var(--muted)]">
              {settings.enabled && settings.baseUrl
                ? `Model Gateway: ${settings.model}`
                : "Model Gateway: mock runtime"}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {suggestionPrompts.map((prompt) => (
              <button
                className="rounded-full border border-[var(--line)] bg-[rgba(255,250,241,0.9)] px-4 py-2 text-sm transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
                key={prompt}
                onClick={() => setInput(prompt)}
                type="button"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-hidden px-4 py-4 md:px-6">
          <div className="h-full overflow-y-auto pr-1" ref={scrollRef}>
            <div className="mx-auto flex max-w-4xl flex-col gap-4">
              {messages.map((message) => (
                <div
                  className={
                    message.role === "user"
                      ? "ml-auto w-full max-w-2xl"
                      : "mr-auto w-full max-w-3xl"
                  }
                  key={message.id}
                >
                  <ChatMessageCard message={message} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <form
          className="border-t border-[var(--line)] bg-[rgba(255,250,241,0.52)] p-4 md:p-6"
          onSubmit={handleSubmit}
        >
          <div className="mx-auto max-w-4xl">
            <textarea
              className="min-h-32 w-full rounded-[28px] border border-[var(--line)] bg-[rgba(255,250,241,0.92)] px-5 py-4 text-base outline-none transition focus:border-[var(--brand)]"
              onChange={(event) => setInput(event.target.value)}
              placeholder="例如：明天下午安排客户回访，并避开已有会议。"
              value={input}
            />
            <div className="mt-3 flex items-center justify-between">
              <button
                className="rounded-full bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-deep)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canSubmit}
                type="submit"
              >
                {isSubmitting ? "处理中..." : "发送"}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
