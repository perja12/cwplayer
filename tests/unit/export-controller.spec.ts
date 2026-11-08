// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appStore } from "../../src/app/app-store";
import { exportStore } from "../../src/app/export-store";
import { playbackStore } from "../../src/app/playback-store";
import type { ExportWorkerMessage } from "../../src/audio/messages";
import { startMp3Export } from "../../src/controllers/export-controller";
import { resetStores } from "./helpers";

const mocks = vi.hoisted(() => {
  const writer = {
    write: vi.fn(),
    close: vi.fn(),
    abort: vi.fn(),
  };
  const getWriter = vi.fn(() => writer);
  const createDownloadStream = vi.fn(() => ({ getWriter }));
  const streamSaverAvailable = vi.fn(() => true);
  const getEngineModule = vi.fn();
  return { writer, getWriter, createDownloadStream, streamSaverAvailable, getEngineModule };
});

vi.mock("../../src/data/streamsaver-client", () => ({
  streamSaverAvailable: mocks.streamSaverAvailable,
  createDownloadStream: mocks.createDownloadStream,
}));

vi.mock("../../src/audio/engine-client", () => ({
  getEngineModule: mocks.getEngineModule,
}));

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent<ExportWorkerMessage>) => unknown) | null = null;
  onerror: ((event: ErrorEvent) => unknown) | null = null;
  messages: unknown[] = [];
  postMessage = vi.fn((message: unknown) => {
    this.messages.push(message);
  });
  terminate = vi.fn();
  constructor() {
    FakeWorker.instances.push(this);
  }
}

const currentWorker = () => FakeWorker.instances.at(-1)!;
const statusText = () => document.querySelector("#export-status")?.textContent ?? "";
const toastText = () => document.querySelector("#toast")?.textContent ?? "";
const send = (message: ExportWorkerMessage) =>
  currentWorker().onmessage?.({ data: message } as MessageEvent<ExportWorkerMessage>);

