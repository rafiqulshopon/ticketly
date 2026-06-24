import { Injectable } from "@nestjs/common";
import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { TicketDetail } from "@ticketly/shared";

/** Maximum number of prior messages fed to the model as context. Keeps the
 *  prompt (and token cost) bounded for long threads. */
const MAX_CONTEXT_MESSAGES = 6;

/**
 * Server-side AI calls through the Vercel AI SDK, against any OpenAI-compatible
 * chat endpoint. This is the first AI surface in the app; the planned classify /
 * summarize / RAG steps will grow here.
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
}
