import { appStore, currentItem } from "../app/app-store";
import { playbackStore } from "../app/playback-store";
import { findSpanAtFrame } from "../model/playback";
import { formatTime } from "../model/format";
import { highlightText } from "./transcript-view";

export function renderPlayerProgress() {
  const item = currentItem();
  if (!item) return;
  const track = document.querySelector<HTMLElement>(".progress-track span");
  if (track)
    track.style.width = `${playbackStore.totalFrames ? Math.min(100, (playbackStore.consumedFrames / playbackStore.totalFrames) * 100) : 0}%`;
  const labels = document.querySelector<HTMLElement>(".time-labels");
  if (labels)
    labels.innerHTML = `<span>${formatTime(playbackStore.consumedFrames / playbackStore.sampleRate)}</span><span>${playbackStore.totalFrames ? formatTime(playbackStore.totalFrames / playbackStore.sampleRate) : "--:--"}</span>`;
  const transcript = document.querySelector<HTMLElement>("#transcript");
  if (transcript && playbackStore.spans.length) {
    const index = findSpanAtFrame(playbackStore.spans, playbackStore.consumedFrames);
    if (index !== playbackStore.activeSpanIndex) {
      playbackStore.activeSpanIndex = index;
      transcript.innerHTML = highlightText(
        item.content,
        playbackStore.consumedFrames,
        appStore.followVisible,
      );
      const cursor = transcript.querySelector<HTMLElement>(".current-char");
      if (cursor && appStore.followVisible && !appStore.transcriptFollowPaused) {
        const bounds = transcript.getBoundingClientRect();
        const mark = cursor.getBoundingClientRect();
        const followLine = bounds.bottom - Math.max(36, mark.height * 2);
        if (mark.bottom > followLine)
          transcript.scrollTo({
            top: transcript.scrollTop + mark.bottom - followLine,
            behavior: "smooth",
          });
      }
      updateTranscriptHomeButton();
    }
  }
}

export function updateTranscriptHomeButton() {
  const transcript = document.querySelector<HTMLElement>("#transcript");
  const button = document.querySelector<HTMLButtonElement>("[data-transcript-home]");
  const cursor = transcript?.querySelector<HTMLElement>(".current-char");
  // Morse gaps have no active character mark. Keep the last known visibility
  // through those gaps to avoid making the return control blink with the code.
  if (!transcript || !button || !cursor) return;
  if (!appStore.transcriptFollowPaused) {
    button.hidden = true;
    return;
  }
  const bounds = transcript.getBoundingClientRect();
  const mark = cursor.getBoundingClientRect();
  button.hidden =
    mark.bottom > bounds.top &&
    mark.top < bounds.bottom &&
    mark.right > bounds.left &&
    mark.left < bounds.right;
}

/**
 * Re-align the transcript after a late font swap reflows it. The follow loop
 * only scrolls when the cursor crosses the follow line, so a swap that moves
 * the text by more than a line could otherwise leave the current word off
 * screen.
 */
export function refollowTranscript() {
  const transcript = document.querySelector<HTMLElement>("#transcript");
  const cursor = transcript?.querySelector<HTMLElement>(".current-char");
  if (!transcript || !cursor) return;
  if (appStore.followVisible && !appStore.transcriptFollowPaused) {
    const bounds = transcript.getBoundingClientRect();
    const mark = cursor.getBoundingClientRect();
    const followLine = bounds.bottom - Math.max(36, mark.height * 2);
    if (mark.top < bounds.top + 4 || mark.bottom > followLine) {
      transcript.scrollTo({
        top: transcript.scrollTop + mark.bottom - followLine,
        behavior: "auto",
      });
    }
  }
  updateTranscriptHomeButton();
}
