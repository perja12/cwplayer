import {
  appStore,
  currentItem,
  persistLibrary,
  persistTexts,
  setActiveText,
} from "../app/app-store";
import { playbackStore, resetPlaybackPosition } from "../app/playback-store";
import { previewStore } from "../app/preview-store";
import { requestRender } from "../app/render-bus";
import {
  flushPlaybackPosition,
  pausePlayback,
  resumePlayback,
  startPlayback,
  stopPlayback,
} from "../audio/playback-controller";
import { markFromPosition } from "../model/text";
import { stepQueueIndex, textPositionAtFrame, transportAction } from "../model/playback";
import { playableQueueTextIds } from "../model/library";
import { uid } from "../model/ids";
import { openModal } from "../ui/modal";
import { showToast } from "../ui/toast";
import { refollowTranscript, updateTranscriptHomeButton } from "../views/player-progress-view";
import { startMp3Export } from "./export-controller";
import { dismissSelectionPopup } from "./selection-controller";

let positionFlushBound = false;
let fontFollowBound = false;

export function bindPlayerEvents() {
  if (!positionFlushBound) {
    window.addEventListener("pagehide", flushPlaybackPosition);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushPlaybackPosition();
    });
    positionFlushBound = true;
  }
  if (!fontFollowBound && document.fonts) {
    document.fonts.addEventListener("loadingdone", refollowTranscript);
    fontFollowBound = true;
  }
  document
    .querySelectorAll<HTMLButtonElement>("[data-play]")
    .forEach((button) =>
      button.addEventListener("click", () => toggleTextPlayback(button.dataset.play!)),
    );
  document.querySelectorAll<HTMLButtonElement>("[data-play-collection]").forEach((button) =>
    button.addEventListener("click", () => {
      void toggleCollectionPlayback(button.dataset.playCollection!);
    }),
  );
  document.querySelectorAll<HTMLButtonElement>("[data-queue-step]").forEach((button) =>
    button.addEventListener("click", () => {
      void stepQueue(Number(button.dataset.queueStep));
    }),
  );
  document
    .querySelector<HTMLButtonElement>("[data-follow-toggle]")
    ?.addEventListener("click", () => {
      appStore.followVisible = !appStore.followVisible;
      if (!appStore.followVisible) dismissSelectionPopup();
      requestRender();
    });
  const transcript = document.querySelector<HTMLElement>("#transcript");
  transcript?.addEventListener("scroll", updateTranscriptHomeButton, { passive: true });
  transcript?.addEventListener(
    "scroll",
    () => {
      if (previewStore.selection && !previewStore.selection.playing) dismissSelectionPopup();
    },
    { passive: true },
  );
  const pauseTranscriptFollow = () => {
    appStore.transcriptFollowPaused = true;
    updateTranscriptHomeButton();
    if (previewStore.selection && !previewStore.selection.playing) dismissSelectionPopup();
  };
  transcript?.addEventListener("wheel", pauseTranscriptFollow, { passive: true });
  transcript?.addEventListener("touchstart", pauseTranscriptFollow, { passive: true });
  transcript?.addEventListener("pointerdown", pauseTranscriptFollow, { passive: true });
  transcript?.addEventListener("keydown", (event) => {
    if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key))
      pauseTranscriptFollow();
  });
  document
    .querySelector<HTMLButtonElement>("[data-transcript-home]")
    ?.addEventListener("click", () => {
      const cursor = transcript?.querySelector<HTMLElement>(".current-char");
      if (!transcript || !cursor) return;
      appStore.transcriptFollowPaused = false;
      const cursorRect = cursor.getBoundingClientRect();
      const transcriptRect = transcript.getBoundingClientRect();
      transcript.scrollTo({
        top:
          transcript.scrollTop +
          cursorRect.top -
          transcriptRect.top -
          transcript.clientHeight / 2 +
          cursorRect.height / 2,
        behavior: "smooth",
      });
    });
  document
    .querySelector<HTMLButtonElement>("[data-recognize]")
    ?.addEventListener("click", markWordRecognized);
  document
    .querySelector<HTMLButtonElement>("[data-transport=toggle]")
    ?.addEventListener("click", () => {
      const action = transportAction(playbackStore.state);
      if (action === "pause") void pausePlayback();
      else if (action === "resume") void resumePlayback();
      else void startPlayback();
    });
  document
    .querySelector<HTMLButtonElement>("[data-transport=stop]")
    ?.addEventListener("click", () => {
      appStore.playbackQueue = null;
      void stopPlayback();
    });
  document
    .querySelector<HTMLButtonElement>("[data-more]")
    ?.addEventListener("click", openPlayerMenu);
}

