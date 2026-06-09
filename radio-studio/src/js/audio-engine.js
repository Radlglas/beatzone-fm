// ── Audio Engine ──────────────────────────────────────────────────────────────
// Single AudioContext with two decks, mixer, sampler, effects

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.decks = [null, null];
    this.masterGain = null;
    this.masterAnalyser = null;
    this.headphoneGain = null;
    this.crossfader = 0.5;
    this.streamDest = null;
    this._listeners = {};
    this.samples = new Array(16).fill(null);
    this.sampleNodes = new Array(16).fill(null);
  }

  async init() {
    this.ctx = new AudioContext({ sampleRate: 44100, latencyHint: 'interactive' });

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1.0;

    this.masterAnalyser = this.ctx.createAnalyser();
    this.masterAnalyser.fftSize = 2048;
    this.masterAnalyser.smoothingTimeConstant = 0.8;

    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -1;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.1;

    this.masterGain
      .connect(limiter)
      .connect(this.masterAnalyser)
      .connect(this.ctx.destination);

    this.streamDest = this.ctx.createMediaStreamDestination();
    this.masterAnalyser.connect(this.streamDest);

    this.headphoneGain = this.ctx.createGain();
    this.headphoneGain.gain.value = 0.8;

    this.decks[0] = this._createDeck(0);
    this.decks[1] = this._createDeck(1);

    await this.ctx.audioWorklet.addModule('./js/audio-capture-worklet.js');

    return this;
  }

  _createDeck(idx) {
    const ctx = this.ctx;
    const d = {
      idx,
      buffer: null,
      source: null,
      gainNode: ctx.createGain(),
      analyser: ctx.createAnalyser(),
      eqHigh: ctx.createBiquadFilter(),
      eqMid: ctx.createBiquadFilter(),
      eqLow: ctx.createBiquadFilter(),
      filterNode: ctx.createBiquadFilter(),
      trimGain: ctx.createGain(),
      channelGain: ctx.createGain(),
      cueGain: ctx.createGain(),
      effects: [],
      effectWet: [],
      playing: false,
      startTime: 0,
      startOffset: 0,
      duration: 0,
      bpm: null,
      detectedBpm: null,
      pitch: 1.0,
      hotCues: new Array(8).fill(null),
      loopStart: null,
      loopEnd: null,
      looping: false,
      meta: null,
      filePath: null,
      peakData: null,
      volume: 0.85
    };

    d.eqHigh.type = 'highshelf';
    d.eqHigh.frequency.value = 10000;
    d.eqHigh.gain.value = 0;

    d.eqMid.type = 'peaking';
    d.eqMid.frequency.value = 1000;
    d.eqMid.Q.value = 0.7;
    d.eqMid.gain.value = 0;

    d.eqLow.type = 'lowshelf';
    d.eqLow.frequency.value = 250;
    d.eqLow.gain.value = 0;

    d.filterNode.type = 'allpass';
    d.filterNode.frequency.value = 22050;

    d.analyser.fftSize = 1024;
    d.analyser.smoothingTimeConstant = 0.85;

    d.trimGain.gain.value = 1.0;
    d.channelGain.gain.value = d.volume;
    d.cueGain.gain.value = 0;

    // EQ chain: trim → low → mid → high → filter → channel gain → analyser → master
    d.trimGain
      .connect(d.eqLow)
      .connect(d.eqMid)
      .connect(d.eqHigh)
      .connect(d.filterNode)
      .connect(d.channelGain)
      .connect(d.analyser);

    // Cross-fader routing
    d._crossGain = ctx.createGain();
    d.analyser.connect(d._crossGain);
    d._crossGain.connect(this.masterGain);

    d.analyser.connect(d.cueGain);
    d.cueGain.connect(this.headphoneGain);

    this._applyEffectsChain(d);
    return d;
  }

  _applyEffectsChain(deck) {
    const ctx = this.ctx;
    const effects = [
      this._createEcho(ctx),
      this._createFilter(ctx),
      this._createReverb(ctx),
      this._createFlanger(ctx)
    ];
    deck.effects = effects;
    deck.effectWet = [0, 0, 0, 0];
    // Effects insert between filterNode output and channelGain
    // For simplicity, effects are parallel sends from analyser
    for (const fx of effects) {
      deck.analyser.connect(fx.input);
      fx.output.connect(this.masterGain);
      fx.dryWet.gain.value = 0;
    }
  }

  _createEcho(ctx) {
    const delay = ctx.createDelay(2);
    delay.delayTime.value = 0.375;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.4;
    const wet = ctx.createGain();
    wet.gain.value = 0;
    delay.connect(feedback).connect(delay);
    delay.connect(wet);
    return { input: delay, output: wet, dryWet: wet, type: 'echo',
             params: { time: delay.delayTime, feedback: feedback.gain } };
  }

  _createFilter(ctx) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 22050;
    filter.Q.value = 2;
    const wet = ctx.createGain();
    wet.gain.value = 0;
    filter.connect(wet);
    return { input: filter, output: wet, dryWet: wet, type: 'filter',
             params: { freq: filter.frequency, q: filter.Q } };
  }

  _createReverb(ctx) {
    const conv = ctx.createConvolver();
    const wet = ctx.createGain();
    wet.gain.value = 0;
    const length = ctx.sampleRate * 2;
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
    }
    conv.buffer = impulse;
    conv.connect(wet);
    return { input: conv, output: wet, dryWet: wet, type: 'reverb', params: {} };
  }

  _createFlanger(ctx) {
    const delay = ctx.createDelay(0.02);
    delay.delayTime.value = 0.005;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.5;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.003;
    lfo.connect(lfoGain).connect(delay.delayTime);
    lfo.start();
    const wet = ctx.createGain();
    wet.gain.value = 0;
    delay.connect(wet);
    return { input: delay, output: wet, dryWet: wet, type: 'flanger',
             params: { rate: lfo.frequency, depth: lfoGain.gain } };
  }

  async loadTrack(deckIdx, filePath, meta = null) {
    const deck = this.decks[deckIdx];
    this.stop(deckIdx);

    const buffer = await window.radioAPI.readFileBuffer(filePath);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);

    deck.buffer = audioBuffer;
    deck.duration = audioBuffer.duration;
    deck.filePath = filePath;
    deck.meta = meta;
    deck.startOffset = 0;
    deck.bpm = meta?.bpm || null;
    deck.peakData = this._computePeaks(audioBuffer, 2000);

    if (!deck.bpm) {
      deck.detectedBpm = this._detectBPM(audioBuffer);
      deck.bpm = deck.detectedBpm;
    }

    this._emit('trackloaded', { deckIdx, meta, duration: audioBuffer.duration, bpm: deck.bpm });
    return { duration: audioBuffer.duration, bpm: deck.bpm };
  }

  _computePeaks(audioBuffer, numPeaks) {
    const ch = audioBuffer.getChannelData(0);
    const blockSize = Math.floor(ch.length / numPeaks);
    const peaks = new Float32Array(numPeaks * 2);
    for (let i = 0; i < numPeaks; i++) {
      let min = 0, max = 0;
      for (let j = 0; j < blockSize; j++) {
        const v = ch[i * blockSize + j] || 0;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      peaks[i * 2] = min;
      peaks[i * 2 + 1] = max;
    }
    return peaks;
  }

  _detectBPM(audioBuffer) {
    const ch = audioBuffer.getChannelData(0);
    const sr = audioBuffer.sampleRate;
    const frameSize = Math.floor(sr * 0.1);
    const energies = [];
    for (let i = 0; i < ch.length - frameSize; i += frameSize) {
      let e = 0;
      for (let j = 0; j < frameSize; j++) e += ch[i + j] ** 2;
      energies.push(e / frameSize);
    }
    const avg = energies.reduce((a, b) => a + b, 0) / energies.length;
    const peaks = [];
    for (let i = 1; i < energies.length - 1; i++) {
      if (energies[i] > energies[i - 1] && energies[i] > energies[i + 1] && energies[i] > avg * 1.5) {
        if (peaks.length === 0 || i - peaks[peaks.length - 1] > 3) peaks.push(i);
      }
    }
    if (peaks.length < 2) return null;
    const intervals = [];
    for (let i = 1; i < peaks.length; i++) intervals.push((peaks[i] - peaks[i - 1]) * 0.1);
    intervals.sort((a, b) => a - b);
    const median = intervals[Math.floor(intervals.length / 2)];
    if (!median) return null;
    const bpm = Math.round(60 / median);
    if (bpm < 60 || bpm > 200) return null;
    return bpm;
  }

  play(deckIdx) {
    const deck = this.decks[deckIdx];
    if (!deck.buffer || deck.playing) return;
    this._startSource(deck);
  }

  _startSource(deck) {
    if (deck.source) {
      try { deck.source.stop(); } catch (_) {}
    }
    const src = this.ctx.createBufferSource();
    src.buffer = deck.buffer;
    src.playbackRate.value = deck.pitch;
    src.loop = deck.looping;
    if (deck.looping && deck.loopStart !== null) {
      src.loopStart = deck.loopStart;
      src.loopEnd = deck.loopEnd;
    }
    src.connect(deck.trimGain);
    src.start(0, deck.startOffset);
    src.onended = () => {
      if (deck.playing && !deck.looping) {
        deck.playing = false;
        deck.startOffset = 0;
        this._emit('trackended', { deckIdx: deck.idx });
      }
    };
    deck.source = src;
    deck.startTime = this.ctx.currentTime;
    deck.playing = true;
    this._emit('playstate', { deckIdx: deck.idx, playing: true });
  }

  pause(deckIdx) {
    const deck = this.decks[deckIdx];
    if (!deck.playing) return;
    deck.startOffset = this.getPosition(deckIdx) * deck.duration;
    try { deck.source.stop(); } catch (_) {}
    deck.playing = false;
    this._emit('playstate', { deckIdx: deck.idx, playing: false });
  }

  stop(deckIdx) {
    const deck = this.decks[deckIdx];
    deck.startOffset = 0;
    if (deck.playing) {
      try { deck.source.stop(); } catch (_) {}
      deck.playing = false;
    }
    this._emit('playstate', { deckIdx: deck.idx, playing: false });
  }

  cue(deckIdx) {
    const deck = this.decks[deckIdx];
    if (deck.playing) {
      this.pause(deckIdx);
    } else {
      deck.startOffset = 0;
      this._emit('positionupdate', { deckIdx, position: 0 });
    }
  }

  setCuePoint(deckIdx) {
    const deck = this.decks[deckIdx];
    deck.startOffset = this.getPosition(deckIdx) * deck.duration;
  }

  setHotCue(deckIdx, index) {
    const deck = this.decks[deckIdx];
    deck.hotCues[index] = this.getPosition(deckIdx);
    this._emit('hotcueupdate', { deckIdx, index, position: deck.hotCues[index] });
  }

  gotoHotCue(deckIdx, index) {
    const deck = this.decks[deckIdx];
    if (deck.hotCues[index] === null) { this.setHotCue(deckIdx, index); return; }
    const wasPlaying = deck.playing;
    const pos = deck.hotCues[index];
    deck.startOffset = pos * deck.duration;
    if (wasPlaying) {
      deck.playing = false;
      this._startSource(deck);
    }
  }

  deleteHotCue(deckIdx, index) {
    this.decks[deckIdx].hotCues[index] = null;
    this._emit('hotcueupdate', { deckIdx, index, position: null });
  }

  setLoopIn(deckIdx) {
    const deck = this.decks[deckIdx];
    deck.loopStart = this.getPosition(deckIdx) * deck.duration;
  }

  setLoopOut(deckIdx) {
    const deck = this.decks[deckIdx];
    deck.loopEnd = this.getPosition(deckIdx) * deck.duration;
    if (deck.loopStart !== null && deck.loopEnd > deck.loopStart) {
      this.enableLoop(deckIdx);
    }
  }

  enableLoop(deckIdx) {
    const deck = this.decks[deckIdx];
    deck.looping = true;
    if (deck.playing) { this._startSource(deck); }
    this._emit('loopstate', { deckIdx, active: true });
  }

  disableLoop(deckIdx) {
    const deck = this.decks[deckIdx];
    deck.looping = false;
    if (deck.source) deck.source.loop = false;
    this._emit('loopstate', { deckIdx, active: false });
  }

  setLoopSize(deckIdx, bars) {
    const deck = this.decks[deckIdx];
    if (!deck.bpm) return;
    const beatLength = 60 / deck.bpm;
    const loopLen = beatLength * bars * 4;
    const pos = this.getPosition(deckIdx) * deck.duration;
    deck.loopStart = pos;
    deck.loopEnd = pos + loopLen;
    this.enableLoop(deckIdx);
  }

  getPosition(deckIdx) {
    const deck = this.decks[deckIdx];
    if (!deck.buffer || deck.duration === 0) return 0;
    let pos;
    if (deck.playing) {
      pos = (deck.startOffset + (this.ctx.currentTime - deck.startTime) * deck.pitch) / deck.duration;
    } else {
      pos = deck.startOffset / deck.duration;
    }
    return Math.max(0, Math.min(1, pos));
  }

  seekTo(deckIdx, normalizedPos) {
    const deck = this.decks[deckIdx];
    if (!deck.buffer) return;
    const wasPlaying = deck.playing;
    deck.startOffset = normalizedPos * deck.duration;
    if (wasPlaying) { deck.playing = false; this._startSource(deck); }
  }

  setPitch(deckIdx, rate) {
    const deck = this.decks[deckIdx];
    deck.pitch = rate;
    if (deck.source) deck.source.playbackRate.setTargetAtTime(rate, this.ctx.currentTime, 0.05);
  }

  setVolume(deckIdx, val) {
    const deck = this.decks[deckIdx];
    deck.volume = val;
    deck.channelGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.01);
  }

  setGain(deckIdx, val) {
    this.decks[deckIdx].trimGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.01);
  }

  setEQ(deckIdx, band, val) {
    const deck = this.decks[deckIdx];
    const dbVal = (val - 1) * 24;
    if (band === 'high') deck.eqHigh.gain.setTargetAtTime(dbVal, this.ctx.currentTime, 0.01);
    if (band === 'mid')  deck.eqMid.gain.setTargetAtTime(dbVal, this.ctx.currentTime, 0.01);
    if (band === 'low')  deck.eqLow.gain.setTargetAtTime(dbVal, this.ctx.currentTime, 0.01);
  }

  setFilter(deckIdx, val) {
    const deck = this.decks[deckIdx];
    if (Math.abs(val - 0.5) < 0.02) {
      deck.filterNode.type = 'allpass';
    } else if (val < 0.5) {
      deck.filterNode.type = 'lowpass';
      const freq = 200 + (val / 0.5) * 21800;
      deck.filterNode.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.02);
    } else {
      deck.filterNode.type = 'highpass';
      const freq = 200 + ((val - 0.5) / 0.5) * 5000;
      deck.filterNode.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.02);
    }
  }

  setCrossfader(val) {
    this.crossfader = val;
    const gainA = val < 0.5 ? 1 : Math.cos((val - 0.5) * Math.PI);
    const gainB = val > 0.5 ? 1 : Math.cos((0.5 - val) * Math.PI);
    this.decks[0]._crossGain.gain.setTargetAtTime(gainA, this.ctx.currentTime, 0.01);
    this.decks[1]._crossGain.gain.setTargetAtTime(gainB, this.ctx.currentTime, 0.01);
  }

  setMasterVolume(val) {
    this.masterGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.01);
  }

  setHeadphoneVolume(val) {
    this.headphoneGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.01);
  }

  setCue(deckIdx, enabled) {
    this.decks[deckIdx].cueGain.gain.setTargetAtTime(enabled ? 0.7 : 0, this.ctx.currentTime, 0.02);
  }

  syncDecks(sourceIdx) {
    const src = this.decks[sourceIdx];
    const dst = this.decks[1 - sourceIdx];
    if (!src.bpm || !dst.bpm) return;
    const ratio = src.bpm / dst.bpm;
    dst.pitch = ratio;
    if (dst.source) dst.source.playbackRate.setTargetAtTime(ratio, this.ctx.currentTime, 0.05);
  }

  setEffect(deckIdx, slot, enabled, wet = 0.4) {
    const deck = this.decks[deckIdx];
    if (!deck.effects[slot]) return;
    deck.effectWet[slot] = enabled ? wet : 0;
    deck.effects[slot].dryWet.gain.setTargetAtTime(deck.effectWet[slot], this.ctx.currentTime, 0.05);
  }

  getVULevel(deckIdx) {
    const deck = this.decks[deckIdx];
    const data = new Float32Array(deck.analyser.fftSize);
    deck.analyser.getFloatTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    const rms = Math.sqrt(sum / data.length);
    return { left: rms, right: rms };
  }

  getMasterVU() {
    const data = new Float32Array(this.masterAnalyser.fftSize);
    this.masterAnalyser.getFloatTimeDomainData(data);
    let sumL = 0, sumR = 0;
    for (let i = 0; i < data.length; i += 2) {
      sumL += data[i] * data[i];
      sumR += data[i + 1] * data[i + 1];
    }
    const n = data.length / 2;
    return { left: Math.sqrt(sumL / n), right: Math.sqrt(sumR / n) };
  }

  // Sampler
  async loadSample(padIdx, filePath) {
    const buf = await window.radioAPI.readFileBuffer(filePath);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const audioBuffer = await this.ctx.decodeAudioData(ab);
    this.samples[padIdx] = { buffer: audioBuffer, filePath, name: window.radioAPI.basename(filePath, window.radioAPI.extname(filePath)) };
    this._emit('sampleloaded', { padIdx, name: this.samples[padIdx].name });
  }

  playSample(padIdx, volume = 0.8) {
    if (!this.samples[padIdx]) return;
    if (this.sampleNodes[padIdx]) { try { this.sampleNodes[padIdx].stop(); } catch (_) {} }
    const src = this.ctx.createBufferSource();
    src.buffer = this.samples[padIdx].buffer;
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g).connect(this.masterGain);
    src.start();
    src.onended = () => { this.sampleNodes[padIdx] = null; };
    this.sampleNodes[padIdx] = src;
  }

  stopSample(padIdx) {
    if (this.sampleNodes[padIdx]) { try { this.sampleNodes[padIdx].stop(); } catch (_) {} }
  }

  getStreamDest() { return this.streamDest; }
  getAudioContext() { return this.ctx; }

  on(event, cb) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(cb);
  }

  _emit(event, data) {
    (this._listeners[event] || []).forEach(cb => cb(data));
  }
}
