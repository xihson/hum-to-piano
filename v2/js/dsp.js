/* Signal analysis: pitch (YIN), note segmentation, clap/snap onsets, tempo. */
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

  /* frames -> notes in seconds. mask: [[t0,t1],...] intervals to treat as unvoiced (claps). */
  function transcribe(frames, mask = []) {
    const n = frames.length;
    if (!n) return { notes: [], trace: [] };
    const masked = t => mask.some(([a, b]) => t >= a && t <= b);
    const sorted = frames.map(f => f.rms).sort((a, b) => a - b), pct = p => sorted[Math.min(n - 1, Math.floor(p * n))];
    const gate = Math.max(pct(.1) * 2.5, pct(.95) * .08, .004);
    const raw = frames.map(f => (!masked(f.t) && f.rms > gate && f.c < .25 && f.f > 65 && f.f < F_MAX) ? 69 + 12 * Math.log2(f.f / 440) : NaN);
    const near = (arr, i, r) => { const w = []; for (let k = i - r; k <= i + r; k++) if (k >= 0 && k < n && !isNaN(arr[k])) w.push(arr[k]); return w; };
    const smooth = raw.map((v, i) => isNaN(v) ? NaN : median(near(raw, i, 2)));
    const m = smooth.map((v, i) => { if (isNaN(v)) return v; const md = median(near(smooth, i, 8)); if (Math.abs(v - md - 12) < 1.5) return v - 12; if (Math.abs(v - md + 12) < 1.5) return v + 12; return v; });
    let sx = 0, sy = 0;
    m.forEach(v => { if (!isNaN(v)) { const a = 2 * Math.PI * (v - Math.round(v)); sx += Math.cos(a); sy += Math.sin(a); } });
    const offset = (sx || sy) ? Math.atan2(sy, sx) / (2 * Math.PI) : 0;
    const adj = m.map(v => v - offset);
    const rs = frames.map((f, i) => (f.rms + (i ? frames[i - 1].rms : f.rms)) / 2);
    const onset = rs.map((v, i) => { if (i < 3 || v < gate || masked(frames[i].t)) return false; let mn = Infinity; for (let k = Math.max(0, i - 8); k <= i - 2; k++) mn = Math.min(mn, rs[k]); return v > 2.2 * mn; });
    const segs = []; let cur = null, gap = 0, dev = 0, devStart = 0;
    const close = end => { if (cur) { cur.end = end; segs.push(cur); cur = null; } };
    for (let i = 0; i < n; i++) {
      const v = adj[i];
      if (isNaN(v)) { if (cur && ++gap >= (masked(frames[i].t) ? 12 : 3)) { close(i - gap + 1); gap = 0; } continue; }
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
    const dt = HOP / SR;
    const notes = segs.map(s => ({ p: Math.round(median(s.vals.slice(Math.floor(s.vals.length * .2)))), t: frames[s.start].t - dt / 2, e: frames[s.end - 1].t + dt / 2, onset: s.onset }))
      .filter(x => x.e - x.t >= .08);
    const merged = [];
    for (const x of notes) { const p = merged[merged.length - 1]; if (p && p.p === x.p && !x.onset && x.t - p.e < .06) p.e = x.e; else merged.push({ ...x }); }
    return { notes: merged, trace: frames.map((f, i) => ({ t: f.t, m: adj[i] })), offset };
  }

  /* RBJ biquad high-pass, applied in place to a copy. */
  function highpass(x, sr, fc, q = .707) {
    const w = 2 * Math.PI * fc / sr, al = Math.sin(w) / (2 * q), cw = Math.cos(w), a0 = 1 + al;
    const b0 = (1 + cw) / 2 / a0, b1 = -(1 + cw) / a0, b2 = b0, a1 = -2 * cw / a0, a2 = (1 - al) / a0;
    const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) { const v = x[i], o = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = o; y[i] = o; }
    return y;
  }
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) { let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) { const a = i + k, b = a + len / 2, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } }
    }
  }
  const SNAP_CENTROID = 3300;
  function centroid(x, start, sr) {
    const N = 1024, re = new Float32Array(N), im = new Float32Array(N);
    for (let i = 0; i < N; i++) { const v = x[start + i] || 0; re[i] = v * (.5 - .5 * Math.cos(2 * Math.PI * i / (N - 1))); }
    fft(re, im);
    let num = 0, den = 0;
    for (let k = Math.ceil(300 * N / sr); k < N / 2; k++) { const mag = Math.hypot(re[k], im[k]); num += mag * k * sr / N; den += mag; }
    return den ? num / den : 0;
  }

  /* Percussive onsets (claps, finger snaps). Returns [{t, kind:'clap'|'snap'}] in seconds. */
  function detectHits(x, sr) {
    const hp = highpass(x, sr, 2000), hop = 256, n = Math.floor(x.length / hop);
    const eAll = new Float32Array(n), eHF = new Float32Array(n);
    for (let i = 0; i < n; i++) { let a = 0, h = 0; for (let j = i * hop; j < (i + 1) * hop; j++) { a += x[j] * x[j]; h += hp[j] * hp[j]; } eAll[i] = Math.sqrt(a / hop); eHF[i] = Math.sqrt(h / hop); }
    const sorted = Array.from(eHF).sort((a, b) => a - b), pct = p => sorted[Math.min(n - 1, Math.floor(p * n))] || 0;
    const gate = Math.max(pct(.995) * .12, pct(.5) * 4, .003);
    const hits = []; let last = -1e9;
    for (let i = 12; i < n - 12; i++) {
      if (eHF[i] < gate || eHF[i] / (eAll[i] + 1e-9) < .3) continue;
      let mn = Infinity; for (let k = i - 12; k <= i - 3; k++) mn = Math.min(mn, eHF[k]);
      if (eHF[i] < 4 * mn + 1e-4) continue;
      if ((i - last) * hop / sr < .09) continue;
      let pk = i; for (let k = i; k < i + 5; k++) if (eHF[k] > eHF[pk]) pk = k;
      let early = 0, late = 0; for (let k = pk; k < pk + 3; k++) early += eHF[k]; for (let k = pk + 4; k < pk + 12; k++) late += eHF[k];
      const c = centroid(hp, Math.max(0, i * hop - 64), sr);
      const decay = early / 3 / (late / 8 + 1e-9);
      hits.push({ t: i * hop / sr, kind: 'clap', c: Math.round(c), decay: +decay.toFixed(1) });
      last = i;
      i = pk + 4;
    }
    classify(hits);
    return hits;
  }
  /* Claps vs snaps differ by microphone, so split each take into a darker and a brighter group
     instead of using fixed thresholds. One homogeneous group counts as claps. */
  function classify(hits) {
    if (hits.length < 3) return;
    const f = hits.map(h => Math.log(h.c + 1));
    let a = Math.min(...f), b = Math.max(...f), A = [], B = [];
    for (let it = 0; it < 20; it++) {
      A = []; B = []; f.forEach(v => (Math.abs(v - a) <= Math.abs(v - b) ? A : B).push(v));
      if (!A.length || !B.length) return;
      a = A.reduce((s, v) => s + v, 0) / A.length; b = B.reduce((s, v) => s + v, 0) / B.length;
    }
    const varOf = (arr, m) => arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
    const fisher = (b - a) ** 2 / (varOf(A, a) + varOf(B, b) + 1e-6);
    if (fisher < 6 || Math.exp(b - a) < 1.1) return;
    hits.forEach((h, i) => { h.kind = Math.abs(f[i] - b) < Math.abs(f[i] - a) ? 'snap' : 'clap'; });
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

  /* seconds -> beats, quantised to sixteenths */
  function toBeats(notes, hits, bpm, t0) {
    const spb = 60 / bpm, q = v => Math.round(v * 4) / 4;
    let ns = notes.map(n => ({ p: n.p, s: q((n.t - t0) / spb), d: Math.max(.25, q((n.e - n.t) / spb)) })).filter(n => n.s >= -0.01);
    ns.sort((a, b) => a.s - b.s);
    ns = ns.filter((n, i) => i === 0 || n.s > ns[i - 1].s);
    for (let i = 1; i < ns.length; i++) if (ns[i - 1].s + ns[i - 1].d > ns[i].s) ns[i - 1].d = ns[i].s - ns[i - 1].s;
    const hs = [];
    for (const h of hits) { const t = q((h.t - t0) / spb); if (t < -0.01) continue; if (!hs.some(x => x.t === t && x.k === h.kind)) hs.push({ t: Math.max(0, t), k: h.kind }); }
    return { notes: ns.map(n => ({ ...n, s: Math.max(0, n.s) })), hits: hs };
  }

  return { yin, SR, F_MAX, toMono, pitchFrames, transcribe, highpass, detectHits, estimateTempo, toBeats, median };
})();
