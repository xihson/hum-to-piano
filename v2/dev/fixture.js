/* Development fixture: a synthetic take (hummed "Twinkle" at 100 BPM, claps on 2 and 4, snaps on 1 and 3).
   Load it in the console with:  await import('./dev/fixture.js')  — then call window.makeFixture(). */
window.makeFixture = (opts = {}) => {
  const sr = 48000, bpm = opts.bpm || 100, spb = 60 / bpm, lead = opts.lead ?? .5;
  const mel = [[60, 0, 1], [60, 1, 1], [67, 2, 1], [67, 3, 1], [69, 4, 1], [69, 5, 1], [67, 6, 2], [65, 8, 1], [65, 9, 1], [64, 10, 1], [64, 11, 1], [62, 12, 1], [62, 13, 1], [60, 14, 2]];
  const N = Math.ceil((lead + 16 * spb + .6) * sr), x = new Float32Array(N);
  let ph = 0;
  for (const [m, s, d] of mel) {
    const f = 440 * 2 ** ((m - 69 + .25) / 12), a = Math.floor((lead + s * spb) * sr), n = Math.floor(d * spb * .88 * sr);
    for (let k = 0; k < n; k++) { const vib = 1 + .005 * Math.sin(2 * Math.PI * 5.5 * k / sr); ph += 2 * Math.PI * f * vib / sr; const env = Math.min(1, k / (.02 * sr)) * Math.min(1, (n - k) / (.03 * sr)); x[a + k] += env * .25 * (Math.sin(ph) + .5 * Math.sin(2 * ph) + .25 * Math.sin(3 * ph)); }
  }
  const burst = (at, hpHz, lpHz, decay, amp, parts) => { for (const off of parts) { const a = Math.floor((at + off) * sr); let lp = 0, prev = 0, hp = 0; const aL = Math.exp(-2 * Math.PI * lpHz / sr), aH = Math.exp(-2 * Math.PI * hpHz / sr);
    for (let k = 0; k < sr * .08 && a + k < N; k++) { const nz = Math.random() * 2 - 1; lp = (1 - aL) * nz + aL * lp; hp = aH * (hp + lp - prev); prev = lp; x[a + k] += amp * hp * Math.exp(-k / (decay * sr)); } } };
  const truth = [];
  for (let b = 0; b < 4; b++) {
    if (opts.claps !== false) for (const be of [1, 3]) { const t = lead + (b * 4 + be) * spb + (Math.random() - .5) * .03; truth.push({ t, k: 'clap' }); burst(t, 900, 3500, .012, 2.2, [0, .008, .016]); }
    if (opts.snaps !== false) for (const be of [0, 2]) { const t = lead + (b * 4 + be) * spb + (Math.random() - .5) * .03; truth.push({ t, k: 'snap' }); burst(t, 3000, 12000, .004, 1.6, [0]); }
  }
  for (let i = 0; i < N; i++) x[i] += (Math.random() * 2 - 1) * .004;
  const buf = new AudioBuffer({ length: N, sampleRate: sr, numberOfChannels: 1 }); buf.copyToChannel(x, 0);
  return { buf, bpm, lead, truth: truth.sort((p, q) => p.t - q.t) };
};
