// ── Streaming Manager (Renderer side) ────────────────────────────────────────
// Captures master audio, encodes MP3 via lamejs, sends to main process

export class StreamingManager {
  constructor(engine) {
    this.engine = engine;
    this.connected = false;
    this.encoding = false;
    this._workletNode = null;
    this._encoder = null;
    this._listeners = {};
    this._sampleRate = 44100;
    this._bitrate = 128;
  }

  async connect(config) {
    this._bitrate = config.bitrate || 128;
    const result = await window.radioAPI.streamConnect(config);

    window.radioAPI.onStreamStatus((data) => {
      this.connected = data.connected;
      this._emit('status', data);
      if (data.connected && !this.encoding) this._startCapture();
      if (!data.connected) this._stopCapture();
    });

    if (result.success) {
      this.connected = true;
      await this._startCapture();
      this._emit('status', { connected: true });
    } else {
      this._emit('status', { connected: false, error: result.error });
    }
    return result;
  }

  async disconnect() {
    this._stopCapture();
    await window.radioAPI.streamDisconnect();
    this.connected = false;
    this._emit('status', { connected: false });
  }

  async _startCapture() {
    if (this.encoding) return;
    const ctx = this.engine.getAudioContext();
    const dest = this.engine.getStreamDest();

    // Use MediaRecorder if lamejs not available
    if (typeof lamejs === 'undefined') {
      await this._startMediaRecorder(dest.stream);
      return;
    }

    this._encoder = new lamejs.Mp3Encoder(2, this._sampleRate, this._bitrate);

    try {
      this._workletNode = new AudioWorkletNode(ctx, 'audio-capture');
      dest.connect(this._workletNode);

      this._workletNode.port.onmessage = (e) => {
        if (e.data.type !== 'pcm') return;
        for (const [leftArr, rightArr] of e.data.frames) {
          const leftInt16  = this._floatToInt16(leftArr);
          const rightInt16 = this._floatToInt16(rightArr);
          const mp3 = this._encoder.encodeBuffer(leftInt16, rightInt16);
          if (mp3.length > 0) window.radioAPI.sendAudioChunk(mp3);
        }
      };

      this.encoding = true;
    } catch (err) {
      console.warn('AudioWorklet capture failed, falling back to MediaRecorder:', err);
      await this._startMediaRecorder(dest.stream);
    }
  }

  async _startMediaRecorder(stream) {
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/ogg;codecs=opus';

    const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: this._bitrate * 1000 });
    recorder.ondataavailable = async (e) => {
      if (e.data.size === 0) return;
      const buf = await e.data.arrayBuffer();
      window.radioAPI.sendAudioChunk(new Uint8Array(buf));
    };
    recorder.start(200);
    this._mediaRecorder = recorder;
    this.encoding = true;
  }

  _stopCapture() {
    if (this._workletNode) {
      try { this._workletNode.disconnect(); } catch (_) {}
      this._workletNode = null;
    }
    if (this._mediaRecorder) {
      try { this._mediaRecorder.stop(); } catch (_) {}
      this._mediaRecorder = null;
    }
    if (this._encoder) {
      const final = this._encoder.flush();
      if (final.length > 0) window.radioAPI.sendAudioChunk(final);
      this._encoder = null;
    }
    this.encoding = false;
  }

  _floatToInt16(floatArr) {
    const int16 = new Int16Array(floatArr.length);
    for (let i = 0; i < floatArr.length; i++) {
      const s = Math.max(-1, Math.min(1, floatArr[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16;
  }

  on(event, cb) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(cb);
  }

  _emit(event, data) {
    (this._listeners[event] || []).forEach(cb => cb(data));
  }
}
