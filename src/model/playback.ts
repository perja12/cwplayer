import type { PlaybackState, TextSpan } from "./types";

export type TransportAction = "pause" | "resume" | "start";

/** Which transport operation the toggle button should trigger next. */
export function transportAction(state: PlaybackState): TransportAction {
  if (state === "playing") return "pause";
  if (state === "paused") return "resume";
  return "start";
}

export function isSelectionPlaybackAllowed(state: PlaybackState) {
  return state === "idle" || state === "paused" || state === "ended";
}

export function findSpanAtFrame(spans: TextSpan[], frame: number) {
  let low = 0;
  let high = spans.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (spans[mid].endFrame <= frame) low = mid + 1;
    else high = mid;
  }
  return low < spans.length && spans[low].startFrame <= frame ? low : -1;
}

/**
 * Text offset used when the listener asks to mark a word. Inside a span it is
 * the span start; in a Morse gap it falls back to the previous span so the
 * button still marks the word that was just heard.
 */
export function textPositionAtFrame(spans: TextSpan[], frame: number) {
  const active = spans.find((span) => frame >= span.startFrame && frame < span.endFrame);
  if (active) return active.startText;
  const ended = spans.filter((span) => span.endFrame <= frame).at(-1);
  return ended?.startText ?? 0;
}

/** Index of the next queued text that still exists, or -1 at the end. */
export function nextPlayableQueueIndex(
  textIds: readonly string[],
  currentIndex: number,
  availableIds: readonly string[],
) {
  const available = new Set(availableIds);
  let nextIndex = currentIndex + 1;
  while (nextIndex < textIds.length && !available.has(textIds[nextIndex])) nextIndex++;
  return nextIndex >= textIds.length ? -1 : nextIndex;
}

/** Move by one or more chapters, or null when the target is out of range. */
export function stepQueueIndex(currentIndex: number, offset: number, length: number) {
  const nextIndex = currentIndex + offset;
  return nextIndex >= 0 && nextIndex < length ? nextIndex : null;
}

/** Listening time represented by a frame-range delta. */
export function listeningSeconds(consumedFrames: number, lastLogFrame: number, sampleRate: number) {
  return Math.max(0, consumedFrames - lastLogFrame) / sampleRate;
}

/**
 * Character offsets are saved to storage because they survive changes to the
 * speed settings. The renderer uses UTF-8 byte offsets, so a saved position
 * must be converted when playback resumes.
 */
export function byteOffsetAt(content: string, characterOffset: number) {
  const offset = Math.max(0, Math.min(characterOffset, content.length));
  let bytes = 0;
  let index = 0;
  for (const character of content) {
    if (index >= offset) break;
    const point = character.codePointAt(0)!;
    bytes += point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
    index += character.length;
  }
  return bytes;
}
