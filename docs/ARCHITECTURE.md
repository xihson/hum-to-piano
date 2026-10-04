# 架构：v2

纯前端、无构建步骤、无依赖。五个普通 `<script>`（不是 ES module，所以用 `file://` 直接打开也能跑），按顺序加载，各自往全局挂一个对象：

```
theory.js  → Theory   乐理（不依赖其他模块）
dsp.js     → DSP      信号分析（不依赖其他模块）
synth.js   → Synth    发声（不依赖其他模块）
arrange.js → Arrange  编曲（依赖 Theory）
app.js     → （IIFE）界面（依赖以上全部；调试时暴露 window.__app）
```

`v2/dev/fixture.js` 是开发用的合成录音，页面不加载它，见 [TESTING.md](TESTING.md)。

## 1. 数据流

```
麦克风 / 上传文件                     键盘：空格 = 军鼓，Alt = 踩镲（手机：两个大按钮）
   │ startCapture() → ScriptProcessor 收集 PCM；实时：liveLoop()（YIN 音高）；tap() 记下每次打击的 AudioContext 时间
   ▼
AudioBuffer（单声道，设备采样率）+ taps
   │ stopCapture() 把 taps 换算好（见下面“按键时间换算”），再 analyzeTake(buffer, info, taps)
   │   ├─ DSP.toMono(buf, 22050) → DSP.pitchFrames() → DSP.transcribe(frames) → 音符（秒）
   │   ├─ 速度：开节拍器 → info.bpm + info.beat0（节拍器回声校准过）
   │   │        不开     → DSP.estimateTempo(音符起点 + 打击时刻)
   │   └─ DSP.toBeats() → 量化到 16 分音符的拍子单位，去掉开头的空小节
   ▼
{ notes, hits, bpm, bars }
   │ newSong() / 添加段落
   ▼
song（见第 2 节）── commit() ──▶ 撤回历史
   │ Arrange.arrange(song)       点"编曲"：配和弦、加前奏 / 复制段 / 尾声
   │ Arrange.compile(song)       → 事件列表（拍子 + 秒），按风格展开和弦、贝斯、鼓
   ▼
事件 ──▶ startPlay()/pump()  实时播放（向前预排 0.2 秒）
     ──▶ Synth.render()      离线渲染 → Synth.wav() → WAV
     ──▶ Arrange.toMidi()    多轨 MIDI
```

### 按键时间换算

`tap()` 只记 `{ ctx: AudioContext.currentTime, k }`。`stopCapture()` 换算后交给 `analyzeTake(buffer, info, taps)`：

- **开节拍器**：用户是跟着听到的咔嗒声按键，而声音从扬声器出来晚了 `outLat = c.outputLatency || c.baseLatency || 0`，所以拍子位置 = `(ctx - outLat - beat0Ctx) / spb`，`taps = [{ b: 拍, k }]`。这里**不用**节拍器回声校准值，那个值只校准麦克风收到的人声。
- **不开节拍器**：`taps = [{ t: ctx - firstCtx（缓冲区里的秒数）, k }]`，和音符起点一起交给 `estimateTempo`，再由 `toBeats` 量化。可能差几十毫秒，16 分音符量化能吸收大部分（已知限制）。
- 预备拍期间的按键忽略。只有鼓点、没有哼唱也会生成作品；两者都没有才算失败。

## 2. 数据模型

`song` 必须能被 JSON 序列化，因为撤回历史存的就是 `JSON.stringify(song)`。录音音频不放在 `song` 里，单独存在 `takes`（Map：takeId → AudioBuffer）。

```js
song = {
  bpm: 100,
  key: { tonic: 0..11, mode: 'major' | 'minor' },
  arranged: false,          // 点过"编曲"之后为 true
  style: 'pop',             // Arrange.STYLES 的键
  mute: { 'melody:piano': true, clap: false, chords: false, bass: false, drums: false },
  sections: [Section, ...]  // 播放顺序 = 数组顺序
}
Section = {
  id: 's1abc',              // Arrange.uid()
  name: '主歌',             // 显示名：主歌 / 副歌 / 桥段 / 尾声 / 前奏
  role: 'rec' | 'copy' | 'intro' | 'outro',   // rec = 用户录的；其余由编曲或复制产生
  bars: 4,                  // 每小节固定 4 拍（目前不支持 3/4 拍）
  melody: { inst: 'piano', notes: [{ p: 60, s: 0, d: 1 }] } | null,   // p = MIDI 音高，s/d = 段内起点和时值（拍）
  hits: [{ t: 1, k: 'clap' | 'snap' }],       // t = 段内拍子，按 16 分音符量化
  chords: ['C', 'G', 'F', 'C'] | null,        // 每小节一个；编曲前为 null
  take: 't1712345' | undefined                // 指向 takes 里的原始录音
}
```

时间单位：存储一律用**拍**；只有 `compile()` 的输出和播放用秒（`t = b * 60 / bpm`）。

### 撤回

