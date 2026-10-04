# 哼唱成曲（hum-to-piano）— 给 agent 的入口

一个纯浏览器的小工具：用户对着麦克风哼旋律，同时按空格、Alt（手机上按两个大按钮）打军鼓和踩镲，程序把它们转成钢琴旋律和鼓点；用户可以拖动修改，再一键编曲（加和弦、贝斯、鼓，6 种风格），导出 MIDI、WAV 或原声，或者交给 Suno 生成完整歌曲。

用户说中文，界面是中文。这个项目和同一台电脑上的 Johann Strauss 宣传片项目**没有任何关系**：不要把这里的改动写进那个项目的 CHANGELOG，也不要提交到那个仓库。

## 先读什么

0. **如果 [docs/HANDOFF.md](docs/HANDOFF.md) 存在，先读它**：上一个 session 留下的、已经确认但还没写的代码任务。
1. [docs/UX-WALKTHROUGH.md](docs/UX-WALKTHROUGH.md)：每个界面、每个控件是什么，在哪里，由哪个函数处理。
2. [docs/DECISIONS.md](docs/DECISIONS.md)：用户已经定下的事。**改之前先看，不要推翻。**
3. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)：数据模型、数据流、模块接口、怎么加风格或乐器、可调参数、已知限制。
4. [docs/DESIGN.md](docs/DESIGN.md)：Figma 文件和画板索引、颜色、字体、尺寸、文案规则。
5. [docs/TESTING.md](docs/TESTING.md)：本地运行、合成录音测试、需要真人测的项目、发布。

## 目录

```
index.html          v1：哼唱转钢琴（单文件，已完成，保持不动）
v2/index.html       v2 的页面结构和全部 CSS（颜色变量在顶部）
v2/js/i18n.js       界面文案（中 / 英 / 德），最先加载
v2/js/theory.js     乐理
v2/js/dsp.js        信号分析
v2/js/synth.js      发声
v2/js/arrange.js    编曲、MIDI
v2/js/app.js        界面和交互
v2/dev/fixture.js   合成录音（只用于测试，页面不加载）
docs/               上面列出的文档
```

## 工作方式（用户定的）

- **先在 Figma 里设计，停下来等用户看，用户确认后再写代码。** Figma 文件 key：`ESeUXZQnMt2A6WK4vaA0N9`。
- 一看就懂的功能不加说明文字。
- 修改 `song` 一律经过 `commit(fn)`，这样能撤回。
- 没有构建步骤，也没有依赖。不要引入框架或打包工具，除非用户要求。
- 改完 JS 后运行 `node --check`，再用 `docs/TESTING.md` 里的合成录音回归检查一遍。
- 提交信息用英文，一次改动一个提交。push 到 `main` 就会发布到 GitHub Pages。**用户希望 agent 自己把部署做完**：代码确认并测试过后直接 push，再用 `docs/TESTING.md` 里的命令确认构建完成；只有需要用户介入时才停下，并说清楚怎么做，比如要 token、要在网页后台点击、要加 DNS 记录。
- 新的决定写进 `docs/DECISIONS.md`；界面或交互变了，同步更新 `docs/UX-WALKTHROUGH.md`。
- 用户会在新 session 里直接说要改什么。小的交互修改（不涉及新界面）用户通常不要求先画 Figma，拿不准就问。

## 容易踩的坑（前几个 session 总结的）

- **改了 JS 就改 `v2/index.html` 里脚本的 `?v=` 版本号**（六个脚本用同一个值）。GitHub Pages 缓存 10 分钟，不改的话用户会拿到新旧混用的文件；本地内置浏览器也会缓存，测试前先 `fetch(文件, { cache: 'reload' })` 再刷新。
- **新加的文案三种语言都要写**（`v2/js/i18n.js` 的 `STRINGS`），不要在 `app.js` 或 `index.html` 里直接写中文。段落名在数据里存中文，显示时经 `secName()` 翻译。
- **行尾**：`v2/` 和 `docs/` 里的文件大多是 CRLF（`synth.js` 是 LF）。用脚本改文件时按字节读写、保持原来的行尾，不然 diff 会变成整个文件。提交前看一眼 `git diff --stat` 是否只有真实改动。
- `app.js` 里有个变量叫 `screen`（当前屏幕），会遮住 `window.screen`，要用屏幕尺寸时写 `window.screen`。
- 内置浏览器面板不在前台时页面不出帧，`requestAnimationFrame` 和 CSS 过渡都会停住，截图可能是旧的。先截一张图把它唤醒，再用 JS 读状态来判断，别只看截图。没有麦克风时的测法见 `docs/TESTING.md`。

## 运行

```bash
python -m http.server 8766 --bind 127.0.0.1
```

然后打开 http://127.0.0.1:8766/v2/ 。
