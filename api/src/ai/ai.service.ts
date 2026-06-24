import { Injectable } from "@nestjs/common";
import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { ticketCategoryEnum, type TicketCategory, type TicketDetail } from "@ticketly/shared";

/** Maximum number of prior messages fed to the model as context. Keeps the
 *  prompt (and token cost) bounded for long threads. */
const MAX_CONTEXT_MESSAGES = 6;

/**
 * Server-side AI calls through the Vercel AI SDK, against any OpenAI-compatible
 * chat endpoint. classify + summarize are implemented here; the planned
 * RAG-grounded draft step will grow here too.
 *
 * Everything about the model is env-driven and provider-neutral (`AI_API_KEY`,
 * `AI_BASE_URL`, `AI_MODEL`) so the provider/model can be swapped — to OpenAI,
 * another GLM tier, etc. — by editing env alone, with no code change. Defaults
 * are the current provider (Zhipu GLM) so it works out of the box. Values are
 * read in the constructor rather than at import time: Nest instantiates
 * providers after the module graph is wired, by which point the first line of
 * `main.ts` (`import "dotenv/config"`) has already populated `process.env` — the
 * same ordering that makes `auth.config.ts` work. Reading here also means a
 * missing/misconfigured key only fails when a method actually calls the model,
 * not at boot.
 */
@Injectable()
export class AiService {
  // `name` is a neutral label used only in AI SDK metadata/error output — it does
  // NOT select the endpoint, so it stays provider-agnostic.
  private readonly provider = createOpenAICompatible({
    name: "llm",
    baseURL: process.env.AI_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4",
    apiKey: process.env.AI_API_KEY ?? "",
  });
  private readonly model = process.env.AI_MODEL ?? "glm-4.7-flash";