- `commit(fn, anim)`：保存快照 → 执行 `fn` → `afterChange(anim)`（重画并刷新正在播放的事件）。**界面上所有对 `song` 的修改都要经过它。**
- 拖动类操作（拖音符）在按下时先 `snapshot()`，松手后有变化才 `pushHistory(snap)`，所以一次拖动只算一步撤回。
- `preArrange`：点"编曲"那一刻的快照，供"取消编曲"使用。取消编曲本身也走 `commit`，所以可以再撤回。
- 静音开关会改 `song.mute`，但不经过 `commit`。它会出现在之后的快照里，所以撤回可能连带恢复静音状态。

### 选中

`sel = { type: 'melody' | 'hits' | 'chord' | 'section', sec: sectionId, bar?: n }` 或 `null`。

## 3. `app.js` 地图

文件里用 `/* ---------------- 名称 ---------------- */` 分节：

| 分节 | 主要内容 |
|---|---|
| （开头） | `ICONS`（Lucide 风格 24×24 描边 SVG；拍手、响指、踩镲是自己画的）、`icon()`、`hydrate()`、`toast()`、`setup()`（高分屏 canvas）、`rr()`（圆角矩形）、`save()` |
| state | `prefs`（localStorage）、`song`、`sel`、`playhead`（拍）、`takes`、`hist`、`commit/undo/redo/afterChange` |
| screens / menus | `show(id)`；`openMenu(anchor, build, align)` 是通用弹出菜单，用 `item()` 加菜单项 |
| home | 节拍器、速度、上传、语言 |
| recording | `startCapture(opts)` 是**通用录音器**，录音页和添加段落弹窗共用（`opts.compact` 用于弹窗）；`pumpRec`（节拍器和伴奏调度）、`liveLoop`、`drawLive`、`stopCapture`（含节拍器回声校准）、`analyzeTake`、`newSong`、`startMain/stopMain` |
| workspace: layout | `L`（几何：`secH`、`laneH`、`bw` 每小节像素）、`lanes()`、`starts()`、`renderWork()`、`renderArr(anim)` |
| workspace: arrangement interaction | `gesture(e, {start, move, end, click})`：按下后移动超过 5px 算拖动，否则算点击（pointercancel 不算点击）；`holdGesture()`（触摸长按）；`edgeScroll()`（拖到边缘自动滚动）；`panner()`；`makeGhost()`；时间线上 `pointerdown` 的事件委托；自定义滚动条 `updateBar()` |
| editor | `renderEditor()`、钢琴卷帘（状态在 `pr`）、`buildHitGrid`、`buildChordPicker` |
| playback | `startPlay` / `pump` / `frame` / `stopPlay` / `refreshPlayer` / `seek`。每次播放新建一个 bus 增益节点，停止时把它淡出 |
| toolbar | 编曲按钮（过渡动画计时）、风格、调、速度 |
| header menus | 重新录、下载、Suno |
| add section | `openAdd`、`#addRec`、`closeAdd`、`#addOk` |
| keyboard & resize | 快捷键；窗口变化时重画 |

`renderArr()` 每次清空重建整个时间线 DOM。目前规模（几十个元素）没问题，段落多了以后再考虑增量更新。

## 4. 模块接口速查

**Theory**：`noteName(midi)`、`keyLabel(key)`、`detectKey(notes)`（Krumhansl–Kessler）、`parse(chord)`、`tones(chord)`、`diatonic(key)` → `[{name, roman, degree}]`、`extras(key)`、`harmonize(notes, bars, key)`（每小节选一个调内三和弦，用 Viterbi 算法同时考虑旋律匹配和和弦进行）、`introChords/outroChords(key)`、`voicing(chord)`、`bassNote(chord)`。

**DSP**：`yin()`、`toMono(buffer, sr)`、`pitchFrames(x22k)`、`transcribe(frames)` → `{notes:[{p,t,e}], trace, offset}`、`estimateTempo(onsets)` → `{bpm, t0}`、`toBeats(notes, hits, bpm, t0)`（`hits` 是 `[{t: 秒, k}]`）、`median()`。麦克风**不再识别拍手和响指**，鼓点只来自按键。

**Synth**：`ctx()` → 实时信号链 `S = {c, input, tone, noise, ks}`；`play(S, dest, ev)`，其中 ev 是 `{inst, m, t, d, v}` 或 `{drum, t, v}`；`click(S, t, accent)`；`setTone(hz)`（Lo-fi 的低通滤波）；`render(events, duration, {lowpass})` → AudioBuffer；`wav(buffer)` → Blob。

**Arrange**：`STYLES`、`STYLE_ORDER`、`KITS`、`MELODY_INSTS`、`instLabel()`、`uid()`、`clone()`、`arrange(song)`、`reharmonize(song)`、`compile(song)` → `{events, bars, starts, duration, tone}`、`toMidi(song)` → Blob、`sunoPrompt(song)`。

事件格式：`{ b: 全局拍, db: 时值拍, lane: 'melody:piano' | 'clap' | 'snap' | 'chords' | 'bass' | 'drums', inst | drum, m, v, t: 秒, d: 秒 }`。用户打的军鼓（`clap`）播放成 `snare`，踩镲（`snap`）播放成 `hat`。内部键名沿用 `clap` / `snap`，避免迁移旧数据，只有显示文字是“军鼓 / 踩镲”。

