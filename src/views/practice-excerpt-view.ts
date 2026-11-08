import { escapeHtml } from "../ui/html";

const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

export function renderPracticeExcerpt(excerpt: string, characterOffset?: number) {
  const start = excerpt.indexOf("[[");
  const end = excerpt.indexOf("]]", start + 2);
  if (start < 0 || end < 0) return escapeHtml(excerpt);
  const before = excerpt.slice(0, start);
  const anchor = excerpt.slice(start + 2, end);
  const after = excerpt.slice(end + 2);
  const previousWords = [...before.matchAll(WORD_PATTERN)].slice(-3);
  let cursor = 0;
  let result = "";
  for (let index = 0; index < previousWords.length; index++) {
    const match = previousWords[index];
    const wordIndex = match.index ?? 0;
    const fade = previousWords.length - index;
    result += `${escapeHtml(before.slice(cursor, wordIndex))}<mark class="mark-trail mark-trail-${fade}">${escapeHtml(match[0])}</mark>`;
    cursor = wordIndex + match[0].length;
  }
  result += escapeHtml(before.slice(cursor));
  const anchorCharacters = Array.from(anchor);
  if (characterOffset === undefined || anchorCharacters.length === 0) {
    result += `<mark class="mark-anchor">${escapeHtml(anchor)}</mark>`;
  } else {
    const currentIndex = Math.max(
      0,
      Math.min(anchorCharacters.length - 1, Math.trunc(characterOffset)),
    );
    result += `${currentIndex ? `<mark class="mark-char-trail">${escapeHtml(anchorCharacters.slice(0, currentIndex).join(""))}</mark>` : ""}<mark class="mark-anchor">${escapeHtml(anchorCharacters[currentIndex])}</mark>${escapeHtml(anchorCharacters.slice(currentIndex + 1).join(""))}`;
  }
  return `${result}${escapeHtml(after)}`;
}
