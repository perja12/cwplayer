import { appStore } from "../app/app-store";
import { exportStore } from "../app/export-store";
import { playbackStore } from "../app/playback-store";
import { formatTime } from "../model/format";
import { describeItem } from "../model/library";
import type { TextItem } from "../model/types";
import { coverArtwork } from "../ui/cover";
import { icon } from "../ui/icons";
import { escapeHtml } from "../ui/html";

export function renderDock(item?: TextItem) {
  const transportButtons = `<div class="transport-buttons"><button class="icon-button" data-transport="stop" aria-label="Stop" ${playbackStore.state === "idle" ? "disabled" : ""}>${icon("stop")}</button><button class="icon-button large" data-transport="toggle" aria-label="${playbackStore.state === "playing" ? "Pause" : "Play"}" ${item && !exportStore.active ? "" : "disabled"}>${icon(playbackStore.state === "playing" ? "pause" : "play")}</button></div>`;
  const progress = `<div class="dock-progress progress-wrap"><div class="progress-track"><span style="width:${playbackStore.totalFrames ? Math.min(100, (playbackStore.consumedFrames / playbackStore.totalFrames) * 100) : 0}%"></span></div><div class="time-labels"><span>${formatTime(playbackStore.consumedFrames / playbackStore.sampleRate)}</span><span>${playbackStore.totalFrames ? formatTime(playbackStore.totalFrames / playbackStore.sampleRate) : "--:--"}</span></div></div>`;
  const recognized = Date.now() < playbackStore.recognizedFeedbackUntil;
  const recognizeLabel = recognized ? "Word recognized" : "Mark current word recognized";
  const thumbnail = item ? coverArtwork(item.coverImage, item.id, true) : "";
  return `<section class="dock">${progress}<div class="dock-item">${thumbnail}<div class="dock-meta"><strong>${escapeHtml(item?.title ?? "Choose a text")}</strong><span>${escapeHtml(describeItem(item, appStore.playbackQueue, appStore.collections, appStore.queueIndex))}</span></div></div><div class="transport">${transportButtons}</div><div class="dock-actions"><button class="secondary sound-summary" data-sound>${icon("settings")} ${appStore.settings.wpm} WPM · Sound</button><button class="icon-button recognize-icon ${recognized ? "confirmed" : ""}" data-recognize aria-label="${recognizeLabel}" title="${recognizeLabel}" ${playbackStore.state !== "playing" ? "disabled" : ""}>${icon(recognized ? "check" : "lightbulb")}</button><button class="icon-button" data-more aria-label="More player actions">${icon("more")}</button></div></section>`;
}
