/* App: screens, recording, workspace rendering and interaction, playback, history, export.
   Section banners below ("---- recording ----" etc.) match the map in docs/ARCHITECTURE.md; every UI element
   is traced to its DOM id and handler in docs/UX-WALKTHROUGH.md.
   Rule of thumb: never mutate `song` directly from a UI handler — wrap the change in commit(fn) so it lands in
   the undo history and the workspace re-renders. */
(() => {
  const $ = s => document.querySelector(s);
  const fmt = s => { s = Math.max(0, s); return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); };
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const HAND = 'M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15';
  const ICONS = {
    mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
    metronome: '<path d="M9.2 3h5.6l4.2 18H5L9.2 3Z"/><path d="m12 16 4.5-8.5"/><path d="M7 16h10"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    languages: '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
    speech: '<path d="M8.8 20v-4.1l1.9.2a2.3 2.3 0 0 0 2.164-2.1V8.3A5.37 5.37 0 0 0 2 8.25c0 2.8.656 3.054 1 4.55a5.77 5.77 0 0 1 .029 2.758L2 20"/><path d="M19.8 17.8a7.5 7.5 0 0 0 .003-10.603"/><path d="M17 15a3.5 3.5 0 0 0-.025-4.975"/>',
    clap: `<g transform="translate(0.5 5.5) rotate(18 6 9) scale(0.62)" stroke-width="3.2"><path d="${HAND}"/></g><g transform="translate(23.5 5.5) scale(-1 1) rotate(18 6 9) scale(0.62)" stroke-width="3.2"><path d="${HAND}"/></g><path d="M12 1.5v2.2"/><path d="M8.3 2.6l1 1.7"/><path d="M15.7 2.6l-1 1.7"/>`,
    snap: `<g transform="translate(0 5.5) scale(0.76)" stroke-width="2.6"><path d="${HAND}"/></g><path d="M19.5 1.8v2.6"/><path d="M22.4 5h-2.6"/><path d="M22 2.3l-1.7 1.7"/>`,
    piano: '<path d="M18.5 8c-1.4 0-2.6-.8-3.2-2A6.87 6.87 0 0 0 2 9v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-8.5C22 9.6 20.4 8 18.5 8"/><path d="M2 14h20"/><path d="M6 14v4"/><path d="M10 14v4"/><path d="M14 14v4"/><path d="M18 14v4"/>',
    drum: '<path d="m2 2 8 8"/><path d="m22 2-8 8"/><ellipse cx="12" cy="9" rx="10" ry="5"/><path d="M7 13.4v7.9"/><path d="M12 14v8"/><path d="M17 13.4v7.9"/><path d="M2 9v8a10 5 0 0 0 20 0V9"/>',
    keyboard: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="M6 8h.01"/><path d="M10 8h.01"/><path d="M14 8h.01"/><path d="M18 8h.01"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/><path d="M7 16h10"/>',
    hihat: '<path d="M3 8c3-1.8 15-1.8 18 0"/><path d="M3 11.5c3 1.8 15 1.8 18 0"/><path d="M12 3.5v18"/><path d="M8.5 21.5h7"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',
    play: '<path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" fill="currentColor" stroke="none"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/>',
    rotate: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    sparkle: '<path d="M9.94 14.06 4 20"/><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z"/>',
    chev: '<path d="m6 9 6 6 6-6"/>',
    minus: '<path d="M5 12h14"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    volume: '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>',
    mute: '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/>',
    grip: '<circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  };
  const icon = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;
  const hydrate = root => root.querySelectorAll('[data-icon]').forEach(el => { el.outerHTML = icon(el.dataset.icon); });
  document.querySelectorAll('[data-logo]').forEach(h => h.appendChild($('#logoTpl').content.cloneNode(true)));
  hydrate(document);

  let toastT = 0;
  const toast = msg => { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 4200); };
  const setup = (cv, w, h) => { const d = window.devicePixelRatio || 1; cv.width = Math.max(1, Math.round(w * d)); cv.height = Math.max(1, Math.round(h * d)); cv.style.width = w + 'px'; cv.style.height = h + 'px'; const g = cv.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); return g; };
  const rr = (g, x, y, w, h, r) => { r = Math.max(0, Math.min(r, w / 2, h / 2)); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const save = (blob, name) => { const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 3000); };
  const instColor = inst => `--i-${inst}`;
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- state ---------------- */
  const prefs = (() => { try { return JSON.parse(localStorage.getItem('hum2-prefs')) || {}; } catch (e) { return {}; } })();
  prefs.metronome = !!prefs.metronome; prefs.bpm = prefs.bpm || 100;
  const savePrefs = () => { try { localStorage.setItem('hum2-prefs', JSON.stringify(prefs)); } catch (e) {} };
  let song = null, sel = null, playhead = 0, preArrange = null;
  const takes = new Map();
  const hist = { undo: [], redo: [] };
  const snapshot = () => JSON.stringify(song);
  function pushHistory(snap) { hist.undo.push(snap); if (hist.undo.length > 200) hist.undo.shift(); hist.redo = []; }
  function commit(fn, anim) { pushHistory(snapshot()); fn(); afterChange(anim); }
  function undo() { if (!hist.undo.length) return; hist.redo.push(snapshot()); song = JSON.parse(hist.undo.pop()); afterChange(); }
  function redo() { if (!hist.redo.length) return; hist.undo.push(snapshot()); song = JSON.parse(hist.redo.pop()); afterChange(); }
  const findSec = id => song && song.sections.find(s => s.id === id);
  // a phone (not just a narrow window): used for the landscape layout and the rotate prompt
  const isPhone = () => matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 600;
  function afterChange(anim) {
    if (sel && !findSec(sel.sec)) sel = null;
    if (sel && sel.type === 'melody' && !findSec(sel.sec).melody) sel = null;
    renderWork(anim);
    if (player) refreshPlayer();
  }

  /* ---------------- screens ---------------- */
  let screen = 'home';
  function show(id) { screen = id; for (const s of ['home', 'recording', 'work']) $('#' + s).hidden = s !== id; if (id === 'work') requestAnimationFrame(() => renderWork()); }

  /* ---------------- menus ---------------- */
  let menuCleanup = null;
  function openMenu(anchor, build, align = 'right') {
    closeMenu();
    const m = $('#menu'); m.innerHTML = ''; build(m); hydrate(m); m.hidden = false;
    const r = anchor.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
    let x = align === 'right' ? r.right - mw : r.left; x = clamp(x, 8, innerWidth - mw - 8);
    let y = r.bottom + 8; if (y + mh > innerHeight - 8) y = Math.max(8, r.top - mh - 8);
    m.style.left = x + 'px'; m.style.top = y + 'px';
    const off = e => { if (!m.contains(e.target) && !anchor.contains(e.target)) closeMenu(); };
    setTimeout(() => document.addEventListener('pointerdown', off), 0);
    menuCleanup = () => document.removeEventListener('pointerdown', off);
  }
  function closeMenu() { $('#menu').hidden = true; if (menuCleanup) menuCleanup(); menuCleanup = null; }
  const item = (m, html, fn, opts = {}) => { const b = document.createElement('button'); b.innerHTML = html; if (opts.disabled) b.disabled = true; if (opts.cls) b.className = opts.cls; b.addEventListener('click', e => fn(e, b)); m.appendChild(b); return b; };

  /* ---------------- home ---------------- */
  function syncHome() {
    const mb = $('#metroBtn'); mb.setAttribute('aria-pressed', prefs.metronome); mb.classList.toggle('off', !prefs.metronome);
    $('#bpmRow').hidden = !prefs.metronome; $('#bpmOut').textContent = prefs.bpm;
  }
  $('#metroBtn').addEventListener('click', () => { prefs.metronome = !prefs.metronome; savePrefs(); syncHome(); });
  $('#bpmDown').addEventListener('click', () => { prefs.bpm = clamp(prefs.bpm - 5, 40, 240); savePrefs(); syncHome(); });
  $('#bpmUp').addEventListener('click', () => { prefs.bpm = clamp(prefs.bpm + 5, 40, 240); savePrefs(); syncHome(); });
  $('#uploadBtn').addEventListener('click', () => $('#fileInput').click());
  $('#langBtn').addEventListener('click', e => openMenu(e.currentTarget, m => {
    item(m, icon('check') + '中文', closeMenu);
    item(m, '<span style="width:16px"></span>English', closeMenu, { disabled: true });
    item(m, '<span style="width:16px"></span>Deutsch', closeMenu, { disabled: true });
  }, 'left'));
  $('#fileInput').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    $('#analyzing').hidden = false;
    try {
      const S = Synth.ctx(), buf = await S.c.decodeAudioData(await f.arrayBuffer());
      const mono = await toMonoBuffer(buf), res = await analyzeTake(mono, null);
      if (!res) { toast('没有听出旋律。换一段更清楚的录音试试。'); return; }
      newSong(res, mono);
    } catch (err) { console.error(err); toast('这个文件打不开。换成 mp3、m4a 或 wav 再试。'); }
    finally { $('#analyzing').hidden = true; }
  });
  syncHome();

  /* ---------------- recording ---------------- */
  async function startCapture(opts) {
    const S = Synth.ctx(), c = S.c, sr = c.sampleRate;
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); }
    catch (e) { toast('无法使用麦克风。可以先用手机录一段，再上传。'); return null; }
    const src = c.createMediaStreamSource(stream), an = c.createAnalyser(); an.fftSize = 2048; src.connect(an);
    const proc = c.createScriptProcessor(4096, 1, 1), mute = c.createGain(); mute.gain.value = 0;
    const R = { S, c, sr, stream, src, an, proc, mute, chunks: [], n: 0, firstCtx: null, opts, live: { pitch: [], hits: [] }, taps: [], buf: new Float32Array(2048), d: new Float32Array(1100),
      lo: 56, hi: 74, spb: 60 / opts.bpm, bus: c.createGain(), note: null };
    R.bus.gain.value = .55; R.bus.connect(S.input);
    proc.onaudioprocess = e => {
      const data = new Float32Array(e.inputBuffer.getChannelData(0));
      if (R.firstCtx === null) R.firstCtx = Math.max(0, e.playbackTime - 2 * data.length / sr);
      R.chunks.push(data); R.n += data.length;
    };
    src.connect(proc); proc.connect(mute); mute.connect(c.destination);
    // count-in: two bars of clicks with the metronome, a silent 3-2-1 without it
    R.tStart = c.currentTime + .15;
    R.count = opts.metronome ? 8 : 0;
    R.beat0Ctx = R.tStart + (opts.metronome ? R.count * R.spb : 3);
    R.split = R.tStart + (opts.metronome ? 4 * R.spb : 2.5); // full-screen count flies up here (recording screen only)
    R.nextClick = 0;
    if (opts.metronome || opts.backing) { R.timer = setInterval(() => pumpRec(R), 40); pumpRec(R); }
    if (opts.backing) { const b = opts.backing; R.back = { events: b.events, loop: b.loop, k: 0, idx: 0 }; }
    R.raf = requestAnimationFrame(() => liveLoop(R));
    return R;
  }
  function pumpRec(R) {
    const until = R.c.currentTime + .3;
    if (R.opts.metronome) while (R.tStart + R.nextClick * R.spb < until) { Synth.click(R.S, R.tStart + R.nextClick * R.spb, R.nextClick % 4 === 0); R.nextClick++; }
    const B = R.back;
    if (B && B.events.length) while (true) {
      if (B.idx >= B.events.length) { B.idx = 0; B.k++; }
      const e = B.events[B.idx], t = R.beat0Ctx + B.k * B.loop + e.t;
      if (t > until) break;
      if (t > R.c.currentTime - .02) Synth.play(R.S, R.bus, { ...e, t });
      B.idx++;
    }
  }
  /* A drum key (Space / Alt) or pad: sound it now, mark it on the live view, keep its context time for analysis. */
  function tap(R, k) {
    if (!R || R.stopped || R.firstCtx === null) return;
    const c = R.c, now = c.currentTime;
    if (now < R.beat0Ctx) return; // count-in: ignored
    Synth.play(R.S, R.bus, { drum: k === 'clap' ? 'snare' : 'hat', t: now, v: .8 });
    R.live.hits.push({ t: now - R.firstCtx, k });
    R.taps.push({ ctx: now, k });
  }
  function liveLoop(R) {
    if (R.stopped) return;
    const c = R.c, sr = c.sampleRate, ct = c.currentTime, o = R.opts, counting = ct < R.beat0Ctx;
    R.now = R.firstCtx === null ? 0 : Math.min(ct, R.beat0Ctx) - R.firstCtx; // the view starts scrolling when the count-in ends
    let m = NaN;
    if (!counting) {
      R.an.getFloatTimeDomainData(R.buf);
      let e = 0; for (const v of R.buf) e += v * v;
      const rms = Math.sqrt(e / R.buf.length);
      if (rms > .006) { const r = DSP.yin(R.buf, 0, 1024, sr, Math.floor(sr / 1000), Math.min(1024, Math.ceil(sr / 65)), R.d); if (r.c < .2 && r.f > 65 && r.f < DSP.F_MAX) m = 69 + 12 * Math.log2(r.f / 440); }
      R.live.pitch.push({ t: R.now, m });
    }
    const beat = Math.floor((ct - R.tStart) / R.spb), noteEl = o.noteEl;
    // count-in: the dots fill up one by one; while recording only the current beat of the two-bar cycle is lit
    if (o.beatEl) { o.beatEl.hidden = !o.metronome; o.beatEl.querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', counting ? beat >= i : beat % 8 === i)); }
    if (counting) {
      if (!o.metronome) { noteEl.textContent = String(clamp(3 - Math.floor(ct - R.tStart), 1, 3)); noteEl.classList.add('count'); noteEl.classList.remove('quiet'); }
    } else {
      if (!R.started) { R.started = true; noteEl.textContent = o.compact ? '' : '–'; noteEl.classList.remove('count'); noteEl.classList.add('quiet'); if (noteEl.classList.contains('gone')) revealNote(o); }
      if (!isNaN(m)) { noteEl.textContent = Theory.noteName(Math.round(m)); noteEl.classList.remove('quiet'); } else noteEl.classList.add('quiet');
    }
    if (o.countEl) countIn(R, ct);
    o.timerEl.textContent = fmt(Math.max(0, ct - R.beat0Ctx));
    drawLive(R);
    R.raf = requestAnimationFrame(() => liveLoop(R));
  }
  /* Recording-screen count-in (Figma 22a–23b). A copy of the real dots / number sits over them, scaled up to fill the
     screen; at R.split the copy shrinks back onto the real element (FLIP) and the rest of the screen fades in. */
  function placeCount(o) {
    const C = o.countEl, target = o.metronome ? o.beatEl : o.noteEl;
    if (!C.firstChild) { const k = target.cloneNode(true); k.removeAttribute('id'); k.hidden = false; C.appendChild(k); C.hidden = false; }
    const copy = C.firstChild;
    if (o.metronome) copy.querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', o.beatEl.children[i].classList.contains('on')));
    else { copy.textContent = o.noteEl.textContent; copy.className = o.noteEl.className; }
    const r = target.getBoundingClientRect(); if (!r.width) return;
    Object.assign(C.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    const k = o.metronome ? Math.min(3.6, (innerWidth - 40) / r.width) : Math.min(260 / parseFloat(getComputedStyle(o.noteEl).fontSize), innerHeight * .6 / r.height);
    C.style.transform = `translate(${innerWidth / 2 - r.left - r.width / 2}px, ${innerHeight / 2 - r.top - r.height / 2}px) scale(${k})`;
  }
  function countIn(R, ct) {
    const o = R.opts, C = o.countEl;
    if (R.flying) { if (o.metronome && C.firstChild) C.firstChild.querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', o.beatEl.children[i].classList.contains('on'))); return; }
    placeCount(o);
    if (ct < R.split) return;
    R.flying = true;
    const land = () => { if (R.stopped) return; o.screenEl.classList.remove('counting'); setTimeout(() => { if (!R.stopped) resetCount(); }, reducedMotion() ? 0 : 300); };
    if (reducedMotion()) return land();
    void C.offsetWidth; C.classList.add('fly'); C.style.transform = 'none';
    setTimeout(land, 400);
  }
  function resetCount() { const C = $('#countIn'); C.hidden = true; C.innerHTML = ''; C.className = 'count-in'; C.style.transform = ''; }
  // metronome: the note name appears when recording starts; slide the dots over instead of letting them jump
  function revealNote(o) {
    const d = o.beatEl, r1 = d.getBoundingClientRect();
    o.noteEl.classList.remove('gone');
    const r2 = d.getBoundingClientRect();
    if (!reducedMotion() && r1.width && d.animate) d.animate([{ transform: `translateX(${r1.left - r2.left}px)` }, { transform: 'none' }], { duration: 300, easing: 'ease-out' });
  }
  function drawLive(R) {
    const cv = R.opts.canvas, box = cv.parentElement, W = box.clientWidth, H = box.clientHeight; if (!W || !H) return;
    const g = setup(cv, W, H), now = R.now, compact = R.opts.compact, pps = compact ? 90 : 110, cx = W / 2, X = t => cx - (now - t) * pps;
    // two drum rows under the pitch area; in the compact view they sit above the record button strip (Figma 26)
    const mh = compact ? H - 101 : H - 88, rowH = compact ? 26 : 44;
    g.clearRect(0, 0, W, H);
    g.fillStyle = css('--line');
    const beat0 = R.firstCtx === null ? 0 : R.beat0Ctx - R.firstCtx;
    if (R.opts.metronome) { const k0 = Math.floor((now - cx / pps - beat0) / R.spb), k1 = Math.ceil((now + cx / pps - beat0) / R.spb); for (let k = k0; k <= k1; k++) { const x = X(beat0 + k * R.spb); g.globalAlpha = k % 4 ? .45 : 1; g.fillRect(Math.round(x), 0, 1, H); } g.globalAlpha = 1; }
    else { for (let s = Math.floor(now - cx / pps); s <= now + cx / pps; s++) { g.globalAlpha = .5; g.fillRect(Math.round(X(s)), 0, 1, H); } g.globalAlpha = 1; }
    g.fillRect(0, mh, W, 1); g.fillRect(0, mh + rowH, W, 1);
    const pts = R.live.pitch.filter(p => p.t >= now - cx / pps - .1), v = pts.filter(p => !isNaN(p.m)).map(p => p.m);
    if (v.length) { let lo = Math.floor(Math.min(...v)) - 3, hi = Math.ceil(Math.max(...v)) + 3; while (hi - lo < 14) { lo--; hi++; } R.lo += (lo - R.lo) * .08; R.hi += (hi - R.hi) * .08; }
    const Y = m => 12 + (R.hi - m) / (R.hi - R.lo) * (mh - 24);
    g.strokeStyle = css(R.opts.color || '--accent'); g.lineWidth = 2.5; g.lineJoin = g.lineCap = 'round'; g.beginPath();
    let pen = false; for (const p of pts) { if (isNaN(p.m)) { pen = false; continue; } pen ? g.lineTo(X(p.t), Y(p.m)) : g.moveTo(X(p.t), Y(p.m)); pen = true; } g.stroke();
    const last = pts[pts.length - 1];
    if (last && !isNaN(last.m)) { g.fillStyle = css(R.opts.color || '--accent'); g.beginPath(); g.arc(cx, Y(last.m), 6, 0, 7); g.fill(); }
    g.fillStyle = css('--hits');
    for (const h of R.live.hits) { const x = X(h.t); if (x < -10 || x > cx + 10) continue; const big = h.k === 'clap', y = big ? mh + rowH / 2 : mh + rowH * 1.5; g.beginPath(); g.arc(x, y, big ? 7 : 4.5, 0, 7); g.fill(); }
    g.fillStyle = css('--ink'); g.fillRect(cx - 1, 0, 2, H);
  }
  function goertzelPeak(x, sr, t0, t1, freqs) {
    const N = 256, hop = 64; let best = { t: 0, e: 0 }, es = [];
    for (let s = Math.max(0, Math.floor(t0 * sr)); s + N < Math.min(x.length, t1 * sr); s += hop) {
      let tot = 0;
      for (const f of freqs) { const k = 2 * Math.cos(2 * Math.PI * f / sr); let s1 = 0, s2 = 0; for (let i = 0; i < N; i++) { const s0 = x[s + i] + k * s1 - s2; s2 = s1; s1 = s0; } tot += s1 * s1 + s2 * s2 - k * s1 * s2; }
      es.push(tot); if (tot > best.e) best = { t: s / sr, e: tot };
    }
    const med = DSP.median(es);
    return best.e > med * 30 && best.e > 1e-3 ? best.t : null;
  }
  async function stopCapture(R) {
    R.stopped = true; cancelAnimationFrame(R.raf); clearInterval(R.timer);
    const t = R.c.currentTime; R.bus.gain.setTargetAtTime(0, t, .03); setTimeout(() => R.bus.disconnect(), 300);
    R.src.disconnect(); R.proc.disconnect(); R.mute.disconnect(); R.stream.getTracks().forEach(tr => tr.stop());
    const len = R.chunks.reduce((s, a) => s + a.length, 0);
    if (len < R.sr * .4) return null;
    const buffer = R.c.createBuffer(1, len, R.sr), d = buffer.getChannelData(0);
    let o = 0; for (const a of R.chunks) { d.set(a, o); o += a.length; }
    let info = null;
    if (R.opts.metronome) {
      let beat0 = R.beat0Ctx - R.firstCtx;
      const offs = [];
      for (let k = 0; k < R.count; k++) { const te = R.tStart + k * R.spb - R.firstCtx, pk = goertzelPeak(d, R.sr, te - .25, te + .25, [1250, 1600]); if (pk !== null) offs.push(pk - te); }
      if (offs.length >= 2) { const m = DSP.median(offs); if (Math.abs(m) < .25) beat0 += m; }
      info = { bpm: R.opts.bpm, beat0 };
    }
    // With the metronome the player taps along with clicks that leave the speaker outputLatency late, so taps are
    // placed on the beat grid directly. Without it they share the buffer clock with the voice and go through tempo estimation.
    const outLat = R.c.outputLatency || R.c.baseLatency || 0;
    const taps = R.opts.metronome ? R.taps.map(p => ({ b: (p.ctx - outLat - R.beat0Ctx) / R.spb, k: p.k })) : R.taps.map(p => ({ t: p.ctx - R.firstCtx, k: p.k }));
    return { buffer, info, taps };
  }
  async function toMonoBuffer(buf) {
    if (buf.numberOfChannels === 1) return buf;
    const x = await DSP.toMono(buf, buf.sampleRate), b = new AudioBuffer({ length: x.length, sampleRate: buf.sampleRate, numberOfChannels: 1 });
    b.copyToChannel(x, 0); return b;
  }
  /* buffer: the take. info: {bpm, beat0 (seconds into the buffer)} when recorded with the metronome, else null (tempo is estimated).
     taps: drum keys, either [{b: beats from beat 0, k}] (metronome) or [{t: seconds into the buffer, k}] (no metronome). */
  async function analyzeTake(buffer, info, taps = []) {
    const x22 = await DSP.toMono(buffer, DSP.SR);
    const tr = DSP.transcribe(DSP.pitchFrames(x22));
    const secTaps = taps.filter(p => p.t !== undefined), beatTaps = taps.filter(p => p.b !== undefined);
    let bpm, t0;
    if (info) ({ bpm, beat0: t0 } = info);
    else ({ bpm, t0 } = DSP.estimateTempo([...tr.notes.map(n => n.t), ...secTaps.map(p => p.t)]));
    let { notes, hits: hb } = DSP.toBeats(tr.notes, secTaps, bpm, t0);
    for (const p of beatTaps) { const t = Math.round(p.b * 4) / 4; if (t < -0.01) continue; if (!hb.some(h => h.t === Math.max(0, t) && h.k === p.k)) hb.push({ t: Math.max(0, t), k: p.k }); }
    hb.sort((a, b) => a.t - b.t);
    const first = Math.min(Infinity, ...notes.map(n => n.s), ...hb.map(h => h.t));
    if (!isFinite(first)) return null;
    const shift = Math.floor(first / 4) * 4;
    notes = notes.map(n => ({ ...n, s: n.s - shift })); hb = hb.map(h => ({ ...h, t: h.t - shift }));
    const end = Math.max(0, ...notes.map(n => n.s + n.d), ...hb.map(h => h.t + .25));
    window.__lastAnalysis = { taps, notes: tr.notes, bpm, t0 };
    return { notes, hits: hb, bpm, bars: Math.max(1, Math.ceil(end / 4 - 1e-6)) };
  }
  function newSong(res, buffer) {
    const take = 't' + Date.now(); takes.clear(); takes.set(take, buffer);
    const autoKey = Theory.detectKey(res.notes);
    song = { bpm: res.bpm, key: { ...autoKey }, autoKey, arranged: false, style: 'pop', mute: {},
      sections: [{ id: Arrange.uid(), name: '主歌', role: 'rec', bars: res.bars, melody: res.notes.length ? { inst: 'piano', notes: res.notes } : null, hits: res.hits, chords: null, take }] };
    hist.undo = []; hist.redo = []; preArrange = null; sel = null; playhead = 0;
    show('work');
  }

  let mainRec = null;
  async function startMain() {
    if (mainRec) return;
    const metronome = prefs.metronome, bn = $('#bigNote'), dots = $('#beatDots');
    bn.textContent = metronome ? '' : '3'; bn.className = 'big-note ' + (metronome ? 'gone' : 'count');
    dots.hidden = !metronome; dots.querySelectorAll('i').forEach(d => d.classList.remove('on'));
    $('#timer').textContent = '0:00';
    resetCount(); $('#recording').classList.add('counting');
    show('recording');
    const opts = { canvas: $('#liveCv'), noteEl: bn, beatEl: dots, timerEl: $('#timer'), countEl: $('#countIn'), screenEl: $('#recording'), metronome, bpm: prefs.bpm };
    placeCount(opts);
    mainRec = await startCapture(opts);
    if (!mainRec) { resetCount(); show('home'); }
  }
  function leaveRecording() { resetCount(); $('#recording').classList.remove('counting'); }
  async function stopMain() {
    if (!mainRec) return;
    const R = mainRec; mainRec = null;
    leaveRecording();
    const out = await stopCapture(R);
    if (!out) { show('home'); return; }
    $('#analyzing').hidden = false;
    try {
      const res = await analyzeTake(out.buffer, out.info, out.taps);
      if (!res) { toast('没有听出旋律。离麦克风近一点再试。'); show('home'); return; }
      newSong(res, out.buffer);
    } finally { $('#analyzing').hidden = true; }
  }
  // Esc while recording asks first; a second Esc (or the red button) confirms.
  function openQuit() { $('#quitModal').hidden = false; $('#quitNo').focus(); }
  function closeQuit() { $('#quitModal').hidden = true; }
  function abandonMain() {
    closeQuit();
    const R = mainRec; mainRec = null;
    if (R) stopCapture(R);
    leaveRecording(); show('home');
  }
  $('#quitNo').addEventListener('click', closeQuit);
  $('#quitYes').addEventListener('click', abandonMain);
  // phone pads (Figma 25): pointerdown, not click, so the hit lands when the finger does
  document.querySelectorAll('.pad').forEach(p => p.addEventListener('pointerdown', e => {
    e.preventDefault();
    const R = screen === 'recording' ? mainRec : addState && addState.rec;
    if (!R) return;
    tap(R, p.dataset.k); p.classList.add('on'); clearTimeout(p._t); p._t = setTimeout(() => p.classList.remove('on'), 120);
  }));
  $('#recBtn').addEventListener('click', startMain);

  $('#stopBtn').addEventListener('click', stopMain);

  /* ---------------- workspace: layout ---------------- */
  const L = { secH: 32, laneH: 46, bw: 60 };
  function lanes() {
    const out = [], insts = [];
    for (const s of song.sections) if (s.melody && !insts.includes(s.melody.inst)) insts.push(s.melody.inst);
    for (const i of insts) out.push({ id: 'melody:' + i, kind: 'melody', inst: i, label: Arrange.instLabel(i), color: instColor(i) });
    if (song.sections.some(s => s.hits.some(h => h.k === 'clap'))) out.push({ id: 'clap', kind: 'hits', hit: 'clap', label: '军鼓', color: '--hits' });
    if (song.sections.some(s => s.hits.some(h => h.k === 'snap'))) out.push({ id: 'snap', kind: 'hits', hit: 'snap', label: '踩镲', color: '--hits' });
    if (song.arranged) {
      out.push({ id: 'chords', kind: 'chords', label: '和弦', color: '--chords', auto: true });
      out.push({ id: 'bass', kind: 'auto', label: '贝斯', color: '--bass', auto: true });
      if (Arrange.STYLES[song.style].drums) out.push({ id: 'drums', kind: 'auto', label: '鼓', color: '--kit', auto: true });
    }
    return out;
  }
  const starts = () => { const a = []; let b = 0; for (const s of song.sections) { a.push(b); b += s.bars; } return { a, total: b }; };

  function renderWork(anim) {
    if (!song || screen !== 'work') return;
    $('#keyChip span').textContent = Theory.keyLabel(song.key);
    $('#tempoChip span').textContent = '♩ ' + song.bpm;
    $('#styleChip span').textContent = Arrange.STYLES[song.style].label;
    $('#preArrange').hidden = song.arranged && !arranging;
    $('#styleSeg').hidden = !song.arranged || arranging;
    $('#sunoBtn').hidden = !song.arranged || arranging;
    const seg = $('#styleSeg'); seg.innerHTML = '';
    for (const id of Arrange.STYLE_ORDER) { const b = document.createElement('button'); b.textContent = Arrange.STYLES[id].label; b.setAttribute('aria-pressed', id === song.style); b.addEventListener('click', () => { if (song.style === id) return; commit(() => { song.style = id; }, 'style'); }); seg.appendChild(b); }
    setPlayIcon();
    renderArr(anim);
    renderEditor();
    updateTime();
  }

  function renderArr(anim) {
    const ls = lanes(), { a: st, total } = starts(), scroll = $('#arrScroll'), keepScroll = scroll.scrollLeft;
    const avail = scroll.clientWidth || 800;
    L.laneH = ls.length <= 3 ? 60 : 46;
    // bars fill the width when the song is short; past that they keep a minimum width and the timeline scrolls
    L.bw = clamp((avail - 72) / Math.max(total, 12), innerWidth <= 640 || isPhone() ? 56 : 72, 110);
    const W = total * L.bw + 72, H = L.secH + ls.length * L.laneH;
    const labels = $('#arrLabels'), tl = $('#arrTl');
    hideInsert();
    labels.innerHTML = '<div class="head"></div>'; tl.innerHTML = '';
    tl.style.width = W + 'px'; tl.style.height = H + 'px';
    const firstAuto = ls.findIndex(l => l.auto);
    ls.forEach((ln, i) => {
      const d = document.createElement('div'); d.className = 'lane-label' + (song.mute[ln.id] ? ' muted' : ''); d.style.height = L.laneH + 'px';
      if (anim === 'arrange' && ln.auto) { d.classList.add('lane-enter'); d.style.setProperty('--i', i - firstAuto); }
      d.innerHTML = `<i class="dot" style="background:var(${ln.color})"></i><button class="name${ln.kind === 'melody' ? ' drop' : ''}">${ln.label}${ln.kind === 'melody' ? icon('chev') : ''}</button><button class="mute" aria-label="静音">${icon(song.mute[ln.id] ? 'mute' : 'volume')}</button>`;
      if (ln.kind === 'melody') d.querySelector('.name').addEventListener('click', e => openMenu(e.currentTarget, m => {
        for (const [id, lab] of Arrange.MELODY_INSTS) item(m, (id === ln.inst ? icon('check') : '<span style="width:16px"></span>') + lab, () => { closeMenu(); if (id !== ln.inst) commit(() => song.sections.forEach(s => { if (s.melody && s.melody.inst === ln.inst) s.melody.inst = id; })); });
      }, 'left'));
      d.querySelector('.mute').addEventListener('click', () => { song.mute[ln.id] = !song.mute[ln.id]; renderArr(); if (player) refreshPlayer(); });
      labels.appendChild(d);
    });
    const add = (cls, style, html = '') => { const e = document.createElement('div'); e.className = cls; for (const [k, v] of Object.entries(style)) k.startsWith('--') ? e.style.setProperty(k, v) : (e.style[k] = v); e.innerHTML = html; tl.appendChild(e); return e; };
    add('sec-row', { width: W + 'px' });
    song.sections.forEach((s, i) => {
      const e = add('sec' + (sel && sel.type === 'section' && sel.sec === s.id ? ' selected' : ''), { left: st[i] * L.bw + 'px', width: s.bars * L.bw + 'px' }, `<span class="grip">${icon('grip')}</span><span>${s.name}</span>`);
      e.dataset.sec = s.id;
      if (anim === 'arrange' && s.role !== 'rec') e.classList.add('enter');
    });
    for (let b = 1; b <= total; b++) add('vline' + (st.includes(b) || b === total ? '' : ' weak'), { left: b * L.bw + 'px' });
    ls.forEach((ln, i) => { if (i) add('hline', { top: L.secH + i * L.laneH + 'px', width: total * L.bw + 'px' }); });
    const compiled = Arrange.compile({ ...song, mute: {} });
    ls.forEach((ln, i) => {
      const top = L.secH + i * L.laneH;
      if (ln.kind === 'melody' || ln.kind === 'hits') {
        const ps = song.sections.flatMap(s => s.melody && s.melody.inst === ln.inst ? s.melody.notes.map(n => n.p) : []);
        const lo = Math.min(...ps, 60) - 1, hi = Math.max(lo + 9, Math.max(...ps, 60) + 1);
        song.sections.forEach((s, si) => {
          const has = ln.kind === 'melody' ? s.melody && s.melody.inst === ln.inst : s.hits.some(h => h.k === ln.hit);
          if (!has) return;
          const x = st[si] * L.bw + 2, w = s.bars * L.bw - 4, h = L.laneH - 10;
          const isSel = sel && sel.sec === s.id && (sel.type === (ln.kind === 'melody' ? 'melody' : 'hits'));
          const c = add('clip' + (isSel ? ' selected' : '') + (anim === 'arrange' && s.role === 'copy' ? ' enter' : ''), { left: x + 'px', top: top + 5 + 'px', width: w + 'px', height: h + 'px', '--c': `var(${ln.color})` });
          c.dataset.sec = s.id; c.dataset.kind = ln.kind === 'melody' ? 'melody' : 'hits';
          const cv = document.createElement('canvas'); c.appendChild(cv);
          const g = setup(cv, w, h), ppb = w / (s.bars * 4);
          g.fillStyle = css(ln.color);
          if (ln.kind === 'melody') for (const n of s.melody.notes) { rr(g, n.s * ppb + 1, 6 + (hi - n.p) / (hi - lo) * (h - 17), Math.max(3, n.d * ppb - 2), 5, 2); g.fill(); }
          else for (const hh of s.hits) if (hh.k === ln.hit) { g.beginPath(); g.arc((hh.t + .125) * ppb, h / 2, ln.hit === 'clap' ? 5 : 3.5, 0, 7); g.fill(); }
        });
      } else if (ln.kind === 'chords') {
        song.sections.forEach((s, si) => (s.chords || []).forEach((name, b) => {
          const dim = s.role === 'intro' || s.role === 'outro', isSel = sel && sel.type === 'chord' && sel.sec === s.id && sel.bar === b;
          const e = add('chord' + (dim ? ' dim' : '') + (isSel ? ' selected' : ''), { left: (st[si] + b) * L.bw + 3 + 'px', top: top + 7 + 'px', width: L.bw - 6 + 'px', height: L.laneH - 14 + 'px' }, name);
          e.dataset.sec = s.id; e.dataset.bar = b;
        }));
      } else {
        const cv = document.createElement('canvas'); cv.className = 'auto-cv'; cv.style.top = top + 'px'; tl.appendChild(cv);
        const g = setup(cv, total * L.bw, L.laneH), ppb = L.bw / 4;
        g.fillStyle = css(ln.color);
        for (const e of compiled.events) {
          if (e.lane !== ln.id) continue;
          if (ln.id === 'bass') { rr(g, e.b * ppb + 1, 8 + (52 - e.m) / 24 * (L.laneH - 22), Math.max(3, e.db * ppb - 2), 5, 2); g.fill(); }
          else { const y = { kick: L.laneH - 12, snare: L.laneH / 2, clap: L.laneH / 2, rim: L.laneH / 2, crash: 9, hat: 10, ohat: 10 }[e.drum], r = { kick: 3.5, snare: 3, clap: 3, rim: 2.5, crash: 3.5, hat: 1.6, ohat: 2 }[e.drum]; g.beginPath(); g.arc(e.b * ppb + 2, y, r, 0, 7); g.fill(); }
        }
      }
    });
    const tile = add('add-sec', { left: total * L.bw + 10 + 'px', top: '7px', height: H - 14 + 'px' }, icon('plus') + '<span>段落</span>');
    tile.addEventListener('click', () => openAdd());
    if ((anim === 'arrange' || anim === 'style') && firstAuto >= 0) {
      const t = L.secH + firstAuto * L.laneH, h = (ls.length - firstAuto) * L.laneH;
      add('wipe', { top: t + 'px', height: h + 'px', width: total * L.bw + 'px' });
      const sw = add('sweep', { top: t + 'px', height: h + 'px' });
      sw.style.setProperty('--w', total * L.bw + 'px');
      if (anim === 'style') { tl.querySelectorAll('.wipe, .sweep').forEach(e => e.style.animationDelay = '0s'); }
      setTimeout(() => tl.querySelectorAll('.wipe, .sweep').forEach(e => e.remove()), 1800);
    }
    add('playhead', { left: playhead * L.bw / 4 + 'px' }).id = 'arrPlayhead';
    add('ph-tag', { left: playhead * L.bw / 4 - 7 + 'px' }, PH_TAG).id = 'arrTag';
    $('#editorHint').hidden = !!sel;
    scroll.scrollLeft = keepScroll;
    updateBar();
  }
  const sweepFix = document.createElement('style');
  sweepFix.textContent = '.sweep{animation-name:sweepPx}@keyframes sweepPx{from{left:0;opacity:1}95%{opacity:1}to{left:var(--w);opacity:0}}';
  document.head.appendChild(sweepFix);

  /* ---------------- workspace: arrangement interaction ---------------- */
  // press, then: moved more than 5px = drag (start / move / end), released in place = click. A cancelled pointer (the
  // browser took over to scroll) is never a click.
  function gesture(e, h) {
    const x0 = e.clientX, y0 = e.clientY; let drag = false;
    const mv = ev => { if (!drag && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 5) { drag = true; h.start && h.start(ev); } if (drag && h.move) h.move(ev); };
    const up = ev => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); if (drag) h.end && h.end(ev); else if (ev.type === 'pointerup') h.click && h.click(ev); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  }
  // touch / pen on a section bar: hold 400ms without moving = reorder (h.hold), move first = pan (h.pan), tap = click
  function holdGesture(e, h) {
    const x0 = e.clientX, y0 = e.clientY; let mode = null, last = e;
    const timer = setTimeout(() => { if (mode) return; mode = 'hold'; if (navigator.vibrate) navigator.vibrate(10); h.hold.start(last); }, 400);
    const mv = ev => {
      last = ev;
      if (!mode && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 5) { mode = 'pan'; clearTimeout(timer); h.pan.start(ev); }
      if (mode === 'pan') h.pan.move(ev); else if (mode === 'hold') h.hold.move(ev);
    };
    const up = ev => {
      clearTimeout(timer); removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      if (mode === 'hold') h.hold.end(ev); else if (mode === 'pan') h.pan.end && h.pan.end(ev); else if (ev.type === 'pointerup') h.click(ev);
    };
    addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  }
  // while dragging near the left / right 40px of a scroller, keep scrolling it; onTick re-applies the drag at the new offset
  function edgeScroll(sc, onTick) {
    let x = null, raf = requestAnimationFrame(function loop() {
      raf = requestAnimationFrame(loop);
      if (x === null) return;
      const r = sc.getBoundingClientRect(); let v = 0;
      if (x < r.left + 40) v = -Math.ceil((r.left + 40 - x) / 4); else if (x > r.right - 40) v = Math.ceil((x - r.right + 40) / 4);
      if (!v) return;
      const before = sc.scrollLeft; sc.scrollLeft += v; if (sc.scrollLeft !== before) onTick();
    });
    return { at(cx) { x = cx; }, stop() { cancelAnimationFrame(raf); } };
  }
  // panning the timeline by dragging a section bar
  function panner(e) {
    const sc = $('#arrScroll'), x0 = e.clientX, sl0 = sc.scrollLeft;
    return { start() { dragging = true; }, move(ev) { sc.scrollLeft = sl0 - (ev.clientX - x0); }, end() { dragging = false; } };
  }
  let dragging = false;
  /* Playhead handle (Figma 27, 31): only the handle drags, the line itself ignores the pointer. o.beatAt(clientX) maps
     to a beat, clamped to [o.lo, o.hi] and snapped to 1/4 beat; the time floats beside the handle. Playback pauses while
     dragging and resumes from the new spot. */
  const PH_TAG = '<svg viewBox="0 0 14 18" aria-hidden="true"><path d="M3 0h8a3 3 0 0 1 3 3v8.7a2 2 0 0 1-.7 1.5l-5 4.3a2 2 0 0 1-2.6 0l-5-4.3A2 2 0 0 1 0 11.7V3a3 3 0 0 1 3-3Z" fill="currentColor"/></svg>';
  function dragPlayhead(e, o) {
    e.preventDefault();
    const was = !!player; stopPlay(); dragging = true;
    const tip = document.createElement('div'); tip.className = 'tip fixed'; document.body.appendChild(tip);
    const grab = o.beatAt(e.clientX) - playhead;
    let last = e;
    const edge = edgeScroll(o.sc, () => move(last));
    function move(ev) {
      last = ev; edge.at(ev.clientX);
      playhead = clamp(Math.round((o.beatAt(ev.clientX) - grab) * 4) / 4, o.lo, o.hi); movePlayhead(o.follow);
      tip.textContent = fmt(playhead * 60 / song.bpm);
      const r = o.tag().getBoundingClientRect(); tip.style.left = r.right + 6 + 'px'; tip.style.top = r.top + r.height / 2 - 12 + 'px';
    }
    function up() {
      edge.stop(); tip.remove(); dragging = false;
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      if (was) startPlay();
    }
    move(e);
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  }
  function makeGhost(el, e) {
    const r = el.getBoundingClientRect(), g = el.cloneNode(true);
    g.classList.add('ghost'); g.classList.remove('selected'); g.style.left = r.left + 'px'; g.style.top = r.top + 'px'; g.style.width = r.width + 'px'; g.style.height = r.height + 'px';
    document.body.appendChild(g);
    return { el: g, dx: e.clientX - r.left, dy: e.clientY - r.top, place(ev) { g.style.left = ev.clientX - this.dx + 'px'; g.style.top = ev.clientY - this.dy - 6 + 'px'; } };
  }
  /* Hover insert (Figma 28, desktop only): near the boundary between two sections a blue "+" appears above the card
     with a line through the timeline; clicking either opens the add-section dialog for that spot. The pin lives
     outside the card (the card clips), positioned from getBoundingClientRect and updated on scroll. */
  const fineHover = matchMedia('(hover: hover) and (pointer: fine)');
  let insAt = -1, insHideT = 0;
  function showInsert(i) {
    clearTimeout(insHideT);
    const tl = $('#arrTl'), x = starts().a[i] * L.bw;
    if (insAt !== i || !tl.querySelector('.ins-line')) {
      tl.querySelectorAll('.ins-line, .ins-hit').forEach(el => el.remove());
      const line = document.createElement('div'); line.className = 'ins-line'; line.style.left = x - 1 + 'px';
      const hit = document.createElement('div'); hit.className = 'ins-hit'; hit.style.left = x - 10 + 'px';
      tl.append(line, hit);
    }
    insAt = i; placeInsert();
  }
  function placeInsert() {
    if (insAt < 0) return;
    const pin = $('#insPin'), line = $('#arrTl .ins-line'); if (!line) return hideInsert();
    const cx = line.getBoundingClientRect().left + 1, sr = $('#arrScroll').getBoundingClientRect();
    pin.hidden = cx < sr.left || cx > sr.right; if (pin.hidden) return;
    pin.style.left = cx - 13 + 'px'; pin.style.top = $('#arr').getBoundingClientRect().top - 34 + 'px';
  }
  function hideInsert() { clearTimeout(insHideT); insAt = -1; $('#insPin').hidden = true; document.querySelectorAll('#arrTl .ins-line, #arrTl .ins-hit').forEach(el => el.remove()); }
  const hideInsertSoon = () => { clearTimeout(insHideT); insHideT = setTimeout(hideInsert, 150); };
  $('#arrTl').addEventListener('pointermove', e => {
    if (!fineHover.matches || dragging || e.buttons || !$('#addModal').hidden) { if (insAt >= 0) hideInsert(); return; }
    const x = e.clientX - $('#arrTl').getBoundingClientRect().left, { a: st } = starts();
    let at = -1; for (let i = 1; i < st.length; i++) if (Math.abs(x - st[i] * L.bw) <= 10) at = i;
    if (at >= 0) showInsert(at); else if (insAt >= 0) hideInsertSoon();
  });
  $('#arr').addEventListener('pointerleave', hideInsertSoon);
  $('#insPin').addEventListener('pointerenter', () => clearTimeout(insHideT));
  $('#insPin').addEventListener('pointerleave', hideInsertSoon);
  $('#insPin').addEventListener('click', () => { const i = insAt; if (i > 0) openAdd({ insertAt: i }); });
  addEventListener('scroll', placeInsert, true);

  $('#arrTl').addEventListener('pointerdown', e => {
    if (e.button) return;
    if (e.target.closest('.ins-hit')) { const i = insAt; return openAdd({ insertAt: i }); }
    if (e.target.closest('.ph-tag')) return dragPlayhead(e, { sc: $('#arrScroll'), beatAt: x => (x - $('#arrTl').getBoundingClientRect().left) / L.bw * 4, lo: 0, hi: starts().total * 4, tag: () => $('#arrTag') });
    const chord = e.target.closest('.chord'), sec = e.target.closest('.sec'), clip = e.target.closest('.clip');
    if (e.target.closest('.add-sec')) return;
    if (chord) {
      let ghost, target = null;
      return gesture(e, {
        start: ev => { dragging = true; ghost = makeGhost(chord, ev); chord.classList.add('origin'); },
        move: ev => { ghost.place(ev); const under = document.elementFromPoint(ev.clientX, ev.clientY), c = under && under.closest('.chord'); if (target) target.classList.remove('target'); target = c && c !== chord ? c : null; if (target) target.classList.add('target'); },
        end: () => {
          dragging = false; ghost.el.remove(); chord.classList.remove('origin');

          if (!target) return renderArr();
          const a = findSec(chord.dataset.sec), b = findSec(target.dataset.sec), ia = +chord.dataset.bar, ib = +target.dataset.bar;
          commit(() => { const tmp = a.chords[ia]; a.chords[ia] = b.chords[ib]; b.chords[ib] = tmp; });
          select({ type: 'chord', sec: b.id, bar: ib });
        },
        click: () => { select({ type: 'chord', sec: chord.dataset.sec, bar: +chord.dataset.bar }); previewChord(findSec(chord.dataset.sec).chords[+chord.dataset.bar]); },
      });
    }
    if (sec) {
      // reorder: drag the grip with a mouse, or long-press with touch; the rest of the bar pans the timeline
      let ghost, mark, to = -1, edge, last;
      const from = song.sections.findIndex(s => s.id === sec.dataset.sec), sc = $('#arrScroll');
      const place = ev => {
        last = ev; ghost.place(ev); edge.at(ev.clientX);
        const x = ev.clientX - $('#arrTl').getBoundingClientRect().left, { a: st, total } = starts();
        to = 0; song.sections.forEach((s, i) => { if (x > (st[i] + s.bars / 2) * L.bw) to = i + 1; });
        mark.style.left = (to < song.sections.length ? st[to] : total) * L.bw - 1 + 'px';
      };
      const reorder = {
        start: ev => { dragging = true; ghost = makeGhost(sec, ev); sec.style.opacity = .35; mark = document.createElement('div'); mark.className = 'insert-mark'; $('#arrTl').appendChild(mark); edge = edgeScroll(sc, () => place(last)); place(ev); },
        move: place,
        end: () => {
          dragging = false; edge.stop(); ghost.el.remove(); mark.remove(); sec.style.opacity = '';
          let j = to > from ? to - 1 : to;
          if (to < 0 || j === from) return renderArr();
          commit(() => { const [s] = song.sections.splice(from, 1); song.sections.splice(j, 0, s); });
        },
      };
      const click = () => select({ type: 'section', sec: sec.dataset.sec });
      if (e.pointerType !== 'mouse') return holdGesture(e, { hold: reorder, pan: panner(e), click });
      return gesture(e, e.target.closest('.grip') ? { ...reorder, click } : { ...panner(e), click });
    }
    if (clip) return gesture(e, { click: () => select({ type: clip.dataset.kind, sec: clip.dataset.sec }) });
    gesture(e, { click: ev => { const x = ev.clientX - $('#arrTl').getBoundingClientRect().left; seek(clamp(Math.round(x / L.bw * 4), 0, starts().total * 4)); select(null); } });
  });
  function select(s) { sel = s; renderArr(); renderEditor(); }
  // Shift + wheel scrolls the timeline sideways (trackpad sideways swipes stay native)
  $('#arrScroll').addEventListener('wheel', e => { if (e.shiftKey && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); $('#arrScroll').scrollLeft += e.deltaY; } }, { passive: false });
  $('#arrScroll').addEventListener('scroll', () => updateBar());
  /* custom scrollbar under the timeline column (Figma 27): drag the thumb, click the track to jump a page */
  function updateBar() {
    const sc = $('#arrScroll'), bar = $('#arrBar'), need = sc.scrollWidth > sc.clientWidth + 1;
    bar.hidden = !need; if (!need) return;
    const tw = bar.querySelector('.track').clientWidth, w = Math.max(24, tw * sc.clientWidth / sc.scrollWidth), th = bar.querySelector('.thumb');
    th.style.width = w + 'px'; th.style.left = (tw - w) * sc.scrollLeft / (sc.scrollWidth - sc.clientWidth) + 'px';
  }
  $('#arrBar').addEventListener('pointerdown', e => {
    if (e.button) return;
    const sc = $('#arrScroll'), th = e.target.closest('.thumb'), tw = $('#arrBar .track').clientWidth;
    e.preventDefault();
    if (!th) { const r = $('#arrBar .thumb').getBoundingClientRect(); sc.scrollLeft += (e.clientX < r.left ? -1 : 1) * sc.clientWidth * .9; return; }
    const x0 = e.clientX, sl0 = sc.scrollLeft, k = (sc.scrollWidth - sc.clientWidth) / Math.max(1, tw - th.offsetWidth);
    th.classList.add('active');
    const mv = ev => { sc.scrollLeft = sl0 + (ev.clientX - x0) * k; };
    const up = () => { th.classList.remove('active'); removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  });

  /* ---------------- editor ---------------- */
  let pr = null; // piano-roll state
  function renderEditor() {
    const ed = $('#editor'), hint = $('#editorHint');
    const s = sel && findSec(sel.sec);
    if (!s) { ed.hidden = true; hint.hidden = false; pr = null; return; }
    hint.hidden = true; ed.hidden = false;
    let type = sel.type;
    if (type === 'section') type = s.melody ? 'melody' : s.hits.length ? 'hits' : s.chords ? 'chord' : null;
    const body = $('#edBody'); body.innerHTML = ''; pr = null;
    const instChip = $('#edInst'); instChip.hidden = true;
    if (type === 'melody') {
      $('#edDot').style.background = `var(${instColor(s.melody.inst)})`;
      $('#edTitle').textContent = '旋律 · ' + s.name;
      instChip.hidden = false; instChip.querySelector('span').textContent = Arrange.instLabel(s.melody.inst);
      buildPianoRoll(body, s);
    } else if (type === 'hits') {
      $('#edDot').style.background = 'var(--hits)'; $('#edTitle').textContent = '节奏 · ' + s.name;
      buildHitGrid(body, s);
    } else if (type === 'chord') {
      const bar = sel.type === 'chord' ? sel.bar : 0;
      $('#edDot').style.background = 'var(--chords)'; $('#edTitle').textContent = `和弦 · ${s.name} 第 ${bar + 1} 小节`;
      buildChordPicker(body, s, bar);
    } else { $('#edDot').style.background = 'var(--muted)'; $('#edTitle').textContent = s.name; }
    $('#edDel').hidden = type === 'chord' && sel.type === 'chord';
  }
  $('#edClose').addEventListener('click', () => select(null));
  $('#edCopy').addEventListener('click', () => {
    const s = findSec(sel.sec); if (!s) return;
    const copy = { ...Arrange.clone(s), id: Arrange.uid(), role: s.role === 'rec' ? 'copy' : s.role };
    commit(() => { song.sections.splice(song.sections.indexOf(s) + 1, 0, copy); });
    select({ ...sel, sec: copy.id });
  });
  $('#edDel').addEventListener('click', () => {
    const s = findSec(sel.sec); if (!s) return;
    if (sel.type === 'section') { if (song.sections.length <= 1) return toast('至少要保留一个段落。'); commit(() => song.sections.splice(song.sections.indexOf(s), 1)); return select(null); }
    if (sel.type === 'melody') commit(() => { s.melody = null; });
    if (sel.type === 'hits') commit(() => { s.hits = []; });
    select(null);
  });
  $('#edInst').addEventListener('click', e => { const s = findSec(sel.sec); openMenu(e.currentTarget, m => {
    for (const [id, lab] of Arrange.MELODY_INSTS) item(m, (id === s.melody.inst ? icon('check') : '<span style="width:16px"></span>') + lab, () => { closeMenu(); commit(() => { s.melody.inst = id; }); });
  }, 'left'); });

  /* Piano roll (Figma 31): a ruler with bar numbers on top, keys on the left, the note grid scrolling sideways. The
     playhead line and its handle are DOM elements inside the scrolled content; the handle sets the global playhead
     (section start + beat in section) and stays within this section. */
  const PR_RULER = 26;
  function buildPianoRoll(body, s) {
    body.innerHTML = `<div class="pr"><div class="pr-corner"></div><canvas class="pr-keys"></canvas><div class="pr-scroll"><div class="pr-inner"><canvas class="pr-ruler"></canvas><canvas class="pr-grid"></canvas><div class="pr-ph"></div><div class="ph-tag pr-tag">${PH_TAG}</div></div></div></div>`;
    const wrap = body.querySelector('.pr'), keys = wrap.querySelector('.pr-keys'), scroll = wrap.querySelector('.pr-scroll'), cv = wrap.querySelector('.pr-grid');
    const notes = s.melody.notes, ps = notes.map(n => n.p);
    let lo = (ps.length ? Math.min(...ps) : 60) - 4, hi = (ps.length ? Math.max(...ps) : 72) + 4; while (hi - lo < 16) { lo--; hi++; }
    const beats = s.bars * 4, H = body.clientHeight - PR_RULER, ppb = Math.max(26, scroll.clientWidth / beats), W = beats * ppb, rh = H / (hi - lo + 1);
    const st = starts().a[song.sections.indexOf(s)] * 4;
    pr = { s, st, lo, hi, ppb, rh, W, H, cv, keys, scroll, inner: wrap.querySelector('.pr-inner'), ruler: wrap.querySelector('.pr-ruler'), ph: wrap.querySelector('.pr-ph'), tag: wrap.querySelector('.pr-tag'), beats, selNote: -1, drag: null };
    drawPR(); drawRuler(); placePRHead();
    cv.addEventListener('pointerdown', prDown);
    const beatAt = x => pr.st + (x - pr.inner.getBoundingClientRect().left) / pr.ppb;
    pr.ruler.addEventListener('pointerdown', e => { if (e.button) return; seek(clamp(Math.round(beatAt(e.clientX) * 4) / 4, pr.st, pr.st + pr.beats)); });
    pr.tag.addEventListener('pointerdown', e => { if (e.button) return; dragPlayhead(e, { sc: pr.scroll, beatAt, lo: pr.st, hi: pr.st + pr.beats, tag: () => pr.tag, follow: true }); });
    cv.addEventListener('dblclick', e => {
      const { b, p } = prPos(e); if (prHit(e) >= 0) return;
      const n = { p, s: clamp(Math.floor(b * 4) / 4, 0, pr.beats - 1), d: 1 };
      commit(() => { pr.s.melody.notes.push(n); pr.s.melody.notes.sort((a, c) => a.s - c.s); });
    });
  }
  const prPos = e => { const r = pr.cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; return { x, y, b: x / pr.ppb, p: Math.round(pr.hi - (y - pr.rh / 2) / pr.rh) }; };
  function prHit(e) { const { x, y } = prPos(e); const ns = pr.s.melody.notes; for (let i = ns.length - 1; i >= 0; i--) { const n = ns[i], nx = n.s * pr.ppb, ny = (pr.hi - n.p) * pr.rh; if (x >= nx && x <= nx + n.d * pr.ppb && y >= ny && y <= ny + pr.rh) return i; } return -1; }
  function prDown(e) {
    if (e.button) return;
    const i = prHit(e); pr.selNote = i; drawPR();
    if (i < 0) return;
    const n = pr.s.melody.notes[i], { x } = prPos(e), resize = x > (n.s + n.d) * pr.ppb - 8, orig = { ...n }, snap = snapshot(), p0 = prPos(e);
    let changed = false, lastP = n.p;
    Synth.play(Synth.ctx(), Synth.ctx().input, { inst: pr.s.melody.inst, m: n.p, t: Synth.ctx().c.currentTime + .01, d: .4, v: .7 });
    const tip = document.createElement('div'); tip.className = 'tip';
    gesture(e, {
      start: () => { $('#edBody').appendChild(tip); },
      move: ev => {
        const q = prPos(ev), db = Math.round((q.b - p0.b) * 4) / 4, dp = Math.round((p0.y - q.y) / pr.rh);
        if (resize) n.d = clamp(orig.d + db, .25, pr.beats - n.s);
        else { n.s = clamp(orig.s + db, 0, pr.beats - n.d); n.p = clamp(orig.p + dp, 24, 108); }
        changed = n.s !== orig.s || n.p !== orig.p || n.d !== orig.d;
        if (n.p !== lastP) { lastP = n.p; Synth.play(Synth.ctx(), Synth.ctx().input, { inst: pr.s.melody.inst, m: n.p, t: Synth.ctx().c.currentTime + .01, d: .3, v: .6 }); }
        tip.textContent = resize ? (n.d + ' 拍') : (n.p === orig.p ? Theory.noteName(n.p) : Theory.noteName(orig.p) + ' → ' + Theory.noteName(n.p));
        const ny = (pr.hi - n.p) * pr.rh, bodyR = $('#edBody').getBoundingClientRect(), cvR = pr.cv.getBoundingClientRect();
        tip.style.left = cvR.left - bodyR.left + n.s * pr.ppb + 'px'; tip.style.top = Math.max(2, cvR.top - bodyR.top + ny - 30) + 'px';
        drawPR(); // the arrangement preview refreshes on pointerup via afterChange()
      },
      end: () => {
        tip.remove();
        if (changed) { pr.s.melody.notes.sort((a, c) => a.s - c.s); pr.selNote = pr.s.melody.notes.indexOf(n); pushHistory(snap); afterChange(); }
      },
    });
  }
  function drawPR() {
    if (!pr) return;
    const { s, lo, hi, ppb, rh, W, H, cv, keys, beats } = pr, g = setup(cv, W, H), color = css(instColor(s.melody.inst));
    g.fillStyle = css('--surface'); g.fillRect(0, 0, W, H);
    for (let m = lo; m <= hi; m++) if ([1, 3, 6, 8, 10].includes(Theory.mod12(m))) { g.fillStyle = css('--sunken'); g.fillRect(0, (hi - m) * rh, W, rh); }
    g.fillStyle = css('--line');
    for (let b = 1; b < beats; b++) { g.globalAlpha = b % 4 ? .45 : 1; g.fillRect(Math.round(b * ppb), 0, 1, H); } g.globalAlpha = 1;
    g.font = '500 10px ' + css('--font-num'); g.textBaseline = 'middle';
    s.melody.notes.forEach((n, i) => {
      const x = n.s * ppb + 1, y = (hi - n.p) * rh + 2, w = Math.max(4, n.d * ppb - 3), h = rh - 4;
      g.fillStyle = color; rr(g, x, y, w, h, 5); g.fill();
      if (i === pr.selNote) { g.strokeStyle = css('--ink'); g.lineWidth = 2; rr(g, x - 1, y - 1, w + 2, h + 2, 6); g.stroke(); g.fillStyle = css('--on-accent'); g.globalAlpha = .9; rr(g, x + w - 6, y + 4, 3, h - 8, 1.5); g.fill(); g.globalAlpha = 1; }
      if (w > 26 && h >= 12) { g.fillStyle = css('--on-accent'); g.fillText(Theory.noteName(n.p), x + 7, y + h / 2 + .5); }
    });
    const k = setup(keys, 46, H);
    k.fillStyle = css('--surface'); k.fillRect(0, 0, 46, H); k.font = '500 10px ' + css('--font-num'); k.textBaseline = 'middle';
    for (let m = lo; m <= hi; m++) { if ([1, 3, 6, 8, 10].includes(Theory.mod12(m))) { k.fillStyle = css('--ink'); k.globalAlpha = .85; rr(k, -4, (hi - m) * rh + 1, 32, rh - 2, 3); k.fill(); k.globalAlpha = 1; } else if (Theory.mod12(m) === 0) { k.fillStyle = css('--muted'); k.fillText(Theory.noteName(m), 6, (hi - m) * rh + rh / 2); } }
    k.fillStyle = css('--line'); k.fillRect(45, 0, 1, H);
  }
  function drawRuler() {
    const { ruler, W, ppb, s } = pr, g = setup(ruler, W, PR_RULER);
    g.fillStyle = css('--sunken'); g.fillRect(0, 0, W, PR_RULER);
    g.fillStyle = css('--line'); g.fillRect(0, PR_RULER - 1, W, 1);
    g.fillStyle = css('--muted'); g.font = '500 11px ' + css('--font-num'); g.textBaseline = 'middle';
    for (let b = 0; b < s.bars; b++) g.fillText(String(b + 1), b * 4 * ppb + 8, PR_RULER / 2);
  }
  // shown only while the playhead is inside this section; while playing, the roll scrolls to keep it in view
  function placePRHead() {
    if (!pr) return;
    const rel = playhead - pr.st, on = rel >= 0 && rel <= pr.beats, x = rel * pr.ppb;
    pr.ph.hidden = pr.tag.hidden = !on; if (!on) return;
    pr.ph.style.left = x - 1 + 'px'; pr.tag.style.left = x - 7 + 'px';
    const sc = pr.scroll;
    if (player && (x > sc.scrollLeft + sc.clientWidth - 30 || x < sc.scrollLeft)) sc.scrollLeft = Math.max(0, x - 30);
  }
  function buildHitGrid(body, s) {
    const wrap = document.createElement('div'); wrap.className = 'grid-ed';
    for (const [k, lab] of [['clap', '军鼓'], ['snap', '踩镲']]) {
      const row = document.createElement('div'); row.className = 'grid-row'; row.innerHTML = `<span>${lab}</span>`;
      const cells = document.createElement('div'); cells.className = 'cells';
      for (let b = 0; b < s.bars; b++) {
        const bar = document.createElement('div'); bar.className = 'bar';
        for (let i = 0; i < 16; i++) {
          const t = b * 4 + i / 4, on = s.hits.some(h => h.k === k && Math.abs(h.t - t) < .01);
          const c = document.createElement('button'); c.className = 'cell' + (on ? ' on' : '') + (Math.floor(i / 4) % 2 ? ' beat2' : '');
          c.setAttribute('aria-label', `${lab} 第 ${b + 1} 小节 第 ${i + 1} 格`);
          c.addEventListener('click', () => {
            commit(() => { const j = s.hits.findIndex(h => h.k === k && Math.abs(h.t - t) < .01); if (j >= 0) s.hits.splice(j, 1); else { s.hits.push({ t, k }); s.hits.sort((a, c2) => a.t - c2.t); } });
            if (!s.hits.some(h => h.k === k && Math.abs(h.t - t) < .01)) return;
            const S = Synth.ctx(); Synth.play(S, S.input, { drum: k === 'clap' ? 'snare' : 'hat', t: S.c.currentTime + .01, v: .8 });
          });
          bar.appendChild(c);
        }
        cells.appendChild(bar);
      }
      row.appendChild(cells); wrap.appendChild(row);
    }
    body.appendChild(wrap);
  }
  function previewChord(name) { const S = Synth.ctx(), t = S.c.currentTime + .01; for (const m of Theory.voicing(name)) Synth.play(S, S.input, { inst: 'piano', m, t, d: .9, v: .5 }); }
  function buildChordPicker(body, s, bar) {
    const wrap = document.createElement('div'); wrap.className = 'chords-ed';
    const cur = s.chords[bar];
    const row1 = document.createElement('div'); row1.className = 'row';
    for (const c of Theory.diatonic(song.key)) { const b = document.createElement('button'); b.className = 'cbtn' + (c.name === cur ? ' on' : ''); b.innerHTML = `${c.name}<small>${c.roman}</small>`; b.addEventListener('click', () => setChord(s, bar, c.name)); row1.appendChild(b); }
    const row2 = document.createElement('div'); row2.className = 'row';
    for (const name of Theory.extras(song.key)) { const b = document.createElement('button'); b.className = 'cbtn sm' + (name === cur ? ' on' : ''); b.textContent = name; b.addEventListener('click', () => setChord(s, bar, name)); row2.appendChild(b); }
    wrap.append(row1, row2); body.appendChild(wrap);
  }
  function setChord(s, bar, name) { previewChord(name); if (s.chords[bar] === name) return; commit(() => { s.chords[bar] = name; }); }

  /* ---------------- playback ---------------- */
  let player = null;
  function setPlayIcon() { $('#playBtn').innerHTML = icon(player ? 'pause' : 'play'); $('#playBtn').setAttribute('aria-label', player ? '暂停' : '播放'); }
  function updateTime() { if (!song) return; const spb = 60 / song.bpm; $('#time').textContent = fmt(playhead * spb) + ' / ' + fmt(starts().total * 4 * spb); }
  function startPlay() {
    if (!song) return;
    const S = Synth.ctx(), c = S.c, comp = Arrange.compile(song), spb = 60 / song.bpm;
    if (playhead >= comp.bars * 4 - .01) playhead = 0;
    Synth.setTone(comp.tone);
    const bus = c.createGain(); bus.connect(S.input);
    const t0 = c.currentTime + .08 - playhead * spb;
    player = { S, bus, t0, spb, events: comp.events, end: comp.duration, idx: comp.events.findIndex(e => e.b >= playhead - 1e-6) };
    if (player.idx < 0) player.idx = comp.events.length;
    player.timer = setInterval(pump, 25); pump();
    player.raf = requestAnimationFrame(frame);
    setPlayIcon();
  }
  function pump() {
    const P = player; if (!P) return;
    const until = P.S.c.currentTime + .2;
    while (P.idx < P.events.length && P.t0 + P.events[P.idx].t < until) { const e = P.events[P.idx++]; Synth.play(P.S, P.bus, { ...e, t: Math.max(P.S.c.currentTime, P.t0 + e.t) }); }
  }
  function frame() {
    const P = player; if (!P) return;
    const pos = (P.S.c.currentTime - P.t0) / P.spb;
    if (P.S.c.currentTime - P.t0 > P.end + .4) { stopPlay(); playhead = 0; movePlayhead(); return; }
    playhead = Math.max(0, pos); movePlayhead();
    const sc = $('#arrScroll'), x = playhead * L.bw / 4;
    if (x > sc.scrollLeft + sc.clientWidth - 60 || x < sc.scrollLeft) sc.scrollLeft = Math.max(0, x - 60);
    P.raf = requestAnimationFrame(frame);
  }
  // follow: also scroll the arrangement so the playhead stays visible (when it is moved from the piano roll)
  function movePlayhead(follow) {
    const x = playhead * L.bw / 4, ph = $('#arrPlayhead'), tag = $('#arrTag');
    if (ph) ph.style.left = x + 'px'; if (tag) tag.style.left = x - 7 + 'px';
    if (follow) { const sc = $('#arrScroll'); if (x < sc.scrollLeft + 20 || x > sc.scrollLeft + sc.clientWidth - 20) sc.scrollLeft = x - sc.clientWidth / 2; }
    placePRHead(); updateTime();
  }


  function stopPlay() {
    const P = player; if (!P) return; player = null;
    clearInterval(P.timer); cancelAnimationFrame(P.raf);
    P.bus.gain.setTargetAtTime(0, P.S.c.currentTime, .03); setTimeout(() => P.bus.disconnect(), 400);
    setPlayIcon();
  }
  function refreshPlayer() {
    const P = player; if (!P) return;
    const comp = Arrange.compile(song), now = (P.S.c.currentTime - P.t0) / P.spb + .2 / P.spb;
    P.events = comp.events; P.end = comp.duration; P.idx = comp.events.findIndex(e => e.b > now); if (P.idx < 0) P.idx = comp.events.length;
    Synth.setTone(comp.tone);
  }
  function seek(beat) { const was = !!player; stopPlay(); playhead = beat; movePlayhead(); if (was) startPlay(); }
  $('#playBtn').addEventListener('click', () => player ? stopPlay() : startPlay());

  /* ---------------- toolbar ---------------- */
  let arranging = false;
  $('#arrangeBtn').addEventListener('click', () => {
    if (arranging || song.arranged) return;
    preArrange = snapshot();
    arranging = true;
    const btn = $('#arrangeBtn'); btn.classList.add('working'); btn.innerHTML = '<span class="spin"></span><span>编曲中</span>';
    commit(() => Arrange.arrange(song), 'arrange');
    setTimeout(() => { arranging = false; btn.classList.remove('working'); btn.innerHTML = icon('sparkle') + '<span>编曲</span>'; renderWork(); }, 1700);
  });
  $('#styleChip').addEventListener('click', e => openMenu(e.currentTarget, m => {
    for (const id of Arrange.STYLE_ORDER) item(m, (id === song.style ? icon('check') : '<span style="width:16px"></span>') + Arrange.STYLES[id].label, () => { closeMenu(); song.style = id; renderWork(); });
  }));
  // key menu (Figma 30): first the detected key + "（自动）", then all 24 keys. Changing key re-harmonises an arranged song.
  const sameKey = (a, b) => a.tonic === b.tonic && a.mode === b.mode;
  $('#keyChip').addEventListener('click', e => openMenu(e.currentTarget, m => {
    const auto = song.autoKey || Theory.detectKey(song.sections.flatMap(s => s.melody ? s.melody.notes : [])); // older songs have no autoKey
    const setKey = k => { closeMenu(); if (sameKey(song.key, k)) return; commit(() => { song.key = { ...k }; if (song.arranged) Arrange.reharmonize(song); }); };
    const isAuto = sameKey(song.key, auto);
    item(m, Theory.keyLabel(auto) + '（自动）', () => setKey(auto), { cls: 'auto' + (isAuto ? ' on' : '') });
    m.appendChild(document.createElement('hr'));
    const g = document.createElement('div'); g.className = 'grid24'; m.appendChild(g);
    for (const mode of ['major', 'minor']) for (let t = 0; t < 12; t++) {
      const k = { tonic: t, mode };
      item(g, Theory.keyLabel(k), () => setKey(k), { cls: !isAuto && sameKey(song.key, k) ? 'on' : '' });
    }
  }, 'left'));
  $('#tempoChip').addEventListener('click', e => openMenu(e.currentTarget, m => {
    let pushed = false;
    const st = document.createElement('div'); st.className = 'stepper'; st.innerHTML = `<button aria-label="减慢">${icon('minus')}</button><output class="num">${song.bpm}</output><button aria-label="加快">${icon('plus')}</button>`;
    const change = d => { if (!pushed) { pushHistory(snapshot()); pushed = true; } song.bpm = clamp(song.bpm + d, 40, 240); st.querySelector('output').textContent = song.bpm; afterChange(); };
    st.children[0].addEventListener('click', () => change(-5)); st.children[2].addEventListener('click', () => change(5));
    m.appendChild(st);
  }, 'left'));

  /* ---------------- header menus ---------------- */
  $('#reBtn').addEventListener('click', e => openMenu(e.currentTarget, m => {
    let armed = false;
    item(m, icon('mic') + '<span>从头开始</span>', (ev, b) => {
      if (!armed) { armed = true; b.classList.add('danger'); b.querySelector('span').textContent = '确认从头开始'; return; }
      closeMenu(); stopPlay(); song = null; sel = null; hist.undo = []; hist.redo = []; takes.clear(); show('home');
    });
    if (song.arranged && preArrange) item(m, icon('x') + '取消编曲', () => { closeMenu(); const pre = preArrange; preArrange = null; commit(() => { song = JSON.parse(pre); }); });
    m.appendChild(document.createElement('hr'));
    item(m, icon('undo') + '撤回<span class="kbd">Ctrl Z</span>', () => { closeMenu(); undo(); }, { disabled: !hist.undo.length });
  }));
  $('#dlBtn').addEventListener('click', e => openMenu(e.currentTarget, m => {
    item(m, icon('download') + 'MIDI', () => { closeMenu(); save(Arrange.toMidi(song), '哼唱成曲.mid'); });
    item(m, icon('download') + 'WAV', () => { closeMenu(); downloadMix(); });
    item(m, icon('download') + '原声', () => { closeMenu(); downloadVoice(); });
  }));
  async function downloadMix() {
    toast('正在生成 WAV…');
    const comp = Arrange.compile(song), buf = await Synth.render(comp.events, comp.duration, { lowpass: comp.tone });
    save(Synth.wav(buf), '哼唱成曲.wav'); $('#toast').hidden = true;
  }
  function downloadVoice() {
    const ids = [...new Set(song.sections.map(s => s.take).filter(Boolean))].filter(id => takes.has(id));
    if (!ids.length) return toast('没有找到原始录音。');
    const bufs = ids.map(id => takes.get(id)), sr = bufs[0].sampleRate, gap = Math.round(sr * .5);
    const len = bufs.reduce((n, b) => n + b.length, 0) + gap * (bufs.length - 1);
    const out = new AudioBuffer({ length: len, sampleRate: sr, numberOfChannels: 1 }), d = out.getChannelData(0);
    let o = 0; for (const b of bufs) { d.set(b.getChannelData(0), o); o += b.length + gap; }
    save(Synth.wav(out), '哼唱原声.wav');
  }
  // Suno
  $('#sunoBtn').addEventListener('click', () => { $('#sunoPrompt').textContent = Arrange.sunoPrompt(song); $('#sunoModal').hidden = false; });
  $('#sunoClose').addEventListener('click', () => $('#sunoModal').hidden = true);
  $('#sunoSrc').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $('#sunoSrc').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); });
  $('#sunoDl').addEventListener('click', () => { $('#sunoSrc [aria-pressed="true"]').dataset.v === 'voice' ? downloadVoice() : downloadMix(); });
  $('#sunoCopy').addEventListener('click', async () => {
    const t = $('#sunoPrompt').textContent;
    try { await navigator.clipboard.writeText(t); toast('已复制'); } catch (e) { const r = document.createRange(); r.selectNodeContents($('#sunoPrompt')); getSelection().removeAllRanges(); getSelection().addRange(r); }
  });

  /* ---------------- add section ---------------- */
  const ADD_NAMES = ['主歌', '副歌', '桥段', '尾声'];
  let addState = null;
  function segInit(el, items, val, onPick) {
    el.innerHTML = '';
    for (const [v, lab] of items) { const b = document.createElement('button'); b.textContent = lab; b.setAttribute('aria-pressed', v === val); b.addEventListener('click', () => { el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); onPick(v); }); el.appendChild(b); }
  }
  /* opts.insertAt: section index to insert before (from the hover "+" between sections); default is before the outro. */
  function openAdd(opts = {}) {
    stopPlay(); hideInsert();

    addState = { name: song.sections.some(s => s.name === '主歌') ? '副歌' : '主歌', inst: 'piano', backing: true, metronome: true, bpm: song.bpm, insertAt: opts.insertAt ?? null, rec: null, res: null };
    segInit($('#addName'), ADD_NAMES.map(n => [n, n]), addState.name, v => addState.name = v);
    segInit($('#addInst'), Arrange.MELODY_INSTS, addState.inst, v => addState.inst = v);
    $('#addBacking').setAttribute('aria-checked', 'true');
    $('#addOk').disabled = true; $('#addNote').textContent = ''; $('#addNote').className = 'note'; $('#addBeats').hidden = true; $('#addTimerWrap').hidden = true;
    $('#addRec').innerHTML = icon('mic'); $('#addRec').setAttribute('aria-label', '开始录音');
    syncAddBeat();
    $('#addModal').hidden = false;
    setup($('#addCv'), $('#addArea').clientWidth || 600, $('#addArea').clientHeight || 200);
  }
  // 节拍 row: metronome on/off and the recording tempo (only for this take; song.bpm is not changed)
  function syncAddBeat() {
    const A = addState; if (!A) return;
    $('#addMetro').setAttribute('aria-pressed', A.metronome);
    $('#addBpmRow').hidden = !A.metronome; $('#addBpmOut').textContent = A.bpm;
    $('#addBackingWrap').hidden = !A.metronome || !song.arranged;
  }
  $('#addMetro').addEventListener('click', () => { if (!addState || addState.rec) return; addState.metronome = !addState.metronome; syncAddBeat(); });
  $('#addBpmDown').addEventListener('click', () => { if (!addState || addState.rec) return; addState.bpm = clamp(addState.bpm - 5, 40, 240); syncAddBeat(); });
  $('#addBpmUp').addEventListener('click', () => { if (!addState || addState.rec) return; addState.bpm = clamp(addState.bpm + 5, 40, 240); syncAddBeat(); });
  $('#addBacking').addEventListener('click', e => { const on = e.currentTarget.getAttribute('aria-checked') !== 'true'; e.currentTarget.setAttribute('aria-checked', on); addState.backing = on; });
  async function startAddRec() {
    const A = addState; if (!A || A.rec) return;
    let backing = null;
    if (A.metronome && A.backing && song.arranged) {
      const base = song.sections.find(s => s.role === 'rec' && s.chords) || song.sections.find(s => s.chords);
      if (base) { const c = Arrange.compile({ ...song, bpm: A.bpm, sections: [{ ...base, melody: null, hits: [] }], mute: {} }); backing = { events: c.events.filter(e => e.lane !== 'drums' || e.drum === 'kick'), loop: c.duration }; }
    }
    const note = $('#addNote'); note.textContent = A.metronome ? '' : '3'; note.className = 'note' + (A.metronome ? '' : ' count');
    $('#addBeats').querySelectorAll('i').forEach(d => d.classList.remove('on'));
    $('#addOk').disabled = true; A.res = null;
    $('#addTimerWrap').hidden = false;
    $('#addRec').innerHTML = icon('stop'); $('#addRec').setAttribute('aria-label', '停止');
    A.rec = await startCapture({ canvas: $('#addCv'), noteEl: note, beatEl: $('#addBeats'), timerEl: $('#addTimer'), metronome: A.metronome, bpm: A.bpm, backing, compact: true, color: instColor(A.inst) });
    if (!A.rec) { $('#addRec').innerHTML = icon('mic'); $('#addTimerWrap').hidden = true; }
  }
  async function stopAddRec() {
    const A = addState; if (!A || !A.rec) return;
    const R = A.rec; A.rec = null;
    $('#addRec').innerHTML = icon('mic'); $('#addRec').setAttribute('aria-label', '重新录');
    const out = await stopCapture(R);
    if (!out) return;
    const res = await analyzeTake(out.buffer, out.info, out.taps);
    if (!res) { toast('没有听出旋律。离麦克风近一点再试。'); return; }
    A.res = res; A.buffer = out.buffer; $('#addOk').disabled = false;
    $('#addNote').classList.remove('count');
    $('#addNote').textContent = ''; $('#addBeats').hidden = true;
  }
  $('#addRec').addEventListener('click', () => addState && (addState.rec ? stopAddRec() : startAddRec()));
  async function closeAdd() { if (addState && addState.rec) { const R = addState.rec; addState.rec = null; await stopCapture(R); } addState = null; $('#addModal').hidden = true; }
  $('#addCancel').addEventListener('click', closeAdd); $('#addClose').addEventListener('click', closeAdd);
  $('#addOk').addEventListener('click', () => {
    const A = addState; if (!A || !A.res) return;
    const take = 't' + Date.now(); takes.set(take, A.buffer);
    const s = { id: Arrange.uid(), name: A.name, role: 'rec', bars: A.res.bars, melody: A.res.notes.length ? { inst: A.inst, notes: A.res.notes } : null, hits: A.res.hits, chords: null, take };
    if (song.arranged) s.chords = Theory.harmonize(s.melody ? s.melody.notes : [], s.bars, song.key);
    commit(() => {
      const out = song.sections.findIndex(x => x.role === 'outro');
      song.sections.splice(A.insertAt !== null ? A.insertAt : out >= 0 ? out : song.sections.length, 0, s);
    });

    closeAdd();
    select({ type: s.melody ? 'melody' : 'hits', sec: s.id });
  });

  /* ---------------- keyboard & resize ---------------- */
  // While a take is recording: Space = snare ('clap'), Alt = hi-hat ('snap'), Enter = stop and analyse, Esc = abandon.
  const DRUM_KEYS = { Space: 'clap', AltLeft: 'snap', AltRight: 'snap' };
  const liveRec = () => screen === 'recording' && mainRec ? mainRec : !$('#addModal').hidden && addState && addState.rec ? addState.rec : null;
  document.addEventListener('keydown', e => {
    const R = liveRec();
    if (R) {
      const quitOpen = !$('#quitModal').hidden;
      // preventDefault also keeps a focused button from being clicked and Alt from focusing the browser menu bar
      if (DRUM_KEYS[e.code] || e.key === 'Enter') e.preventDefault();
      if (e.key === 'Escape') { e.preventDefault(); if (screen === 'recording') quitOpen ? abandonMain() : openQuit(); else closeAdd(); return; }
      if (quitOpen || e.repeat) return;
      if (DRUM_KEYS[e.code]) tap(R, DRUM_KEYS[e.code]);
      else if (e.key === 'Enter') screen === 'recording' ? stopMain() : stopAddRec();
      return;
    }
    if (screen === 'recording') { if (e.key === 'Escape' && !$('#quitModal').hidden) closeQuit(); return; }
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z' && screen === 'work' && $('#addModal').hidden) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && e.key.toLowerCase() === 'y' && screen === 'work') { e.preventDefault(); redo(); return; }
    if (e.key === 'Escape') { closeMenu(); if (!$('#sunoModal').hidden) $('#sunoModal').hidden = true; else if (!$('#addModal').hidden) closeAdd(); else if (sel) select(null); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && pr && pr.selNote >= 0 && !e.target.closest('input')) {
      e.preventDefault(); const i = pr.selNote; commit(() => pr.s.melody.notes.splice(i, 1)); return;
    }
    if (e.code !== 'Space' || e.target.closest('button, input, a')) return;
    e.preventDefault();
    if (!$('#addModal').hidden) return;
    if (screen === 'home') startMain(); else if (screen === 'work') player ? stopPlay() : startPlay();
  });
  document.addEventListener('keyup', e => { if (liveRec() && DRUM_KEYS[e.code]) e.preventDefault(); });
  let rsz = 0; addEventListener('resize', () => { clearTimeout(rsz); rsz = setTimeout(() => { if (screen === 'work') { renderArr(); renderEditor(); } }, 120); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => screen === 'work' && renderWork());

  window.__app = { get song() { return song; }, newSong, analyzeTake, takes, select, renderWork, undo, redo };
})();
