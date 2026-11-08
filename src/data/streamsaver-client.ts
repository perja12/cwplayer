import type { StreamSaverWindow } from "../model/types";

const streamSaver = (window as StreamSaverWindow).streamSaver;
if (streamSaver)
  streamSaver.mitm = new URL("/vendor/streamsaver/mitm.html?version=2.0.0", location.href).href;

export function streamSaverAvailable() {
  return !!streamSaver?.supported && typeof WritableStream !== "undefined";
}

export function createDownloadStream(filename: string) {
  if (!streamSaver) throw new Error("Streamed downloads are unavailable in this browser.");
  return streamSaver.createWriteStream(filename);
}
