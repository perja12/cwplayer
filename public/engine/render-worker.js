let engine,
  channels,
  samples,
  finished = false;
const BLOCK_FRAMES = 512;
const REFILL_BLOCKS = 48;

function fill(blocks) {
  for (let block = 0; block < blocks && !finished; block++) {
    const made = engine.cw_stream_render(BLOCK_FRAMES);
    if (made < 0) {
      postMessage({ type: "error", message: "Renderer failed while producing audio." });
      finished = true;
      break;
    }
    const pcm = new Float32Array(made * channels);
    for (let i = 0; i < pcm.length; i++) pcm[i] = samples[i] / 32768;
    postMessage({ type: "block", pcm }, [pcm.buffer]);
    if (engine.cw_stream_done()) {
      finished = true;
      postMessage({ type: "end" });
    }
  }
}

self.onmessage = (event) => {
  const message = event.data;
  if (message.type === "start") {
    try {
      engine = new WebAssembly.Instance(message.module, {}).exports;
      const s = message.settings;
      const result = engine.cw_set_settings(
        s.wpm,
        s.farnsworthWpm,
        s.frequency,
        s.secondFrequency,
        s.envelope,
        s.volume,
        s.phase,
        s.shape,
        s.stereo,
        s.room,
        s.roomLevel,
        s.paragraphPause,
        s.rate,
        s.wordGapMultiplier,
      );
      const startStream = (text) => {
        const input = engine.cw_alloc(text.length);
        new Uint8Array(engine.memory.buffer, input, text.length).set(text);
        const started = engine.cw_stream_start(input, text.length);
        engine.cw_free(input, text.length);
        return started;
      };
      // The first stream is only asked for its timeline. Preparing a stream
      // schedules the whole document eagerly, so the frame count and word
      // ranges are available without synthesizing a single sample.
      const started = startStream(message.text);
      if (result !== 0 || started !== 0)
        throw new Error(
          started === -3
            ? "Text contains a character the Morse engine does not support."
            : "Text or settings were rejected.",
        );
      const totalFrames = engine.cw_stream_total_frames();
      const count = engine.cw_stream_span_count();
      const spanPtr = engine.cw_alloc(16);
      const view = new DataView(engine.memory.buffer);
      const spans = [];
      for (let i = 0; i < count; i++) {
        if (engine.cw_stream_span_at(i, spanPtr) !== 0) continue;
        spans.push({
          startByte: view.getUint32(spanPtr, true),
          endByte: view.getUint32(spanPtr + 4, true),
          startFrame: view.getUint32(spanPtr + 8, true),
          endFrame: view.getUint32(spanPtr + 12, true),
        });
      }
      engine.cw_free(spanPtr, 16);
      // Resume at the saved word by starting a fresh stream there instead of
      // rendering and discarding every frame before it. The schedule is
      // deterministic, so suffix frame N is full-timeline frame
      // resumeFrame + N: frame counts and spans stay absolute.
      let resumeFrame = 0;
      let resumeByte = 0;
      if (message.startByte > 0) {
        const resumeSpan = spans.find((span) => span.endByte > message.startByte);
        if (resumeSpan && resumeSpan.startFrame < totalFrames) {
          resumeFrame = resumeSpan.startFrame;
          resumeByte = resumeSpan.startByte;
        }
      }
      const audioText = resumeByte > 0 ? message.text.subarray(resumeByte) : message.text;
      const audioStarted = startStream(audioText);
      if (audioStarted !== 0)
        throw new Error("Text or settings were rejected while resuming playback.");
      channels = engine.cw_stream_channels();
      samples = new Int16Array(
        engine.memory.buffer,
        engine.cw_stream_ptr(),
        BLOCK_FRAMES * channels,
      );
      postMessage({ type: "started", frames: totalFrames, channels, resumeFrame });
      postMessage({ type: "spans", spans });
      fill(REFILL_BLOCKS);
    } catch (error) {
      postMessage({
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  } else if (message.type === "fill" && !finished) {
    fill(REFILL_BLOCKS);
  } else if (message.type === "stop") {
    finished = true;
    close();
  }
};
