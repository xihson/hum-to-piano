/* UI strings in Chinese / English / German. t(key, vars) reads the current language, falls back to zh, then to the key.
   {name} in a string is replaced from vars. Static markup in index.html uses data-i18n (text), data-i18n-aria (aria-label),
   data-i18n-title (title) and data-i18n-label (both); applyI18n() fills them in. app.js sets the language with setLang().
   Section names are stored in song data as the Chinese strings (see SEC_KEYS); they are translated only for display. */
const STRINGS = {
  zh: {
    'app.title': '哼唱成曲',
    'logo.hum': '哼唱', 'logo.space': '空格',
    'rec.start': '开始录音', 'rec.startTitle': '开始录音（空格）', 'rec.stop': '停止', 'rec.stopTitle': '停止（回车）', 'rec.again': '重新录',
    'metro': '节拍器', 'upload': '上传录音', 'lang': '语言', 'slower': '减慢', 'faster': '加快',
    'snare': '军鼓', 'hihat': '踩镲',
    'download': '下载', 'play': '播放', 'playTitle': '播放（空格）', 'pause': '暂停', 'mute': '静音', 'close': '关闭', 'delete': '删除', 'copy': '复制', 'copied': '已复制',
    'arrange': '编曲', 'arranging': '编曲中', 'suno.render': '用 Suno 渲染！',
    'hint.edit': '点击段落来编辑',
    'ed.copy': '复制段落', 'ed.melody': '旋律 · {sec}', 'ed.rhythm': '节奏 · {sec}', 'ed.chord': '和弦 · {sec} 第 {n} 小节', 'ed.cell': '{lab} 第 {bar} 小节 第 {n} 格',
    'tip.beat': '{n} 拍', 'tip.beats': '{n} 拍',
    'lane.chords': '和弦', 'lane.bass': '贝斯', 'lane.drums': '鼓',
    'chord.bass': '低音', 'chord.root': '根音', 'chord.third': '三音', 'chord.fifth': '五音',
    'add.title': '添加段落', 'add.section': '段落', 'add.inst': '乐器', 'add.beat': '节拍', 'add.backing': '伴奏', 'add.cancel': '取消', 'add.ok': '添加', 'sec.add': '段落',
    'ins.aria': '在这里插入段落', 'ins.title': '插入段落',
    'suno.title': '用 Suno 生成', 'suno.audio': '音频', 'suno.voice': '原声哼唱', 'suno.mix': '我们的编曲', 'suno.prompt': '风格提示词', 'suno.open': '打开 Suno',
    'quit.title': '放弃这次录音？', 'quit.no': '继续录音', 'quit.yes': '放弃',
    'rotate.title': '横过来编辑', 'rotate.skip': '保持竖屏', 'rotate.lock': '尝试关闭旋转锁定。',
    'menu.restart': '从头开始', 'menu.restartConfirm': '确认从头开始', 'menu.cancelArrange': '取消编曲', 'menu.undo': '撤回', 'kbd.undo': 'Ctrl Z', 'menu.voice': '原声',
    'key.major': '{k} 大调', 'key.minor': '{k} 小调', 'key.auto': '（自动）',
    'file.song': '哼唱成曲', 'file.voice': '哼唱原声',
    'toast.noMelodyClose': '没有听出旋律。离麦克风近一点再试。', 'toast.noMelodyClear': '没有听出旋律。换一段更清楚的录音试试。',
    'toast.badFile': '这个文件打不开。换成 mp3、m4a 或 wav 再试。', 'toast.noMic': '无法使用麦克风。可以先用手机录一段，再上传。',
    'toast.lastSection': '至少要保留一个段落。', 'toast.noTake': '没有找到原始录音。', 'toast.makingWav': '正在生成 WAV…',
    'sec.verse': '主歌', 'sec.chorus': '副歌', 'sec.bridge': '桥段', 'sec.outro': '尾声', 'sec.intro': '前奏',
    'style.piano': '纯钢琴', 'style.pop': '流行', 'style.lofi': 'Lo-fi', 'style.rock': '摇滚', 'style.ballad': '抒情', 'style.edm': '电子',
    'inst.piano': '钢琴', 'inst.epiano': '电钢琴', 'inst.guitar': '吉他', 'inst.strings': '弦乐', 'inst.musicbox': '八音盒', 'inst.synth': '合成器',
  },
  en: {
    'app.title': 'Hum to Piano',
    'logo.hum': 'Hum', 'logo.space': 'Space',
    'rec.start': 'Start recording', 'rec.startTitle': 'Start recording (Space)', 'rec.stop': 'Stop', 'rec.stopTitle': 'Stop (Enter)', 'rec.again': 'Record again',
    'metro': 'Metronome', 'upload': 'Upload recording', 'lang': 'Language', 'slower': 'Slower', 'faster': 'Faster',
    'snare': 'Snare', 'hihat': 'Hi-hat',
    'download': 'Download', 'play': 'Play', 'playTitle': 'Play (Space)', 'pause': 'Pause', 'mute': 'Mute', 'close': 'Close', 'delete': 'Delete', 'copy': 'Copy', 'copied': 'Copied',
    'arrange': 'Arrange', 'arranging': 'Arranging', 'suno.render': 'Render with Suno!',
    'hint.edit': 'Click a section to edit',
    'ed.copy': 'Duplicate section', 'ed.melody': 'Melody · {sec}', 'ed.rhythm': 'Rhythm · {sec}', 'ed.chord': 'Chord · {sec} · Bar {n}', 'ed.cell': '{lab}, bar {bar}, step {n}',
    'tip.beat': '{n} beat', 'tip.beats': '{n} beats',
    'lane.chords': 'Chords', 'lane.bass': 'Bass', 'lane.drums': 'Drums',
    'chord.bass': 'Bass', 'chord.root': 'Root', 'chord.third': '3rd', 'chord.fifth': '5th',
    'add.title': 'Add section', 'add.section': 'Section', 'add.inst': 'Instrument', 'add.beat': 'Tempo', 'add.backing': 'Backing', 'add.cancel': 'Cancel', 'add.ok': 'Add', 'sec.add': 'Section',
    'ins.aria': 'Insert section here', 'ins.title': 'Insert section',
    'suno.title': 'Generate with Suno', 'suno.audio': 'Audio', 'suno.voice': 'Original hum', 'suno.mix': 'Our arrangement', 'suno.prompt': 'Style prompt', 'suno.open': 'Open Suno',
    'quit.title': 'Discard this recording?', 'quit.no': 'Keep recording', 'quit.yes': 'Discard',
    'rotate.title': 'Turn sideways to edit', 'rotate.skip': 'Stay in portrait', 'rotate.lock': 'Try turning off rotation lock.',
    'menu.restart': 'Start over', 'menu.restartConfirm': 'Confirm start over', 'menu.cancelArrange': 'Cancel arrangement', 'menu.undo': 'Undo', 'kbd.undo': 'Ctrl Z', 'menu.voice': 'Recording',
    'key.major': '{k} major', 'key.minor': '{k} minor', 'key.auto': ' (auto)',
    'file.song': 'hum-song', 'file.voice': 'hum-voice',
    'toast.noMelodyClose': 'No melody heard. Move closer to the mic and try again.', 'toast.noMelodyClear': 'No melody heard. Try a clearer recording.',
    'toast.badFile': "Can't open this file. Try mp3, m4a or wav.", 'toast.noMic': "Can't use the microphone. Record on your phone, then upload.",
    'toast.lastSection': 'Keep at least one section.', 'toast.noTake': 'Original recording not found.', 'toast.makingWav': 'Rendering WAV…',
    'sec.verse': 'Verse', 'sec.chorus': 'Chorus', 'sec.bridge': 'Bridge', 'sec.outro': 'Outro', 'sec.intro': 'Intro',
    'style.piano': 'Piano', 'style.pop': 'Pop', 'style.lofi': 'Lo-fi', 'style.rock': 'Rock', 'style.ballad': 'Ballad', 'style.edm': 'EDM',
    'inst.piano': 'Piano', 'inst.epiano': 'E-piano', 'inst.guitar': 'Guitar', 'inst.strings': 'Strings', 'inst.musicbox': 'Music box', 'inst.synth': 'Synth',
  },
  de: {
    'app.title': 'Vom Summen zum Klavier',
    'logo.hum': 'Summen', 'logo.space': 'Leertaste',
    'rec.start': 'Aufnahme starten', 'rec.startTitle': 'Aufnahme starten (Leertaste)', 'rec.stop': 'Stopp', 'rec.stopTitle': 'Stopp (Enter)', 'rec.again': 'Neu aufnehmen',
    'metro': 'Metronom', 'upload': 'Aufnahme hochladen', 'lang': 'Sprache', 'slower': 'Langsamer', 'faster': 'Schneller',
    'snare': 'Snare', 'hihat': 'Hi-Hat',
    'download': 'Download', 'play': 'Abspielen', 'playTitle': 'Abspielen (Leertaste)', 'pause': 'Pause', 'mute': 'Stumm', 'close': 'Schließen', 'delete': 'Löschen', 'copy': 'Kopieren', 'copied': 'Kopiert',
    'arrange': 'Arrangieren', 'arranging': 'Arrangiere', 'suno.render': 'Mit Suno rendern!',
    'hint.edit': 'Klicke auf einen Abschnitt, um ihn zu bearbeiten',
    'ed.copy': 'Abschnitt duplizieren', 'ed.melody': 'Melodie · {sec}', 'ed.rhythm': 'Rhythmus · {sec}', 'ed.chord': 'Akkord · {sec} · Takt {n}', 'ed.cell': '{lab}, Takt {bar}, Schritt {n}',
    'tip.beat': '{n} Schlag', 'tip.beats': '{n} Schläge',
    'lane.chords': 'Akkorde', 'lane.bass': 'Bass', 'lane.drums': 'Drums',
    'chord.bass': 'Bass', 'chord.root': 'Grundton', 'chord.third': 'Terz', 'chord.fifth': 'Quinte',
    'add.title': 'Abschnitt hinzufügen', 'add.section': 'Abschnitt', 'add.inst': 'Instrument', 'add.beat': 'Tempo', 'add.backing': 'Begleitung', 'add.cancel': 'Abbrechen', 'add.ok': 'Hinzufügen', 'sec.add': 'Abschnitt',
    'ins.aria': 'Abschnitt hier einfügen', 'ins.title': 'Abschnitt einfügen',
    'suno.title': 'Mit Suno generieren', 'suno.audio': 'Audio', 'suno.voice': 'Original-Summen', 'suno.mix': 'Unser Arrangement', 'suno.prompt': 'Stil-Prompt', 'suno.open': 'Suno öffnen',
    'quit.title': 'Aufnahme verwerfen?', 'quit.no': 'Weiter aufnehmen', 'quit.yes': 'Verwerfen',
    'rotate.title': 'Zum Bearbeiten drehen', 'rotate.skip': 'Hochformat beibehalten', 'rotate.lock': 'Schalte die Rotationssperre aus.',
    'menu.restart': 'Neu beginnen', 'menu.restartConfirm': 'Neu beginnen bestätigen', 'menu.cancelArrange': 'Arrangement verwerfen', 'menu.undo': 'Rückgängig', 'kbd.undo': 'Strg Z', 'menu.voice': 'Aufnahme',
    'key.major': '{k}-Dur', 'key.minor': '{k}-Moll', 'key.auto': ' (auto)',
    'file.song': 'summ-song', 'file.voice': 'summ-aufnahme',
    'toast.noMelodyClose': 'Keine Melodie erkannt. Geh näher ans Mikrofon und versuch es nochmal.', 'toast.noMelodyClear': 'Keine Melodie erkannt. Versuch es mit einer klareren Aufnahme.',
    'toast.badFile': 'Diese Datei lässt sich nicht öffnen. Versuch es mit mp3, m4a oder wav.', 'toast.noMic': 'Mikrofon nicht verfügbar. Nimm auf dem Handy auf und lade die Datei hoch.',
    'toast.lastSection': 'Mindestens ein Abschnitt muss bleiben.', 'toast.noTake': 'Originalaufnahme nicht gefunden.', 'toast.makingWav': 'WAV wird erstellt…',
    'sec.verse': 'Strophe', 'sec.chorus': 'Refrain', 'sec.bridge': 'Bridge', 'sec.outro': 'Outro', 'sec.intro': 'Intro',
    'style.piano': 'Piano', 'style.pop': 'Pop', 'style.lofi': 'Lo-fi', 'style.rock': 'Rock', 'style.ballad': 'Ballade', 'style.edm': 'EDM',
    'inst.piano': 'Klavier', 'inst.epiano': 'E-Piano', 'inst.guitar': 'Gitarre', 'inst.strings': 'Streicher', 'inst.musicbox': 'Spieluhr', 'inst.synth': 'Synth',
  },
};
const LANGS = [['zh', '中文', 'zh-CN'], ['en', 'English', 'en'], ['de', 'Deutsch', 'de']];
const SEC_KEYS = { '主歌': 'sec.verse', '副歌': 'sec.chorus', '桥段': 'sec.bridge', '尾声': 'sec.outro', '前奏': 'sec.intro' };
let LANG = 'zh';
const getLang = () => LANG;
const t = (key, vars) => {
  let s = STRINGS[LANG][key] ?? STRINGS.zh[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => k in vars ? vars[k] : m);
  return s;
};
// stored section names are Chinese; unknown names are shown as they are
const secName = name => SEC_KEYS[name] ? t(SEC_KEYS[name]) : name;
function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  root.querySelectorAll('[data-i18n-title]').forEach(el => el.setAttribute('title', t(el.dataset.i18nTitle)));
  root.querySelectorAll('[data-i18n-label]').forEach(el => { const s = t(el.dataset.i18nLabel); el.setAttribute('aria-label', s); el.setAttribute('title', s); });
}
function setLang(l) {
  LANG = STRINGS[l] ? l : 'zh';
  document.documentElement.lang = LANGS.find(x => x[0] === LANG)[2];
  document.title = t('app.title');
  applyI18n();
}
