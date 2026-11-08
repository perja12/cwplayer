const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

export type WordFrequency = { word: string; count: number };
export type TextWord = { value: string; start: number; end: number };
export type MarkPosition = { word: string; excerpt: string; characterOffset: number };

export function wordFrequencies(content: string): WordFrequency[] {
  const counts = new Map<string, WordFrequency>();
  for (const match of content.matchAll(WORD_PATTERN)) {
    const word = match[0].toLowerCase();
    const entry = counts.get(word);
    if (entry) entry.count++;
    else counts.set(word, { word, count: 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

export function estimateSeconds(content: string, wpm: number) {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round((words * 60) / Math.max(5, wpm * 2)));
}

export function wordAtPosition(text: string, position: number): TextWord | null {
  const pattern = new RegExp(WORD_PATTERN.source, WORD_PATTERN.flags);
  let match: RegExpExecArray | null;
  let previous: TextWord | null = null;
  while ((match = pattern.exec(text))) {
    const found = { value: match[0], start: match.index, end: match.index + match[0].length };
    if (position >= found.start && position <= found.end) return found;
    if (found.start > position) break;
    previous = found;
  }
  return previous;
}

export function markFromPosition(content: string, position: number): MarkPosition | null {
  const word = wordAtPosition(content, position);
  if (!word) return null;
  const excerpt = content
    .slice(Math.max(0, word.start - 36), Math.min(content.length, word.end + 36))
    .replace(word.value, `[[${word.value}]]`)
    .replace(/\s+/g, " ");
  const characterOffset = Array.from(
    content.slice(word.start, Math.max(word.start, Math.min(position, word.end))),
  ).length;
  return { word: word.value, excerpt, characterOffset };
}
