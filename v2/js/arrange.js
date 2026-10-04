/* Arrangement: song structure, style patterns, compiling a song into timed events, MIDI export. */
const Arrange = (() => {
  let nextId = 1;
  const uid = () => 's' + (nextId++) + Math.random().toString(36).slice(2, 6);
  const clone = o => JSON.parse(JSON.stringify(o));

  /* Styles. To add one: add an entry here (chord/bass patterns are the `case` names in chordEvents/bassEvents,
     drums is a key of KITS or null), append its id to STYLE_ORDER, and add Suno words in sunoPrompt(). */
  const STYLES = {
    piano: { label: '纯钢琴', chord: { inst: 'piano', pat: 'arp', v: .34 }, bass: { inst: 'piano', pat: 'whole', v: .5 }, drums: null },
    pop: { label: '流行', chord: { inst: 'piano', pat: 'pulse', v: .36 }, bass: { inst: 'bass', pat: 'pop', v: .8 }, drums: 'pop' },
    lofi: { label: 'Lo-fi', chord: { inst: 'epiano', pat: 'hold', v: .55, seventh: true }, bass: { inst: 'bass', pat: 'lofi', v: .75 }, drums: 'lofi', tone: 3000, swing: .17 },
    rock: { label: '摇滚', chord: { inst: 'power', pat: 'power8', v: .8 }, bass: { inst: 'synthbass', pat: 'eighths', v: .7 }, drums: 'rock' },
    ballad: { label: '抒情', chord: { inst: 'strings', pat: 'hold', v: .7 }, chord2: { inst: 'piano', pat: 'arp4', v: .3 }, bass: { inst: 'bass', pat: 'whole', v: .7 }, drums: 'ballad' },
    edm: { label: '电子', chord: { inst: 'synth', pat: 'offbeat', v: .6 }, bass: { inst: 'synthbass', pat: 'offbeat', v: .8 }, drums: 'edm' },
  };
  const STYLE_ORDER = ['piano', 'pop', 'lofi', 'rock', 'ballad', 'edm'];
  const range = (a, b, s = 1) => { const r = []; for (let i = a; i < b; i += s) r.push(i); return r; };
  const KITS = {
    pop: { kick: [0, 8, 11], snare: [4, 12], hat: range(0, 16, 2) },
    lofi: { kick: [0, 7, 10], snare: [4, 12], hat: range(0, 16, 2), hatV: .45, snareV: .55 },
    rock: { kick: [0, 6, 8, 10], snare: [4, 12], hat: range(0, 16, 2), hatV: .85, crash: true },
    ballad: { kick: [0, 10], rim: [4, 12], hat: [0, 4, 8, 12], hatV: .4 },
    edm: { kick: [0, 4, 8, 12], clap: [4, 12], ohat: [2, 6, 10, 14], hat: [1, 3, 5, 7, 9, 11, 13, 15], hatV: .35 },
  };
  // Melody instruments shown in the pickers. A new id also needs: Synth INSTRUMENTS, GM below, a CSS colour --i-<id>, Suno words.
  const MELODY_INSTS = [['piano', '钢琴'], ['epiano', '电钢琴'], ['guitar', '吉他'], ['strings', '弦乐'], ['musicbox', '八音盒'], ['synth', '合成器']];
  const instLabel = id => (MELODY_INSTS.find(x => x[0] === id) || [, id])[1];

  /* Fill in chords and the intro / repeat / outro around what was recorded. */
  function arrange(song) {
    const rec = song.sections.map(s => ({ ...s, chords: Theory.harmonize(s.melody ? s.melody.notes : [], s.bars, song.key) }));
    const out = [{ id: uid(), name: '前奏', role: 'intro', bars: 2, melody: null, hits: [], chords: Theory.introChords(song.key) }, ...rec];
    if (rec.length === 1) out.push({ ...clone(rec[0]), id: uid(), role: 'copy' });
    out.push({ id: uid(), name: '尾声', role: 'outro', bars: 2, melody: null, hits: [], chords: Theory.outroChords(song.key) });
    song.sections = out; song.arranged = true;
  }
  function reharmonize(song) {
    for (const s of song.sections) {
      if (s.role === 'intro') s.chords = Theory.introChords(song.key);
      else if (s.role === 'outro') s.chords = Theory.outroChords(song.key);
      else s.chords = Theory.harmonize(s.melody ? s.melody.notes : [], s.bars, song.key);
    }
  }

  function seventh(name, key) {
    const c = Theory.parse(name), deg = Theory.mod12(c.root - key.tonic);
    if (c.q === 'm') return name + '7';
    if (c.q === '') return name + (deg === 7 ? '7' : 'maj7');
    return name;
  }
  function chordEvents(st, name, bar0, beats, role, key, push) {
    const nm = st.seventh ? seventh(name, key) : name, v = Theory.voicing(nm), V = st.v;
    const at = (b, m, d, vel = V) => push(bar0 + b, m, d, vel);
    if (role === 'outro-last') { v.forEach(m => at(0, m, beats, V * 1.1)); return; }
    switch (st.pat) {
      case 'arp': { const seq = [v[0], v[1], v[2], v[0] + 12, v[2], v[1], v[2], v[0] + 12]; for (let i = 0; i < beats * 2; i++) at(i / 2, seq[i % 8], 1.2, V * (i % 2 ? .85 : 1)); break; }
      case 'arp4': { const seq = [v[0], v[1], v[2], v[1]]; for (let i = 0; i < beats; i++) at(i, seq[i % 4] + 12, 1.5); break; }
      case 'pulse': for (const [b, d] of [[0, 1.5], [1.5, 1], [2.5, 1.5]]) if (b < beats) v.forEach(m => at(b, m, d, V * (b ? .85 : 1))); break;
      case 'hold': v.forEach((m, i) => at(i * .03, m, beats - .1)); break;
      case 'power8': { const r = Theory.bassNote(nm, 40) ; for (let i = 0; i < beats * 2; i++) at(i / 2, r, .42, V * (i % 2 ? .8 : 1)); break; }
      case 'offbeat': for (let i = 0; i < beats; i++) v.forEach(m => at(i + .5, m + 12, .3)); break;
    }
  }
  function bassEvents(st, name, bar0, beats, push) {
    const r = Theory.bassNote(name), fifth = r + 7, V = st.v;
    const at = (b, m, d) => { if (b < beats) push(bar0 + b, m, d, V); };
    switch (st.pat) {
      case 'whole': at(0, st.inst === 'piano' ? r + 12 : r, beats); break;
      case 'pop': at(0, r, 1.5); at(1.5, r, .5); at(2, r, 1.5); at(3.5, fifth, .5); break;
      case 'lofi': at(0, r, 2.2); at(2.5, fifth - 12 < 28 ? fifth : fifth - 12, 1.3); break;
      case 'eighths': for (let i = 0; i < beats * 2; i++) at(i / 2, r, .45); break;
      case 'offbeat': for (let i = 0; i < beats; i++) at(i + .5, r, .4); break;
    }
  }

  /* Song -> events. Each event: {b (global beat), db, lane, inst|drum, m, v, t, d (seconds)} */
  function compile(song) {
    const spb = 60 / song.bpm, st = STYLES[song.style] || STYLES.pop, ev = [], mute = song.mute || {};
    const swing = b => { const f = b - Math.floor(b); return st.swing && Math.abs(f - .5) < 1e-6 ? b + st.swing * .5 : b; };
    let bar = 0;
    const starts = [];
    song.sections.forEach((s, si) => {
      const b0 = bar * 4; starts.push(b0);
      if (s.melody && !mute['melody:' + s.melody.inst]) for (const n of s.melody.notes) ev.push({ b: b0 + n.s, db: n.d, lane: 'melody:' + s.melody.inst, inst: s.melody.inst, m: n.p, v: .8 });
      for (const h of s.hits || []) if (!mute[h.k]) ev.push({ b: b0 + h.t, db: .25, lane: h.k, drum: h.k === 'clap' ? 'snare' : 'hat', v: h.k === 'clap' ? .85 : .7 });
      if (song.arranged && s.chords) {
        const last = s.role === 'outro';
        s.chords.forEach((name, i) => {
          const barB = b0 + i * 4, finalBar = last && i === s.chords.length - 1;
          if (!mute.chords) {
            chordEvents(st.chord, name, barB, 4, finalBar ? 'outro-last' : s.role, song.key, (b, m, d, v) => ev.push({ b: swing(b), db: d, lane: 'chords', inst: st.chord.inst, m, v }));
            if (st.chord2 && !finalBar) chordEvents(st.chord2, name, barB, 4, s.role, song.key, (b, m, d, v) => ev.push({ b, db: d, lane: 'chords', inst: st.chord2.inst, m, v }));
          }
          if (!mute.bass) bassEvents(finalBar ? { ...st.bass, pat: 'whole' } : st.bass, name, barB, 4, (b, m, d, v) => ev.push({ b, db: d, lane: 'bass', inst: st.bass.inst, m, v }));
          const kit = KITS[st.drums];
          if (kit && !mute.drums) {
            const add = (drum, step, v) => ev.push({ b: swing(barB + step / 4), db: .25, lane: 'drums', drum, v });
            if (finalBar) { add('kick', 0, .9); add('crash', 0, .8); return; }
            if (s.role === 'intro') { if (i === s.chords.length - 1) for (const k of kit.hat || []) add('hat', k, (kit.hatV || .7) * .8); return; }
            for (const k of kit.kick || []) add('kick', k, .9);
            for (const k of kit.snare || []) add('snare', k, kit.snareV || .8);
            for (const k of kit.rim || []) add('rim', k, .6);
            for (const k of kit.clap || []) add('clap', k, .7);
            for (const k of kit.hat || []) add('hat', k, (kit.hatV || .7) * (k % 4 ? .75 : 1));
            for (const k of kit.ohat || []) add('ohat', k, .6);
            if (kit.crash && i === 0 && si > 0) add('crash', 0, .6);
          }
        });
      }
      bar += s.bars;
    });
    for (const e of ev) { e.t = e.b * spb; e.d = e.db * spb; }
    ev.sort((a, b) => a.t - b.t);
    return { events: ev, bars: bar, starts, duration: bar * 4 * spb, tone: st.tone };
  }

  /* Standard MIDI file, one track per lane. */
  const GM = { piano: 0, epiano: 4, guitar: 25, strings: 48, musicbox: 10, synth: 80, power: 29, bass: 33, synthbass: 38 };
  const GM_DRUM = { kick: 36, snare: 38, hat: 42, ohat: 46, clap: 39, rim: 37, crash: 49 };
  function toMidi(song) {
    const { events } = compile({ ...song, mute: {} });
    const tpq = 480, us = Math.round(60e6 / song.bpm);
    const vlq = v => { const b = [v & 0x7f]; while (v >>= 7) b.unshift((v & 0x7f) | 0x80); return b; };
    const lanes = new Map();
    for (const e of events) { if (!lanes.has(e.lane)) lanes.set(e.lane, []); lanes.get(e.lane).push(e); }
    const tracks = [[0, 0xFF, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255, 0, 0xFF, 0x2F, 0]];
    let ch = 0;
    for (const [lane, evs] of lanes) {
      const drums = evs[0].drum || lane === 'clap' || lane === 'snap', channel = drums ? 9 : ch++ % 9;
      const list = [];
      for (const e of evs) {
        const note = e.drum ? GM_DRUM[e.drum] : e.m, vel = Math.max(1, Math.min(127, Math.round((e.v ?? .8) * 110))), on = Math.round(e.b * tpq), off = Math.max(on + 1, Math.round((e.b + (e.drum ? .25 : e.db)) * tpq));
        list.push([on, 0x90 | channel, note, vel], [off, 0x80 | channel, note, 0]);
      }
      list.sort((a, b) => a[0] - b[0] || (a[1] & 0xF0) - (b[1] & 0xF0));
      const name = [...new TextEncoder().encode(lane)];
      const trk = [0, 0xFF, 0x03, name.length, ...name];
      if (!drums) trk.push(0, 0xC0 | channel, GM[evs[0].inst] ?? 0);
      let last = 0; for (const e of list) { trk.push(...vlq(e[0] - last), e[1], e[2], e[3]); last = e[0]; }
      trk.push(0, 0xFF, 0x2F, 0); tracks.push(trk);
    }
    const bytes = [0x4D, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, (tracks.length >> 8) & 255, tracks.length & 255, tpq >> 8, tpq & 255];
    for (const t of tracks) { const L = t.length; bytes.push(0x4D, 0x54, 0x72, 0x6B, (L >>> 24) & 255, (L >> 16) & 255, (L >> 8) & 255, L & 255, ...t); }
    return new Blob([new Uint8Array(bytes)], { type: 'audio/midi' });
  }

  function sunoPrompt(song) {
    const words = { piano: 'solo grand piano, gentle', pop: 'pop, warm piano, electric bass, light drums', lofi: 'lo-fi hip hop, mellow electric piano, dusty drums, warm bass', rock: 'rock, overdriven guitars, driving drums, bass guitar', ballad: 'ballad, lush strings, soft piano, emotional', edm: 'electronic dance, synth stabs, four-on-the-floor kick, saw bass' };
    const leads = [...new Set(song.sections.filter(s => s.melody).map(s => s.melody.inst))].map(i => ({ piano: 'piano lead', epiano: 'electric piano lead', guitar: 'acoustic guitar lead', strings: 'string lead', musicbox: 'music box melody', synth: 'synth lead' }[i]));
    const key = Theory.pcName(song.key.tonic, song.key) + (song.key.mode === 'major' ? ' major' : ' minor');
    return [song.arranged ? words[song.style] : 'simple arrangement', ...leads, song.bpm + ' BPM', key, 'instrumental'].join(', ');
  }

  return { STYLES, STYLE_ORDER, KITS, MELODY_INSTS, instLabel, uid, clone, arrange, reharmonize, compile, toMidi, sunoPrompt };
})();
