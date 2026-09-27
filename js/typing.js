/* ============================================
   TYPING SKILLS BY PEC - Main Script
   Pure vanilla JavaScript (HTML + CSS + JS)
   ============================================ */

(function () {
  'use strict';

  /* ==================================================
     CONFIGURATION
     ================================================== */
  // Where "Back to PEC" should go. Set to '' to use history.back() instead.
  var PEC_HOME_URL = '../index.html';
  var PEC_FALLBACK_URL = '../index.html';

  var SESSIONS_KEY = 'pec-typing-sessions';
  var SOUND_KEY = 'pec-typing-sound';

  var STAGES = {
    2: ['sprout', 'tree'],
    5: ['sprout', 'leaf', 'tree', 'city'],
    7: ['sprout', 'leaf', 'tree', 'city', 'skyline'],
    10: ['sprout', 'leaf', 'tree', 'city', 'skyline'],
    20: ['sprout', 'leaf', 'tree', 'city', 'skyline', 'galaxy']
  };

  var STAGE_INFO = {
    sprout: { e: '\uD83C\uDF31', n: 'Sprout' },
    leaf: { e: '\uD83C\uDF3F', n: 'Growth' },
    tree: { e: '\uD83C\uDF33', n: 'Tree' },
    city: { e: '\uD83C\uDFD9', n: 'City' },
    skyline: { e: '\uD83C\uDF06', n: 'Skyline' },
    galaxy: { e: '\uD83C\uDF0C', n: 'Galaxy' }
  };

  var KB_ROWS = [
    ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'B:Backspace'],
    ['Tab', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'],
    ['Caps', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'", 'Enter'],
    ['Shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', 'Shift'],
    ['Space']
  ];

  var WIDE_KEYS = { 'B:Backspace': 'Backspace', Tab: 'Tab', Caps: 'Caps', Enter: 'Enter', Shift: 'Shift' };
  var SHORT_KEYS = { Backspace: '\u232B', Tab: '\u21E5', Caps: '\u21EA', Enter: '\u23CE', Shift: '\u21E7' };

  /* ==================================================
     ELEMENTS
     ================================================== */
  var $ = function (id) { return document.getElementById(id); };

  var els = {
    back1: $('backPec1'), back2: $('backPec2'), back3: $('backPec3'), brand: $('brandLink'),
    durationGrid: $('durationGrid'), startBtn: $('startBtn'), startHint: $('startHint'),
    shell: $('testShell'), statTime: $('statTime'), statWpm: $('statWpm'), statAcc: $('statAcc'),
    statErr: $('statErr'), statCombo: $('statCombo'), statCons: $('statCons'),
    journeyEmoji: $('journeyEmoji'), journeyFill: $('journeyFill'), journeyDots: $('journeyDots'),
    journeyLabel: $('journeyLabel'), typingArea: $('typingArea'), passage: $('passage'),
    input: $('typeInput'), focusHint: $('focusHint'), passageFill: $('passageFill'),
    keyboard: $('keyboard'), soundBtn: $('soundBtn'), focusBtn: $('focusBtn'), endBtn: $('endBtn'),
    endModal: $('endModal'), modalCancel: $('modalCancel'), modalConfirm: $('modalConfirm'),
    overlay: $('completeOverlay'), overlayTime: $('completeTime'), overlayTitle: $('completeTitle')
  };

  /* ==================================================
     STATE
     ================================================== */
  var selectedMin = 0;
  var running = false;
  var finished = false;
  var startTime = 0;
  var durationMs = 0;
  var pauseAt = 0;
  var pausedTotal = 0;
  var rafId = 0;
  var lastShownSecond = -1;
  var lastSampleSec = -1;

  var currentPassage = '';
  var spans = [];
  var states = [];
  var pos = 0;
  var transitioning = false;
  var pendingKeys = [];
  var queue = [];
  var lastPassageIndex = -1;
  var passagesDone = 0;

  // live counters
  var liveCorrect = 0;
  var totalKS = 0;
  var correctKS = 0;
  var wrongKS = 0;
  var combo = 0;
  var bestCombo = 0;
  var corrections = 0;
  var pairs = {};
  var keyStats = {};
  var wpmSeries = [];
  var accSeries = [];
  var soundOn = false;

  /* ==================================================
     HELPERS
     ================================================== */
  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function num(n) { return Math.round(n).toLocaleString('en-US'); }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function elapsedSec() {
    if (!startTime) return 0;
    var end = finished ? lastStopTime : Date.now();
    var paused = pausedTotal + (pauseAt ? Date.now() - pauseAt : 0);
    return Math.max(0, (end - startTime - paused) / 1000);
  }

  var lastStopTime = 0;

  function computeWpm() {
    var min = elapsedSec() / 60;
    if (min <= 0) return 0;
    return liveCorrect / 5 / min;
  }

  function computeAcc() {
    if (totalKS === 0) return 100;
    return correctKS / totalKS * 100;
  }

  function computeConsistency() {
    if (wpmSeries.length < 2) return 100;
    var vals = wpmSeries.slice(1).map(function (s) { return s.v; }).filter(function (v) { return v > 0; });
    if (vals.length < 2) return 100;
    var mean = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
    if (mean <= 0) return 100;
    var variance = vals.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / vals.length;
    var sd = Math.sqrt(variance);
    return clamp(Math.round(100 - (sd / mean) * 100), 0, 100);
  }

  function getKeyStat(key) {
    if (!keyStats[key]) keyStats[key] = { typed: 0, correct: 0, wrong: 0 };
    return keyStats[key];
  }

  /* ==================================================
     NAVIGATION / BACK BUTTON
     ================================================== */
  function goBack(e) {
    if (e) e.preventDefault();
    if (PEC_HOME_URL) { window.location.href = PEC_HOME_URL; return; }
    if (window.history.length > 1) { window.history.back(); return; }
    window.location.href = PEC_FALLBACK_URL;
  }

  [els.back1, els.back2, els.back3, els.brand].forEach(function (el) {
    if (el) el.addEventListener('click', goBack);
  });

  function showScreen(id) {
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) screens[i].classList.remove('active');
    var target = $(id);
    if (target) target.classList.add('active');
    window.scrollTo(0, 0);
  }

  /* ==================================================
     DURATION SELECTION
     ================================================== */
  els.durationGrid.addEventListener('click', function (e) {
    var card = e.target.closest('.duration-card');
    if (!card) return;
    var cards = els.durationGrid.querySelectorAll('.duration-card');
    for (var i = 0; i < cards.length; i++) cards[i].classList.remove('selected');
    card.classList.add('selected');
    selectedMin = parseInt(card.getAttribute('data-min'), 10);
    els.startBtn.disabled = false;
    els.startHint.textContent = selectedMin + ' minute session selected';
  });

  els.startBtn.addEventListener('click', function () {
    if (!selectedMin) return;
    startTest(selectedMin);
  });

  /* ==================================================
     KEYBOARD BUILD
     ================================================== */
  function buildKeyboard(container, mode) {
    container.innerHTML = '';
    for (var r = 0; r < KB_ROWS.length; r++) {
      var row = document.createElement('div');
      row.className = 'kb-row';
      var keys = KB_ROWS[r];
      for (var i = 0; i < keys.length; i++) {
        var raw = keys[i];
        var key = document.createElement('span');
        key.className = 'kb-key';
        var dataKey = raw;
        var label = raw;
        var wide = false;
        if (WIDE_KEYS[raw]) {
          label = WIDE_KEYS[raw];
          dataKey = WIDE_KEYS[raw].toLowerCase();
          wide = true;
          key.classList.add('wide');
        } else if (raw.indexOf('B:') === 0) {
          label = raw.slice(2);
          dataKey = 'backspace';
          wide = true;
          key.classList.add('wide');
        }
        key.setAttribute('data-key', dataKey === 'Space' ? 'space' : dataKey);
        if (dataKey === 'space') {
          key.classList.add('space');
          key.textContent = '';
        } else if (wide) {
          var full = document.createElement('span');
          full.className = 'kb-full';
          full.textContent = label;
          var short = document.createElement('span');
          short.className = 'kb-short';
          short.textContent = SHORT_KEYS[label] || label.charAt(0);
          key.appendChild(full);
          key.appendChild(short);
        } else {
          key.textContent = label;
        }
        row.appendChild(key);
      }
      container.appendChild(row);
    }
    if (mode === 'result') container.classList.add('heatmap-keys');
  }

  function keyEl(container, name) {
    var list = container.querySelectorAll('[data-key]');
    for (var i = 0; i < list.length; i++) {
      if (list[i].getAttribute('data-key') === name) return list[i];
    }
    return null;
  }

  function highlightKey(name) {
    var el = keyEl(els.keyboard, name);
    if (!el) return;
    el.classList.add('pressed');
    setTimeout(function () { el.classList.remove('pressed'); }, 110);
  }

  function updateNextKey() {
    var prev = els.keyboard.querySelector('.next-up');
    if (prev) prev.classList.remove('next-up');
    if (!currentPassage || pos >= currentPassage.length) return;
    var ch = currentPassage[pos];
    var name = ch === ' ' ? 'space' : ch.toLowerCase();
    var el = keyEl(els.keyboard, name);
    if (el) el.classList.add('next-up');
  }

  /* ==================================================
     PASSAGE ENGINE (ENDLESS)
     ================================================== */
  function refillQueue() {
    var lib = window.PEC_PASSAGES || [];
    if (!lib.length) return;
    var order = shuffle(lib);
    if (order.length > 1 && lastPassageIndex >= 0) {
      var tries = 0;
      while (tries < 6 && order[0] === lib[lastPassageIndex]) {
        order = shuffle(lib);
        tries++;
      }
    }
    queue = queue.concat(order);
  }

  function nextPassage() {
    if (queue.length < 2) refillQueue();
    if (!queue.length) refillQueue();
    var item = queue.shift();
    var lib = window.PEC_PASSAGES || [];
    for (var i = 0; i < lib.length; i++) if (lib[i] === item) lastPassageIndex = i;
    return item;
  }

  function renderPassage(text) {
    currentPassage = text;
    pos = 0;
    states = new Array(text.length);
    spans = new Array(text.length);
    var frag = document.createDocumentFragment();
    for (var i = 0; i < text.length; i++) {
      var s = document.createElement('span');
      s.className = 'ch';
      if (i === 0) s.classList.add('current');
      s.textContent = text.charAt(i);
      spans[i] = s;
      states[i] = 0;
      frag.appendChild(s);
    }
    els.passage.textContent = '';
    els.passage.appendChild(frag);
    els.passageFill.style.width = '0%';
    updateNextKey();
  }

  function updateChar(i) {
    if (i < 0 || !spans[i]) return;
    var cls = 'ch';
    if (states[i] === 1) cls += ' correct';
    else if (states[i] === 2) cls += ' wrong';
    spans[i].className = cls;
  }

  function setCurrent(i) {
    if (spans[i]) spans[i].classList.add('current');
  }

  function transitionPassage() {
    if (transitioning) return;
    transitioning = true;
    passagesDone++;
    els.passage.classList.add('out');
    setTimeout(function () {
      var item = nextPassage();
      renderPassage(item.t);
      els.passage.classList.remove('out');
      els.passage.classList.add('in');
      void els.passage.offsetWidth;
      els.passage.classList.remove('in');
      transitioning = false;
      flushPending();
    }, 300);
  }

  function flushPending() {
    while (pendingKeys.length && !transitioning && running) {
      var ch = pendingKeys.shift();
      handleChar(ch);
    }
  }

  /* ==================================================
     TYPING INPUT
     ================================================== */
  function handleChar(ch) {
    if (!running || finished) return;
    if (transitioning) { pendingKeys.push(ch); return; }
    if (pos >= currentPassage.length) return;

    var expected = currentPassage.charAt(pos);
    totalKS++;

    var ks = getKeyStat(expected.toLowerCase() === ' ' ? 'space' : expected.toLowerCase());
    ks.typed++;

    if (ch === expected) {
      correctKS++;
      liveCorrect++;
      states[pos] = 1;
      ks.correct++;
      combo++;
      if (combo > bestCombo) bestCombo = combo;
      playKeySound();
    } else {
      wrongKS++;
      states[pos] = 2;
      ks.wrong++;
      combo = 0;
      var pk = expected + '>' + ch;
      pairs[pk] = (pairs[pk] || 0) + 1;
      var typedStat = getKeyStat(ch.toLowerCase() === ' ' ? 'space' : ch.toLowerCase());
      typedStat.wrong++;
      playErrorSound();
    }

    updateChar(pos);
    pos++;

    if (pos < currentPassage.length) setCurrent(pos);
    els.passageFill.style.width = (pos / currentPassage.length * 100) + '%';
    updateNextKey();
    updateLiveStats();

    if (pos >= currentPassage.length) {
      els.passageFill.style.width = '100%';
      transitionPassage();
    }
  }

  function handleBackspace() {
    if (!running || finished || transitioning) return;
    if (pos <= 0) return;
    if (spans[pos]) spans[pos].classList.remove('current');
    pos--;
    if (states[pos] === 1) liveCorrect = Math.max(0, liveCorrect - 1);
    states[pos] = 0;
    corrections++;
    updateChar(pos);
    setCurrent(pos);
    els.passageFill.style.width = (pos / currentPassage.length * 100) + '%';
    updateNextKey();
    updateLiveStats();
  }

  function onKeyDown(e) {
    if (!running || finished) return;
    if (els.endModal && !els.endModal.hidden) return;

    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === 'Backspace') {
      e.preventDefault();
      handleBackspace();
      highlightKey('backspace');
      return;
    }
    if (e.key === 'Enter') { e.preventDefault(); return; }
    if (e.key === 'Tab') { e.preventDefault(); return; }
    if (e.key === ' ') e.preventDefault();

    if (e.key && e.key.length === 1) {
      e.preventDefault();
      handleChar(e.key);
      highlightKey(e.key === ' ' ? 'space' : e.key.toLowerCase());
    }
  }

  function onInput() {
    if (!running || finished) return;
    var v = els.input.value;
    if (!v) return;
    for (var i = 0; i < v.length; i++) handleChar(v.charAt(i));
    els.input.value = '';
  }

  document.addEventListener('keydown', onKeyDown);
  els.input.addEventListener('input', onInput);

  els.typingArea.addEventListener('click', function () { els.input.focus(); });
  els.typingArea.addEventListener('focus', function () { els.typingArea.classList.remove('blurred'); });
  els.typingArea.addEventListener('blur', function () {
    if (running && !finished) els.typingArea.classList.add('blurred');
  });
  els.input.addEventListener('focus', function () {
    els.typingArea.classList.remove('blurred');
    els.typingArea.classList.add('active-caret');
  });
  els.input.addEventListener('blur', function () {
    els.typingArea.classList.remove('active-caret');
    if (running && !finished) els.typingArea.classList.add('blurred');
  });

  /* ==================================================
     SOUND
     ================================================== */
  var audioCtx = null;

  function ensureAudio() {
    if (!soundOn) return null;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
    } catch (e) { return null; }
  }

  function beep(freq, dur, type, vol) {
    var ctx = ensureAudio();
    if (!ctx) return;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    o.connect(g); g.connect(ctx.destination);
    var t = ctx.currentTime;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function playKeySound() { beep(720, 0.045, 'triangle', 0.022); }
  function playErrorSound() { beep(170, 0.1, 'sawtooth', 0.03); }
  function playFinishSound() {
    beep(523, 0.16, 'sine', 0.05);
    setTimeout(function () { beep(659, 0.16, 'sine', 0.05); }, 150);
    setTimeout(function () { beep(784, 0.28, 'sine', 0.05); }, 300);
  }

  function renderSoundBtn() {
    els.soundBtn.innerHTML = soundOn
      ? '<i class="fas fa-volume-high"></i>'
      : '<i class="fas fa-volume-xmark"></i>';
    els.soundBtn.classList.toggle('on', soundOn);
  }

  els.soundBtn.addEventListener('click', function () {
    soundOn = !soundOn;
    localStorage.setItem(SOUND_KEY, soundOn ? 'on' : 'off');
    renderSoundBtn();
    if (soundOn) beep(660, 0.08, 'sine', 0.04);
  });

  /* ==================================================
     FOCUS MODE + END TEST
     ================================================== */
  els.focusBtn.addEventListener('click', function () {
    document.body.classList.toggle('focus-mode');
    var on = document.body.classList.contains('focus-mode');
    els.focusBtn.innerHTML = on ? '<i class="fas fa-compress"></i>' : '<i class="fas fa-expand"></i>';
    els.focusBtn.classList.toggle('on', on);
  });

  els.endBtn.addEventListener('click', function () { els.endModal.hidden = false; });
  els.modalCancel.addEventListener('click', function () { els.endModal.hidden = true; });
  els.modalConfirm.addEventListener('click', function () {
    els.endModal.hidden = true;
    finish('manual');
  });

  /* ==================================================
     TEST LIFECYCLE
     ================================================== */
  function startTest(min) {
    selectedMin = min;
    resetSession();
    showScreen('screen-test');
    document.body.classList.remove('focus-mode');
    els.shell.classList.remove('finishing');
    els.overlay.hidden = true;

    durationMs = min * 60 * 1000;
    running = true;
    finished = false;
    startTime = Date.now();
    pausedTotal = 0;
    lastStopTime = 0;
    lastShownSecond = -1;
    lastSampleSec = -1;

    queue = [];
    lastPassageIndex = -1;
    renderPassage(nextPassage().t);

    buildKeyboard(els.keyboard, 'live');
    updateNextKey();
    setupJourney(min);

    wpmSeries = [];
    accSeries = [];
    sampleStats(0);

    updateStatsUI();
    els.typingArea.classList.remove('blurred');
    setTimeout(function () { els.input.focus(); }, 120);

    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  function resetSession() {
    liveCorrect = 0; totalKS = 0; correctKS = 0; wrongKS = 0;
    combo = 0; bestCombo = 0; corrections = 0;
    pairs = {}; keyStats = {}; passagesDone = 0;
    pendingKeys = []; transitioning = false;
    els.shell.classList.remove('finishing');
  }

  function loop() {
    if (!running || finished) return;
    var el = elapsedSec();

    if (el * 1000 >= durationMs) {
      els.statTime.textContent = '00:00';
      finish('time');
      return;
    }

    var whole = Math.floor(el);
    if (whole !== lastShownSecond) {
      lastShownSecond = whole;
      updateStatsUI();
      updateJourney(el);
    }

    if (whole > lastSampleSec && whole > 0) {
      lastSampleSec = whole;
      sampleStats(whole);
    }

    rafId = requestAnimationFrame(loop);
  }

  function sampleStats(sec) {
    wpmSeries.push({ t: sec, v: Math.round(computeWpm()) });
    accSeries.push({ t: sec, v: Math.round(computeAcc() * 10) / 10 });
  }

  function updateStatsUI() {
    var el = elapsedSec();
    var remain = Math.max(0, durationMs / 1000 - el);
    if (els.statTime.textContent !== fmtTime(remain)) {
      els.statTime.textContent = fmtTime(remain);
      els.statTime.classList.remove('bump');
      void els.statTime.offsetWidth;
      els.statTime.classList.add('bump');
    }
    updateLiveStats();
  }

  function updateLiveStats() {
    setVal(els.statWpm, Math.round(computeWpm()));
    setVal(els.statAcc, computeAcc().toFixed(1) + '%');
    setVal(els.statErr, wrongKS);
    setVal(els.statCombo, combo);
    setVal(els.statCons, computeConsistency() + '%');
  }

  function setVal(el, v) {
    if (el.textContent === String(v)) return;
    el.textContent = v;
  }

  /* ==================================================
     JOURNEY VISUAL
     ================================================== */
  function setupJourney(min) {
    var list = STAGES[min] || STAGES[5];
    els.journeyDots.innerHTML = '';
    for (var i = 0; i < list.length; i++) {
      var d = document.createElement('span');
      d.style.left = (i / Math.max(1, list.length - 1) * 100) + '%';
      els.journeyDots.appendChild(d);
    }
    updateJourney(0);
  }

  function updateJourney(elapsed) {
    var list = STAGES[selectedMin] || STAGES[5];
    var progress = clamp(elapsed / (durationMs / 1000), 0, 1);
    var idx = clamp(Math.floor(progress * list.length), 0, list.length - 1);
    var info = STAGE_INFO[list[idx]];

    els.journeyFill.style.width = (progress * 100) + '%';
    if (els.journeyEmoji.textContent !== info.e) {
      els.journeyEmoji.textContent = info.e;
      els.journeyEmoji.classList.add('pop');
      setTimeout(function () { els.journeyEmoji.classList.remove('pop'); }, 450);
    }
    els.journeyLabel.textContent = info.n + ' · ' + Math.round(progress * 100) + '%';

    var dots = els.journeyDots.children;
    for (var i = 0; i < dots.length; i++) dots[i].classList.toggle('done', i <= idx);
  }

  /* ==================================================
     FINISH + TRANSITION
     ================================================== */
  function finish(reason) {
    if (finished) return;
    lastStopTime = reason === 'time' ? startTime + pausedTotal + durationMs : Date.now();
    finished = true;
    running = false;
    cancelAnimationFrame(rafId);

    var elapsed = reason === 'time' ? durationMs / 1000 : elapsedSec();

    sampleStats(Math.max(1, Math.floor(elapsed)));

    els.input.blur();
    els.shell.classList.add('finishing');

    // save session AFTER reading history so we can compare with the previous best
    var prevSessions = loadSessions();
    var prevBest = 0;
    for (var i = 0; i < prevSessions.length; i++) prevBest = Math.max(prevBest, prevSessions[i].wpm);

    var session = buildSession(elapsed);
    var isBest = prevSessions.length > 0 && session.wpm > prevBest;
    if (session.total > 0) saveSession(session);
    playFinishSound();

    // --- transition sequence ---
    els.overlayTime.textContent = reason === 'time' ? '00:00' : fmtTime(elapsed);
    els.overlayTitle.textContent = 'Test Complete';
    setTimeout(function () { els.overlay.hidden = false; }, 320);

    setTimeout(function () {
      els.overlay.hidden = true;
      els.shell.classList.remove('finishing');
      renderResults(session, prevSessions.length ? prevBest : null, isBest);
      showScreen('screen-results');
      animateReveal();
      if (isBest) launchConfetti();
    }, 2450);
  }

  function buildSession(elapsed) {
    var acc = computeAcc();
    return {
      date: new Date().toISOString(),
      min: selectedMin,
      durationSec: Math.round(durationMs / 1000),
      elapsedSec: Math.round(elapsed),
      wpm: Math.round(computeWpm()),
      acc: Math.round(acc * 10) / 10,
      errors: wrongKS,
      correct: liveCorrect,
      total: liveCorrect + wrongKS,
      consistency: computeConsistency(),
      combo: bestCombo,
      corrections: corrections,
      passages: passagesDone,
      wpmSeries: wpmSeries.slice(),
      accSeries: accSeries.slice(),
      keyStats: JSON.parse(JSON.stringify(keyStats)),
      pairs: JSON.parse(JSON.stringify(pairs))
    };
  }

  /* ==================================================
     LOCAL STORAGE
     ================================================== */
  function loadSessions() {
    try {
      var raw = localStorage.getItem(SESSIONS_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }

  function saveSession(s) {
    var list = loadSessions();
    list.push(s);
    if (list.length > 100) list = list.slice(list.length - 100);
    try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(list)); } catch (e) {}
  }

  /* ==================================================
     RESULTS RENDERING
     ================================================== */
  var lastSession = null;

  function renderResults(s, prevBest, isBest) {
    lastSession = s;

    $('resWpm').textContent = s.wpm;
    $('resAcc').textContent = s.acc + '%';
    $('resCorrect').textContent = num(s.correct);
    $('resWrong').textContent = num(s.errors);
    $('resTotal').textContent = num(s.total);
    $('resCombo').textContent = s.combo;
    $('resCons').textContent = s.consistency + '%';
    $('resDuration').textContent = fmtTime(s.elapsedSec);
    $('resCorrections').textContent = num(s.corrections);
    $('resSub').textContent = s.min + ' minute session · ' + num(s.total) + ' characters typed';

    var badge = $('bestBadge');
    badge.hidden = !isBest;

    setRing('ringWpm', clamp(s.wpm / 90, 0, 1), s.wpm);
    setRing('ringAcc', clamp(s.acc / 100, 0, 1), s.acc + '%');
    setRing('ringCons', clamp(s.consistency / 100, 0, 1), s.consistency + '%');
    var errRate = s.total ? s.errors / s.total : 0;
    setRing('ringErr', clamp(errRate * 6, 0.03, 1), s.errors);

    renderKeyboardHeatmap(s);
    renderMistakes(s);
    renderJourneyStrip(s);
    renderRecords(s, prevBest);

    setTimeout(function () {
      drawWpmChart(s);
      drawAccChart(s);
    }, 240);
  }

  function setRing(id, pct, value) {
    var wrap = $(id);
    if (!wrap) return;
    var circle = wrap.querySelector('.ring-fg');
    var C = 326.7;
    circle.style.strokeDashoffset = C;
    setTimeout(function () { circle.style.strokeDashoffset = C * (1 - pct); }, 300);
    wrap.querySelector('.ring-value').textContent = value;
  }

  function animateReveal() {
    var items = document.querySelectorAll('#screen-results .reveal');
    for (var i = 0; i < items.length; i++) {
      (function (el, index) {
        setTimeout(function () { el.classList.add('shown'); }, index * 80);
      })(items[i], i);
    }
  }

  function launchConfetti() {
    var colors = ['#f59e0b', '#9adce5', '#10b981', '#fbbf24', '#1597ad'];
    for (var i = 0; i < 28; i++) {
      (function (i) {
        var p = document.createElement('div');
        p.className = 'confetti-piece';
        p.style.left = (Math.random() * 100) + 'vw';
        p.style.background = colors[i % colors.length];
        p.style.animationDuration = (2.2 + Math.random() * 1.6) + 's';
        p.style.animationDelay = (Math.random() * 0.5) + 's';
        document.body.appendChild(p);
        setTimeout(function () { p.remove(); }, 5000);
      })(i);
    }
  }

  /* ---------- keyboard heatmap ---------- */
  function renderKeyboardHeatmap(s) {
    var box = $('resultKeyboard');
    buildKeyboard(box, 'result');
    var ks = s.keyStats || {};
    var keys = Object.keys(ks);

    for (var i = 0; i < keys.length; i++) {
      var k = keys[i], st = ks[k];
      if (st.typed < 3) continue;
      var acc = st.correct / st.typed * 100;
      var el = keyEl(box, k);
      if (!el) continue;
      el.classList.add(acc >= 98 ? 'ok' : acc >= 94 ? 'good' : acc >= 88 ? 'mid' : 'weak');
      el.title = k.toUpperCase() + ' — ' + acc.toFixed(0) + '% (' + st.correct + '/' + st.typed + ')';
    }

    var usable = keys.filter(function (k) { return ks[k].typed >= 5; });
    var byAcc = usable.slice().sort(function (a, b) {
      return (ks[b].correct / ks[b].typed) - (ks[a].correct / ks[a].typed);
    });

    var best = byAcc.slice(0, 5);
    var weak = byAcc.filter(function (k) {
      return ks[k].correct / ks[k].typed < 1;
    }).slice(0, 5);

    fillKeyList($('bestKeys'), best, ks, 'good', 'Not enough data yet');
    fillKeyList($('weakKeys'), weak, ks, 'bad', 'No weak keys this session - perfect accuracy');
  }

  function fillKeyList(ul, list, ks, tone, emptyMsg) {
    ul.innerHTML = '';
    if (!list.length) {
      ul.innerHTML = '<li><span>' + emptyMsg + '</span></li>';
      return;
    }
    list.forEach(function (k) {
      var st = ks[k];
      var acc = (st.correct / st.typed * 100).toFixed(0);
      var li = document.createElement('li');
      li.innerHTML = '<b>' + (k === 'space' ? 'SPACE' : k.toUpperCase()) + '</b><span class="' + tone + '">' + acc + '%</span>';
      ul.appendChild(li);
    });
  }

  /* ---------- mistake analysis ---------- */
  function renderMistakes(s) {
    var pairsArr = Object.keys(s.pairs || {}).map(function (k) {
      var p = k.split('>');
      return { from: p[0], to: p[1], n: s.pairs[k] };
    }).sort(function (a, b) { return b.n - a.n; });

    var ul = $('pairList');
    ul.innerHTML = '';
    if (!pairsArr.length) {
      ul.innerHTML = '<li><span>No repeated typing mistakes detected</span></li>';
    } else {
      pairsArr.slice(0, 6).forEach(function (p) {
        var li = document.createElement('li');
        li.innerHTML = '<b>' + labelOf(p.from) + ' → ' + labelOf(p.to) + '</b><span class="bad">' + p.n + '×</span>';
        ul.appendChild(li);
      });
    }

    var repeat = pairsArr.filter(function (p) { return p.n > 1; }).length;
    $('wrongChars').textContent = num(s.errors);
    $('repeatMistakes').textContent = repeat;
    $('corrCount').textContent = num(s.corrections);

    var ks = s.keyStats || {};
    var errKeys = Object.keys(ks)
      .map(function (k) { return { k: k, w: ks[k].wrong }; })
      .filter(function (o) { return o.w > 0; })
      .sort(function (a, b) { return b.w - a.w; })
      .slice(0, 5);

    var eul = $('errorKeys');
    eul.innerHTML = '';
    if (!errKeys.length) {
      eul.innerHTML = '<li><span class="good">No error-prone keys found</span></li>';
    } else {
      errKeys.forEach(function (o) {
        var li = document.createElement('li');
        li.innerHTML = '<b>' + labelOf(o.k) + '</b><span class="bad">' + o.w + ' errors</span>';
        eul.appendChild(li);
      });
    }

    $('tipText').textContent = buildTip(s, pairsArr, errKeys);
  }

  function labelOf(k) {
    if (k === 'space' || k === ' ') return 'SPACE';
    if (k === ';' || k === "'" || k === ',' || k === '.' || k === '/' || k === '-' || k === '=' ||
        k === '[' || k === ']' || k === '\\' || k === '`') return k + ' (symbol)';
    return k.toUpperCase();
  }

  function buildTip(s, pairsArr, errKeys) {
    var acc = s.acc;
    var punctKeys = [';', "'", ',', '.', '/', '-', '=', '[', ']', '\\', '`'];
    var punctErr = 0, letterErr = 0, numberErr = 0;
    var ks = s.keyStats || {};
    Object.keys(ks).forEach(function (k) {
      var w = ks[k].wrong;
      if (!w) return;
      if (punctKeys.indexOf(k) !== -1) punctErr += w;
      else if (/[0-9]/.test(k)) numberErr += w;
      else letterErr += w;
    });

    var area = 'letters';
    if (punctErr >= letterErr && punctErr >= numberErr) area = 'punctuation';
    else if (numberErr > letterErr) area = 'numbers';

    var first = acc >= 97 ? 'Your accuracy is excellent at ' + acc + '%.'
      : acc >= 92 ? 'Your accuracy is solid at ' + acc + '%.'
      : 'Your accuracy is ' + acc + '% and has clear room to improve.';

    var second = area === 'punctuation'
      ? 'Punctuation is causing most of your errors, so try a symbol-focused practice run at a slower speed.'
      : area === 'numbers'
        ? 'The number row is slowing you down, so warm up with digits before your next session.'
        : 'Most mistakes happen on regular letter keys, so slow down slightly and focus on clean finger placement.';

    var third = '';
    if (pairsArr.length) {
      third = ' You repeatedly typed "' + labelOf(pairsArr[0].to) + '" instead of "' +
        labelOf(pairsArr[0].from) + '" (' + pairsArr[0].n + ' times) — watch that swap.';
    } else if (errKeys.length) {
      third = ' The key "' + labelOf(errKeys[0].k) + '" gave you the most trouble (' + errKeys[0].w + ' errors).';
    }

    if (acc >= 97 && !pairsArr.length && !errKeys.length) {
      return 'A near-flawless session. Raise the pace on your next test and keep an eye on your WPM consistency.';
    }
    return first + ' ' + second + third;
  }

  /* ---------- journey strip ---------- */
  function renderJourneyStrip(s) {
    var list = STAGES[s.min] || STAGES[5];
    var progress = clamp(s.elapsedSec / s.durationSec, 0, 1);
    var reached = clamp(Math.ceil(progress * list.length), 1, list.length);

    $('journeyTitle').textContent = 'Your ' + s.min + '-minute typing journey';

    var strip = $('journeyStrip');
    strip.innerHTML = '';
    list.forEach(function (key, i) {
      if (i > 0) {
        var sep = document.createElement('span');
        sep.className = 'js-sep';
        sep.textContent = '──';
        strip.appendChild(sep);
      }
      var info = STAGE_INFO[key];
      var st = document.createElement('span');
      st.className = 'js-stage' + (i < reached ? ' reached' : '');
      st.style.animationDelay = (i * 0.12) + 's';
      st.innerHTML = '<span>' + info.e + '</span><small>' + info.n.toUpperCase() + '</small>';
      strip.appendChild(st);
    });
    var sep2 = document.createElement('span');
    sep2.className = 'js-sep';
    sep2.textContent = '──';
    strip.appendChild(sep2);
    var fin = document.createElement('span');
    fin.className = 'js-stage' + (progress >= 1 ? ' reached' : '');
    fin.style.animationDelay = (list.length * 0.12) + 's';
    fin.innerHTML = '<span>\uD83C\uDFC1</span><small>FINISH</small>';
    strip.appendChild(fin);
  }

  /* ---------- personal records ---------- */
  function renderRecords(s, prevBest) {
    var body = $('recordsBody');
    body.innerHTML = '';

    if (prevBest === null) {
      body.innerHTML =
        '<div class="first-note">' +
        '<p><strong>Complete more tests to build your personal records.</strong></p>' +
        '<p>Your best WPM, average speed, streak and longest session will appear here after your next session.</p>' +
        '</div>';
      return;
    }

    var wrap = document.createElement('div');
    wrap.className = 'records-compare';
    wrap.innerHTML =
      '<div class="record-item"><div class="rl">Personal Best WPM</div><div class="rv hl">' + Math.max(prevBest, s.wpm) + '</div></div>' +
      '<div class="record-item"><div class="rl">Previous Best</div><div class="rv">' + prevBest + '</div></div>' +
      '<div class="record-item"><div class="rl">Current WPM</div><div class="rv">' + s.wpm + '</div></div>';
    body.appendChild(wrap);

    if (s.wpm > prevBest) {
      var note = document.createElement('p');
      note.className = 'first-note';
      note.innerHTML = '<strong class="good">You beat your previous best by ' + (s.wpm - prevBest) + ' WPM.</strong>';
      body.appendChild(note);
    } else {
      var gap = prevBest - s.wpm;
      var note2 = document.createElement('p');
      note2.className = 'first-note';
      note2.textContent = gap <= 3
        ? 'You are ' + gap + ' WPM away from your personal best — very close.'
        : 'You are ' + gap + ' WPM away from your personal best. Keep practising.';
      body.appendChild(note2);
    }
  }

  /* ==================================================
     CHARTS
     ================================================== */
  var chartRedrawers = [];

  function drawChart(canvas, tip, points, opts) {
    if (!canvas || !points.length) return;
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth || canvas.parentNode.clientWidth;
    var h = parseInt(canvas.getAttribute('height'), 10) || 220;
    if (!w) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.height = h + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var padL = 46, padR = 14, padT = 16, padB = 30;
    var pw = w - padL - padR, ph = h - padT - padB;

    var xs = points.map(function (p) { return p.x; });
    var ys = points.map(function (p) { return p.y; });
    var xMin = Math.min.apply(null, xs), xMax = Math.max.apply(null, xs);
    if (xMax === xMin) xMax = xMin + 1;
    var yMin = opts.yMin !== undefined ? opts.yMin : Math.min.apply(null, ys);
    var yMax = opts.yMax !== undefined ? opts.yMax : Math.max.apply(null, ys);
    if (yMax === yMin) yMax = yMin + 1;
    var yPad = (yMax - yMin) * 0.15;
    if (opts.yMin === undefined) yMin = Math.max(0, yMin - yPad);
    if (opts.yMax === undefined) yMax = yMax + yPad;

    function px(x) { return padL + (x - xMin) / (xMax - xMin) * pw; }
    function py(y) { return padT + ph - (y - yMin) / (yMax - yMin) * ph; }

    var gridColor = cssVar('--border-light') || '#e6eef3';
    var labelColor = cssVar('--text-light') || '#9aabb8';

    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = labelColor;
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;

    for (var i = 0; i <= 4; i++) {
      var yv = yMin + (yMax - yMin) * (i / 4);
      var yy = py(yv);
      ctx.beginPath();
      ctx.moveTo(padL, yy);
      ctx.lineTo(w - padR, yy);
      ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillText(opts.yFmt(yv), padL - 8, yy + 4);
    }

    ctx.textAlign = 'center';
    for (var j = 0; j <= 4; j++) {
      var xv = xMin + (xMax - xMin) * (j / 4);
      ctx.fillText(opts.xFmt(xv), px(xv), h - 8);
    }

    var color = opts.color;
    var grad = ctx.createLinearGradient(0, padT, 0, padT + ph);
    grad.addColorStop(0, opts.fill);
    grad.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.beginPath();
    points.forEach(function (p, k) {
      var X = px(p.x), Y = py(p.y);
      if (k === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    });
    ctx.lineTo(px(points[points.length - 1].x), padT + ph);
    ctx.lineTo(px(points[0].x), padT + ph);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    points.forEach(function (p, k) {
      var X = px(p.x), Y = py(p.y);
      if (k === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    ctx.lineJoin = 'round';
    ctx.stroke();

    var last = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(px(last.x), py(last.y), 4.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    canvas._meta = { points: points, px: px, py: py, opts: opts };
    canvas._tip = tip;
  }

  function bindChartHover(canvas) {
    if (canvas._hoverBound) return;
    canvas._hoverBound = true;
    canvas.addEventListener('mousemove', function (e) {
      var meta = canvas._meta;
      var tip = canvas._tip;
      if (!meta || !tip) return;
      var rect = canvas.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var best = meta.points[0], bd = Infinity;
      meta.points.forEach(function (p) {
        var d = Math.abs(meta.px(p.x) - mx);
        if (d < bd) { bd = d; best = p; }
      });
      tip.hidden = false;
      tip.textContent = meta.opts.xFmt(best.x) + ' · ' + meta.opts.tipFmt(best.y);
      tip.style.left = meta.px(best.x) + 'px';
      tip.style.top = meta.py(best.y) + 'px';
    });
    canvas.addEventListener('mouseleave', function () {
      if (canvas._tip) canvas._tip.hidden = true;
    });
  }

  function toSeries(series, key) {
    return series.map(function (p) { return { x: p.t, y: key === 'acc' ? p.v : p.v }; });
  }

  function timeFmt(sec) {
    sec = Math.round(sec);
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function niceCeil(v) {
    if (v <= 5) return 5;
    var mag = Math.pow(10, Math.floor(Math.log(v) / Math.LN10));
    var steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
    for (var i = 0; i < steps.length; i++) {
      if (v <= steps[i] * mag) return steps[i] * mag;
    }
    return 10 * mag;
  }

  function drawWpmChart(s) {
    var canvas = $('canvasWpm'), tip = $('tipWpm');
    var points = toSeries(s.wpmSeries, 'wpm');
    var xMax = Math.max(s.durationSec, points[points.length - 1].x);
    var maxV = Math.max.apply(null, points.map(function (p) { return p.y; }));
    var opts = {
      color: cssVar('--tangerine') || '#f59e0b',
      fill: 'rgba(245,158,11,0.28)',
      yMin: 0,
      yMax: niceCeil(maxV),
      xFmt: timeFmt,
      yFmt: function (v) { return Math.round(v); },
      tipFmt: function (v) { return Math.round(v) + ' WPM'; }
    };
    var mapped = points.map(function (p) { return { x: p.x, y: p.y }; });
    if (mapped.length === 1) mapped.push({ x: xMax, y: mapped[0].y });
    else if (mapped[mapped.length - 1].x < xMax) mapped.push({ x: xMax, y: mapped[mapped.length - 1].y });
    var redraw = function () { drawChart(canvas, tip, mapped, opts); };
    redraw();
    bindChartHover(canvas);
    if (chartRedrawers.indexOf(redraw) === -1) chartRedrawers.push(redraw);
  }

  function drawAccChart(s) {
    var canvas = $('canvasAcc'), tip = $('tipAcc');
    var points = s.accSeries.map(function (p) { return { x: p.t, y: p.v }; });
    var xMax = Math.max(s.durationSec, points[points.length - 1].x);
    var vals = points.map(function (p) { return p.y; });
    var yMin = Math.max(0, Math.min(92, Math.floor((Math.min.apply(null, vals) - 2) / 4) * 4));
    var opts = {
      color: cssVar('--pool-dark') || '#1597ad',
      fill: 'rgba(21,151,173,0.26)',
      yMin: yMin,
      yMax: 100,
      xFmt: timeFmt,
      yFmt: function (v) { return Math.round(v) + '%'; },
      tipFmt: function (v) { return v.toFixed(1) + '%'; }
    };
    if (points.length === 1) points.push({ x: xMax, y: points[0].y });
    else if (points[points.length - 1].x < xMax) points.push({ x: xMax, y: points[points.length - 1].y });
    var redraw = function () { drawChart(canvas, tip, points, opts); };
    redraw();
    bindChartHover(canvas);
    if (chartRedrawers.indexOf(redraw) === -1) chartRedrawers.push(redraw);
  }

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      chartRedrawers.forEach(function (fn) { fn(); });
    }, 160);
  });

  /* ==================================================
     RESULT ACTIONS
     ================================================== */
  $('btnAgain').addEventListener('click', function () {
    startTest(selectedMin || 5);
  });
  $('btnDuration').addEventListener('click', function () {
    showScreen('screen-home');
  });
  $('btnProgress').addEventListener('click', function () {
    renderHistory();
    showScreen('screen-history');
  });

  /* ==================================================
     HISTORY / PROGRESS
     ================================================== */
  function dayKey(d) { return new Date(d).toDateString(); }

  function streakOf(list) {
    if (!list.length) return 0;
    var days = {};
    list.forEach(function (s) { days[dayKey(s.date)] = true; });
    var streak = 0;
    var cursor = new Date();
    if (!days[cursor.toDateString()]) cursor.setDate(cursor.getDate() - 1);
    while (days[cursor.toDateString()]) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function renderHistory() {
    var list = loadSessions();
    var empty = $('histEmpty'), content = $('histContent');

    if (!list.length) {
      empty.hidden = false;
      content.hidden = true;
      return;
    }
    empty.hidden = true;
    content.hidden = false;

    var wpmVals = list.map(function (s) { return s.wpm; });
    var accVals = list.map(function (s) { return s.acc; });
    var bestWpm = Math.max.apply(null, wpmVals);
    var avgWpm = wpmVals.reduce(function (a, b) { return a + b; }, 0) / wpmVals.length;
    var avgAcc = accVals.reduce(function (a, b) { return a + b; }, 0) / accVals.length;
    var bestCombo = Math.max.apply(null, list.map(function (s) { return s.combo; }));
    var longest = Math.max.apply(null, list.map(function (s) { return s.elapsedSec; }));
    var totalSec = list.reduce(function (a, s) { return a + (s.elapsedSec || 0); }, 0);
    var totalChars = list.reduce(function (a, s) { return a + (s.total || 0); }, 0);

    var stats = [
      ['Personal Best WPM', bestWpm, true],
      ['Average WPM', Math.round(avgWpm), false],
      ['Average Accuracy', avgAcc.toFixed(1) + '%', false],
      ['Best Combo', bestCombo, false],
      ['Longest Session', fmtTime(longest), false],
      ['Total Tests', list.length, false],
      ['Total Typing Time', fmtTime(totalSec), false],
      ['Total Characters Typed', num(totalChars), false],
      ['Current Streak', streakOf(list) + (streakOf(list) === 1 ? ' day' : ' days'), false]
    ];

    var grid = $('progressStats');
    grid.innerHTML = '';
    stats.forEach(function (row) {
      var d = document.createElement('div');
      d.className = 'record-item';
      d.innerHTML = '<div class="rl">' + row[0] + '</div><div class="rv' + (row[2] ? ' hl' : '') + '">' + row[1] + '</div>';
      grid.appendChild(d);
    });

    var ul = $('sessionList');
    ul.innerHTML = '';
    list.slice().reverse().slice(0, 15).forEach(function (s) {
      var item = document.createElement('div');
      item.className = 'session-item';
      item.innerHTML =
        '<span class="si-main">' + s.min + ' min — ' + s.wpm + ' WPM — ' + s.acc + '%</span>' +
        '<span class="si-meta">' + num(s.total) + ' chars · ' + s.errors + ' errors · combo ' + s.combo + '</span>' +
        '<span class="si-date">' + new Date(s.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) + '</span>';
      ul.appendChild(item);
    });

    setTimeout(function () {
      drawHistoryChart(list);
      if (!historyRedrawBound) {
        historyRedrawBound = true;
        chartRedrawers.push(function () {
          if ($('screen-history').classList.contains('active')) drawHistoryChart(loadSessions());
        });
      }
    }, 200);
  }

  var historyRedrawBound = false;

  function drawHistoryChart(list) {
    var canvas = $('canvasTrend');
    var points = list.map(function (s, i) { return { x: i, y: s.wpm }; });
    if (points.length === 1) points.push({ x: 1, y: points[0].y });
    if (!points.length) return;
    drawChart(canvas, null, points, {
      color: cssVar('--tangerine') || '#f59e0b',
      fill: 'rgba(245,158,11,0.26)',
      yMin: 0,
      yMax: niceCeil(Math.max.apply(null, points.map(function (p) { return p.y; }))),
      xFmt: function (v) { return '#' + (Math.round(v) + 1); },
      yFmt: function (v) { return Math.round(v); },
      tipFmt: function (v) { return Math.round(v) + ' WPM'; }
    });
  }

  $('histStart').addEventListener('click', function () { startTest(selectedMin || 5); });
  $('histHome').addEventListener('click', function () { showScreen('screen-home'); });
  $('emptyStart').addEventListener('click', function () { showScreen('screen-home'); });

  /* ==================================================
     VISIBILITY PAUSE (keeps the timer fair)
     ================================================== */
  document.addEventListener('visibilitychange', function () {
    if (!running || finished) return;
    if (document.hidden) {
      pauseAt = Date.now();
    } else if (pauseAt) {
      pausedTotal += Date.now() - pauseAt;
      pauseAt = 0;
      lastShownSecond = -1;
    }
  });

  /* ==================================================
     INIT
     ================================================== */
  function init() {
    // remove dividers injected by main.js (they do not belong on this page)
    document.querySelectorAll('.section-divider').forEach(function (d) { d.remove(); });

    // keep the configured destination as the single source of truth
    [els.back1, els.back2, els.back3, els.brand].forEach(function (el) {
      if (el && PEC_HOME_URL) el.setAttribute('href', PEC_HOME_URL);
    });

    soundOn = localStorage.getItem(SOUND_KEY) === 'on';
    renderSoundBtn();
    buildKeyboard(els.keyboard, 'live');

    // deep-link support: ?min=5
    var qs = new URLSearchParams(window.location.search);
    var m = parseInt(qs.get('min'), 10);
    if (m && STAGES[m]) {
      var card = els.durationGrid.querySelector('[data-min="' + m + '"]');
      if (card) card.click();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
