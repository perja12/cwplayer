import { appStore } from "../app/app-store";
import { previewStore } from "../app/preview-store";
import { requestRender, requestSelectionPopupRender } from "../app/render-bus";
import { WORD_PREVIEW_GAP_SECONDS } from "../model/defaults";
import { showToast } from "../ui/toast";
import { getEngineModule } from "./engine-client";
import type { WordWorkerMessage } from "./messages";

let previewContext: AudioContext | null = null;
let previewWorker: Worker | null = null;
let previewSource: AudioBufferSourceNode | null = null;
let previewGain: GainNode | null = null;

function createPreviewBuffer(
  context: AudioContext,
  message: { channels: number; frames: number; pcm: Float32Array },
) {
  const buffer = context.createBuffer(message.channels, message.frames, context.sampleRate);
  for (let channel = 0; channel < message.channels; channel++) {
    const target = buffer.getChannelData(channel);
    for (let frame = 0; frame < message.frames; frame++) {
      target[frame] = message.pcm[frame * message.channels + channel];
    }
  }
  return buffer;
}

function stopPreviewAudio() {
  previewStore.request++;
  previewWorker?.terminate();
  previewWorker = null;
  const source = previewSource;
  previewSource = null;
  if (source) {
    try {
      source.stop();
    } catch {
      /* Already stopped. */
    }
    source.disconnect();
  }
  previewGain?.disconnect();
  previewGain = null;
  if (previewContext?.state === "running") void previewContext.suspend();
}

export function stopWordPreview(redraw = true) {
  const hadPreview = previewStore.word !== null;
  if (hadPreview) stopPreviewAudio();
  previewStore.word = null;
  if (redraw && hadPreview) requestRender();
}

export function stopSelectionPreview(redraw = true) {
  if (!previewStore.selection) return;
  stopPreviewAudio();
  previewStore.selection = null;
  if (redraw) requestSelectionPopupRender();
}

export function stopPhrasePreview(redraw = true) {
  if (!previewStore.phrase) return;
  stopPreviewAudio();
  previewStore.phrase = null;
  if (redraw) requestRender();
}

export function stopAllPreviews(redraw = true) {
  stopWordPreview(redraw);
  stopSelectionPreview(redraw);
  stopPhrasePreview(redraw);
}

/** Cancel anything in flight and return a token the caller can re-check after await. */
export function cancelPreviews() {
  stopAllPreviews(false);
  previewStore.request++;
  return previewStore.request;
}

export function isCurrentPreviewRequest(request: number) {
  return request === previewStore.request;
}

