const BLOCK_FRAMES = 512;
/**
 * Audio is buffered in the worklet so a brief worker or main-thread stall does
 * not turn into silence. The values are durations rather than block counts so
 * they keep the same meaning at every sample rate.
 */
const PREBUFFER_SECONDS = 0.7;
const LOW_WATER_SECONDS = 0.45;
const CLEAR_REFILL_SECONDS = 0.95;
const PROGRESS_SECONDS = 0.1;
const DECLICK_FRAMES = 96;

class CwBufferedPlayer extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.queue = new Array(Math.ceil((sampleRate * 3) / BLOCK_FRAMES) + 8);
    this.read = 0;
    this.write = 0;
    this.count = 0;
    this.current = null;
    this.offset = 0;
    this.channels = options.processorOptions.channels;
    this.refillPending = false;
    this.ended = false;
    this.stopped = false;
    this.ready = false;
    this.playing = false;
    this.underrunning = false;
    this.consumedFrames = 0;
    this.nextProgressFrame = 0;
    this.fadeInRemaining = 0;
    this.lastSample = new Float32Array(2);
    this.audioPort = null;

    this.prebufferBlocks = Math.max(1, Math.ceil((sampleRate * PREBUFFER_SECONDS) / BLOCK_FRAMES));
    this.lowWaterBlocks = Math.max(1, Math.ceil((sampleRate * LOW_WATER_SECONDS) / BLOCK_FRAMES));
    this.clearRefillBlocks = Math.max(
      this.lowWaterBlocks + 1,
      Math.ceil((sampleRate * CLEAR_REFILL_SECONDS) / BLOCK_FRAMES),
    );
    this.progressFrames = Math.max(256, Math.round(sampleRate * PROGRESS_SECONDS));

    this.port.onmessage = (event) => this.handleControl(event.data);
  }

  handleControl(message) {
    if (message.type === "connect") {
      // The render worker gets a private port so buffer refills never need to
      // wait behind UI work on the main thread.
      this.audioPort = message.port;
      this.audioPort.onmessage = (event) => this.handleAudio(event.data);
      return;
    }
    if (message.type === "block" || message.type === "end") {
      // Fallback for browsers where the direct port cannot be transferred.
      this.handleAudio(message);
      return;
    }
    if (message.type === "go") this.playing = true;
    else if (message.type === "stop") this.stopped = true;
    else if (message.type === "snapshot")
      this.port.postMessage({ type: "snapshot", frames: this.consumedFrames });
  }

  handleAudio(message) {
    if (message.type === "block") {
      if (this.count === this.queue.length) return;
      this.queue[this.write] = message.pcm;
      this.write = (this.write + 1) % this.queue.length;
      this.count++;
      if (this.count > this.clearRefillBlocks) {
        this.refillPending = false;
        this.underrunning = false;
      }
      if (!this.ready && this.count >= this.prebufferBlocks) {
        this.ready = true;
        this.port.postMessage({ type: "ready" });
      }
    } else if (message.type === "end") {
      this.ended = true;
      if (!this.ready && this.count > 0) {
        this.ready = true;
        this.port.postMessage({ type: "ready" });
      }
    }
  }

  process(_inputs, outputs) {
    if (this.stopped) return false;
    const output = outputs[0];
    if (!output?.length) return true;
    // The graph pulls the node while it is still pre-buffering. Stay silent
    // without consuming the queue so playback starts on the first block.
    if (!this.playing) return true;
    const frames = output[0].length;
    let i = 0;
    while (i < frames) {
      if (!this.current || this.offset >= this.current.length / this.channels) {
        this.current = null;
        if (!this.count) break;
        this.current = this.queue[this.read];
        this.queue[this.read] = undefined;
        this.read = (this.read + 1) % this.queue.length;
        this.count--;
        this.offset = 0;
      }
      for (let channel = 0; channel < output.length; channel++)
        output[channel][i] = this.current[this.offset * this.channels + channel] ?? 0;
      this.offset++;
      i++;
    }
    this.consumedFrames += i;
    if (i > 0) {
      if (this.fadeInRemaining > 0) {
        const fade = Math.min(this.fadeInRemaining, i);
        for (let channel = 0; channel < output.length; channel++) {
          const data = output[channel];
          for (let k = 0; k < fade; k++) {
            const gain = (DECLICK_FRAMES - this.fadeInRemaining + k + 1) / DECLICK_FRAMES;
            data[k] *= gain;
          }
        }
        this.fadeInRemaining -= fade;
      }
      for (let channel = 0; channel < output.length; channel++)
        this.lastSample[channel] = output[channel][i - 1];
    }
    if (this.consumedFrames >= this.nextProgressFrame) {
      this.nextProgressFrame = this.consumedFrames + this.progressFrames;
      this.port.postMessage({ type: "progress", frames: this.consumedFrames });
    }
    if (i < frames) {
      // Never splice silence into a waveform. A short fade avoids the click a
      // hard zero-fill would produce, and the next block fades back in.
      for (let channel = 0; channel < output.length; channel++) {
        const data = output[channel];
        const fade = Math.min(DECLICK_FRAMES, frames - i);
        for (let k = 0; k < fade; k++)
          data[i + k] = this.lastSample[channel] * (1 - (k + 1) / fade);
        data.fill(0, i + fade);
        this.lastSample[channel] = 0;
      }
      this.fadeInRemaining = DECLICK_FRAMES;
      if (this.playing && !this.ended && !this.underrunning) {
        this.underrunning = true;
        this.port.postMessage({ type: "underrun" });
      }
    }
    if (!this.ended && this.count <= this.lowWaterBlocks && !this.refillPending) {
      this.refillPending = true;
      (this.audioPort ?? this.port).postMessage({ type: "need" });
    }
    if (this.ended && this.count === 0 && !this.current) {
      this.port.postMessage({ type: "done", frames: this.consumedFrames });
      return false;
    }
    return true;
  }
}
registerProcessor("cw-buffered-player", CwBufferedPlayer);
