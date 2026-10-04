/* Music theory: note names, key detection, chords, harmonisation. */
const Theory = (() => {
  const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const mod12 = n => ((n % 12) + 12) % 12;
  const noteName = m => SHARP[mod12(m)] + (Math.floor(m / 12) - 1);

  // keys whose signature is written with flats
  const usesFlats = key => [5, 10, 3, 8, 1, 6].includes(key.mode === 'major' ? key.tonic : mod12(key.tonic + 3));
  const pcName = (pc, key, flat) => (flat || (key && usesFlats(key)) ? FLAT : SHARP)[mod12(pc)];
  const keyLabel = key => pcName(key.tonic, key) + (key.mode === 'major' ? ' 大调' : ' 小调');

  // Krumhansl–Kessler key profiles
  const MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const MIN = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  function corr(a, b) {
    const ma = a.reduce((s, v) => s + v, 0) / 12, mb = b.reduce((s, v) => s + v, 0) / 12;
    let n = 0, da = 0, db = 0;
    for (let i = 0; i < 12; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
    return da && db ? n / Math.sqrt(da * db) : 0;
  }
  function detectKey(notes) {
    const h = new Array(12).fill(0);
    for (const n of notes) h[mod12(n.p)] += n.d;
    if (!h.some(v => v > 0)) return { tonic: 0, mode: 'major' };
    const last = notes.length ? mod12(notes[notes.length - 1].p) : -1;
    let best = null;
    for (let t = 0; t < 12; t++) for (const mode of ['major', 'minor']) {
      const prof = mode === 'major' ? MAJ : MIN;
      const rot = prof.map((_, i) => prof[mod12(i - t)]);
      const s = corr(h, rot) + (mode === 'major' ? .03 : 0) + (t === last ? .05 : 0);
      if (!best || s > best.s) best = { tonic: t, mode, s };
    }
    return { tonic: best.tonic, mode: best.mode };
  }

  const INTERVALS = { '': [0, 4, 7], m: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], sus4: [0, 5, 7], sus2: [0, 2, 7], m7b5: [0, 3, 6, 10] };
  const LETTER = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const letterPc = (l, acc) => mod12(LETTER[l] + (acc === '#' ? 1 : acc === 'b' ? -1 : 0));
  /* "F/A" = F chord with A in the bass. Returns {root, q, bass}; bass = root when there is no slash. */
  function parse(name) {
    const [chord, slash] = String(name || '').split('/');
    const m = /^([A-G])([#b]?)(.*)$/.exec(chord);
    if (!m) return { root: 0, q: '', bass: 0 };
    const root = letterPc(m[1], m[2]), b = slash && /^([A-G])([#b]?)$/.exec(slash);
    return { root, q: INTERVALS[m[3]] ? m[3] : '', bass: b ? letterPc(b[1], b[2]) : root };
  }
  const chordPart = name => String(name || '').split('/')[0];
  const tones = name => { const c = parse(name); return INTERVALS[c.q].map(i => mod12(c.root + i)); };
  const make = (rootPc, q, key) => pcName(rootPc, key) + q;

  const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11], MAJOR_Q = ['', 'm', 'm', '', '', 'm', 'dim'], MAJOR_R = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
  const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10], MINOR_Q = ['m', 'dim', '', 'm', '', '', ''], MINOR_R = ['i', 'ii°', 'III', 'iv', 'V', 'VI', 'VII'];
  function diatonic(key) {
    const maj = key.mode === 'major', st = maj ? MAJOR_STEPS : MINOR_STEPS, q = maj ? MAJOR_Q : MINOR_Q, r = maj ? MAJOR_R : MINOR_R;
    return st.map((s, i) => ({ name: make(key.tonic + s, q[i], key), roman: r[i], degree: i }));
  }
  function extras(key) {
    const t = key.tonic, flat = (pc, q) => FLAT[mod12(pc)] + q; // borrowed chords are spelled with flats
    if (key.mode === 'major') return [make(t, 'maj7', key), make(t + 2, 'm7', key), make(t + 7, '7', key), make(t + 9, 'm7', key), make(t + 5, 'maj7', key), make(t + 7, 'sus4', key), make(t + 4, '7', key), make(t + 2, '', key), flat(t + 10, ''), flat(t + 8, '')];
    return [make(t, 'm7', key), make(t + 5, 'm7', key), make(t + 7, '7', key), make(t + 8, 'maj7', key), make(t + 3, 'maj7', key), make(t + 7, 'sus4', key), make(t + 5, '', key), make(t + 7, 'm', key), flat(t + 1, '')];
  }
  const scalePcs = key => (key.mode === 'major' ? MAJOR_STEPS : MINOR_STEPS).map(s => mod12(key.tonic + s));

  /* Pick one chord per bar for a melody. notes: [{p, s, d}] in beats, section-relative. */
  function harmonize(notes, bars, key, beatsPerBar = 4) {
    const cands = diatonic(key).filter(c => !c.name.endsWith('dim'));
    const scale = scalePcs(key);
    const prior = key.mode === 'major' ? [.3, 0, -.05, .2, .2, .1] : [.3, -.1, .1, .2, .2, .15];
    const weights = [];
    for (let b = 0; b < bars; b++) {
      const w = new Array(12).fill(0), a = b * beatsPerBar, z = a + beatsPerBar;
      for (const n of notes) {
        const ov = Math.min(z, n.s + n.d) - Math.max(a, n.s);
        if (ov <= 0) continue;
        const strong = n.s >= a && (n.s - a) % 2 === 0 ? 1.4 : 1;
        w[mod12(n.p)] += ov * strong;
      }
      const tot = w.reduce((s, v) => s + v, 0);
      weights.push(tot ? w.map(v => v / tot) : null);
    }
    const local = (b, ci) => {
      const c = cands[ci], ts = tones(c.name), root = parse(c.name).root, w = weights[b];
      let s = prior[ci] || 0;
      if (w) for (let pc = 0; pc < 12; pc++) {
        if (!w[pc]) continue;
        if (ts.includes(pc)) s += w[pc] * (pc === root ? 1.25 : 1);
        else s -= w[pc] * (scale.includes(pc) ? .55 : .9);
      }
      if (b === 0 && c.degree === 0) s += .5;
      if (b === bars - 1 && c.degree === 0) s += .7;
      if (bars > 2 && b === bars - 2 && (c.degree === 4 || c.degree === 3)) s += .2;
      return s;
    };
    const trans = (pi, ci, b) => {
      const p = cands[pi].degree, c = cands[ci].degree;
      if (p === c) return weights[b] ? -.15 : .2;
      if (p === 4 && c === 0) return .3;
      if ((p === 3 || p === 1) && c === 4) return .2;
      if (p === 0 && [3, 4, 5].includes(c)) return .1;
      if (p === 5 && (c === 3 || c === 1)) return .1;
      return 0;
    };
    // Viterbi over bars
    const n = cands.length;
    let score = cands.map((_, ci) => local(0, ci)), back = [];
    for (let b = 1; b < bars; b++) {
      const next = [], bk = [];
      for (let ci = 0; ci < n; ci++) {
        let best = -Infinity, arg = 0;
        for (let pi = 0; pi < n; pi++) { const v = score[pi] + trans(pi, ci, b); if (v > best) { best = v; arg = pi; } }
        next.push(best + local(b, ci)); bk.push(arg);
      }
      score = next; back.push(bk);
    }
    let ci = score.indexOf(Math.max(...score));
    const out = [cands[ci].name];
    for (let b = bars - 2; b >= 0; b--) { ci = back[b][ci]; out.unshift(cands[ci].name); }
    return out;
  }
  const introChords = key => { const d = diatonic(key); return [d[0].name, d[4].name]; };
  const outroChords = key => { const d = diatonic(key); return [d[3].name, d[0].name]; };

  /* Chord voicing around C3–C4. */
  function voicing(name, base = 48) {
    const c = parse(name);
    let root = base + c.root; if (c.root >= 7) root -= 12;
    return INTERVALS[c.q].map(i => root + 12 + i);
  }
  const bassNote = (name, base = 36) => { const c = parse(name); let r = base + c.bass; if (c.bass >= 8) r -= 12; return r; };

  return { noteName, pcName, keyLabel, detectKey, parse, chordPart, tones,
 diatonic, extras, harmonize, introChords, outroChords, voicing, bassNote, mod12 };
})();
