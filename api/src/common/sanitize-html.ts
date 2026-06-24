import DOMPurify from "isomorphic-dompurify";

/**
 * Strict email-HTML allowlist. DOMPurify's defaults already strip `<script>`,
 * `on*` event handlers, and `javascript:`/`vbscript:`/`data:` URIs; the
 * allowlist below additionally drops `style`/`class` and every tag or attribute
 * not explicitly listed (so `<iframe>`, `<form>`, `<svg>`, `<object>`,
 * `<embed>`, `<style>`, … are removed entirely). Email HTML is the highest-trust
 * external input we store, so an explicit allowlist is preferred over DOMPurify
 * with no config. Relying on DOMPurify's well-tested *default* URI handling
 * rather than a hand-rolled `ALLOWED_URI_REGEXP` (a custom regexp is the more
 * likely place to introduce a gap). When rich-text rendering lands later, the
 * stored HTML is already safe and bounded.
 */
const EMAIL_HTML_CONFIG = {
  ALLOWED_TAGS: [
    // structure & prose
    "p", "br", "hr", "div", "span", "blockquote", "pre",
    // headings
    "h1", "h2", "h3", "h4", "h5", "h6",
    // inline formatting
    "strong", "b", "em", "i", "u", "s", "del", "ins",
    "code", "small", "sub", "sup", "mark", "abbr", "cite", "q",
    // lists
    "ul", "ol", "li", "dl", "dt", "dd",
    // links & media
    "a", "img",
    // tables
    "table", "thead", "tbody", "tfoot", "tr", "td", "th",
  ],
  ALLOWED_ATTR: [
    "href", "src", "alt", "title", "width", "height",
    "colspan", "rowspan", "target", "rel", "start", "type",
  ],
};

/**
 * Sanitize untrusted email HTML for safe storage. Returns `null` when there is
 * no input or nothing survives sanitization, so the `bodyHtml` column stores
 * `NULL` rather than an empty string (matches the prior `bodyHtml ?? null`
 * semantics at the write site). Called at the single persistence chokepoint
 * (`TicketsService.create`) so the DB never holds malicious HTML, regardless of
 * which caller (manual `POST /tickets` or the inbound-email webhook) supplied it.
 */
export function sanitizeEmailHtml(
  html: string | null | undefined,
): string | null {
  if (!html) return null;
  const clean = DOMPurify.sanitize(html, EMAIL_HTML_CONFIG);
  const trimmed = clean.trim();
  return trimmed === "" ? null : trimmed;
}
