/**
 * formatters.js
 * Small helpers for the chatbot UI.
 */

/** Format a Date object as HH:MM AM/PM */
export function formatTime(date) {
  if (!date) return ''
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * Lightweight markdown → HTML renderer for chat messages.
 * Handles: **bold**, *italic*, `code`, bullet lists, numbered lists, line breaks.
 */
export function renderMarkdown(text) {
  if (!text) return ''

  let html = text
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    // Numbered list items
    .replace(/^\d+\.\s(.+)$/gm, '<li class="list-item">$1</li>')
    // Bullet list items (-, *, •)
    .replace(/^[-*•]\s(.+)$/gm, '<li class="list-item bullet">$1</li>')
    // Headings (## and ###)
    .replace(/^###\s(.+)$/gm, '<h4 class="md-h4">$1</h4>')
    .replace(/^##\s(.+)$/gm, '<h3 class="md-h3">$1</h3>')

  // Wrap consecutive <li> items in a <ul>
  html = html.replace(/(<li class="list-item[^>]*>.*?<\/li>\n?)+/gs, match => `<ul class="md-list">${match}</ul>`)

  // Line breaks (double newline = paragraph break, single = <br>)
  html = html
    .replace(/\n\n/g, '</p><p class="md-p">')
    .replace(/\n/g, '<br />')

  // Wrap in a paragraph if it doesn't already start with a block element
  if (!html.startsWith('<')) {
    html = `<p class="md-p">${html}</p>`
  }

  return html
}