beforeEach(() => {
  resetStores();
  FakeWorker.instances = [];
  mocks.createDownloadStream.mockClear();
  mocks.streamSaverAvailable.mockReturnValue(true);
  mocks.getEngineModule.mockReset();
  mocks.getEngineModule.mockResolvedValue({});
  mocks.writer.write.mockReset();
  mocks.writer.close.mockReset();
  mocks.writer.abort.mockReset();
  mocks.writer.close.mockResolvedValue(undefined);
  mocks.writer.abort.mockResolvedValue(undefined);
  document.body.innerHTML = '<div id="toast" hidden></div><dialog id="modal"></dialog>';
  vi.stubGlobal("Worker", FakeWorker);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("MP3 export", () => {
  it("explains that it is waiting for a save location until the first chunk is accepted", async () => {
    vi.useFakeTimers();
    let acceptFirstChunk!: () => void;
    mocks.writer.write.mockReturnValue(
      new Promise<void>((resolve) => {
        acceptFirstChunk = resolve;
      }),
    );
    await startMp3Export();
    expect(exportStore.active).toBe(true);

    const write = send({ type: "chunk", data: new ArrayBuffer(8) });
    expect(statusText()).toBe("Waiting for the save location…");

    await vi.advanceTimersByTimeAsync(10_000);
    expect(statusText()).toContain("Still waiting for the save location");
    expect(statusText()).toContain("cancel and try again");

    acceptFirstChunk();
    await write;
    expect(statusText()).toBe("Download started · encoding…");
    expect(exportStore.bytes).toBe(8);
    expect(currentWorker().messages).toContainEqual({ type: "continue" });

    await send({ type: "done" });
    expect(statusText()).toBe("MP3 download complete.");
    expect(exportStore.active).toBe(false);
  });

  it("fails cleanly when the browser never starts the download", async () => {
    vi.useFakeTimers();
    mocks.writer.write.mockReturnValue(new Promise<void>(() => undefined));
    await startMp3Export();

    const write = send({ type: "chunk", data: new ArrayBuffer(8) });
    await vi.advanceTimersByTimeAsync(120_000);
    await write;

    expect(statusText()).toContain("did not start the download");
    expect(exportStore.active).toBe(false);
    expect(currentWorker().terminate).toHaveBeenCalled();
    expect(mocks.writer.abort).toHaveBeenCalled();
  });

  it("fails cleanly when a later chunk stalls", async () => {
    vi.useFakeTimers();
    mocks.writer.write.mockResolvedValueOnce(undefined);
    mocks.writer.write.mockReturnValueOnce(new Promise<void>(() => undefined));
    await startMp3Export();

    await send({ type: "chunk", data: new ArrayBuffer(8) });
    expect(statusText()).toBe("Download started · encoding…");

    const stalled = send({ type: "chunk", data: new ArrayBuffer(8) });
    await vi.advanceTimersByTimeAsync(30_000);
    await stalled;

    expect(statusText()).toContain("stopped accepting data");
    expect(exportStore.active).toBe(false);
    expect(currentWorker().terminate).toHaveBeenCalled();
  });

  it("cancels immediately even while a write is blocked", async () => {
    mocks.writer.write.mockReturnValue(new Promise<void>(() => undefined));
    await startMp3Export();
    void send({ type: "chunk", data: new ArrayBuffer(8) });

    document.querySelector<HTMLButtonElement>("[data-export-cancel]")!.click();

    expect(statusText()).toBe("MP3 download canceled.");
    expect(exportStore.active).toBe(false);
    expect(mocks.writer.abort).toHaveBeenCalled();
    expect(currentWorker().terminate).toHaveBeenCalled();
    expect(currentWorker().messages).toContainEqual({ type: "cancel" });

    document.querySelector<HTMLButtonElement>("[data-export-cancel]")!.click();
    expect(statusText()).toBe("MP3 download canceled.");
  });

  it("ignores late worker messages after the export settles", async () => {
    mocks.writer.write.mockResolvedValue(undefined);
    await startMp3Export();
    const worker = currentWorker();
    await send({ type: "cancelled" });
    expect(statusText()).toBe("MP3 download canceled.");

    await send({ type: "error", message: "late" });
    worker.onerror?.({ message: "late" } as ErrorEvent);
    expect(statusText()).toBe("MP3 download canceled.");
  });

  it("refuses to export while active, playing, preparing, unavailable, or empty", async () => {
    exportStore.active = true;
    await startMp3Export();
    expect(FakeWorker.instances).toHaveLength(0);

    exportStore.active = false;
    mocks.streamSaverAvailable.mockReturnValue(false);
    await startMp3Export();
    expect(toastText()).toBe("This browser does not support streamed downloads.");

    mocks.streamSaverAvailable.mockReturnValue(true);
    playbackStore.state = "playing";
    await startMp3Export();
    expect(toastText()).toBe("Pause or stop playback before generating an MP3.");

    playbackStore.state = "preparing";
    await startMp3Export();
    expect(toastText()).toBe("Pause or stop playback before generating an MP3.");

    playbackStore.state = "idle";
    appStore.texts = [];
    await startMp3Export();
    expect(toastText()).toBe("Choose a text before exporting.");
    expect(FakeWorker.instances).toHaveLength(0);
  });

  it("reports a stream creation failure without opening the dialog", async () => {
    mocks.createDownloadStream.mockImplementationOnce(() => {
      throw new Error("no stream");
    });
    await startMp3Export();

    expect(toastText()).toBe("Could not start MP3 download: no stream");
    expect(FakeWorker.instances).toHaveLength(0);
  });

  it("stringifies non-Error failures from stream creation and engine loading", async () => {
    mocks.createDownloadStream.mockImplementationOnce(() => {
      // Browsers and older polyfills can reject with values that are not Error.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw "no stream";
    });
    await startMp3Export();
    expect(toastText()).toBe("Could not start MP3 download: no stream");

    mocks.getEngineModule.mockRejectedValueOnce("no engine");
    await startMp3Export();
    expect(statusText()).toBe("Could not prepare MP3 export: no engine");
    expect(exportStore.active).toBe(false);
  });

  it("reports an engine module failure and cleans up the stream", async () => {
    mocks.getEngineModule.mockRejectedValueOnce(new Error("no engine"));
    await startMp3Export();

    expect(statusText()).toBe("Could not prepare MP3 export: no engine");
    expect(exportStore.active).toBe(false);
    expect(mocks.writer.abort).toHaveBeenCalled();
  });

  it("shows render progress and handles worker errors", async () => {
    mocks.writer.write.mockResolvedValue(undefined);
    await startMp3Export();
    const worker = currentWorker();

    await send({ type: "started", frames: 88_200 });
    expect(statusText()).toBe("Rendering and encoding · 0:00:02 audio");

    await send({ type: "progress", progress: 0.42 });
    expect(document.querySelector<HTMLProgressElement>("#export-progress")?.value).toBe(42);
    expect(statusText()).toBe("Rendering and encoding · 0:00:02 audio");

    await send({ type: "chunk", data: new ArrayBuffer(8) });
    await send({ type: "progress", progress: 0.75 });
    expect(statusText()).toBe("Rendering and encoding · 75%");

    await send({ type: "error", message: "encoder failed" });
    expect(statusText()).toBe("MP3 export failed: encoder failed");
    expect(worker.terminate).toHaveBeenCalled();
  });

  it("reports worker startup failures", async () => {
    await startMp3Export();
    currentWorker().onerror?.({ message: "worker failed" } as ErrorEvent);

    expect(statusText()).toBe("MP3 export worker failed: worker failed");
    expect(exportStore.active).toBe(false);
  });

  it("reports write and close failures, including non-Error reasons", async () => {
    mocks.writer.write.mockRejectedValueOnce("disk full");
    await startMp3Export();
    await send({ type: "chunk", data: new ArrayBuffer(8) });
    expect(statusText()).toBe("MP3 download failed: disk full");
    expect(mocks.writer.abort).toHaveBeenCalled();

    exportStore.active = false;
    FakeWorker.instances = [];
    mocks.writer.write.mockReset();
    mocks.writer.close.mockRejectedValueOnce("close failed");
    await startMp3Export();
    await send({ type: "done" });
    expect(statusText()).toBe("MP3 download failed: close failed");
  });

  it("does not overwrite a cancellation when a blocked write later rejects", async () => {
    let rejectWrite!: (error: Error) => void;
    mocks.writer.write.mockReturnValue(
      new Promise<void>((_resolve, reject) => {
        rejectWrite = reject;
      }),
    );
    await startMp3Export();
    const write = send({ type: "chunk", data: new ArrayBuffer(8) });
    document.querySelector<HTMLButtonElement>("[data-export-cancel]")!.click();
    rejectWrite(new Error("aborted"));
    await write;

    expect(statusText()).toBe("MP3 download canceled.");
  });

  it("stops a pending start when the user cancels while the engine loads", async () => {
    let resolveEngine!: (module: object) => void;
    mocks.getEngineModule.mockReturnValue(
      new Promise((resolve) => {
        resolveEngine = resolve;
      }),
    );
    const started = startMp3Export();
    await Promise.resolve();
    document.querySelector<HTMLButtonElement>("[data-export-cancel]")!.click();
    resolveEngine({});
    await started;

    expect(statusText()).toBe("MP3 download canceled.");
    expect(currentWorker().postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "start" }),
      expect.anything(),
    );
  });
});
