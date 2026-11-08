import { appStore } from "../app/app-store";
import { playbackStore } from "../app/playback-store";
import { describeItem } from "../model/library";
import type { TextItem } from "../model/types";
import { coverArtwork } from "../ui/cover";
import { icon } from "../ui/icons";
import { escapeHtml } from "../ui/html";
import { highlightText } from "./transcript-view";

export function renderPlayer(item?: TextItem) {
  if (!item)
    return `<section class="empty-player"><h1>No text selected</h1><p>Add or select a text in your library to begin.</p><button class="primary" data-nav="library">Open Library</button></section>`;
  const highlighted = highlightText(
    item.content,
    playbackStore.consumedFrames,
    appStore.followVisible,
  );
  const visibilityLabel = appStore.followVisible ? "Hide transcript" : "Show transcript";
  const queueDescription = escapeHtml(
    describeItem(item, appStore.playbackQueue, appStore.collections, appStore.queueIndex),
  );
  const queueControls = appStore.playbackQueue
    ? `<div class="chapter-controls"><button class="secondary compact" data-queue-step="-1" ${appStore.queueIndex <= 0 ? "disabled" : ""}>Previous chapter</button><span>Chapter ${appStore.queueIndex + 1} of ${appStore.playbackQueue.textIds.length}</span><button class="secondary compact" data-queue-step="1" ${appStore.queueIndex >= appStore.playbackQueue.textIds.length - 1 ? "disabled" : ""}>Next chapter</button></div>`
    : "";
  return `<header class="page-heading"><div><p class="eyebrow">NOW LISTENING</p><h1>${escapeHtml(item.title)}</h1><p class="subheading">${queueDescription}</p></div></header><section class="player-content"><div class="player-cover">${coverArtwork(item.coverImage, item.id)}</div><div class="player-title"><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.labels.join(" · ") || item.language || "Morse practice")}</p></div>${queueControls}<div class="follow-toolbar"><button class="icon-button visibility-toggle" data-follow-toggle aria-label="${visibilityLabel}" title="${visibilityLabel}">${icon(appStore.followVisible ? "visibility" : "visibilityOff")}</button></div><div class="transcript-box ${appStore.followVisible ? "" : "blurred"}"><button class="transcript-home" data-transcript-home aria-label="Return to the current playback position" title="Return to playback position" hidden>${icon("center_focus_strong")}</button><div class="transcript-text" id="transcript" tabindex="${appStore.followVisible ? "0" : "-1"}" aria-label="Follow along transcript"${appStore.followVisible ? "" : ' aria-hidden="true"'}>${highlighted}</div></div></section>`;
}
