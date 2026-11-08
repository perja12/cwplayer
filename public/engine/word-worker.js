// Render a short snippet once, then append an optional silent gap so the main thread can loop it.
self.onmessage = (event) => {
  const message = event.data;
  if (message.type !== "start") return;
  try {
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
    if (configured !== 0 || started !== 0) {
      throw new Error(
        started === -3
          ? "This text contains an unsupported Morse character."
          : "The text or sound settings were rejected.",
      );
    }

    const channels = engine.cw_stream_channels();
    const samples = new Int16Array(engine.memory.buffer, engine.cw_stream_ptr(), 4096 * channels);
    const blocks = [];
    let audioFrames = 0;
    while (!engine.cw_stream_done()) {
      const made = engine.cw_stream_render(4096);
      if (made < 0) throw new Error("The Morse renderer failed while preparing this text.");
      if (made === 0) break;
      const pcm = new Float32Array(made * channels);
      for (let index = 0; index < pcm.length; index++) pcm[index] = samples[index] / 32768;
      blocks.push(pcm);
      audioFrames += made;
    }

    const gapFrames = Math.max(0, Math.round(message.gapSeconds * settings.rate));
    const frames = audioFrames + gapFrames;
    if (!frames) throw new Error("There was no audio to play for this text.");
    const pcm = new Float32Array(frames * channels);
    let offset = 0;
    for (const block of blocks) {
      pcm.set(block, offset);
      offset += block.length;
    }
    self.postMessage({ type: "ready", pcm, frames, channels }, [pcm.buffer]);
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
