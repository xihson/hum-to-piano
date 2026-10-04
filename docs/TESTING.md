# 测试与发布

## 本地运行

在仓库根目录运行：

```bash
python -m http.server 8766 --bind 127.0.0.1
```

然后打开 http://127.0.0.1:8766/v2/ 。麦克风只能在 `localhost`、`127.0.0.1` 或 HTTPS 下使用。直接双击打开 `file://` 时页面也能跑，但麦克风是否可用取决于浏览器。

没有构建步骤。改完 JS 后先检查语法，并把 `v2/index.html` 里脚本的 `?v=` 版本号改掉（见 ARCHITECTURE“脚本缓存”）：

```bash
for f in v2/js/*.js; do node --check "$f"; done
```

## 调试接口

页面在全局暴露了 `window.__app`：`song`（只读 getter）、`newSong(res, buffer)`、`analyzeTake(buffer, info, taps)`、`takes`、`select(sel)`、`renderWork()`、`undo()`、`redo()`。另外 `window.__lastAnalysis` 保存了最近一次分析的原始结果（按键、秒单位的音符、速度、t0）。

## 合成录音（不用麦克风也能测）

`v2/dev/fixture.js` 会生成一段合成录音：100 BPM 哼《小星星》，音准偏高 25 音分，带颤音；第 2、4 拍混入拍手声，第 1、3 拍混入响指声（麦克风已不识别它们，只当干扰）；再加上噪声。可选参数：`{bpm, lead, claps:false, snaps:false}`。

**把它当成一次录音载入作品页**（在 `/v2/` 页面的控制台运行）：

```js
await import('./dev/fixture.js?' + Date.now());
const F = makeFixture();
const r = await __app.analyzeTake(F.buf, { bpm: 100, beat0: F.lead });  // 模拟开节拍器
__app.newSong(r, F.buf);
```

把第二个参数换成 `null`，就是模拟"不开节拍器"，走速度估计。

**旋律回归**（2026-10-04 的结果：100 / 120 / 80 BPM 下，开不开节拍器都和《小星星》的谱一致，没有鼓点）：

```js
await import('./dev/fixture.js?' + Date.now());
const F = makeFixture({ claps: false, snaps: false });
const r = await __app.analyzeTake(F.buf, { bpm: 100, beat0: F.lead });
r.notes.map(n => n.p + '@' + n.s + ':' + n.d).join(' ')
// 60@0:1 60@1:1 67@2:1 67@3:1 69@4:1 69@5:1 67@6:1.75 65@8:1 … 60@14:1.75，r.hits 为空
```

fixture 默认还会混入拍手和响指的噪声。麦克风已经不识别它们了，所以它们只会偶尔把长音切成两段，这是预期行为。

**人工打击换算**（按键打鼓）：

```js
// 开节拍器：taps 直接给拍子（stopCapture 已减去输出延迟）
const r = await __app.analyzeTake(F.buf, { bpm: 100, beat0: F.lead }, [{ b: 1.02, k: 'clap' }, { b: .49, k: 'snap' }, { b: 2.97, k: 'clap' }]);
r.hits  // [{t:.5,k:'snap'}, {t:1,k:'clap'}, {t:3,k:'clap'}]
// 不开节拍器：taps 给缓冲区里的秒数
const r2 = await __app.analyzeTake(F.buf, null, [{ t: F.lead + .612, k: 'clap' }, { t: F.lead + 1.5, k: 'snap' }]);
r2.hits // [{t:1,k:'clap'}, {t:2.5,k:'snap'}]
```

只有鼓点、没有哼唱时（传一段静音），也应该返回结果；什么都没有时返回 `null`。

**没有麦克风时测录音界面**：把 `getUserMedia` 换成一个振荡器，就能走完预备拍、按键打鼓、Esc 确认、回车停止这些流程（音高恒定的振荡器不会被识别成旋律，结果只有鼓点）：

```js
navigator.mediaDevices.getUserMedia = async () => { const c = Synth.ctx().c, d = c.createMediaStreamDestination(), o = c.createOscillator(); o.frequency.value = 330; o.connect(d); o.start(); return d.stream; };
document.querySelector('#recBtn').click();
// 之后：document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true }))
```

内置浏览器面板不在前台时页面不出帧，CSS 过渡和 `requestAnimationFrame` 会停住，截图可能是旧画面；以 JS 读出的状态为准。

**混音峰值检查**（应 < 1.0，2026-10-04 实测 0.91）：

```js
const c = Arrange.compile(__app.song), b = await Synth.render(c.events, c.duration, {});
let p = 0; for (let ch = 0; ch < 2; ch++) for (const v of b.getChannelData(ch)) p = Math.max(p, Math.abs(v)); p
```

## 需要真人测试的项目

开发用的浏览器面板没有麦克风，以下几项还没验证过：

- [ ] 真实哼唱的识别准确度：用"嗒嗒嗒"和用"嗯——"分别试。
- [ ] 按键打鼓（空格 / Alt）和节拍是否对齐：开节拍器时外放、戴耳机各试一次；不开节拍器时试一次。
- [ ] 开节拍器时，扬声器外放和戴耳机两种情况下，录音是否和拍子对齐。
- [ ] 添加段落时开伴奏，伴奏会不会被误识别成旋律。
- [ ] 手机 Safari：麦克风权限、`ScriptProcessorNode`、`OfflineAudioContext`。
- [ ] 下载：MIDI 能否导入 GarageBand 或 FL Studio；WAV 能否播放。
- [ ] 手机竖屏录完 → “横过来编辑”提示；转横屏后自动消失；开着旋转锁定时 5 秒后出现“尝试关闭旋转锁定。”。
- [ ] 手机横屏布局（M2–M4）：顶栏一行、编排区占满、点段落后编辑器占满、添加段落全屏面板；长按段落 0.4 秒换顺序、直接滑动平移。
- [ ] 手机录音页和添加段落里的军鼓 / 踩镲大按钮：按下即响，没有明显延迟。

## 发布

GitHub Pages 从 `main` 分支的根目录发布（仓库 `xihson/hum-to-piano`）。push 后大约 1 分钟生效：

```bash
gh api repos/xihson/hum-to-piano/pages/builds/latest --jq '.status + " " + .commit[0:7]'
```

线上地址：v1 是 https://xihson.github.io/hum-to-piano/ ，v2 是 https://xihson.github.io/hum-to-piano/v2/ 。
