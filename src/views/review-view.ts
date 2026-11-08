import { appStore, currentItem } from "../app/app-store";
import { previewStore } from "../app/preview-store";
import { WORD_FREQUENCY_LIMIT } from "../model/defaults";
import { wordFrequencies, type WordFrequency } from "../model/text";
import type { Mark } from "../model/types";
import { icon } from "../ui/icons";
import { escapeHtml } from "../ui/html";
import { renderPracticeExcerpt } from "./practice-excerpt-view";

function renderFrequencyItem(entry: WordFrequency) {
  const playing = previewStore.word?.toLowerCase() === entry.word;
  const action = playing ? "Stop" : "Play";
  const label = `${action} ${entry.word}`;
  return `<div class="frequency-item${playing ? " playing" : ""}"><button class="icon-button word-play${playing ? " playing" : ""}" data-word-play="${escapeHtml(entry.word)}" aria-label="${label}" aria-pressed="${playing}" title="${label}">${icon(playing ? "stop" : "play")}</button><span class="frequency-word">${escapeHtml(entry.word)}</span><strong class="frequency-count">${entry.count}</strong></div>`;
}

function plainExcerpt(excerpt: string) {
  return excerpt.replace(/\[\[|\]\]/g, "");
}

function renderRecognizedItem(mark: Mark) {
  const phrase = previewStore.phrase;
  const playing = phrase?.id === mark.id && phrase.playing;
  const action = playing ? "Stop" : "Play";
  const label = `${action} sentence for ${mark.word}`;
  return `<article class="review-item${playing ? " playing" : ""}"><button class="icon-button sentence-play${playing ? " playing" : ""}" data-phrase-play="${escapeHtml(mark.id)}" data-phrase-text="${escapeHtml(plainExcerpt(mark.excerpt))}" aria-label="${escapeHtml(label)}" aria-pressed="${playing}" title="${escapeHtml(label)}">${icon(playing ? "stop" : "play")}</button><div class="review-item-body"><p>${renderPracticeExcerpt(mark.excerpt, mark.characterOffset)}</p><span>${new Date(mark.date).toLocaleDateString()} · ${escapeHtml(appStore.texts.find((text) => text.id === mark.itemId)?.title ?? "Text removed")}</span></div></article>`;
}

export function renderReview() {
  const list = [...appStore.marks].reverse();
  const selected =
    appStore.texts.find((text) => text.id === appStore.frequencyTextId) ?? currentItem();
  const frequencies = selected ? wordFrequencies(selected.content) : [];
  const shown = frequencies.slice(0, WORD_FREQUENCY_LIMIT);
  const frequencyCard = selected
    ? `<section class="frequency-card"><div class="frequency-heading"><div><h2>Word frequency</h2><p>${escapeHtml(selected.title)} · ${shown.length}${frequencies.length > shown.length ? ` of ${frequencies.length}` : ""} words</p></div><label>Text<select data-frequency-text>${appStore.texts.map((text) => `<option value="${text.id}" ${text.id === selected.id ? "selected" : ""}>${escapeHtml(text.title)}</option>`).join("")}</select></label></div><div class="frequency-list" data-scroll-key="frequency-list">${shown.length ? shown.map(renderFrequencyItem).join("") : `<p class="frequency-empty">There are no words in this text yet.</p>`}</div></section>`
    : "";
  const recognizedCard = `<section class="recognized-card"><div class="recognized-heading"><div><h2>Recognized words</h2><p>${list.length ? `${list.length} ${list.length === 1 ? "word" : "words"} marked while listening` : "Nothing marked yet"}</p></div><button class="secondary compact" data-clear-marks ${list.length ? "" : "disabled"}>Clear</button></div><div class="review-list" data-scroll-key="recognized-list">${list.length ? list.map(renderRecognizedItem).join("") : `<div class="empty-state"><h2>No recognized words yet</h2><p>Tap Word recognized while listening to mark a word.</p></div>`}</div></section>`;
  return `<header class="page-heading"><div><p class="eyebrow">YOUR PRACTICE</p><h1>Practice Review</h1><p class="subheading">Words you marked while listening.</p></div></header><div class="review-layout">${frequencyCard}${recognizedCard}</div>`;
}
