export type EngineSpan = {
  startByte: number;
  endByte: number;
  startFrame: number;
  endFrame: number;
};

export type RenderWorkerMessage =
  | { type: "started"; frames: number; channels: number; resumeFrame: number }
  | { type: "spans"; spans: EngineSpan[] }
  | { type: "block"; pcm: Float32Array }
  | { type: "end" }
  | { type: "error"; message: string };

export type ExportWorkerMessage =
  | { type: "started"; frames: number }
  | { type: "progress"; progress: number }
  | { type: "chunk"; data: ArrayBuffer }
  | { type: "done" }
  | { type: "cancelled" }
  | { type: "error"; message: string };

export type WordWorkerMessage =
  | { type: "ready"; pcm: Float32Array; frames: number; channels: number }
  | { type: "error"; message: string };

export type WorkletMessage =
  | { type: "ready" }
  | { type: "progress"; frames: number }
  | { type: "need" }
  | { type: "done" }
  | { type: "underrun" };
