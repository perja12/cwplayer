import type { PlaybackState, TextSpan } from "../model/types";

export type PlaybackSnapshot = {
  state: PlaybackState;
  /** The text the frame counters belong to, so a position is never saved to another text. */
  positionTextId: string;
  totalFrames: number;
  consumedFrames: number;
  spans: TextSpan[];
  sampleRate: number;
  lastLogFrame: number;
  lastLogPersist: number;
  activeSpanIndex: number;
  recognizedFeedbackUntil: number;
};

export const playbackStore: PlaybackSnapshot = {
  state: "idle",
  positionTextId: "",
  totalFrames: 0,
  consumedFrames: 0,
  spans: [],
  sampleRate: 16000,
  lastLogFrame: 0,
  lastLogPersist: 0,
  activeSpanIndex: -2,
  recognizedFeedbackUntil: 0,
};

export function resetPlaybackPosition() {
  playbackStore.positionTextId = "";
  playbackStore.totalFrames = 0;
  playbackStore.consumedFrames = 0;
  playbackStore.spans = [];
  playbackStore.activeSpanIndex = -2;
  playbackStore.lastLogFrame = 0;
}
