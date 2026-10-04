/* Signal analysis: pitch (YIN), note segmentation, tempo. Drum hits come from key presses, not from the microphone.
   Every tuning threshold is listed in docs/ARCHITECTURE.md ("Tuning constants") — change them there too.
   Regression check: v2/dev/fixture.js + the snippet in docs/TESTING.md. */
const DSP = (() => {
  const median = a => { if (!a.length) return NaN; const s = [...a].sort((p, q) => p - q), k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };

  function yin(buf, off, W, sr, tMin, tMax, d) {
    d[0] = 1; let run = 0;
    for (let tau = 1; tau <= tMax; tau++) {
      let s = 0;
      for (let j = 0; j < W; j++) { const x = buf[off + j] - buf[off + j + tau]; s += x * x; }
      run += s; d[tau] = run > 0 ? s * tau / run : 1;
    }
    let tau = -1;
    for (let t = tMin; t <= tMax; t++) if (d[t] < .15) { while (t + 1 <= tMax && d[t + 1] < d[t]) t++; tau = t; break; }
    if (tau < 0) { tau = tMin; for (let t = tMin; t <= tMax; t++) if (d[t] < d[tau]) tau = t; }
    let better = tau;
    if (tau > tMin && tau < tMax) { const a = d[tau - 1], b = d[tau], c = d[tau + 1], den = a + c - 2 * b; if (den > 0) better = tau + (a - c) / (2 * den); }
    return { f: sr / better, c: d[tau] };
  }

  const SR = 22050, HOP = 220, WIN = 512, TMIN = Math.floor(SR / 1000), TMAX = Math.ceil(SR / 65);
  const F_MAX = 800; // above this is treated as unvoiced, so metronome beeps are ignored

  async function toMono(buffer, sr) {
    const len = Math.max(1, Math.ceil(buffer.duration * sr));
    const oac = new OfflineAudioContext(1, len, sr);
    const s = oac.createBufferSource(); s.buffer = buffer; s.connect(oac.destination); s.start();
    return (await oac.startRendering()).getChannelData(0);
  }

  function pitchFrames(x) {
    const a = .977; let py = 0, px = 0;
    for (let i = 0; i < x.length; i++) { const v = x[i]; py = a * (py + v - px); px = v; x[i] = py; }
    const frames = [], d = new Float32Array(TMAX + 2);
    for (let off = 0; off + WIN + TMAX <= x.length; off += HOP) {
      let e = 0; for (let j = 0; j < WIN; j++) e += x[off + j] * x[off + j];
      const rms = Math.sqrt(e / WIN);
      let f = 0, c = 1;
      if (rms > 2e-4) { const r = yin(x, off, WIN, SR, TMIN, TMAX, d); f = r.f; c = r.c; }
      frames.push({ t: (off + WIN / 2) / SR, rms, f, c });
    }
    return frames;
  }

  /* frames -> notes in seconds. */
  function transcribe(frames) {
    const n = frames.length;
    if (!n) return { notes: [], trace: [] };
    const sorted = frames.map(f => f.rms).sort((a, b) => a - b), pct = p => sorted[Math.min(n - 1, Math.floor(p * n))];
    const gate = Math.max(pct(.1) * 2.5, pct(.95) * .08, .004);
    const raw = frames.map(f => (f.rms > gate && f.c < .25 && f.f > 65 && f.f < F_MAX) ? 69 + 12 * Math.log2(f.f / 440) : NaN);
    const near = (arr, i, r) => { const w = []; for (let k = i - r; k <= i + r; k++) if (k >= 0 && k < n && !isNaN(arr[k])) w.push(arr[k]); return w; };
    const smooth = raw.map((v, i) => isNaN(v) ? NaN : median(near(raw, i, 2)));
    const m = smooth.map((v, i) => { if (isNaN(v)) return v; const md = median(near(smooth, i, 8)); if (Math.abs(v - md - 12) < 1.5) return v - 12; if (Math.abs(v - md + 12) < 1.5) return v + 12; return v; });
    let sx = 0, sy = 0;
    m.forEach(v => { if (!isNaN(v)) { const a = 2 * Math.PI * (v - Math.round(v)); sx += Math.cos(a); sy += Math.sin(a); } });
    const offset = (sx || sy) ? Math.atan2(sy, sx) / (2 * Math.PI) : 0;
    const adj = m.map(v => v - offset);
    const rs = frames.map((f, i) => (f.rms + (i ? frames[i - 1].rms : f.rms)) / 2);
    const onset = rs.map((v, i) => { if (i < 3 || v < gate) return false; let mn = Infinity; for (let k = Math.max(0, i - 8); k <= i - 2; k++) mn = Math.min(mn, rs[k]); return v > 2.2 * mn && v > 1.4 * rs[i - 2]; }); // still rising, not the tail of an attack
    const segs = []; let cur = null, gap = 0, dev = 0, devStart = 0;
    const close = end => { if (cur) { cur.end = end; segs.push(cur); cur = null; } };
    for (let i = 0; i < n; i++) {
      const v = adj[i];
      if (isNaN(v)) { if (cur && ++gap >= 3) { close(i - gap + 1); gap = 0; } continue; }
      gap = 0;
      if (!cur) { cur = { start: i, vals: [v], onset: true }; dev = 0; continue; }
      if (onset[i] && i - cur.start >= 8) { close(i); cur = { start: i, vals: [v], onset: true }; dev = 0; continue; }
      const ref = median(cur.vals.slice(-10));
      if (Math.abs(v - ref) > .6) {
        if (!dev) devStart = i;
        if (++dev >= 4) { const vals = adj.slice(devStart, i + 1).filter(x => !isNaN(x)); close(devStart); cur = { start: devStart, vals, onset: false }; dev = 0; }
      } else { dev = 0; cur.vals.push(v); }
    }
    if (cur) close(n - gap);
    // pitch settles a few frames after the sound starts: move each attack back to where its energy rose
    segs.forEach((s, j) => {
      if (!s.onset) return;
      const floor = j ? segs[j - 1].end : 0, lim = Math.max(gate * .5, frames[s.start].rms * .25);
      let k = s.start; while (k - 1 >= floor && s.start - k < 8 && frames[k - 1].rms > lim) k--;
      s.start = k;
    });
    const dt = HOP / SR;
    const notes = segs.map(s => ({ p: Math.round(median(s.vals.slice(Math.floor(s.vals.length * .2)))), t: frames[s.start].t - dt / 2, e: frames[s.end - 1].t + dt / 2, onset: s.onset }))
      .filter(x => x.e - x.t >= .08);
    const merged = [];
    for (const x of notes) { const p = merged[merged.length - 1]; if (p && p.p === x.p && !x.onset && x.t - p.e < .06) p.e = x.e; else merged.push({ ...x }); }
    return { notes: merged, trace: frames.map((f, i) => ({ t: f.t, m: adj[i] })), offset };
  }

  /* Tempo from onset times (seconds). Returns {bpm, t0} with t0 a beat at or before the first onset. */
  function estimateTempo(onsets) {
    const on = [...onsets].sort((a, b) => a - b);
    if (on.length < 3) return { bpm: 100, t0: on.length ? on[0] : 0 };
    const ivs = [];
    for (let i = 0; i < on.length; i++) for (let j = i + 1; j < on.length && on[j] - on[i] < 3; j++) ivs.push(on[j] - on[i]);
    let best = { bpm: 100, s: -1 };
    for (let bpm = 60; bpm <= 170; bpm += .5) {
      const half = 30 / bpm; let s = 0;
      for (const iv of ivs) { const r = iv / half, d = r - Math.round(r); s += Math.exp(-d * d / .02) * (Math.round(r) % 2 === 0 ? 1.3 : 1); }
      s /= ivs.length; s *= Math.exp(-.5 * (Math.log2(bpm / 100) / .6) ** 2);
      if (s > best.s) best = { bpm, s };
    }
    const T = 60 / best.bpm;
    let bp = { ph: 0, s: -1 };
    for (let k = 0; k < 48; k++) {
      const ph = k / 48 * T; let s = 0;
      for (const t of on) { const r = (t - ph) / (T / 2), d = r - Math.round(r); s += Math.exp(-d * d / .02) * (Math.round(r) % 2 === 0 ? 1.4 : 1); }
      if (s > bp.s) bp = { ph, s };
    }
    const t0 = bp.ph + Math.floor((on[0] - bp.ph + T * .25) / T) * T;
    return { bpm: Math.round(best.bpm), t0: Math.min(t0, on[0]) };
  }

  /* seconds -> beats, quantised to sixteenths. hits: [{t: seconds, k: 'clap' | 'snap'}] */
  function toBeats(notes, hits, bpm, t0) {
    const spb = 60 / bpm, q = v => Math.round(v * 4) / 4;
    let ns = notes.map(n => ({ p: n.p, s: q((n.t - t0) / spb), d: Math.max(.25, q((n.e - n.t) / spb)) })).filter(n => n.s >= -0.01);
    ns.sort((a, b) => a.s - b.s);
    ns = ns.filter((n, i) => i === 0 || n.s > ns[i - 1].s);
    for (let i = 1; i < ns.length; i++) if (ns[i - 1].s + ns[i - 1].d > ns[i].s) ns[i - 1].d = ns[i].s - ns[i - 1].s;
    const hs = [];
    for (const h of hits) { const t = q((h.t - t0) / spb); if (t < -0.01) continue; if (!hs.some(x => x.t === Math.max(0, t) && x.k === h.k)) hs.push({ t: Math.max(0, t), k: h.k }); }
    return { notes: ns.map(n => ({ ...n, s: Math.max(0, n.s) })), hits: hs };
  }

  return { yin, SR, F_MAX, toMono, pitchFrames, transcribe, estimateTempo, toBeats, median };
})();
