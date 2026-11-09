import {
  addListeningTime,
  appStore,
  currentItem,
  persistLog,
  persistTexts,
} from "../app/app-store";
import { exportStore } from "../app/export-store";
import { playbackStore, resetPlaybackPosition } from "../app/playback-store";
import { requestProgressRender, requestRender } from "../app/render-bus";
import {
  byteOffsetAt,
  listeningSeconds,
  nextPlayableQueueIndex,
  textPositionAtFrame,
} from "../model/playback";
import { decodeByteSpans } from "../model/spans";
import { showToast } from "../ui/toast";
import { getEngineModule } from "./engine-client";
import type { RenderWorkerMessage, WorkletMessage } from "./messages";
import { stopAllPreviews } from "./preview-controller";

let audioContext: AudioContext | null = null;
let outputGain: GainNode | null = null;
let worklet: AudioWorkletNode | null = null;
let worker: Worker | null = null;
let startFrame = 0;
let lastPositionPersist = 0;
let playbackRequest = 0;
let progressFrame = 0;

function setPlaybackState(state: typeof playbackStore.state) {
  playbackStore.state = state;
}

/** Coalesce progress messages so heavy transcript updates run at most once per frame. */
function scheduleProgressRender() {
  if (progressFrame) return;
  progressFrame = requestAnimationFrame(() => {
    progressFrame = 0;
    requestProgressRender();
  });
}

function positionItem() {
  return appStore.texts.find((entry) => entry.id === playbackStore.positionTextId);
}

/** The word the listener is currently on, as a stable character offset. */
function currentTextPosition() {
  if (!playbackStore.spans.length) return 0;
  return textPositionAtFrame(playbackStore.spans, playbackStore.consumedFrames);
}

/** Keep the in-memory position current and persist it at a gentle cadence. */
function trackPosition(forceSave = false) {
  const item = positionItem();
  if (!item || !playbackStore.spans.length) return;
  item.lastPosition = currentTextPosition();
  if (!forceSave && Date.now() - lastPositionPersist < 5000) return;
  lastPositionPersist = Date.now();
  persistTexts();
}

/** A finished text starts from the beginning the next time it is played. */
function finishPosition() {
  const item = positionItem();
  playbackStore.positionTextId = "";
  if (!item) return;
  item.lastPosition = 0;
  lastPositionPersist = Date.now();
  persistTexts();
}

/** Flush the position when the tab is hidden or the page is being unloaded. */
export function flushPlaybackPosition() {
  trackPosition(true);
}

async function advanceQueue() {
  if (!appStore.playbackQueue) return false;
  const nextIndex = nextPlayableQueueIndex(
    appStore.playbackQueue.textIds,
    appStore.queueIndex,
    appStore.texts.map((item) => item.id),
  );
  if (nextIndex < 0) return false;
  appStore.queueIndex = nextIndex;
  appStore.activeTextId = appStore.playbackQueue.textIds[appStore.queueIndex];
  resetPlaybackPosition();
  await startPlayback();
  return true;
}

