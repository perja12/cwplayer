import { appStore } from "../app/app-store";
import { playbackStore } from "../app/playback-store";
import { previewStore } from "../app/preview-store";
import { setSelectionPopupRenderer } from "../app/render-bus";
import { playSelection, stopSelectionPreview, stopWordPreview } from "../audio/preview-controller";
import { isSelectionPlaybackAllowed } from "../model/playback";
import { normalizeSelectionText, selectionPopupPosition } from "../model/selection";
import { icon } from "../ui/icons";

let selectionPopup: HTMLButtonElement | null = null;
let selectionCheckFrame = 0;

export function initSelectionController() {
  setSelectionPopupRenderer(syncSelectionPopup);
  document.addEventListener("selectionchange", scheduleSelectionCheck);
  document.addEventListener("pointerdown", (event) => {
    if (!previewStore.selection || previewStore.selection.playing) return;
    const target = event.target as Node;
    if (selectionPopup?.contains(target) || document.querySelector("#transcript")?.contains(target))
      return;
    hideSelectionPopup();
  });
  window.addEventListener("resize", () => {
    if (previewStore.selection && !previewStore.selection.playing) hideSelectionPopup();
  });
}

export function bindSelectionSurfaceEvents() {
  const transcript = document.querySelector<HTMLElement>("#transcript");
  transcript?.addEventListener("pointerup", scheduleSelectionCheck);
  transcript?.addEventListener("keyup", scheduleSelectionCheck);
}

export function afterRenderSelection() {
  if (!previewStore.selection) {
    if (selectionPopup) selectionPopup.hidden = true;
    return;
  }
  if (appStore.view !== "player" || !appStore.followVisible) {
    stopSelectionPreview(false);
    hideSelectionPopup();
    return;
  }
  if (!previewStore.selection.playing) {
    hideSelectionPopup();
    return;
  }
  syncSelectionPopup();
}

export function dismissSelectionPopup() {
  if (previewStore.selection && !previewStore.selection.playing) hideSelectionPopup();
}

function selectionPreviewAllowed() {
  return isSelectionPlaybackAllowed(playbackStore.state);
}

function ensureSelectionPopup() {
  if (selectionPopup) return selectionPopup;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "selection-play-popup";
  button.hidden = true;
  button.addEventListener("pointerdown", (event) => event.preventDefault());
  button.addEventListener("click", () => void toggleSelectionPreview());
  document.body.append(button);
  selectionPopup = button;
  return button;
}

function syncSelectionPopup() {
  if (!previewStore.selection) {
    if (selectionPopup) selectionPopup.hidden = true;
    return;
  }
  const button = ensureSelectionPopup();
  const playing = previewStore.selection.playing;
  button.classList.toggle("playing", playing);
  button.innerHTML = `${icon(playing ? "stop" : "play")}<span>${playing ? "Stop" : "Play selection"}</span>`;
  const label = playing ? "Stop selected text" : "Play selected text";
  button.setAttribute("aria-label", label);
  button.title = label;
}

function positionSelectionPopup(rect: DOMRect) {
  const button = ensureSelectionPopup();
  const position = selectionPopupPosition(
    rect,
    { width: window.innerWidth, height: window.innerHeight },
    { width: button.offsetWidth || 120, height: button.offsetHeight || 38 },
  );
  button.style.left = `${position.left}px`;
  button.style.top = `${position.top}px`;
}

function showSelectionPopup(text: string, rect: DOMRect) {
  previewStore.selection = { text, playing: false };
  const button = ensureSelectionPopup();
  button.hidden = false;
  syncSelectionPopup();
  positionSelectionPopup(rect);
}

function hideSelectionPopup() {
  previewStore.selection = null;
  if (selectionPopup) selectionPopup.hidden = true;
}

function selectedTranscriptText() {
  const transcript = document.querySelector<HTMLElement>("#transcript");
  const selection = window.getSelection();
  if (!transcript || !selection || selection.isCollapsed || !selection.rangeCount) return null;
  const { anchorNode, focusNode } = selection;
  if (
    !anchorNode ||
    !focusNode ||
    !transcript.contains(anchorNode) ||
    !transcript.contains(focusNode)
  )
    return null;
  const text = normalizeSelectionText(selection.toString());
  if (!text) return null;
  const range = selection.getRangeAt(0);
  const rects = range.getClientRects();
  const rect = rects[rects.length - 1] ?? range.getBoundingClientRect();
  if (!rect || (!rect.width && !rect.height)) return null;
  return { text, rect };
}

function scheduleSelectionCheck() {
  cancelAnimationFrame(selectionCheckFrame);
  selectionCheckFrame = requestAnimationFrame(updateSelectionFromDom);
}

function updateSelectionFromDom() {
  if (!selectionPreviewAllowed()) {
    if (previewStore.selection && !previewStore.selection.playing) hideSelectionPopup();
    return;
  }
  const chosen = selectedTranscriptText();
  if (!chosen) {
    if (previewStore.selection && !previewStore.selection.playing) hideSelectionPopup();
    return;
  }
  if (previewStore.selection?.playing) {
    if (previewStore.selection.text === chosen.text) return;
    stopSelectionPreview();
  }
  showSelectionPopup(chosen.text, chosen.rect);
}

async function toggleSelectionPreview() {
  if (!previewStore.selection) return;
  if (previewStore.selection.playing) {
    stopSelectionPreview();
    hideSelectionPopup();
    return;
  }
  if (!selectionPreviewAllowed()) {
    hideSelectionPopup();
    return;
  }
  const text = previewStore.selection.text;
  stopWordPreview(false);
  await playSelection(text);
}