## 5. 怎么改

### 加一种风格
1. `arrange.js` 的 `STYLES` 里加一项：`chord: {inst, pat, v, seventh?}`、可选的 `chord2`、`bass: {inst, pat, v}`、`drums`（`KITS` 的键或 `null`）、可选的 `tone`（低通频率）和 `swing`。
2. 需要新的伴奏型时，在 `chordEvents()` 或 `bassEvents()` 里加一个 `case`。
3. 需要新的鼓型时，在 `KITS` 里加 16 步的模式。
4. 把 id 加进 `STYLE_ORDER`（决定按钮顺序）。
5. 在 `sunoPrompt()` 的 `words` 里加英文描述。

### 加一种旋律乐器
1. `synth.js`：写 `voice(S, dest, m, t, dur, vel)`，注册到 `INSTRUMENTS`。
2. `arrange.js`：在 `MELODY_INSTS` 加 `[id, '中文名']`，在 `GM` 加 General MIDI 音色号，在 `sunoPrompt()` 的乐器表加英文名。
3. `index.html`：在三处颜色定义里都加 `--i-<id>`（浅色 `:root`、`prefers-color-scheme: dark`、`[data-theme="dark"]`）。

### 加一种鼓声
`synth.js` 的 `DRUMS` 加函数 → `arrange.js` 的 `GM_DRUM` 加音符号 → 在 `KITS` 里使用 → 在 `renderArr()` 鼓轨绘制的 `y` 和 `r` 两张表里加位置和大小。

### 加图标
往 `app.js` 的 `ICONS` 加 SVG 内部（24×24 viewBox，描边用 `currentColor`），在 HTML 里写 `<i data-icon="名字"></i>`，或在 JS 里用 `icon('名字')`。Figma 文件 `Components` 板上有对应的图标组件。

### 多语言（还没做）
文案目前直接写在 `index.html` 和 `app.js` 里。做英语和德语时，建议把所有文案抽成 `strings.<lang>`，用 `data-i18n` 属性加一个 `t(key)` 函数；语言菜单（`#langBtn`）已经留好了位置。

## 6. 可调参数

| 位置 | 参数 | 当前值 | 作用 |
|---|---|---|---|
| `dsp.js` | YIN 阈值 | 0.15 | 越低越严格 |
| `dsp.js` | 有声判定 | `c < .25`，`gate = max(第10百分位×2.5, 第95百分位×0.08, 0.004)` | 判断哪些帧算"在哼" |
| `dsp.js` | `F_MAX` | 800 Hz | 高于此当作无声，用来避开节拍器 |
| `dsp.js` `transcribe` | 换音 | 偏离 0.6 个半音并持续 4 帧（40ms） | — |
| `dsp.js` `transcribe` | 断音 | 3 帧无声；最短音符 80ms | — |
| `dsp.js` `transcribe` | 重新起音 | 能量 > 前 2–8 帧最小值的 2.2 倍，**而且**比 2 帧前高 40%（还在上升） | 第二个条件避免把一个音的起音尾巴当成新音 |
| `dsp.js` `transcribe` | 起点回溯 | 新音的起点往前移到能量开始上升的地方（最多 8 帧） | 音高要几帧才稳定 |
| `dsp.js` `estimateTempo` | 速度范围 | 60–170 BPM，偏好以 100 为中心（σ = 0.6 个八度） | — |
| `app.js` `renderArr` | 每小节宽度 `L.bw` | `clamp((可用宽度 − 72) / max(小节数, 12), MIN, 110)`，`MIN` 电脑 72、手机（宽度 ≤ 640 或横屏手机）56 | 超出部分横向滚动 |
| `app.js` `holdGesture` | 长按换顺序 | 400ms，移动 ≤ 5px | 只用于触摸和笔 |
| `synth.js` `chain` | 混音 | 输入增益 0.55，限幅器 −8 dB / 16:1，混响 1.1 秒、湿声 0.18 | 峰值约 0.9 |

## 7. 已知限制和待办

- **真麦克风没测过**（开发用的浏览器面板没有麦克风）。
- `ScriptProcessorNode` 已被标记为过时，以后应该换成 `AudioWorklet`。
- 开节拍器时的对齐依赖麦克风收到节拍器的声音（`goertzelPeak`）。戴耳机时收不到，只能退回用 `playbackTime` 估计，可能差几十毫秒，16 分音符量化能吸收大部分误差。
- **刷新页面作品就没了**：`song` 和录音都没有持久化。需要的话可以把 `song` 存到 localStorage，把录音存到 IndexedDB。
- 复制出的段落是独立的，没有"联动片段"。
- 和声：每小节一个和弦，只用调内三和弦；没有转调；固定 4/4 拍。
- WAV 渲染约为实时的 1/4（30 秒的歌要 7 秒左右）。
- 改速度只改播放速度，不会重新对齐原始录音（"原声"下载不受影响）。
- 语言菜单只是占位。
