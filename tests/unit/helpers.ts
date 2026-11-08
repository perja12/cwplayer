import { appStore } from "../../src/app/app-store";
import { exportStore } from "../../src/app/export-store";
import { playbackStore } from "../../src/app/playback-store";
import { previewStore } from "../../src/app/preview-store";
import { defaultCollections, defaultSettings, defaultTexts } from "../../src/model/defaults";
import type { TextItem } from "../../src/model/types";

export function resetStores() {
  appStore.texts = structuredClone(defaultTexts);
  appStore.collections = structuredClone(defaultCollections);
  appStore.marks = [];
  appStore.log = {};
  appStore.settings = { ...defaultSettings };
  appStore.theme = "dark";
  appStore.activeTextId = appStore.texts[0]?.id ?? "";
  appStore.playbackQueue = null;
  appStore.queueIndex = 0;
  appStore.view = "player";
  appStore.followVisible = true;
  appStore.transcriptFollowPaused = false;
  appStore.frequencyTextId = appStore.activeTextId;
  appStore.expandedCollections = new Set<string>();
  appStore.installPrompt = null;

  playbackStore.state = "idle";
  playbackStore.positionTextId = "";
  playbackStore.totalFrames = 0;
  playbackStore.consumedFrames = 0;
  playbackStore.spans = [];
  playbackStore.sampleRate = 16000;
  playbackStore.lastLogFrame = 0;
  playbackStore.lastLogPersist = 0;
  playbackStore.activeSpanIndex = -2;
  playbackStore.recognizedFeedbackUntil = 0;

  previewStore.word = null;
  previewStore.selection = null;
  previewStore.phrase = null;
  previewStore.request = 0;

  exportStore.active = false;
  exportStore.bytes = 0;

  document.body.innerHTML = "";
}

export function render(html: string) {
  const container = document.createElement("div");
  container.innerHTML = html;
  return container;
}

export function sampleText(overrides: Partial<TextItem> = {}): TextItem {
  return {
    id: "sample",
    title: "Sample text",
    author: "LB2KK",
    language: "English",
    labels: ["Practice"],
    content: "CQ DE LA1ABC",
    collectionId: null,
    lastPosition: 0,
    ...overrides,
  };
}
