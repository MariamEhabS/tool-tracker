import DOMPurify, { type Config } from "dompurify";

/**
 * DOMPurify configuration for sanitizing HTML content.
 * Only allows safe formatting tags and attributes commonly found
 * in rich text content from the Procore API.
 */
const PURIFY_CONFIG: Config = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "a",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "code",
    "pre",
    "span",
    "div",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
  ],
  ALLOWED_ATTR: ["href", "target", "rel", "class", "style"],
  ALLOW_DATA_ATTR: false,
};

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Uses DOMPurify with a restrictive allowlist of safe tags and attributes.
 *
 * @param html - The HTML string to sanitize (accepts null/undefined)
 * @returns Sanitized HTML string safe for rendering
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return "";

  const sanitized = DOMPurify.sanitize(html, PURIFY_CONFIG);

  // Defense-in-depth: with happy-dom, orphaned void tags like <input> and
  // <embed> can survive when wrapped by disallowed parents.
  return sanitized
    .replace(/<input\b[^>]*>/gi, "")
    .replace(/<embed\b[^>]*>/gi, "")
    .replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, "")
    .replace(/<\/?form\b[^>]*>/gi, "");
}

/**
 * Sanitize HTML and return an object suitable for React's dangerouslySetInnerHTML prop.
 *
 * @param html - The HTML string to sanitize (accepts null/undefined)
 * @returns Object with __html property containing sanitized HTML
 *
 * @example
 * ```tsx
 * <div dangerouslySetInnerHTML={createSafeHtml(answer.rich_text_body)} />
 * ```
 */
export function createSafeHtml(html: string | null | undefined): {
  __html: string;
} {
  return { __html: sanitizeHtml(html) };
}