export async function startPlayback() {
  if (exportStore.active) {
    showToast("Finish the MP3 export before starting playback.");
    return;
  }
  stopAllPreviews(false);
  const request = ++playbackRequest;
  const item = currentItem();
  if (!item) return;
  await stopPlayback(false, false);
  if (request !== playbackRequest) return;
  resetPlaybackPosition();
  startFrame = 0;
  setPlaybackState("preparing");
  requestRender();
  try {
    const engineModule = await getEngineModule();
    if (request !== playbackRequest) return;
    audioContext ??= new AudioContext({ latencyHint: "playback" });
    await audioContext.resume();
    if (request !== playbackRequest) return;
    if (!audioContext.audioWorklet || typeof AudioWorkletNode === "undefined")
      throw new Error("This browser does not support AudioWorklet playback.");
    await audioContext.audioWorklet.addModule("/engine/audio-worklet.js");
    if (request !== playbackRequest) return;
    const channelCount = appStore.settings.stereo || appStore.settings.room ? 2 : 1;
    playbackStore.sampleRate = audioContext.sampleRate;
    outputGain = audioContext.createGain();
    outputGain.gain.value = 0;
    outputGain.connect(audioContext.destination);
    worklet = new AudioWorkletNode(audioContext, "cw-buffered-player", {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [channelCount],
      processorOptions: { channels: channelCount },
    });
    const thisWorklet = worklet;
    thisWorklet.port.onmessage = (event: MessageEvent<WorkletMessage>) => {
      if (request !== playbackRequest || worklet !== thisWorklet) return;
      const message = event.data;
      if (message.type === "ready") {
        thisWorklet.connect(outputGain!);
        outputGain!.gain.setTargetAtTime(1, audioContext!.currentTime, 0.015);
        // The worklet holds its pre-buffer until this handshake, so no audio
        // is silently consumed while the node is still disconnected.
        thisWorklet.port.postMessage({ type: "go" });
        setPlaybackState("playing");
        requestRender();
      } else if (message.type === "progress") {
        playbackStore.consumedFrames = Math.min(
          playbackStore.totalFrames,
          startFrame + message.frames,
        );
        trackPosition();
        accountLog();
        scheduleProgressRender();
      } else if (message.type === "need") worker?.postMessage({ type: "fill" });
      else if (message.type === "done") {
        if (playbackStore.state !== "playing") return;
        playbackStore.consumedFrames = playbackStore.totalFrames;
        accountLog();
        persistLog();
        finishPosition();
        void (async () => {
          if (await advanceQueue()) return;
          setPlaybackState("ended");
          requestRender();
        })();
      } else if (message.type === "underrun") showToast("Audio buffer refilling");
    };
    worker = new Worker("/engine/render-worker.js");
    const thisWorker = worker;
    thisWorker.onmessage = (event: MessageEvent<RenderWorkerMessage>) => {
      if (request !== playbackRequest || worker !== thisWorker) return;
      const message = event.data;
      if (message.type === "started") {
        playbackStore.totalFrames = message.frames;
        playbackStore.positionTextId = item.id;
        playbackStore.consumedFrames = message.resumeFrame;
        playbackStore.lastLogFrame = message.resumeFrame;
        startFrame = message.resumeFrame;
      } else if (message.type === "spans") {
        playbackStore.spans = decodeByteSpans(item.content, message.spans);
      } else if (message.type === "block") worklet?.port.postMessage(message, [message.pcm.buffer]);
      else if (message.type === "end") worklet?.port.postMessage({ type: "end" });
      else if (message.type === "error") {
        setPlaybackState("idle");
        showToast(message.message);
        void stopPlayback(false);
      }
    };
    // Give the worker and the worklet a private channel. Buffer refills then
    // bypass the main thread entirely, so transcript rendering cannot starve
    // the audio queue.
    const channel = new MessageChannel();
    thisWorklet.port.postMessage({ type: "connect", port: channel.port1 }, [channel.port1]);
    thisWorker.postMessage({ type: "connect", port: channel.port2 }, [channel.port2]);
    const text = new TextEncoder().encode(item.content);
    const savedPosition = item.lastPosition ?? 0;
    const startByte = savedPosition > 0 ? byteOffsetAt(item.content, savedPosition) : 0;
    thisWorker.postMessage(
      {
        type: "start",
        module: engineModule,
        settings: { ...appStore.settings, rate: audioContext.sampleRate },
        text,
        startByte,
      },
      [text.buffer],
    );
  } catch (error) {
    if (request !== playbackRequest) return;
    setPlaybackState("idle");
    showToast(error instanceof Error ? error.message : String(error));
    requestRender();
  }
}

export async function pausePlayback() {
  if (!audioContext || playbackStore.state !== "playing") return;
  await audioContext.suspend();
  trackPosition(true);
  setPlaybackState("paused");
  requestRender();
}

export async function resumePlayback() {
  if (!audioContext || playbackStore.state !== "paused") return;
  stopAllPreviews(false);
  await audioContext.resume();
  setPlaybackState("playing");
  requestRender();
}

export async function stopPlayback(redraw = true, invalidate = true) {
  if (invalidate) playbackRequest++;
  if (progressFrame) {
    cancelAnimationFrame(progressFrame);
    progressFrame = 0;
  }
  stopAllPreviews(false);
  // Stopping keeps the listening position, so it behaves like a pause across sessions.
  trackPosition(true);
  setPlaybackState("stopping");
  if (outputGain && audioContext?.state === "running") {
    outputGain.gain.cancelScheduledValues(audioContext.currentTime);
    outputGain.gain.setTargetAtTime(0, audioContext.currentTime, 0.012);
    await new Promise<void>((resolve) => setTimeout(resolve, 60));
  }
  worker?.postMessage({ type: "stop" });
  worker?.terminate();
  worker = null;
  worklet?.port.postMessage({ type: "stop" });
  worklet?.disconnect();
  worklet = null;
  outputGain?.disconnect();
  outputGain = null;
  if (audioContext?.state === "running") await audioContext.suspend();
  accountLog();
  persistLog();
  setPlaybackState("idle");
  if (redraw) requestRender();
}

function accountLog() {
  const delta = listeningSeconds(
    playbackStore.consumedFrames,
    playbackStore.lastLogFrame,
    playbackStore.sampleRate,
  );
  playbackStore.lastLogFrame = playbackStore.consumedFrames;
  if (delta > 0 && playbackStore.state !== "paused") {
    addListeningTime(delta);
    if (Date.now() - playbackStore.lastLogPersist >= 5000) {
      persistLog();
      playbackStore.lastLogPersist = Date.now();
    }
  }
}
