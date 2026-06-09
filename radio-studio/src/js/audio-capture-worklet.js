class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buf = [];
    this._flushCount = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const L = input[0] ? Array.from(input[0]) : [];
    const R = input[1] ? Array.from(input[1]) : Array.from(input[0] || []);
    this._buf.push([L, R]);
    this._flushCount++;
    if (this._flushCount >= 8) {
      this.port.postMessage({ type: 'pcm', frames: this._buf });
      this._buf = [];
      this._flushCount = 0;
    }
    return true;
  }
}

registerProcessor('audio-capture', AudioCaptureProcessor);
