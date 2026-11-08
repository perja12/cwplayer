import { appStore, persistLibrary } from "../app/app-store";
import { playbackStore } from "../app/playback-store";
import { previewStore } from "../app/preview-store";
import { requestRender } from "../app/render-bus";
import { pausePlayback, stopPlayback } from "../audio/playback-controller";
import {
  cancelPreviews,
  isCurrentPreviewRequest,
  playPhrase,
  playWord,
  stopPhrasePreview,
  stopWordPreview,
} from "../audio/preview-controller";

export function bindReviewEvents() {
  document
    .querySelector<HTMLButtonElement>("[data-clear-marks]")
    ?.addEventListener("click", clearMarks);
  document
    .querySelector<HTMLSelectElement>("[data-frequency-text]")
    ?.addEventListener("change", (event) => {
      appStore.frequencyTextId = (event.currentTarget as HTMLSelectElement).value;
      stopWordPreview(false);
      requestRender();
      const list = document.querySelector<HTMLElement>(".frequency-list");
      if (list) list.scrollTop = 0;
    });
  document.querySelectorAll<HTMLButtonElement>("[data-word-play]").forEach((button) => {
    button.addEventListener("click", () => void toggleWordPreview(button.dataset.wordPlay!));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-phrase-play]").forEach((button) => {
    button.addEventListener(
      "click",
      () => void togglePhrasePreview(button.dataset.phrasePlay!, button.dataset.phraseText!),
    );
  });
}

function clearMarks() {
  if (!appStore.marks.length || !confirm("Clear all recognized word marks?")) return;
  appStore.marks = [];
  persistLibrary();
  requestRender();
}

async function toggleWordPreview(word: string) {
  if (previewStore.word === word) {
    stopWordPreview();
    return;
  }
  const request = cancelPreviews();
  if (playbackStore.state === "playing") await pausePlayback();
  else if (playbackStore.state === "preparing" || playbackStore.state === "stopping")
    await stopPlayback(false);
  if (!isCurrentPreviewRequest(request)) return;
  await playWord(word);
}

async function togglePhrasePreview(id: string, text: string) {
  if (previewStore.phrase?.id === id) {
    stopPhrasePreview();
    return;
  }
  const request = cancelPreviews();
  if (playbackStore.state === "playing") await pausePlayback();
  else if (playbackStore.state === "preparing" || playbackStore.state === "stopping")
    await stopPlayback(false);
  if (!isCurrentPreviewRequest(request)) return;
  await playPhrase(id, text);
}
