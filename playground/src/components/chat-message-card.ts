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
      border: 1px solid rgba(112, 90, 61, 0.16);
      padding: 16px 18px;
      background: rgba(255, 251, 245, 0.86);
      color: #2f2418;
      box-shadow: 0 12px 34px rgba(92, 62, 23, 0.08);
    }

    article.user {
      background: linear-gradient(135deg, rgba(164, 75, 26, 0.96), rgba(126, 52, 16, 0.96));
      color: #fff6eb;
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
      color: #a44b1a;
      font-weight: 700;
    }

    article.user .cursor {
      color: #fff6eb;
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

    .candidate-card {
      border-radius: 18px;
      border: 1px solid rgba(112, 90, 61, 0.16);
      background: rgba(250, 242, 227, 0.92);
      padding: 12px 14px;
      text-align: left;
      cursor: pointer;
      transition: border-color 0.2s ease, transform 0.2s ease;
    }

    .candidate-card:hover {
      border-color: #a44b1a;
      transform: translateY(-1px);
    }

    .candidate-name {
      font-size: 14px;
      font-weight: 700;
    }

    .candidate-sub {
      margin-top: 4px;
      color: #705a3d;
      font-size: 12px;
      line-height: 1.5;
    }

    .badge {
      border-radius: 999px;
      padding: 5px 9px;
      font-size: 11px;
      border: 1px solid rgba(112, 90, 61, 0.14);
      background: rgba(243, 232, 212, 0.8);
    }

    article.user .badge {
      border-color: rgba(255, 246, 235, 0.2);
      background: rgba(255, 246, 235, 0.12);
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
                                  },
                                  bubbles: true,
                                  composed: true,
                                }),
                              )}
                            type="button"
                          >
                            <div class="candidate-name">${candidate.name}</div>
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
            `
          : nothing}
      </article>
    `;
  }
}

if (!customElements.get("chat-message-card")) {
  customElements.define("chat-message-card", ChatMessageCardElement);
}
