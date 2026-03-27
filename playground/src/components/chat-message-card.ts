import { css, html, LitElement, nothing } from "lit";
import { ChatCardMeta } from "../types/chat";

export class ChatMessageCardElement extends LitElement {
  static properties = {
    role: { type: String },
    content: { type: String },
    meta: { attribute: false },
    createdAt: { type: String },
    isStreaming: { type: Boolean },
  };

  declare role: "user" | "assistant" | "system";
  declare content: string;
  declare meta?: ChatCardMeta;
  declare createdAt: string;
  declare isStreaming: boolean;

  constructor() {
    super();
    this.role = "assistant";
    this.content = "";
    this.createdAt = "";
    this.isStreaming = false;
  }

  static styles = css`
    :host {
      display: block;
    }

    article {
      border-radius: 22px;
      border: 1px solid var(--line);
      padding: 16px 18px;
      background: var(--panel-strong);
      color: var(--text);
      box-shadow: 0 12px 34px rgba(36, 41, 51, 0.06);
    }

    article.user {
      background: linear-gradient(135deg, var(--brand), var(--brand-deep));
      color: #ffffff;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 10px;
      font-size: 12px;
      opacity: 0.8;
    }

    .role {
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .content {
      margin: 0;
      white-space: pre-wrap;
      line-height: 1.6;
      font-size: 14px;
    }

    .cursor {
      display: inline-block;
      width: 0.7ch;
      margin-left: 2px;
      animation: blink 1s steps(1, end) infinite;
      color: var(--brand);
      font-weight: 700;
    }

    article.user .cursor {
      color: #ffffff;
    }

    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }

    .candidate-grid {
      display: grid;
      gap: 10px;
      margin-top: 14px;
    }

    .recommendation {
      margin-top: 14px;
      border-radius: 18px;
      border: 1px solid rgba(39, 154, 255, 0.18);
      background: rgba(39, 154, 255, 0.06);
      padding: 14px;
    }

    .recommendation-title {
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .recommendation-list {
      display: grid;
      gap: 6px;
      font-size: 12px;
      color: var(--muted);
      line-height: 1.5;
    }

    .recommendation-action {
      margin-top: 12px;
      border-radius: 999px;
      border: 1px solid var(--brand);
      background: var(--brand);
      color: #ffffff;
      padding: 8px 14px;
      font-size: 12px;
      cursor: pointer;
    }

    .candidate-card {
      border-radius: 18px;
      border: 1px solid var(--line);
      background: var(--bg);
      padding: 12px 14px;
      text-align: left;
      cursor: pointer;
      transition: border-color 0.2s ease, transform 0.2s ease;
    }

    .candidate-card:hover {
      border-color: var(--hint);
      transform: translateY(-1px);
    }

    .candidate-name {
      font-size: 14px;
      font-weight: 700;
    }

    .candidate-sub {
      margin-top: 4px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.5;
    }

    .badge {
      border-radius: 999px;
      padding: 5px 9px;
      font-size: 11px;
      border: 1px solid var(--line);
      background: var(--bg);
      color: var(--subtle);
    }

    article.user .badge {
      border-color: rgba(255, 255, 255, 0.2);
      background: rgba(255, 255, 255, 0.12);
      color: inherit;
    }

    @keyframes blink {
      0%,
      49% {
        opacity: 1;
      }

      50%,
      100% {
        opacity: 0;
      }
    }
  `;

  render() {
    return html`
      <article class=${this.role}>
        <header>
          <span class="role">${this.role}</span>
          <span>${this.createdAt}</span>
        </header>
        <p class="content">
          ${this.content}${this.isStreaming ? html`<span class="cursor">|</span>` : nothing}
        </p>
        ${this.meta
          ? html`
              <div class="meta">
                <span class="badge">route ${this.meta.route}</span>
                ${this.meta.target
                  ? html`<span class="badge">${this.meta.target}</span>`
                  : nothing}
                <span class="badge">confidence ${Math.round(this.meta.confidence * 100)}%</span>
                <span class="badge">${this.meta.latencyMs}ms</span>
                ${this.meta.requiresConfirm
                  ? html`<span class="badge">requires confirm</span>`
                  : nothing}
              </div>
              ${this.meta.personCandidates && this.meta.personCandidates.length > 0
                ? html`
                    <div class="candidate-grid">
                      ${this.meta.personCandidates.map(
                        (candidate) => html`
                          <button
                            class="candidate-card"
                            @click=${() =>
                              this.dispatchEvent(
                                new CustomEvent("person-select", {
                                  detail: {
                                    candidateId: candidate.id,
                                    role: candidate.role,
                                    sourceName: candidate.sourceName,
                                  },
                                  bubbles: true,
                                  composed: true,
                                }),
                              )}
                            type="button"
                          >
                            <div class="candidate-name">${candidate.name}</div>
                            <div class="candidate-sub">
                              ${candidate.role === "attendee" ? "参会人" : "抄送人"} · ${candidate.sourceName}
                            </div>
                            <div class="candidate-sub">
                              ${candidate.department} · ${candidate.title}
                            </div>
                            <div class="candidate-sub">${candidate.email}</div>
                          </button>
                        `,
                      )}
                    </div>
                  `
                : nothing}
              ${this.meta.recommendation
                ? html`
                    <section class="recommendation">
                      <div class="recommendation-title">新增日程推荐填充</div>
                      <div class="recommendation-list">
                        <div>${this.meta.recommendation.summary}</div>
                        <div>来源待办：${this.meta.recommendation.sourceTodoTitle}</div>
                        ${this.meta.recommendation.recommendedFields.map(
                          (field) => html`
                            <div>
                              ${field.fieldLabel}：${field.value}
                              （${field.source === "recent_todo" ? "近期待办" : "最近日程"}）
                            </div>
                          `,
                        )}
                      </div>
                      <button
                        class="recommendation-action"
                        @click=${() =>
                          this.dispatchEvent(
                            new CustomEvent("draft-apply", {
                              bubbles: true,
                              composed: true,
                            }),
                          )}
                        type="button"
                      >
                        采纳推荐填充
                      </button>
                    </section>
                  `
                : nothing}
            `
          : nothing}
      </article>
    `;
  }
}

if (!customElements.get("chat-message-card")) {
  customElements.define("chat-message-card", ChatMessageCardElement);
}
