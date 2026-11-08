import { exportStore } from "../app/export-store";
import { appStore, currentItem } from "../app/app-store";
import { playbackStore } from "../app/playback-store";
import { getEngineModule } from "../audio/engine-client";
import type { ExportWorkerMessage } from "../audio/messages";
import { createDownloadStream, streamSaverAvailable } from "../data/streamsaver-client";
import { formatExportSize, formatTime } from "../model/format";
import { mp3FileName } from "../model/export";
import { openModal } from "../ui/modal";
import { showToast } from "../ui/toast";

// Browsers with "ask where to save each file" enabled hold the download
// stream until the user confirms a location, so the first write can take as
// long as the dialog stays open. Warn early, but only give up after a wait
// that no reasonable save dialog needs.
const SAVE_LOCATION_HINT_MS = 10_000;
const DOWNLOAD_START_TIMEOUT_MS = 120_000;
// Later writes can stall if the browser stops accepting data (for example a
// full disk). Fail those much sooner so the export does not hang forever.
const DOWNLOAD_STALL_TIMEOUT_MS = 30_000;

function timeoutAfter(milliseconds: number, message: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const promise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), milliseconds);
  });
  return { promise, clear: () => clearTimeout(timer) };
}

export async function startMp3Export() {
  if (exportStore.active) return;
  if (playbackStore.state === "playing" || playbackStore.state === "preparing") {
    showToast("Pause or stop playback before generating an MP3.");
    return;
  }
  if (!streamSaverAvailable()) {
    showToast("This browser does not support streamed downloads.");
    return;
  }
  const item = currentItem();
  if (!item?.content.trim()) {
    showToast("Choose a text before exporting.");
    return;
  }
  let writer: WritableStreamDefaultWriter<Uint8Array>;
  try {
    writer = createDownloadStream(mp3FileName(item.title)).getWriter();
  } catch (error) {
    showToast(
      `Could not start MP3 download: ${error instanceof Error ? error.message : String(error)}`,
    );
    return;
  }
  exportStore.bytes = 0;
  exportStore.active = true;
  const modal = openModal(
    "form-dialog compact-dialog export-dialog",
    `<header><div><p class="eyebrow">PLAYER EXPORT</p><h2>Download MP3</h2></div></header><div class="form-body"><p id="export-status">Preparing audio for high-quality VBR encoding…</p><progress id="export-progress" max="100" value="0"></progress><p id="export-size" class="quiet">Rendered locally in your browser.</p></div><footer><button type="button" class="secondary" data-export-cancel>Cancel download</button><button type="button" class="primary" data-export-done hidden>Done</button></footer>`,
  );
  let activeWorker: Worker | null = null;
  let settled = false;
  let downloadStarted = false;
  let hintTimer: ReturnType<typeof setTimeout> | undefined;
  const clearHint = () => {
    clearTimeout(hintTimer);
    hintTimer = undefined;
  };
  modal.oncancel = (event) => {
    if (activeWorker) event.preventDefault();
  };
  const cancelButton = modal.querySelector<HTMLButtonElement>("[data-export-cancel]")!;
  const doneButton = modal.querySelector<HTMLButtonElement>("[data-export-done]")!;
  const status = modal.querySelector<HTMLElement>("#export-status")!;
  const size = modal.querySelector<HTMLElement>("#export-size")!;
  const progress = modal.querySelector<HTMLProgressElement>("#export-progress")!;
  const worker = new Worker("/engine/export-worker.js");
  activeWorker = worker;
  const finish = (message: string, done = false) => {
    if (settled) return;
    settled = true;
    clearHint();
    activeWorker?.terminate();
    activeWorker = null;
    exportStore.active = false;
    status.textContent = message;
    cancelButton.hidden = true;
    doneButton.hidden = false;
    size.textContent = done
      ? `File size: ${formatExportSize(exportStore.bytes)} · high-quality VBR MP3`
      : "The incomplete file was canceled.";
  };
  doneButton.addEventListener("click", () => modal.close());
  cancelButton.addEventListener("click", () => {
    if (settled) return;
    worker.postMessage({ type: "cancel" });
    void writer.abort("Canceled by user").catch(() => undefined);
    finish("MP3 download canceled.");
  });
  worker.onmessage = async (event: MessageEvent<ExportWorkerMessage>) => {
    if (activeWorker !== worker || settled) return;
    const message = event.data;
    if (message.type === "started") {
      status.textContent = `Rendering and encoding · ${formatTime(message.frames / 44100)} audio`;
    } else if (message.type === "progress") {
      progress.value = Math.round(message.progress * 100);
      // Until the browser accepts the first chunk it is still waiting for a
      // save location; do not replace that explanation with a percentage.
      if (downloadStarted) status.textContent = `Rendering and encoding · ${progress.value}%`;
    } else if (message.type === "chunk") {
      const starting = !downloadStarted;
      if (starting) {
        status.textContent = "Waiting for the save location…";
        hintTimer = setTimeout(() => {
          if (!settled && !downloadStarted)
            status.textContent =
              "Still waiting for the save location… Choose where to save the file, or cancel and try again.";
        }, SAVE_LOCATION_HINT_MS);
      }
      const timeout = timeoutAfter(
        starting ? DOWNLOAD_START_TIMEOUT_MS : DOWNLOAD_STALL_TIMEOUT_MS,
        starting
          ? "The browser did not start the download. Try again, or check that downloads are allowed for this site."
          : "The download stopped accepting data. Check free disk space and try again.",
      );
      try {
        await Promise.race([writer.write(new Uint8Array(message.data)), timeout.promise]);
        timeout.clear();
        clearHint();
        exportStore.bytes += message.data.byteLength;
        if (starting) {
          downloadStarted = true;
          status.textContent = "Download started · encoding…";
        }
        if (!settled) worker.postMessage({ type: "continue" });
      } catch (error) {
        timeout.clear();
        clearHint();
        if (settled) return;
        worker.postMessage({ type: "cancel" });
        void writer.abort(error).catch(() => undefined);
        finish(`MP3 download failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else if (message.type === "done") {
      const timeout = timeoutAfter(
        DOWNLOAD_STALL_TIMEOUT_MS,
        "The browser did not finish saving the file. Check free disk space and try again.",
      );
      try {
        await Promise.race([writer.close(), timeout.promise]);
        timeout.clear();
        progress.value = 100;
        finish("MP3 download complete.", true);
      } catch (error) {
        timeout.clear();
        void writer.abort(error).catch(() => undefined);
        finish(`MP3 download failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else if (message.type === "cancelled") {
      void writer.abort("Canceled by user").catch(() => undefined);
      finish("MP3 download canceled.");
    } else if (message.type === "error") {
      void writer.abort(message.message).catch(() => undefined);
      finish(`MP3 export failed: ${message.message}`);
    }
  };
  worker.onerror = (event) => {
    void writer.abort(event.message).catch(() => undefined);
    finish(`MP3 export worker failed: ${event.message}`);
  };
  try {
    const engineModule = await getEngineModule();
    if (activeWorker !== worker) return;
    const text = new TextEncoder().encode(item.content);
    worker.postMessage(
      {
        type: "start",
        module: engineModule,
        text,
        settings: { ...appStore.settings, rate: 44100 },
      },
      [text.buffer],
    );
  } catch (error) {
    void writer.abort(error).catch(() => undefined);
    finish(
      `Could not prepare MP3 export: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
