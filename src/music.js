// Background music: one looping track on its own Web Audio graph, kept apart from the
// synthesized effects in audio.js so that music volume and fades never touch the effects.
//
// The track plays as a decoded buffer rather than an <audio> element: buffer loops are
// gapless and sample-accurate, the loop points can sit inside the file (so the original
// recording stays untouched), and the gain node works on iOS, where element volume is fixed.
// The game never calls this module directly; main.js drives it from the game's state.

// Everything about the track in one place. Swap `src` to try another version of the track
// (the path is resolved relative to this file, so it also works under the GitHub Pages path).
export const MUSIC = {
  src: '../assets/audio/triumph-in-the-ring.mp3',
  volume: 0.15,         // music gain; the effects keep their own master gain in audio.js
  loopStart: 1.17877,   // seconds: the band's entry (a downbeat); the quiet intro plays once
  loopEnd: 115.742,     // seconds: the downbeat where the ending begins, 63 bars later (0 = end of track)
  fadeOut: 0.5,         // seconds; used when a run ends
};

function defaultContext() {
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  return AC ? new AC() : null;
}

async function defaultFetch(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.arrayBuffer();
}

export class Music {
  constructor({
    url, enabled = true, volume = MUSIC.volume, loopStart = MUSIC.loopStart, loopEnd = MUSIC.loopEnd,
    fadeOut = MUSIC.fadeOut, createContext = defaultContext, fetchBytes = defaultFetch, onError = () => {},
  } = {}) {
    this.url = url;
    this.enabled = enabled;
    this.volume = volume;
    this.loopStart = loopStart;
    this.loopEnd = loopEnd;
    this.fadeSeconds = fadeOut;
    this.createContext = createContext;
    this.fetchBytes = fetchBytes;
    this.onError = onError;

    this.ctx = null;
    this.gain = null;
    this.bytes = null;      // encoded file, once fetched
    this.buffer = null;     // decoded track, once a context exists
    this.decoding = false;
    this.failed = false;

    // What the game wants from the music. A source node exists only while the intent is
    // 'playing' and nothing holds it back, so a track that finishes loading late starts
    // only if it is still wanted.
    this.intent = 'stopped';  // stopped | playing | paused
    this.pageActive = true;   // false while the tab is hidden
    this.position = 0;        // seconds into the track to (re)start from
    this.source = null;       // the one live source node
    this.startedAt = 0;       // context time when `source` started
    this.startOffset = 0;     // track position `source` started from
    this.fading = null;       // a source that is fading out and will stop on its own
  }

  // Fetch the file early; decoding waits for a context. Safe to call once at boot.
  load() {
    if (!this.url || this.bytes || this.failed) return Promise.resolve();
    return this.fetchBytes(this.url)
      .then((bytes) => { this.bytes = bytes; this.decode(); })
      .catch((err) => { this.failed = true; this.onError(err); });
  }

  // Browsers only allow audio after a user gesture; call this from the same click handlers
  // that unlock the sound effects.
  unlock() {
    if (!this.ctx) {
      try {
        this.ctx = this.createContext();
      } catch (err) {
        this.failed = true;
        this.onError(err);
      }
      if (!this.ctx) return;
      this.gain = this.ctx.createGain();
      this.gain.gain.value = this.volume;
      this.gain.connect(this.ctx.destination);
      this.decode();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  decode() {
    if (!this.ctx || !this.bytes || this.buffer || this.decoding) return;
    this.decoding = true;
    Promise.resolve()
      .then(() => this.ctx.decodeAudioData(this.bytes.slice(0)))
      .then((buffer) => { this.buffer = buffer; this.decoding = false; this.sync(); })
      .catch((err) => { this.decoding = false; this.failed = true; this.onError(err); });
  }

  get ready() { return !!this.buffer; }
  get playing() { return !!this.source; }

  // Begin a run: the track starts from the top, replacing whatever was playing or fading.
  start() {
    this.stopSource(this.fading);
    this.fading = null;
    this.stopSource(this.source);
    this.source = null;
    this.position = 0;
    this.intent = 'playing';
    this.sync();
  }

  pause() {
    if (this.intent !== 'playing') return;
    this.position = this.currentPosition();
    this.intent = 'paused';
    this.sync();
  }

  resume() {
    if (this.intent !== 'paused') return;
    this.intent = 'playing';
    this.sync();
  }

  // End a run: the music fades on its own gain over `fadeOut` seconds and then stops.
  fadeOut() {
    if (this.intent === 'stopped') return;
    this.intent = 'stopped';
    this.position = 0;
    if (this.source && this.ctx) {
      const t = this.ctx.currentTime;
      const g = this.gain.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(this.volume, t);
      g.linearRampToValueAtTime(0, t + this.fadeSeconds);
      this.stopSource(this.fading);
      const src = this.source;
      this.fading = src;
      this.source = null;
      src.onended = () => { if (this.fading === src) this.fading = null; };
      try { src.stop(t + this.fadeSeconds); } catch { /* already stopped */ }
    } else {
      this.sync();
    }
  }

  stop() {
    this.intent = 'stopped';
    this.position = 0;
    this.stopSource(this.fading);
    this.fading = null;
    this.sync();
  }

  // The sound toggle. Off silences and holds the music; on resumes it only if still wanted.
  setEnabled(on) {
    this.enabled = on;
    this.sync();
  }

  // Hold the music while the tab is hidden; it continues where it was when the tab returns.
  setPageActive(active) {
    this.pageActive = active;
    this.sync();
  }

  setVolume(v) {
    this.volume = v;
    if (this.gain && !this.fading) this.gain.gain.value = v;
  }

  // Track position of the live source, folded into the loop.
  currentPosition() {
    if (!this.source || !this.ctx) return this.position;
    let pos = this.startOffset + (this.ctx.currentTime - this.startedAt);
    const end = this.loopEnd > 0 ? this.loopEnd : this.buffer.duration;
    const len = end - this.loopStart;
    if (pos >= end && len > 0) pos = this.loopStart + ((pos - this.loopStart) % len);
    return pos;
  }

  // Make the live source match the intent. All state changes end here.
  sync() {
    const wanted = this.intent === 'playing' && this.enabled && this.pageActive;
    if (wanted && !this.source && this.buffer && this.ctx) {
      const t = this.ctx.currentTime;
      const g = this.gain.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(this.volume, t);
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffer;
      src.loop = true;
      src.loopStart = this.loopStart;
      src.loopEnd = this.loopEnd > 0 ? this.loopEnd : this.buffer.duration;
      src.connect(this.gain);
      const offset = Math.min(this.position, Math.max(0, this.buffer.duration - 0.01));
      try {
        src.start(t, offset);
      } catch (err) {
        this.onError(err);
        return;
      }
      this.source = src;
      this.startedAt = t;
      this.startOffset = offset;
    } else if (!wanted && this.source) {
      if (this.intent === 'playing') this.position = this.currentPosition(); // held, not paused
      this.stopSource(this.source);
      this.source = null;
    }
  }

  stopSource(src) {
    if (!src) return;
    try { src.stop(); } catch { /* never started or already stopped */ }
    try { src.disconnect(); } catch { /* ignore */ }
  }
}
