import { appStore } from "../app/app-store";
import { playbackStore } from "../app/playback-store";
import { formatTime } from "../model/format";
import { estimateSeconds } from "../model/text";
import type { TextItem } from "../model/types";
import { icon } from "../ui/icons";
import { escapeHtml } from "../ui/html";

const itemRow = (item: TextItem, chapter = false) => {
  const playing = playbackStore.state === "playing" && appStore.activeTextId === item.id;
  return `<article class="text-row ${chapter ? "chapter-row" : ""}" draggable="true" data-text-row="${item.id}"><div class="text-meta"><strong>${escapeHtml(item.title)}</strong><div class="tags">${item.labels.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}</div></div><span class="duration">${formatTime(estimateSeconds(item.content, appStore.settings.wpm))}</span><button class="icon-button play-row play-circle" data-play="${item.id}" aria-label="${playing ? "Pause" : "Play"} ${escapeHtml(item.title)}">${icon(playing ? "pauseCircle" : "playCircle")}</button><button class="icon-button row-menu" data-edit="${item.id}" aria-label="Edit ${escapeHtml(item.title)}">${icon("more")}</button></article>`;
};

export function renderLibrary() {
  const collectionItems = new Set(appStore.collections.flatMap((collection) => collection.itemIds));
  const standalone = appStore.texts.filter((item) => !collectionItems.has(item.id));
  const collectionRows = appStore.collections
    .map((collection) => {
      const playing =
        playbackStore.state === "playing" && appStore.playbackQueue?.collectionId === collection.id;
      const playable = collection.itemIds.some((id) =>
        appStore.texts.some((item) => item.id === id),
      );
      return `<section class="collection-block" data-collection="${collection.id}"><div class="collection-row" data-toggle-collection="${collection.id}" data-drop="${collection.id}"><button class="icon-button expand-collection" data-expand="${collection.id}" aria-label="${appStore.expandedCollections.has(collection.id) ? "Collapse" : "Expand"} ${escapeHtml(collection.title)}">${icon(appStore.expandedCollections.has(collection.id) ? "expandMore" : "chevronRight")}</button><strong>${escapeHtml(collection.title)}</strong><span>${collection.itemIds.length} ${collection.itemIds.length === 1 ? "text" : "texts"}</span><button class="icon-button play-collection play-circle" data-play-collection="${collection.id}" aria-label="${playing ? "Pause" : "Play"} collection" ${playable ? "" : "disabled"}>${icon(playing ? "pauseCircle" : "playCircle")}</button><button class="icon-button" data-collection-edit="${collection.id}" aria-label="Edit collection">${icon("more")}</button></div>${
        appStore.expandedCollections.has(collection.id)
          ? collection.itemIds
              .map((id) => appStore.texts.find((item) => item.id === id))
              .filter((item): item is TextItem => !!item)
              .map((item) => itemRow(item, true))
              .join("") ||
            `<p class="empty-collection">Add texts using the text menu or drag them here.</p>`
          : ""
      }</section>`;
    })
    .join("");
  return `<header class="page-heading"><div><p class="eyebrow">YOUR LISTENING SHELF</p><h1>Library</h1></div><div class="heading-actions"><button class="secondary" data-create-collection>New collection</button><button class="primary" data-add-text>${icon("add")} Add text</button></div></header><p class="library-summary">${appStore.collections.length} ${appStore.collections.length === 1 ? "collection" : "collections"} · ${standalone.length} standalone ${standalone.length === 1 ? "text" : "texts"}</p><section class="library-list" aria-label="Saved texts">${collectionRows}${standalone.map((item) => itemRow(item)).join("") || `<p class="empty-library">Your library is empty. Add a text to get started.</p>`}</section>`;
}
