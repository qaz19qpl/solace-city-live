// audio.js — every sound in Solace City is synthesized with WebAudio: no
// audio files exist. A tiny engine hum that follows your speed, a two-tone
// siren, noise-burst gunshots, honks, crashes, a cash register cha-ching
// and a lazy coastal music loop built from scheduled oscillators.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenLfo = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.nextNoteTime = 0;
  }

  // Must be called from a user gesture at least once.
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.startMusic();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.03);
    }
  }

  tone(freq, dur, type = 'sine', vol = 0.2, when = 0, slideTo = null) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime + when;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain).connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch { /* sound is decoration; never break the game */ }
  }

  noise(dur, vol = 0.3, freq = 1200, when = 0) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime + when;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = freq;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filter).connect(gain).connect(this.master);
      src.start(t);
    } catch { /* ignore */ }
  }

  click() { this.tone(660, 0.06, 'square', 0.08); }
  cash() {
    this.tone(988, 0.09, 'sine', 0.16);
    this.tone(1319, 0.16, 'sine', 0.16, 0.07);
  }
  pickup() { this.tone(523, 0.08, 'triangle', 0.14); this.tone(784, 0.12, 'triangle', 0.14, 0.06); }
  shot() { this.noise(0.11, 0.32, 2600); this.tone(160, 0.08, 'square', 0.1, 0, 60); }
  punch() { this.noise(0.07, 0.2, 700); }
  honk() { this.tone(370, 0.16, 'square', 0.07); this.tone(466, 0.16, 'square', 0.05); }
  crash(intensity = 1) {
    this.noise(0.22, 0.22 * intensity, 500);
    this.tone(90, 0.2, 'sine', 0.2 * intensity, 0, 40);
  }
  skid() { this.noise(0.1, 0.05, 3000); }
  missionSting() {
    this.tone(392, 0.12, 'triangle', 0.15);
    this.tone(523, 0.12, 'triangle', 0.15, 0.1);
    this.tone(659, 0.22, 'triangle', 0.15, 0.2);
  }
  failSting() {
    this.tone(330, 0.16, 'triangle', 0.14);
    this.tone(262, 0.26, 'triangle', 0.14, 0.14);
  }

  // Continuous engine note while driving; speedNorm is 0..1.
  setEngine(speedNorm) {
    if (!this.ctx) return;
    try {
      if (speedNorm === null) {
        if (this.engineOsc) {
          this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
          const osc = this.engineOsc;
          window.setTimeout(() => { try { osc.stop(); } catch { /* done */ } }, 300);
          this.engineOsc = null;
        }
        return;
      }
      if (!this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        this.engineOsc.connect(filter).connect(this.engineGain).connect(this.master);
        this.engineOsc.start();
      }
      const freq = 55 + speedNorm * 165;
      this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.06);
      this.engineGain.gain.setTargetAtTime(this.muted ? 0 : 0.05 + speedNorm * 0.05, this.ctx.currentTime, 0.09);
    } catch { /* ignore */ }
  }

  setSiren(on) {
    if (!this.ctx) return;
    try {
      if (on && !this.sirenOsc) {
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'triangle';
        this.sirenOsc.frequency.value = 760;
        this.sirenLfo = this.ctx.createOscillator();
        this.sirenLfo.type = 'square';
        this.sirenLfo.frequency.value = 0.9;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 140;
        this.sirenLfo.connect(lfoGain).connect(this.sirenOsc.frequency);
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = this.muted ? 0 : 0.035;
        this.sirenOsc.connect(this.sirenGain).connect(this.master);
        this.sirenOsc.start();
        this.sirenLfo.start();
      } else if (!on && this.sirenOsc) {
        const osc = this.sirenOsc;
        const lfo = this.sirenLfo;
        window.setTimeout(() => { try { osc.stop(); lfo.stop(); } catch { /* done */ } }, 60);
        this.sirenOsc = null;
        this.sirenLfo = null;
      }
    } catch { /* ignore */ }
  }

  // A slow Am7 — Fmaj7 — Cmaj7 — G progression with a soft bass pulse:
  // the sound of an afternoon that is going nowhere in particular.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const chords = [
      [110.0, 220.0, 261.6, 329.6], // Am7
      [87.3, 174.6, 220.0, 261.6], // Fmaj7
      [130.8, 196.0, 261.6, 329.6], // Cmaj7
      [98.0, 196.0, 246.9, 293.7], // G
    ];
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || this.muted) return;
      try {
        while (this.nextNoteTime < this.ctx.currentTime + 0.35) {
          const chord = chords[Math.floor(this.musicStep / 2) % chords.length];
          const when = this.nextNoteTime - this.ctx.currentTime;
          if (this.musicStep % 2 === 0) {
            for (let n = 1; n < chord.length; n++) {
              this.tone(chord[n], 1.7, 'triangle', 0.028, when);
            }
          }
          this.tone(chord[0], 0.5, 'sine', 0.06, when);
          this.tone(chord[0] * 2, 0.3, 'sine', 0.03, when + 0.45);
          this.nextNoteTime += 0.9;
          this.musicStep++;
        }
      } catch { /* ignore */ }
    }, 240);
  }
}
