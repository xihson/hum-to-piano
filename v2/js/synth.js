/* Sound: instruments, drums and metronome, built from Web Audio primitives. Every voice takes a context
   and a destination so the same code renders live and offline (WAV export). */
const Synth = (() => {
  let live = null;

  function chain(c, opts = {}) {
    const input = c.createGain(); input.gain.value = .55;
    const tone = c.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = opts.lowpass || 20000; tone.Q.value = .4;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -8; comp.ratio.value = 16; comp.attack.value = .003; comp.release.value = .15;
    input.connect(tone); tone.connect(comp); comp.connect(c.destination);
    const len = Math.floor(c.sampleRate * 1.1), ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    const rev = c.createConvolver(); rev.buffer = ir; const wet = c.createGain(); wet.gain.value = .18;
    input.connect(rev); rev.connect(wet); wet.connect(comp);
    const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return { c, input, tone, noise: nb, ks: new Map() };
  }
  function ctx() {
    if (!live) { const c = new (window.AudioContext || window.webkitAudioContext)(); live = chain(c); }
    if (live.c.state === 'suspended') live.c.resume();
    return live;
  }
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  const env = (g, t, peak, attack, tc, end, rel) => {
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + attack);
    if (tc) g.gain.setTargetAtTime(0, t + attack, tc); else g.gain.setValueAtTime(peak, end);
    g.gain.setTargetAtTime(0, end, rel);
  };
  const osc = (c, type, f, t, stop) => { const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.start(t); o.stop(stop); return o; };

  function piano(S, dest, m, t, dur, vel) {
    const c = S.c, f = hz(m), end = t + Math.max(dur, .12);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(Math.min(15000, f * 14), t); lp.frequency.exponentialRampToValueAtTime(Math.max(600, f * 3), t + 1.2); lp.connect(dest);
    const decay = 1.6 * Math.pow(261.6 / f, .45);
    [1, .55, .32, .2, .13, .08].forEach((a, k) => {
      const h = k + 1, o = osc(c, 'sine', f * h * Math.sqrt(1 + .0004 * h * h) * (k ? 1 : 1.0007), t, end + .6), g = c.createGain();
      env(g, t, a * vel * .16, .004, decay / (1 + k * .7), end, .07); o.connect(g); g.connect(lp);
    });
    const ns = c.createBufferSource(), bp = c.createBiquadFilter(), ng = c.createGain();
    ns.buffer = S.noise; bp.type = 'bandpass'; bp.frequency.value = Math.min(8000, f * 5); ng.gain.setValueAtTime(.05 * vel, t); ng.gain.exponentialRampToValueAtTime(.0001, t + .03);
    ns.connect(bp); bp.connect(ng); ng.connect(lp); ns.start(t, Math.random()); ns.stop(t + .04);
  }
  function epiano(S, dest, m, t, dur, vel) {
    const c = S.c, f = hz(m), end = t + Math.max(dur, .15);
    const car = osc(c, 'sine', f, t, end + .8), mod = osc(c, 'sine', f, t, end + .8), mg = c.createGain();
    mg.gain.setValueAtTime(f * 1.6, t); mg.gain.exponentialRampToValueAtTime(f * .15, t + .6);
    mod.connect(mg); mg.connect(car.frequency);
    const g = c.createGain(); env(g, t, vel * .2, .006, 1.4, end, .12); car.connect(g); g.connect(dest);
    const bell = osc(c, 'sine', f * 4, t, t + .4), bg = c.createGain(); env(bg, t, vel * .03, .002, .08, t + .3, .05); bell.connect(bg); bg.connect(dest);
  }
  function guitar(S, dest, m, t, dur, vel) {
    const c = S.c, sr = c.sampleRate, key = m;
    let buf = S.ks.get(key);
    if (!buf) {
      const N = Math.max(2, Math.round(sr / hz(m))), L = Math.floor(sr * 2.2);
      buf = c.createBuffer(1, L, sr); const y = buf.getChannelData(0);
      for (let i = 0; i < N; i++) y[i] = Math.random() * 2 - 1;
      for (let i = N; i < L; i++) y[i] = .996 * .5 * (y[i - N] + y[i - N - 1 < 0 ? 0 : i - N - 1]);
      S.ks.set(key, buf);
    }
    const s = c.createBufferSource(), g = c.createGain(), lp = c.createBiquadFilter();
    s.buffer = buf; lp.type = 'lowpass'; lp.frequency.value = 3500;
    g.gain.setValueAtTime(vel * .45, t); g.gain.setTargetAtTime(0, t + Math.max(dur, .2), .08);
    s.connect(lp); lp.connect(g); g.connect(dest); s.start(t); s.stop(t + Math.min(2.2, dur + .6));
  }
  function strings(S, dest, m, t, dur, vel) {
    const c = S.c, f = hz(m), end = t + Math.max(dur, .25);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(4000, f * 6); lp.Q.value = .6; lp.connect(dest);
    const vib = osc(c, 'sine', 5.2, t, end + 1), vg = c.createGain(); vg.gain.value = f * .004; vib.connect(vg);
    for (const det of [-6, 6, 0]) { const o = osc(c, 'sawtooth', f, t, end + 1); o.detune.value = det; vg.connect(o.frequency); const g = c.createGain(); env(g, t, vel * .055, .18, 0, end, .3); o.connect(g); g.connect(lp); }
  }
  function musicbox(S, dest, m, t, dur, vel) {
    const c = S.c, f = hz(m + 12);
    for (const [r, a, tc] of [[1, 1, .5], [4, .25, .12], [6.3, .08, .06]]) { const o = osc(c, 'sine', f * r, t, t + 2), g = c.createGain(); env(g, t, a * vel * .18, .002, tc, t + 1.6, .1); o.connect(g); g.connect(dest); }
  }
  function lead(S, dest, m, t, dur, vel) {
    const c = S.c, f = hz(m), end = t + Math.max(dur, .12);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4; lp.frequency.setValueAtTime(f * 8, t); lp.frequency.exponentialRampToValueAtTime(f * 2.5, t + .35); lp.connect(dest);
    for (const [type, det] of [['square', 0], ['sawtooth', 8]]) { const o = osc(c, type, f, t, end + .4); o.detune.value = det; const g = c.createGain(); env(g, t, vel * .06, .01, 0, end, .06); o.connect(g); g.connect(lp); }
  }
  function power(S, dest, m, t, dur, vel) { // overdriven rhythm guitar
    const c = S.c, end = t + Math.max(dur, .1);
    const sh = c.createWaveShaper(), curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 6); } sh.curve = curve;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; const g = c.createGain(); env(g, t, vel * .09, .005, 0, end, .05);
    for (const mm of [m, m + 7, m + 12]) { const o = osc(c, 'sawtooth', hz(mm), t, end + .3); o.detune.value = (Math.random() - .5) * 10; o.connect(sh); }
    sh.connect(lp); lp.connect(g); g.connect(dest);
  }
  function bass(S, dest, m, t, dur, vel) {
    const c = S.c, f = hz(m), end = t + Math.max(dur * .92, .1);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.connect(dest);
    const o = osc(c, 'triangle', f, t, end + .3), o2 = osc(c, 'sine', f, t, end + .3), g = c.createGain();
    env(g, t, vel * .32, .008, 1.2, end, .05); o.connect(g); o2.connect(g); g.connect(lp);
  }
  function synthbass(S, dest, m, t, dur, vel) {
    const c = S.c, f = hz(m), end = t + Math.max(dur * .9, .08);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6; lp.frequency.setValueAtTime(f * 10, t); lp.frequency.exponentialRampToValueAtTime(f * 2, t + .18); lp.connect(dest);
    const o = osc(c, 'sawtooth', f, t, end + .2), g = c.createGain(); env(g, t, vel * .14, .004, 0, end, .03); o.connect(g); g.connect(lp);
    const sub = osc(c, 'sine', f, t, end + .2), sg = c.createGain(); env(sg, t, vel * .2, .004, 0, end, .03); sub.connect(sg); sg.connect(dest);
  }
  const INSTRUMENTS = { piano, epiano, guitar, strings, musicbox, synth: lead, power, bass, synthbass };

  function noiseHit(S, dest, t, { type = 'highpass', f = 7000, q = .7, gain = .3, tc = .03, len = .2 }) {
    const c = S.c, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = S.noise; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    g.gain.setValueAtTime(gain, t); g.gain.setTargetAtTime(0, t + .002, tc);
    s.connect(fl); fl.connect(g); g.connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + len);
  }
  const DRUMS = {
    kick(S, dest, t, v) { const c = S.c, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + .12); g.gain.setValueAtTime(v * .9, t); g.gain.exponentialRampToValueAtTime(.001, t + .42); o.connect(g); g.connect(dest); o.start(t); o.stop(t + .45); },
    snare(S, dest, t, v) { noiseHit(S, dest, t, { type: 'bandpass', f: 1900, q: .6, gain: v * .55, tc: .045, len: .25 }); const c = S.c, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(140, t + .08); g.gain.setValueAtTime(v * .3, t); g.gain.exponentialRampToValueAtTime(.001, t + .12); o.connect(g); g.connect(dest); o.start(t); o.stop(t + .13); },
    hat(S, dest, t, v) { noiseHit(S, dest, t, { f: 7500, gain: v * .22, tc: .012, len: .08 }); },
    ohat(S, dest, t, v) { noiseHit(S, dest, t, { f: 7000, gain: v * .18, tc: .09, len: .4 }); },
    clap(S, dest, t, v) { for (const d of [0, .011, .022]) noiseHit(S, dest, t + d, { type: 'bandpass', f: 1400, q: 1.2, gain: v * .45, tc: d < .02 ? .006 : .05, len: .2 }); },
    rim(S, dest, t, v) { noiseHit(S, dest, t, { type: 'bandpass', f: 3200, q: 3, gain: v * .4, tc: .01, len: .05 }); },
    crash(S, dest, t, v) { noiseHit(S, dest, t, { f: 5000, gain: v * .16, tc: .5, len: 1.8 }); },
  };

  function play(S, dest, ev) {
    if (ev.drum) DRUMS[ev.drum](S, dest, ev.t, ev.v ?? .8);
    else (INSTRUMENTS[ev.inst] || piano)(S, dest, ev.m, ev.t, ev.d, ev.v ?? .8);
  }
  function click(S, t, accent) {
    const c = S.c, o = c.createOscillator(), g = c.createGain();
    o.frequency.value = accent ? 1600 : 1250; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(accent ? .35 : .22, t + .002); g.gain.exponentialRampToValueAtTime(.001, t + .04);
    o.connect(g); g.connect(S.c.destination); o.start(t); o.stop(t + .05);
  }

  async function render(events, duration, opts = {}) {
    const sr = 44100, oc = new OfflineAudioContext(2, Math.ceil(sr * (duration + 2)), sr), S = chain(oc, opts);
    for (const ev of events) play(S, S.input, ev);
    return oc.startRendering();
  }
  function wav(buffer) {
    const ch = buffer.numberOfChannels, len = buffer.length, sr = buffer.sampleRate, out = new DataView(new ArrayBuffer(44 + len * ch * 2));
    const str = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); out.setUint32(4, 36 + len * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true);
    out.setUint32(24, sr, true); out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); str(36, 'data'); out.setUint32(40, len * ch * 2, true);
    const data = []; for (let c = 0; c < ch; c++) data.push(buffer.getChannelData(c));
    let o = 44; for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, data[c][i])); out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
    return new Blob([out], { type: 'audio/wav' });
  }
  const setTone = hzCut => { const S = ctx(); S.tone.frequency.setTargetAtTime(hzCut || 20000, S.c.currentTime, .05); };
  return { ctx, play, click, render, wav, setTone, INSTRUMENTS, DRUMS };
})();
