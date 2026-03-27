import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  type CreateCalendarDraft,
  loadModelSettings,
  type PersonLookupCandidate,
  runScheduleAgent,
  type ModelSettings,
} from "@schedule-assistant/agent";
import { ChatMessageCard } from "./components/ChatMessageCard";
import { ChatItem } from "./types/chat";

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

const suggestionPrompts = [
  "查询今天有哪些日程",
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
  const [isRecording, setIsRecording] = useState(false);
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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
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

  useEffect(() => {
    if (!textareaRef.current) {
      return;
    }

    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
  }, [input]);

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
        recommendation: result.resultMetadata?.recommendation,
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

  function buildCreatePrompt(draft: CreateCalendarDraft): string {
    const lines = [
      "创建日程",
      `主题：${draft.title}`,
      `开始日期：${draft.startDate}`,
      `结束日期：${draft.endDate}`,
    ];

    if (draft.attendeeNameQueries && draft.attendeeNameQueries.length > 0) {
      lines.push(`参会人：${draft.attendeeNameQueries.join("、")}`);
    }
    if (draft.selectedAttendeeNames && draft.selectedAttendeeNames.length > 0) {
      lines.push(`已选参会人：${draft.selectedAttendeeNames.join("、")}`);
    }
    if (draft.selectedAttendeeIds && draft.selectedAttendeeIds.length > 0) {
      lines.push(`参会人ID：${draft.selectedAttendeeIds.join("、")}`);
    }
    if (draft.ccNameQueries && draft.ccNameQueries.length > 0) {
      lines.push(`抄送人：${draft.ccNameQueries.join("、")}`);
    }
    if (draft.selectedCcNames && draft.selectedCcNames.length > 0) {
      lines.push(`已选抄送人：${draft.selectedCcNames.join("、")}`);
    }
    if (draft.selectedCcIds && draft.selectedCcIds.length > 0) {
      lines.push(`抄送人ID：${draft.selectedCcIds.join("、")}`);
    }
    if (draft.allDay !== undefined) {
      lines.push(`是否全天：${draft.allDay ? "是" : "否"}`);
    }
    if (draft.meetingRoom) {
      lines.push(`会议室：${draft.meetingRoom}`);
    }
    if (draft.videoMeetingCode) {
      lines.push(`视频会议号：${draft.videoMeetingCode}`);
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

  function buildSelectionPrompt(
    draft: CreateCalendarDraft,
    candidate: PersonLookupCandidate,
  ): string {
    const nextDraft: CreateCalendarDraft = {
      ...draft,
      attendeeNameQueries:
        candidate.role === "attendee"
          ? (draft.attendeeNameQueries ?? []).filter((name) => name !== candidate.sourceName)
          : draft.attendeeNameQueries,
      ccNameQueries:
        candidate.role === "cc"
          ? (draft.ccNameQueries ?? []).filter((name) => name !== candidate.sourceName)
          : draft.ccNameQueries,
      selectedAttendeeNames:
        candidate.role === "attendee"
          ? [...(draft.selectedAttendeeNames ?? []), candidate.name]
          : draft.selectedAttendeeNames,
      selectedAttendeeIds:
        candidate.role === "attendee"
          ? [...(draft.selectedAttendeeIds ?? []), candidate.id]
          : draft.selectedAttendeeIds,
      selectedCcNames:
        candidate.role === "cc"
          ? [...(draft.selectedCcNames ?? []), candidate.name]
          : draft.selectedCcNames,
      selectedCcIds:
        candidate.role === "cc"
          ? [...(draft.selectedCcIds ?? []), candidate.id]
          : draft.selectedCcIds,
    };

    return buildCreatePrompt(nextDraft);
  }

  async function handleApplyDraft(messageId: string): Promise<void> {
    const sourceMessage = messagesRef.current.find((message) => message.id === messageId);
    const draft = sourceMessage?.meta?.draft;
    if (!draft) {
      return;
    }

    await submitUserContent(buildCreatePrompt(draft));
  }

  async function handleSelectCandidate(detail: {
    candidateId: string;
    role: "attendee" | "cc";
    sourceName: string;
  }): Promise<void> {
    const sourceMessage = [...messagesRef.current]
      .reverse()
      .find((message) =>
        message.meta?.personCandidates?.some(
          (candidate) =>
            candidate.id === detail.candidateId &&
            candidate.role === detail.role &&
            candidate.sourceName === detail.sourceName,
        ),
      );

    const candidate = sourceMessage?.meta?.personCandidates?.find(
      (item) =>
        item.id === detail.candidateId &&
        item.role === detail.role &&
        item.sourceName === detail.sourceName,
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

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    void submitUserContent(input.trim());
  }

  function handleVoiceInput(): void {
    const SpeechRecognition =
      (window as Window & {
        SpeechRecognition?: SpeechRecognitionCtor;
        webkitSpeechRecognition?: SpeechRecognitionCtor;
      }).SpeechRecognition ??
      (window as Window & {
        webkitSpeechRecognition?: SpeechRecognitionCtor;
      }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      window.alert("当前浏览器不支持语音识别，请改用文本输入。");
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .flatMap((result) => Array.from(result))
        .map((item) => item.transcript)
        .join("");
      setInput((current) => `${current}${current ? "\n" : ""}${transcript}`.trim());
    };
    recognition.onerror = () => {
      setIsRecording(false);
    };
    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    setIsRecording(true);
    recognition.start();
  }

  return (
    <div className="min-h-screen px-4 py-4 text-[var(--text)] md:px-6 md:py-5 lg:px-8">
      <main className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-6xl flex-col overflow-hidden rounded-[32px] border border-[var(--line)] bg-[var(--panel-strong)] shadow-[0_24px_70px_rgba(36,41,51,0.08)] md:min-h-[calc(100vh-2.5rem)]">
        <div className="border-b border-[var(--line)] px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-4 py-2 text-sm text-[var(--muted)]">
              {settings.enabled && settings.baseUrl
                ? `Model Gateway: ${settings.model}`
                : "Model Gateway: mock runtime"}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {suggestionPrompts.map((prompt) => (
              <button
                className="text-left rounded-full border border-[var(--line)] bg-[var(--bg)] px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--hint)] hover:bg-[rgba(39,154,255,0.08)] hover:text-[var(--brand)]"
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
                    onApplyDraft={() => {
                      void handleApplyDraft(message.id);
                    }}
                    onSelectCandidate={(detail) => {
                      void handleSelectCandidate(detail);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <form className="border-t border-[var(--line)] bg-[var(--bg)] p-4 md:p-6" onSubmit={handleSubmit}>
          <div className="mx-auto max-w-4xl">
            <div className="flex items-center gap-3 rounded-[28px] border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 shadow-[0_10px_24px_rgba(36,41,51,0.04)] transition focus-within:border-[var(--brand)] focus-within:shadow-[0_0_0_4px_rgba(39,154,255,0.12)]">
              <button
                aria-label={isRecording ? "停止语音输入" : "开始语音输入"}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition ${
                  isRecording
                    ? "border-[var(--success)] bg-[rgba(6,198,135,0.12)] text-[var(--success)]"
                    : "border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] hover:border-[var(--hint)] hover:text-[var(--brand)]"
                }`}
                onClick={handleVoiceInput}
                type="button"
              >
                <svg
                  aria-hidden="true"
                  fill="none"
                  height="18"
                  viewBox="0 0 24 24"
                  width="18"
                >
                  <path
                    d="M12 3a3 3 0 0 1 3 3v6a3 3 0 1 1-6 0V6a3 3 0 0 1 3-3Z"
                    fill="currentColor"
                  />
                  <path
                    d="M5 11a1 1 0 1 1 2 0 5 5 0 1 0 10 0 1 1 0 1 1 2 0 7.01 7.01 0 0 1-6 6.93V21h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-3.07A7.01 7.01 0 0 1 5 11Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
              <textarea
                className="h-[44px] flex-1 resize-none bg-transparent px-2 py-[10px] text-[15px] leading-6 text-[var(--text)] outline-none placeholder:text-[var(--subtle)]"
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder={"创建一个新的日程"}
                ref={textareaRef}
                rows={1}
                value={input}
              />
              <button
                aria-label="发送消息"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-white shadow-[0_10px_24px_rgba(27,85,255,0.2)] transition hover:bg-[var(--brand-deep)] disabled:cursor-not-allowed disabled:bg-[var(--subtle)] disabled:shadow-none disabled:opacity-80"
                disabled={!canSubmit}
                type="submit"
              >
                <svg
                  aria-hidden="true"
                  fill="none"
                  height="18"
                  viewBox="0 0 24 24"
                  width="18"
                >
                  <path
                    d="M4 12 19 5l-3 7 3 7-15-7Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between px-1 text-xs text-[var(--subtle)]">
              <span>{isRecording ? "语音输入中..." : "支持文本输入与浏览器语音输入"}</span>
              <span>{isSubmitting ? "处理中..." : "Enter 发送，Shift+Enter 换行"}</span>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
