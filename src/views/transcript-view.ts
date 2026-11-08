import { playbackStore } from "../app/playback-store";
import { findSpanAtFrame } from "../model/playback";
import { escapeHtml } from "../ui/html";

export function highlightText(content: string, frame: number, showCursor = true) {
  const spanIndex = findSpanAtFrame(playbackStore.spans, frame);
  const span = spanIndex >= 0 ? playbackStore.spans[spanIndex] : undefined;
  if (!span || !showCursor) return escapeHtml(content);
  const before = content.slice(0, span.startText);
  const word = content.slice(span.startText, span.endText);
  const after = content.slice(span.endText);
  return `${escapeHtml(before)}<mark class="current-char">${escapeHtml(word)}</mark>${escapeHtml(after)}`;
}
