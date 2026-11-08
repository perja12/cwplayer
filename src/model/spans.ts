import type { TextSpan } from "./types";

/** A transcript span as emitted by the engine: UTF-8 byte offsets plus frames. */
export type ByteFrameSpan = {
  startByte: number;
  endByte: number;
  startFrame: number;
  endFrame: number;
};

/**
 * The engine reports UTF-8 byte offsets. JavaScript strings and the DOM use
 * UTF-16 code-unit offsets, so every span must be translated before it can be
 * used for slicing or highlighting.
 */
export function decodeByteSpans(content: string, spans: ByteFrameSpan[]): TextSpan[] {
  const byteToUtf16 = new Map<number, number>();
  let byte = 0;
  let utf16 = 0;
  for (const character of content) {
    byteToUtf16.set(byte, utf16);
    const point = character.codePointAt(0)!;
    byte += point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
    utf16 += character.length;
  }
  byteToUtf16.set(byte, utf16);

  return spans.map((span) => ({
    startText: byteToUtf16.get(span.startByte) ?? 0,
    endText: byteToUtf16.get(span.endByte) ?? 0,
    startFrame: span.startFrame,
    endFrame: span.endFrame,
  }));
}
