// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { previewStore } from "../../src/app/preview-store";
import { playPhrase, stopPhrasePreview } from "../../src/audio/preview-controller";
import type { WordWorkerMessage } from "../../src/audio/messages";

const engine = vi.hoisted(() => ({ getEngineModule: vi.fn() }));

vi.mock("../../src/audio/engine-client", () => ({ getEngineModule: engine.getEngineModule }));

class FakeGainNode {
  disconnected = false;
  connect<T>(target: T) {
    return target;
  }
  disconnect() {
    this.disconnected = true;
  }
}

class FakeBufferSource {
  static instances: FakeBufferSource[] = [];
  buffer: AudioBuffer | null = null;
  loop = false;
  started = false;
  stopped = false;
  onended: (() => void) | null = null;
  constructor() {
    FakeBufferSource.instances.push(this);
  }
  connect<T>(target: T) {
    return target;
  }
  start() {
    this.started = true;
  }
  stop() {
    this.stopped = true;
  }
  disconnect() {}
}

class FakeAudioContext {
  state: AudioContextState = "running";
  destination = {};
  createBuffer(_channels: number, frames: number) {
    return { getChannelData: () => new Float32Array(frames) };
  }
  createBufferSource() {
    return new FakeBufferSource();
  }
  createGain() {
    return new FakeGainNode();
  }
  resume() {
    this.state = "running";
    return Promise.resolve();
  }
  suspend() {
    this.state = "suspended";
    return Promise.resolve();
  }
}

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent<WordWorkerMessage>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  posted: unknown[] = [];
  terminated = false;
  constructor() {
    FakeWorker.instances.push(this);
  }
  postMessage(message: unknown) {
    this.posted.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  emitMessage(data: WordWorkerMessage) {
    this.onmessage?.({ data } as MessageEvent<WordWorkerMessage>);
  }
}

function lastWorker() {
  const worker = FakeWorker.instances.at(-1);
  if (!worker) throw new Error("Expected a worker to be created");
  return worker;
}

function lastSource() {
  const source = FakeBufferSource.instances.at(-1);
  if (!source) throw new Error("Expected an audio source to be created");
  return source;
}

beforeEach(() => {
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("AudioContext", FakeAudioContext);
  FakeWorker.instances = [];
  FakeBufferSource.instances = [];
  previewStore.word = null;
  previewStore.selection = null;
  previewStore.phrase = null;
  previewStore.request = 0;
  engine.getEngineModule.mockReset().mockResolvedValue({});
});

afterEach(() => {
  previewStore.word = null;
  previewStore.selection = null;
  previewStore.phrase = null;
  previewStore.request = 0;
  vi.unstubAllGlobals();
});

describe("playPhrase", () => {
  it("plays the sentence once and clears the preview when the audio ends", async () => {
    previewStore.word = "CQ";

    await playPhrase("m1", "CQ DE");
    expect(previewStore.word).toBeNull();
    expect(previewStore.phrase).toEqual({ id: "m1", text: "CQ DE", playing: true });

    const worker = lastWorker();
    expect(worker.posted).toHaveLength(1);
    const message = worker.posted[0] as {
      type: string;
      gapSeconds: number;
      text: Uint8Array;
    };
    expect(message.type).toBe("start");
    expect(message.gapSeconds).toBe(0);
    expect(new TextDecoder().decode(message.text)).toBe("CQ DE");

    worker.emitMessage({
      type: "ready",
      channels: 1,
      frames: 2,
      pcm: new Float32Array([0, 0]),
    });
    const source = lastSource();
    expect(worker.terminated).toBe(true);
    expect(source.loop).toBe(false);
    expect(source.started).toBe(true);

    source.onended?.();
    expect(previewStore.phrase).toBeNull();
  });

  it("stops the current audio when toggled off", async () => {
    await playPhrase("m1", "CQ DE");
    lastWorker().emitMessage({
      type: "ready",
      channels: 1,
      frames: 1,
      pcm: new Float32Array([0]),
    });

    stopPhrasePreview();

    expect(lastSource().stopped).toBe(true);
    expect(previewStore.phrase).toBeNull();
  });

  it("clears the preview when the worker reports an error", async () => {
    await playPhrase("m1", "CQ DE");
    lastWorker().emitMessage({ type: "error", message: "engine failed" });

    expect(previewStore.phrase).toBeNull();
  });

  it("clears the preview when the worker emits a runtime error", async () => {
    await playPhrase("m1", "CQ DE");
    lastWorker().onerror?.({ message: "worker crashed" } as ErrorEvent);

    expect(previewStore.phrase).toBeNull();
  });

  it("clears the preview when the engine cannot be loaded", async () => {
    engine.getEngineModule.mockRejectedValueOnce(new Error("no engine"));

    await playPhrase("m1", "CQ DE");

    expect(previewStore.phrase).toBeNull();
  });

  it("discards a stale result after the preview is stopped", async () => {
    let resolveEngine!: (module: WebAssembly.Module) => void;
    engine.getEngineModule.mockReturnValueOnce(
      new Promise<WebAssembly.Module>((resolve) => {
        resolveEngine = resolve;
      }),
    );

    const playing = playPhrase("m1", "CQ DE");
    stopPhrasePreview();
    resolveEngine({});
    await playing;

    expect(previewStore.phrase).toBeNull();
    expect(FakeWorker.instances).toHaveLength(0);
  });

  it("does nothing when stopping without a phrase preview", () => {
    stopPhrasePreview();
    expect(previewStore.phrase).toBeNull();
  });
});
