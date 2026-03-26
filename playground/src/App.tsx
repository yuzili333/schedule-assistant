import { FormEvent, useEffect, useRef, useState } from "react";
import {
  type CreateCalendarDraft,
  loadModelSettings,
  type PersonCandidate,
  runScheduleAgent,
  type ModelSettings,
} from "@schedule-assistant/agent";
import { ChatMessageCard } from "./components/ChatMessageCard";
import { ChatItem } from "./types/chat";

const suggestionPrompts = [
  "查询今天有哪些会议",
  "创建日程\n主题：项目例会\n开始日期：2026-03-26 14:00\n结束日期：2026-03-26 15:00\n参会人：张三",
  "创建日程\n主题：版本复盘\n开始日期：2026-03-27 10:00\n结束日期：2026-03-27 11:30\n会议室：6F Maple",
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
      "我是你的日程助手。目前只提供两类能力：查询日程、创建日程。创建日程时，“主题、开始日期、结束日期”为必填；如果你输入了参会人姓名，我会返回机构人员候选卡片供你手动选择。",
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
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const canSubmit = input.trim().length > 0 && !isSubmitting;

  function appendAssistantChunk(messageId: string, chunk: string): void {
    setMessages((current) =>
      current.map((item) =>
        item.id === messageId
          ? {
              ...item,
              content: `${item.content}${chunk}`,
              isStreaming: true,
            }
          : item,
      ),
    );
  }

  function finalizeAssistantMessage(messageId: string, meta?: ChatItem["meta"]): void {
    setMessages((current) =>
      current.map((item) =>
        item.id === messageId
          ? {
              ...item,
              meta: meta ?? item.meta,
              isStreaming: false,
            }
          : item,
      ),
    );
  }

  async function submitUserContent(content: string): Promise<void> {
    const userMessage = createMessage("user", content);
    const assistantMessage = createMessage("assistant", "");
    setMessages((current) => [
      ...current,
      userMessage,
      {
        ...assistantMessage,
        isStreaming: true,
      },
    ]);
    setInput("");
    setIsSubmitting(true);

    try {
      const nextMessages = [...messagesRef.current, userMessage];
      const result = await runScheduleAgent(nextMessages, settings, (chunk) => {
        appendAssistantChunk(assistantMessage.id, chunk);
      });
      finalizeAssistantMessage(assistantMessage.id, {
        route: result.decision.route,
        target: result.decision.target,
        confidence: result.decision.confidence,
        latencyMs: result.latencyMs,
        requiresConfirm: result.decision.risk.requiresHumanConfirm,
        personCandidates: result.resultMetadata?.personCandidates,
        draft: result.resultMetadata?.draft,
      });
    } catch (error) {
      appendAssistantChunk(
        assistantMessage.id,
        error instanceof Error
          ? error.message
          : "模型请求失败，请检查接口地址和跨域策略。",
      );
      finalizeAssistantMessage(assistantMessage.id, {
        route: "error",
        confidence: 1,
        latencyMs: 0,
        requiresConfirm: false,
        target: "model_gateway",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function buildSelectionPrompt(
    draft: CreateCalendarDraft,
    candidate: PersonCandidate,
  ): string {
    const lines = [
      "创建日程",
      `主题：${draft.title}`,
      `开始日期：${draft.startDate}`,
      `结束日期：${draft.endDate}`,
      `已选参会人：${candidate.name}`,
      `参会人ID：${candidate.id}`,
    ];

    if (draft.allDay !== undefined) {
      lines.push(`是否全天：${draft.allDay ? "是" : "否"}`);
    }
    if (draft.meetingRoom) {
      lines.push(`会议室：${draft.meetingRoom}`);
    }
    if (draft.description) {
      lines.push(`描述：${draft.description}`);
    }
    if (draft.attachments && draft.attachments.length > 0) {
      lines.push(`附件：${draft.attachments.join("、")}`);
    }
    if (draft.reminderChannels && draft.reminderChannels.length > 0) {
      lines.push(`提醒渠道：${draft.reminderChannels.join("、")}`);
    }
    if (draft.urgent !== undefined) {
      lines.push(`紧急状态：${draft.urgent ? "是" : "否"}`);
    }

    return lines.join("\n");
  }

  async function handleSelectCandidate(candidateId: string): Promise<void> {
    const sourceMessage = [...messagesRef.current]
      .reverse()
      .find((message) =>
        message.meta?.personCandidates?.some((candidate) => candidate.id === candidateId),
      );

    const candidate = sourceMessage?.meta?.personCandidates?.find(
      (item) => item.id === candidateId,
    );
    const draft = sourceMessage?.meta?.draft;

    if (!candidate || !draft) {
      return;
    }

    await submitUserContent(buildSelectionPrompt(draft, candidate));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    await submitUserContent(input.trim());
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
                ? `Model Gateway: ${settings.label} · ${settings.model}`
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
                  <ChatMessageCard
                    message={message}
                    onSelectCandidate={handleSelectCandidate}
                  />
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
              placeholder={"例如：创建日程\n主题：项目例会\n开始日期：2026-03-26 14:00\n结束日期：2026-03-26 15:00\n参会人：张三"}
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
