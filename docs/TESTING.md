# 测试与发布

## 本地运行

在仓库根目录运行：

```bash
python -m http.server 8766 --bind 127.0.0.1
```

然后打开 http://127.0.0.1:8766/v2/ 。麦克风只能在 `localhost`、`127.0.0.1` 或 HTTPS 下使用。直接双击打开 `file://` 时页面也能跑，但麦克风是否可用取决于浏览器。

没有构建步骤。改完 JS 后先检查语法：

```bash
for f in v2/js/*.js; do node --check "$f"; done
```

## 调试接口

页面在全局暴露了 `window.__app`：`song`（只读 getter）、`newSong(res, buffer)`、`analyzeTake(buffer, info)`、`takes`、`select(sel)`、`renderWork()`、`undo()`、`redo()`。另外 `window.__lastAnalysis` 保存了最近一次分析的原始结果（拍打声、秒单位的音符、速度、t0）。

## 合成录音（不用麦克风也能测）

`v2/dev/fixture.js` 会生成一段合成录音：100 BPM 哼《小星星》，音准偏高 25 音分，带颤音；第 2、4 拍拍手，第 1、3 拍打响指；再加上噪声。可选参数：`{bpm, lead, claps:false, snaps:false}`。

**把它当成一次录音载入作品页**（在 `/v2/` 页面的控制台运行）：

```js
await import('./dev/fixture.js?' + Date.now());
const F = makeFixture();
const r = await __app.analyzeTake(F.buf, { bpm: 100, beat0: F.lead });  // 模拟开节拍器
__app.newSong(r, F.buf);
```

把第二个参数换成 `null`，就是模拟"不开节拍器"，走速度估计。

**拍打声检测的回归检查**（2026-10-04 的结果：96/96、48/48、48/48）：

```js
await import('./dev/fixture.js?' + Date.now());
const tally = {};
for (const [name, opts] of [['both', {}], ['clapsOnly', { snaps: false }], ['snapsOnly', { claps: false }]]) {
  const t = { ok: 0, wrong: 0, miss: 0 };
  for (let run = 0; run < 6; run++) {
    const F = makeFixture(opts), hits = DSP.detectHits(F.buf.getChannelData(0), 48000);
    for (const tr of F.truth) { const h = hits.find(h => Math.abs(h.t - tr.t) < .05);
      if (!h) t.miss++; else if (h.kind === tr.k || (name === 'snapsOnly' && h.kind === 'clap')) t.ok++; else t.wrong++; }
  }
  tally[name] = t;
}
tally
```

"只有响指"时全部判为拍手，这是**预期行为**：只有一种声音时分不出哪个是响指。

**混音峰值检查**（应 < 1.0，2026-10-04 实测 0.91）：

```js
const c = Arrange.compile(__app.song), b = await Synth.render(c.events, c.duration, {});
let p = 0; for (let ch = 0; ch < 2; ch++) for (const v of b.getChannelData(ch)) p = Math.max(p, Math.abs(v)); p
```

## 需要真人测试的项目

开发用的浏览器面板没有麦克风，以下几项还没验证过：

- [ ] 真实哼唱的识别准确度：用"嗒嗒嗒"和用"嗯——"分别试。
- [ ] 真实拍手和响指的检测率、分类准确度：笔记本内置麦克风、手机、耳机麦克风各试一次。
- [ ] 开节拍器时，扬声器外放和戴耳机两种情况下，录音是否和拍子对齐。
- [ ] 添加段落时开伴奏，伴奏会不会被误识别成拍手或旋律。
- [ ] 手机 Safari：麦克风权限、`ScriptProcessorNode`、`OfflineAudioContext`。
- [ ] 下载：MIDI 能否导入 GarageBand 或 FL Studio；WAV 能否播放。

## 发布

GitHub Pages 从 `main` 分支的根目录发布（仓库 `xihson/hum-to-piano`）。push 后大约 1 分钟生效：

```bash
gh api repos/xihson/hum-to-piano/pages/builds/latest --jq '.status + " " + .commit[0:7]'
```

线上地址：v1 是 https://xihson.github.io/hum-to-piano/ ，v2 是 https://xihson.github.io/hum-to-piano/v2/ 。