/** The library row toggles the active text instead of restarting it. */
function toggleTextPlayback(id: string) {
  if (appStore.activeTextId === id) {
    const action = transportAction(playbackStore.state);
    if (action === "pause") {
      void pausePlayback();
      return;
    }
    if (action === "resume") {
      void resumePlayback();
      return;
    }
  }
  void startText(id);
}

async function toggleCollectionPlayback(collectionId: string) {
  if (appStore.playbackQueue?.collectionId === collectionId) {
    const action = transportAction(playbackStore.state);
    if (action === "pause") {
      await pausePlayback();
      return;
    }
    if (action === "resume") {
      await resumePlayback();
      return;
    }
  }
  await startCollection(collectionId);
}

async function startText(id: string) {
  await stopPlayback(false);
  appStore.playbackQueue = null;
  setActiveText(id);
  resetPlaybackPosition();
  requestRender();
  await startPlayback();
}

async function startCollection(collectionId: string) {
  const collection = appStore.collections.find((entry) => entry.id === collectionId);
  const textIds = playableQueueTextIds(
    collection?.itemIds ?? [],
    appStore.texts.map((item) => item.id),
  );
  if (!collection || !textIds.length) {
    showToast("This collection has no texts to play yet.");
    return;
  }
  await stopPlayback(false);
  appStore.playbackQueue = { collectionId, textIds };
  appStore.queueIndex = 0;
  setActiveText(textIds[appStore.queueIndex]);
  resetPlaybackPosition();
  requestRender();
  await startPlayback();
}

async function stepQueue(offset: number) {
  if (!appStore.playbackQueue) return;
  const nextIndex = stepQueueIndex(
    appStore.queueIndex,
    offset,
    appStore.playbackQueue.textIds.length,
  );
  if (nextIndex === null) return;
  await stopPlayback(false);
  appStore.queueIndex = nextIndex;
  setActiveText(appStore.playbackQueue.textIds[appStore.queueIndex]);
  resetPlaybackPosition();
  await startPlayback();
}

function openPlayerMenu() {
  const modal = openModal(
    "menu-dialog",
    `<h2>Player actions</h2><button data-download>Download MP3</button><button data-start-over>Start over</button><button data-stop>Stop playback</button><button class="secondary" data-modal-close>Cancel</button>`,
  );
  modal.querySelector("[data-modal-close]")!.addEventListener("click", () => modal.close());
  modal.querySelector("[data-download]")!.addEventListener("click", () => {
    modal.close();
    void startMp3Export();
  });
  modal.querySelector("[data-start-over]")!.addEventListener("click", () => {
    modal.close();
    void startOver();
  });
  modal.querySelector("[data-stop]")!.addEventListener("click", () => {
    modal.close();
    appStore.playbackQueue = null;
    void stopPlayback();
  });
}

/** Restart the active text from the beginning, discarding its saved position. */
async function startOver() {
  await stopPlayback(false);
  const item = currentItem();
  if (!item) return;
  item.lastPosition = 0;
  persistTexts();
  resetPlaybackPosition();
  await startPlayback();
}

function markWordRecognized() {
  const item = currentItem();
  if (!item || playbackStore.state !== "playing") return;
  const textPosition = textPositionAtFrame(playbackStore.spans, playbackStore.consumedFrames);
  const mark = markFromPosition(item.content, textPosition);
  if (!mark) {
    showToast("No word at the current position");
    return;
  }
  appStore.marks.push({
    id: uid(),
    itemId: item.id,
    word: mark.word,
    excerpt: mark.excerpt,
    date: Date.now(),
    characterOffset: mark.characterOffset,
  });
  persistLibrary();
  playbackStore.recognizedFeedbackUntil = Date.now() + 550;
  requestRender();
  showToast("Word added to Practice Review");
  window.setTimeout(() => {
    if (Date.now() >= playbackStore.recognizedFeedbackUntil) {
      playbackStore.recognizedFeedbackUntil = 0;
      requestRender();
    }
  }, 600);
}