export async function playWord(word: string) {
  stopAllPreviews(false);
  const request = ++previewStore.request;
  previewStore.word = word;
  requestRender();
  try {
    const engineModule = await getEngineModule();
    if (request !== previewStore.request) return;
    previewContext ??= new AudioContext();
    await previewContext.resume();
    if (request !== previewStore.request) return;
    const context = previewContext;
    const worker = new Worker("/engine/word-worker.js");
    previewWorker = worker;
    worker.onmessage = (event: MessageEvent<WordWorkerMessage>) => {
      if (previewWorker !== worker || request !== previewStore.request) return;
      const message = event.data;
      if (message.type === "ready") {
        worker.terminate();
        if (previewWorker === worker) previewWorker = null;
        if (request !== previewStore.request) return;
        const source = context.createBufferSource();
        source.buffer = createPreviewBuffer(context, message);
        source.loop = true;
        const gain = context.createGain();
        source.connect(gain).connect(context.destination);
        previewSource = source;
        previewGain = gain;
        source.start();
      } else if (message.type === "error") {
        stopWordPreview();
        showToast(message.message);
      }
    };
    worker.onerror = (event) => {
      if (previewWorker !== worker) return;
      stopWordPreview();
      showToast(`Could not play that word: ${event.message}`);
    };
    const text = new TextEncoder().encode(word);
    worker.postMessage(
      {
        type: "start",
        module: engineModule,
        text,
        settings: { ...appStore.settings, rate: context.sampleRate },
        gapSeconds: WORD_PREVIEW_GAP_SECONDS,
      },
      [text.buffer],
    );
  } catch (error) {
    if (request !== previewStore.request) return;
    stopWordPreview();
    showToast(
      `Could not play that word: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function playPhrase(id: string, text: string) {
  stopAllPreviews(false);
  const request = ++previewStore.request;
  previewStore.phrase = { id, text, playing: true };
  requestRender();
  try {
    const engineModule = await getEngineModule();
    if (request !== previewStore.request) return;
    previewContext ??= new AudioContext();
    await previewContext.resume();
    if (request !== previewStore.request) return;
    const context = previewContext;
    const worker = new Worker("/engine/word-worker.js");
    previewWorker = worker;
    worker.onmessage = (event: MessageEvent<WordWorkerMessage>) => {
      if (previewWorker !== worker || request !== previewStore.request) return;
      const message = event.data;
      if (message.type === "ready") {
        worker.terminate();
        if (previewWorker === worker) previewWorker = null;
        if (request !== previewStore.request) return;
        const source = context.createBufferSource();
        source.buffer = createPreviewBuffer(context, message);
        source.loop = false;
        const gain = context.createGain();
        source.connect(gain).connect(context.destination);
        previewSource = source;
        previewGain = gain;
        source.onended = () => {
          if (previewSource !== source) return;
          previewSource = null;
          gain.disconnect();
          previewGain = null;
          if (previewContext?.state === "running") void previewContext.suspend();
          if (previewStore.phrase?.id === id && previewStore.phrase.playing) {
            previewStore.phrase = null;
            requestRender();
          }
        };
        source.start();
      } else if (message.type === "error") {
        stopPhrasePreview();
        showToast(message.message);
      }
    };
    worker.onerror = (event) => {
      if (previewWorker !== worker) return;
      stopPhrasePreview();
      showToast(`Could not play that text: ${event.message}`);
    };
    const encoded = new TextEncoder().encode(text);
    worker.postMessage(
      {
        type: "start",
        module: engineModule,
        text: encoded,
        settings: { ...appStore.settings, rate: context.sampleRate },
        gapSeconds: 0,
      },
      [encoded.buffer],
    );
  } catch (error) {
    if (request !== previewStore.request) return;
    stopPhrasePreview();
    showToast(
      `Could not play that text: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function playSelection(text: string) {
  stopAllPreviews(false);
  const request = ++previewStore.request;
  previewStore.selection = { text, playing: true };
  requestSelectionPopupRender();
  try {
    const engineModule = await getEngineModule();
    if (request !== previewStore.request) return;
    previewContext ??= new AudioContext();
    await previewContext.resume();
    if (request !== previewStore.request) return;
    const context = previewContext;
    const worker = new Worker("/engine/word-worker.js");
    previewWorker = worker;
    worker.onmessage = (event: MessageEvent<WordWorkerMessage>) => {
      if (previewWorker !== worker || request !== previewStore.request) return;
      const message = event.data;
      if (message.type === "ready") {
        worker.terminate();
        if (previewWorker === worker) previewWorker = null;
        if (request !== previewStore.request) return;
        const source = context.createBufferSource();
        source.buffer = createPreviewBuffer(context, message);
        source.loop = false;
        const gain = context.createGain();
        source.connect(gain).connect(context.destination);
        previewSource = source;
        previewGain = gain;
        source.onended = () => {
          if (previewSource !== source) return;
          previewSource = null;
          gain.disconnect();
          previewGain = null;
          if (previewContext?.state === "running") void previewContext.suspend();
          if (previewStore.selection?.playing) {
            previewStore.selection.playing = false;
            requestSelectionPopupRender();
          }
        };
        source.start();
      } else if (message.type === "error") {
        stopSelectionPreview();
        showToast(message.message);
      }
    };
    worker.onerror = (event) => {
      if (previewWorker !== worker) return;
      stopSelectionPreview();
      showToast(`Could not play the selection: ${event.message}`);
    };
    const encoded = new TextEncoder().encode(text);
    worker.postMessage(
      {
        type: "start",
        module: engineModule,
        text: encoded,
        settings: { ...appStore.settings, rate: context.sampleRate },
        gapSeconds: 0,
      },
      [encoded.buffer],
    );
  } catch (error) {
    if (request !== previewStore.request) return;
    stopSelectionPreview();
    showToast(
      `Could not play the selection: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
