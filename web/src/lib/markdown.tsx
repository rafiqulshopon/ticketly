import { type ReactNode } from "react";

/**
 * Render a string with lightweight INLINE markdown as React nodes, so any surface
 * can drop it into its own element/className (the summary paragraph, a message
 * bubble, …). Currently handles **bold** only — the model labels lines like
 * "**Issue:**" and agents may emphasise text the same way. Extend THIS function
 * to add more inline syntax (italics, inline code, links) rather than
 * re-implementing parsing per component.
 *
 * React escapes every string part, so the source text can never inject markup.
 * Splitting on a capturing group interleaves the bold content at odd indices; the
 * surrounding element should keep `whitespace-pre-wrap` so the text's own line
 * breaks are preserved. `strongClassName` defaults to a weight-only bold so the
 * emphasis inherits the surrounding text colour (correct inside both the agent
 * and customer bubbles); override it where a colour pop is wanted (the summary).
 */
export function renderInlineMarkdown(text: string, strongClassName = "font-semibold"): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className={strongClassName}>
        {part}
      </strong>
    ) : (
      part
    ),
  );
}