  /**
   * Classify a ticket into one of the four categories from its subject + first
   * message body. Returns the category, or null when the model's reply isn't a
   * valid category — the caller then leaves the ticket uncategorized (null)
   * rather than guessing. Built for high volume: a Flash-tier model and a capped
   * body keep each call cheap. Provider/network errors throw and are handled by
   * the caller (the non-blocking trigger in TicketsService).
   */
  async classifyTicket(subject: string, body: string): Promise<TicketCategory | null> {
    const system = [
      "You classify customer support tickets into exactly ONE category.",
      "GENERAL_QUESTION — general inquiries or account/help questions that are not technical and not about money.",
      "TECHNICAL_QUESTION — bugs, errors, login/access problems, or how-to/technical issues with the product.",
      "REFUND_REQUEST — refunds, billing disputes, duplicate charges, cancellations, or credits.",
      "SPAM — spam, promotional junk, phishing, or anything unrelated to a real support need.",
      "Decide from the subject and the message body. If two seem to fit, pick the more specific one; if none truly fits, prefer GENERAL_QUESTION.",
      "Reply with ONLY the category name — one of: GENERAL_QUESTION, TECHNICAL_QUESTION, REFUND_REQUEST, SPAM. No punctuation, no explanation.",
    ].join(" ");

    const { text } = await generateText({
      model: this.provider(this.model),
      system,
      // The subject + the start of the body is enough to categorize; cap the body
      // to keep the prompt (and per-ticket cost) small at volume.
      prompt: `Subject: ${subject}\n\nMessage:\n${body.slice(0, 2000)}`,
    });

    const cleaned = text.trim().replace(/^["'\s.]+|["'\s.]+$/g, "").toUpperCase();
    return (ticketCategoryEnum.options as readonly string[]).includes(cleaned)
      ? (cleaned as TicketCategory)
      : null;
  }

  /**
   * Improve a drafted agent reply, informed by the ticket's conversation.
   * Returns the polished plain-text body for the agent to review before sending —
   * this method persists nothing. The prompt is written to raise tone/clarity/
   * empathy while strictly preserving the facts already in the draft (names,
   * dates, commitments) and forbidding invention, so it edits the agent's words
   * rather than answering the ticket itself. On the FIRST agent reply in a thread
   * the body is wrapped with a greeting and a sign-off (agent name + Ticketly);
   * later replies return the polished body alone.
   */
  async polishReply(draft: string, ticket: TicketDetail, agentName: string): Promise<string> {
    const system = [
      "You help a support agent write better replies to a customer.",
      "Rewrite the agent's DRAFT reply to be professional, clear, concise, and empathetic.",
      "Fix grammar, spelling, tone, and flow.",
      "Preserve EVERY fact, name, date, amount, and commitment in the draft — do not remove or alter them.",
      "Do NOT invent information, apologies, deadlines, refunds, or promises that are not already in the draft.",
      "Keep it as a reply from the agent to the customer; do not answer the ticket yourself.",
      "Reply in the same language the conversation is written in.",
      "Output ONLY the improved reply body — no greeting, no preamble, no explanation, no quotation marks, no markdown headings, and no sign-off or signature (these are added automatically where appropriate).",
    ].join(" ");

    const { text } = await generateText({
      model: this.provider(this.model),
      system,
      prompt: [
        `Ticket subject: ${ticket.subject}`,
        `Customer: ${ticket.requesterName}`,
        "",
        "Conversation so far:",
        this.buildTranscript(ticket),
        "",
        "Agent's DRAFT reply to polish:",
        '"""',
        draft,
        '"""',
      ].join("\n"),
    });

    // Only the FIRST agent reply on a thread is wrapped with a greeting + sign-off;
    // later replies are the polished body alone, so a long conversation isn't
    // littered with repeated envelopes. The agent still controls raw vs. polished
    // per reply (this only shapes the polished output).
    const body = text.trim();
    const isFirstReply = !ticket.messages.some((m) => m.senderType === "agent");
    return isFirstReply ? `${this.greeting(ticket)}${body}${this.signature(agentName)}` : body;
  }

  /**
   * Summarize a ticket and its conversation for a support agent — a concise digest
   * of what the customer needs, what's happened so far, the current state, and any
   * open questions / next steps. Returns plain text and persists nothing. Unlike
   * `polishReply` (which only feeds the last few messages to bound the prompt), a
   * summary is only useful with the full thread, so the entire conversation is
   * included; a very long thread is bounded only by the model's context window.
   */
  async summarizeTicket(ticket: TicketDetail): Promise<string> {
    const system = [
      "You summarize customer support conversations for a support agent who needs a quick digest.",
      "Capture the customer's issue, what has happened in the conversation, the current state, and any open questions or next steps.",
      "Base the summary ONLY on information present in the conversation — do not invent facts, dates, names, amounts, or commitments.",
      "Include specific details the customer shared when they matter (order numbers, error messages, dates, amounts).",
      "Be concise and scannable: a one-line overview, then a few short bullet points.",
      "Reply in the same language the conversation is written in.",
      "Output ONLY the summary — no preamble, no headings, no quotation marks.",
    ].join(" ");

    const { text } = await generateText({
      model: this.provider(this.model),
      system,
      prompt: [
        `Ticket subject: ${ticket.subject}`,
        `Customer: ${ticket.requesterName} (${ticket.requesterEmail})`,
        `Status: ${ticket.status}`,
        ...(ticket.category ? [`Category: ${ticket.category}`] : []),
        `Priority: ${ticket.priority}`,
        "",
        "Full conversation (oldest first):",
        this.buildFullTranscript(ticket),
      ].join("\n"),
    });

    return text.trim();
  }

  /** Greeting prepended to the first agent reply only. Deterministic (the model is
   *  told not to add one) so it never duplicates. Uses the ticket's requester. */
  private greeting(ticket: TicketDetail): string {
    return `Hello ${ticket.requesterName},\n\n`;
  }

  /** Sign-off appended to the first agent reply only — the model is told not to
   *  add one, so it never duplicates. Includes the agent's name and the product
   *  name (Ticketly). */
  private signature(agentName: string): string {
    const name = agentName.trim();
    const lines = ["", "", "Best regards,", ...(name ? [name] : []), "Ticketly"];
    return lines.join("\n");
  }

  /** Compact role-labelled transcript of the last few messages for the prompt. */
  private buildTranscript(ticket: TicketDetail): string {
    const recent = ticket.messages.slice(-MAX_CONTEXT_MESSAGES);
    if (recent.length === 0) return "(no prior messages)";
    return recent
      .map((m) => `${m.senderType === "customer" ? "Customer" : "Agent"}: ${m.bodyText}`)
      .join("\n\n");
  }

  /** Role-labelled transcript of the ENTIRE conversation, oldest first. Used for
   *  summarization, which needs full context — unlike `buildTranscript`'s bounded
   *  slice (a summary that drops the start of a thread misses the original issue). */
  private buildFullTranscript(ticket: TicketDetail): string {
    if (ticket.messages.length === 0) return "(no messages)";
    return ticket.messages
      .map((m) => `${m.senderType === "customer" ? "Customer" : "Agent"}: ${m.bodyText}`)
      .join("\n\n");
  }
}
