class CwBufferedPlayer extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.queue = new Array(256);
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
    this.port.onmessage = (event) => {
      const message = event.data;
      if (message.type === "block") {
        if (this.count === this.queue.length) return;
        this.queue[this.write] = message.pcm;
        this.write = (this.write + 1) % this.queue.length;
        this.count++;
        if (this.count > 24) {
          this.refillPending = false;
          this.underrunning = false;
        }
        if (!this.ready && this.count >= 48) {
          this.ready = true;
          this.port.postMessage({ type: "ready" });
        }
      } else if (message.type === "end") {
        this.ended = true;
        if (!this.ready && this.count > 0) {
          this.ready = true;
          this.port.postMessage({ type: "ready" });
        }
      } else if (message.type === "go") this.playing = true;
      else if (message.type === "stop") this.stopped = true;
      else if (message.type === "snapshot")
        this.port.postMessage({ type: "snapshot", frames: this.consumedFrames });
    };
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
    if (this.consumedFrames % 1024 < frames)
      this.port.postMessage({ type: "progress", frames: this.consumedFrames });
    if (i < frames) {
      for (const channel of output) channel.fill(0, i);
      if (this.playing && !this.ended && !this.underrunning) {
        this.underrunning = true;
        this.port.postMessage({ type: "underrun" });
      }
    }
    if (!this.ended && this.count <= 16 && !this.refillPending) {
      this.refillPending = true;
      this.port.postMessage({ type: "need" });
    }
    if (this.ended && this.count === 0 && !this.current) {
      this.port.postMessage({ type: "done", frames: this.consumedFrames });
      return false;
    }
    return true;
  }
}
registerProcessor("cw-buffered-player", CwBufferedPlayer);
