importScripts("./vendor/WasmMediaEncoder.min.js");

let continueExport = null;
let cancelled = false;

async function exportMp3(message) {
  cancelled = false;
  const engine = new WebAssembly.Instance(message.module, {}).exports;
  const settings = message.settings;
  const configured = engine.cw_set_settings(
    settings.wpm,
    settings.farnsworthWpm,
    settings.frequency,
    settings.secondFrequency,
    settings.envelope,
    settings.volume,
    settings.phase,
    settings.shape,
    settings.stereo,
    settings.room,
    settings.roomLevel,
    settings.paragraphPause,
    settings.rate,
    settings.wordGapMultiplier,
  );
  const input = engine.cw_alloc(message.text.length);
  new Uint8Array(engine.memory.buffer, input, message.text.length).set(message.text);
  const started = engine.cw_stream_start(input, message.text.length);
  engine.cw_free(input, message.text.length);
  if (configured !== 0 || started !== 0)
    throw new Error(
      started === -3
        ? "The text contains an unsupported Morse character."
        : "Text or audio settings were rejected.",
    );

  const channels = engine.cw_stream_channels();
  const samples = new Int16Array(engine.memory.buffer, engine.cw_stream_ptr(), 4096 * channels);
  const totalFrames = engine.cw_stream_total_frames();
  const encoderWasm = new URL("./vendor/mp3.wasm", self.location.href).href;
  const encoder = await WasmMediaEncoder.createEncoder("audio/mpeg", encoderWasm);
  encoder.configure({
    sampleRate: settings.rate,
    outputSampleRate: 44100,
    channels,
    vbrQuality: 0,
  });
  postMessage({ type: "started", frames: totalFrames });

  let rendered = 0;
  let previousProgress = 0;
  while (!engine.cw_stream_done() && !cancelled) {
    const made = engine.cw_stream_render(4096);
    if (made < 0) throw new Error("Renderer failed while producing audio.");
    if (made === 0) break;
    const left = new Float32Array(made);
    const right = channels === 2 ? new Float32Array(made) : null;
    for (let frame = 0; frame < made; frame++) {
      left[frame] = samples[frame * channels] / 32768;
      if (right) right[frame] = samples[frame * channels + 1] / 32768;
    }
    const encoded = encoder.encode(right ? [left, right] : [left]);
    if (encoded.length) {
      const chunk = encoded.slice();
      postMessage({ type: "chunk", data: chunk.buffer }, [chunk.buffer]);
      await new Promise((resolve) => {
        continueExport = resolve;
      });
      continueExport = null;
    }
    rendered += made;
    const progress = totalFrames ? rendered / totalFrames : 1;
    if (progress >= previousProgress + 0.01 || progress >= 1) {
      postMessage({ type: "progress", progress });
      previousProgress = progress;
    }
    if ((rendered / 4096) % 64 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  if (cancelled) {
    postMessage({ type: "cancelled" });
    return;
  }
  const tail = encoder.finalize();
  if (tail.length) {
    const chunk = tail.slice();
    postMessage({ type: "chunk", data: chunk.buffer }, [chunk.buffer]);
    await new Promise((resolve) => {
      continueExport = resolve;
    });
    continueExport = null;
  }
  postMessage({ type: cancelled ? "cancelled" : "done" });
}

self.onmessage = (event) => {
  const message = event.data;
  if (message.type === "continue") {
    continueExport?.();
    return;
  }
  if (message.type === "cancel") {
    cancelled = true;
    continueExport?.();
    return;
  }
  if (message.type === "start")
    exportMp3(message).catch((error) =>
      postMessage({
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
};
