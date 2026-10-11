/* ═══════════════════════════════════════════════════════════════
   Arzi — Mascot Pro: document & ink "co-pilot" layer
   Loaded after the core mascot script in template.html.
   Uses window.arziMascot.core (exposed by the core) and the
   page's own globals (render, setCurrentSignature, …) defensively.

   1. Ink Inspector     magnifier + squint on Real Ink / Intensity /
                        Bleed / Pressure, thumbs-up when it looks natural
   2. Handwriting Mimic quill scribbles in rhythm with keystrokes
   3. Signature Guard   holds a stamp while the signature area is in use,
                        stamps the preview when a signature is placed
   4. Reason moods      medical / court / bereavement+emergency / urgent,
                        casual-leave sigh or sunglasses wiggle
   5. Drag & drop       looks up, hands raised, catches the file, slides it
                        onto the document (the signature box is the target)
   6. Clear desk        folds a paper airplane and launches it off-screen
   7. Mouse play        head turns within 50px, triple-poke tickle
   8. Foley + ambience  toggleable synthesized sounds, night-time cap & lamp
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var M = window.arziMascot;
  var C = M && M.core;
  if (!C || !C.box) return;

  var box = C.box;
  var reduce = !!C.reduceMotion;
  var body = document.body;

  /* ───────────────────────── helpers ───────────────────────── */
  function $(id) { return document.getElementById(id); }
  function on(t, ev, fn, opt) { if (t && t.addEventListener) t.addEventListener(ev, fn, opt); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function guard(name, fn) {
    try { fn(); } catch (e) { if (window.console) console.warn('[arzi-mascot-pro] ' + name + ' failed:', e); }
  }
  function q1(sel) { return box.querySelector(sel); }
  function visibleRect(el) {
    var r = el.getBoundingClientRect();
    var l = clamp(r.left, 0, window.innerWidth), rt = clamp(r.right, 0, window.innerWidth);
    var t = clamp(r.top, 0, window.innerHeight), b = clamp(r.bottom, 0, window.innerHeight);
    return { x: (l + rt) / 2, y: (t + b) / 2, onScreen: r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth, rect: r };
  }
  function dirTo(el) {
    var c = C.center();
    if (!el) return { x: 0, y: 0, d: 0 };
    var v = visibleRect(el);
    var dx = v.x - c.x, dy = v.y - c.y;
    var d = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: dx / d, y: dy / d, d: d };
  }
  function sideSign() { return box.getAttribute('data-side') === 'l' ? -1 : 1; }
  function say(msg, ms, force) { if (msg) C.showBubble(msg, ms || 3800, force ? { force: true } : undefined); }
  var seenLocal = {};
  function once(key) { if (seenLocal[key]) return false; seenLocal[key] = 1; return true; }

  /* ───────────────────────── prop layer (markup) ───────────────────────── */
  var HAND = 'fill="#000" stroke="#f6efe0" stroke-width="1.5"';
  var OVERLAY =
    '<div class="mp-layer" aria-hidden="true">' +
      '<div class="mp-glow"></div>' +

      /* night ambience */
      '<div class="mp-prop mp-lamp"><svg viewBox="0 0 28 56">' +
        '<ellipse cx="13" cy="52" rx="10" ry="3" fill="#3a3f4f"/>' +
        '<path d="M13 50 L11 27 L19 13" fill="none" stroke="#9aa0b0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M12 13 L25 5 L28 17 L15 25 Z" fill="#e0b861" stroke="#8a6a2e" stroke-width="1.2" stroke-linejoin="round"/>' +
        '<circle cx="21" cy="20" r="2.4" fill="#fff3c4"/>' +
      '</svg></div>' +
      '<div class="mp-prop mp-cap"><svg viewBox="0 0 56 34">' +
        '<path d="M4 30 C3 14 16 3 34 4 C45 5 52 10 54 17 C42 15 33 22 30 31 Z" fill="#7a2331" stroke="#4a121d" stroke-width="1.2" stroke-linejoin="round"/>' +
        '<path d="M3 31 Q16 25 31 31" fill="none" stroke="#fbf7ea" stroke-width="5" stroke-linecap="round"/>' +
        '<circle cx="53" cy="18" r="4.6" fill="#fbf7ea" stroke="#d8d2c2" stroke-width="1"/>' +
      '</svg></div>' +

      /* 1. ink inspector */
      '<div class="mp-prop mp-magnifier"><svg viewBox="0 0 46 46">' +
        '<line x1="27" y1="27" x2="38" y2="38" stroke="#5b3a1e" stroke-width="5" stroke-linecap="round"/>' +
        '<circle cx="39" cy="39" r="6" ' + HAND + '/>' +
        '<circle cx="17" cy="17" r="13" fill="rgba(255,255,255,.4)" stroke="#b8894a" stroke-width="4"/>' +
        '<path d="M9.5 14 A8.5 8.5 0 0 1 16 8.5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".85"/>' +
      '</svg></div>' +
      '<div class="mp-prop mp-thumb"><svg viewBox="0 0 32 36">' +
        '<rect x="11" y="2" width="9.5" height="17" rx="4.7" ' + HAND + '/>' +
        '<rect x="4.5" y="15" width="23" height="18" rx="7.5" ' + HAND + '/>' +
        '<path d="M10 22 H22 M10 27 H22" stroke="#f6efe0" stroke-width="1" opacity=".45" stroke-linecap="round"/>' +
      '</svg></div>' +

      /* 2. handwriting mimic */
      '<div class="mp-prop mp-scrap"><svg viewBox="0 0 50 30">' +
        '<rect x="2" y="3" width="44" height="24" rx="2" fill="#fbf7ea" stroke="#cfc5a8" transform="rotate(-4 24 15)"/>' +
        '<path class="mp-sc mp-sc1" pathLength="100" d="M8 12 q4 -5 8 0 t8 0 t8 0 t8 0" fill="none" stroke="#23283a" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path class="mp-sc mp-sc2" pathLength="100" d="M8 20 q4 -5 8 0 t8 0 t8 0" fill="none" stroke="#23283a" stroke-width="1.5" stroke-linecap="round"/>' +
      '</svg></div>' +
      '<div class="mp-prop mp-quill"><svg viewBox="0 0 46 52">' +
        '<line x1="6" y1="48" x2="38" y2="5" stroke="#5b3a1e" stroke-width="2" stroke-linecap="round"/>' +
        '<path d="M15 37 C16 21 28 8 43 4 C43 19 32 33 18 42 Z" fill="#fffdf5" stroke="#7a2331" stroke-width="1.3" stroke-linejoin="round"/>' +
        '<path d="M5 49 L9 43 L11 46 Z" fill="#23283a"/>' +
        '<circle cx="19" cy="33" r="5.2" ' + HAND + '/>' +
      '</svg></div>' +

      /* 3. signature guard */
      '<div class="mp-prop mp-stamp"><svg viewBox="0 0 34 44">' +
        '<rect x="12" y="8" width="10" height="14" rx="3" fill="#5b3a1e"/>' +
        '<ellipse cx="17" cy="6" rx="7" ry="5" fill="#7a2331" stroke="#4a121d" stroke-width="1"/>' +
        '<circle cx="17" cy="17" r="6" ' + HAND + '/>' +
        '<rect x="4" y="22" width="26" height="7" rx="2" fill="#7a2331" stroke="#4a121d" stroke-width="1"/>' +
        '<rect x="2" y="29" width="30" height="7" rx="2" fill="#b8894a" stroke="#8a6a2e" stroke-width="1"/>' +
      '</svg></div>' +

      /* 5. drag & drop catch */
      '<div class="mp-prop mp-catch"><svg viewBox="0 0 86 50">' +
        '<path d="M21 46 Q7 33 11 15 M65 46 Q79 33 75 15" fill="none" stroke="#f6efe0" stroke-width="6.5" stroke-linecap="round"/>' +
        '<path d="M21 46 Q7 33 11 15 M65 46 Q79 33 75 15" fill="none" stroke="#000" stroke-width="4" stroke-linecap="round"/>' +
        '<circle cx="11" cy="12" r="7" ' + HAND + '/><circle cx="75" cy="12" r="7" ' + HAND + '/>' +
      '</svg></div>' +

      /* 6. clear-desk paper airplane */
      '<div class="mp-prop mp-sheet"><svg viewBox="0 0 36 36">' +
        '<rect class="f-rect" x="9" y="5" width="18" height="24" rx="1.5" fill="#fbf7ea" stroke="#cfc5a8"/>' +
        '<path class="f-plane" d="M3 18 L33 5 L22 31 L17 21 Z" fill="#fbf7ea" stroke="#9a9078" stroke-width="1.2" stroke-linejoin="round"/>' +
        '<path class="f-plane" d="M17 21 L33 5" stroke="#9a9078" stroke-width="1" fill="none"/>' +
        '<circle cx="9" cy="31" r="5.5" ' + HAND + '/>' +
      '</svg></div>' +

      /* 7. poke → balance on one leg */
      '<div class="mp-prop mp-balance"><svg viewBox="0 0 90 92">' +
        /* head centre sits at (45,31) in this box */
        '<g fill="none" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M19 35 L5 45 M71 28 L85 15" stroke="#f6efe0" stroke-width="6.5"/>' +
          '<path d="M45 55 V77 H55 M45 55 L31 62 L34 72" stroke="#f6efe0" stroke-width="6.5"/>' +
          '<path d="M19 35 L5 45 M71 28 L85 15" stroke="#000" stroke-width="3.8"/>' +
          '<path d="M45 55 V77 H55 M45 55 L31 62 L34 72" stroke="#000" stroke-width="3.8"/>' +
        '</g>' +
        '<circle cx="4" cy="46" r="4.6" ' + HAND + '/><circle cx="86" cy="14" r="4.6" ' + HAND + '/>' +
      '</svg></div>' +

      /* 4. contextual reasons */
      '<div class="mp-prop mp-specs"><svg viewBox="0 0 50 26">' +
        '<g fill="rgba(255,255,255,.1)" stroke="#d9b26a" stroke-width="1.8">' +
          '<circle cx="15" cy="13" r="9.5"/><circle cx="35" cy="13" r="9.5"/>' +
        '</g>' +
        '<path d="M24.5 12 Q25 9.5 25.5 12 M5.5 12 L1 10 M44.5 12 L49 10" fill="none" stroke="#d9b26a" stroke-width="1.8" stroke-linecap="round"/>' +
      '</svg></div>' +
      '<div class="mp-prop mp-gavel"><svg viewBox="0 0 38 38">' +
        '<line x1="10" y1="32" x2="27" y2="13" stroke="#8a5a2b" stroke-width="4" stroke-linecap="round"/>' +
        '<rect x="17" y="4" width="18" height="10" rx="2.2" fill="#6b4423" stroke="#3b2412" stroke-width="1.2" transform="rotate(42 26 9)"/>' +
        '<rect x="22" y="3" width="3" height="12" fill="#b8894a" transform="rotate(42 26 9)"/>' +
        '<circle cx="10" cy="32" r="5.5" ' + HAND + '/>' +
      '</svg></div>' +
      '<div class="mp-prop mp-salute"><svg viewBox="0 0 28 28">' +
        '<path d="M2 26 L12 15" stroke="#f6efe0" stroke-width="6.5" stroke-linecap="round"/>' +
        '<path d="M2 26 L12 15" stroke="#000" stroke-width="4" stroke-linecap="round"/>' +
        '<rect x="10" y="9" width="15" height="6" rx="3" transform="rotate(-24 12 15)" ' + HAND + '/>' +
      '</svg></div>' +
      '<div class="mp-prop mp-stetho"><svg viewBox="0 0 58 46">' +
        '<path d="M6 6 C3 27 19 34 29 34 C39 34 55 27 52 6" fill="none" stroke="#9fc3c7" stroke-width="2.8" stroke-linecap="round"/>' +
        '<circle cx="6" cy="5" r="2.6" fill="#cfdde0"/><circle cx="52" cy="5" r="2.6" fill="#cfdde0"/>' +
        '<circle cx="29" cy="38" r="5.4" fill="#cfdde0" stroke="#5f7f84" stroke-width="1.5"/>' +
        '<circle cx="29" cy="38" r="2" fill="#5f7f84"/>' +
      '</svg></div>' +
      '<div class="mp-prop mp-tea"><svg viewBox="0 0 30 34">' +
        '<g class="mp-steam" fill="none" stroke="#d6d9e0" stroke-width="1.6" stroke-linecap="round">' +
          '<path d="M8 11 q-2 -3 0 -5 t0 -5"/><path d="M13 11 q-2 -3 0 -5 t0 -5"/><path d="M18 11 q-2 -3 0 -5 t0 -5"/>' +
        '</g>' +
        '<ellipse cx="13" cy="28" rx="11" ry="3" fill="#efe6d2" stroke="#b8894a"/>' +
        '<path d="M22 17 q6 0 5 5 q-1 3 -5 3" fill="none" stroke="#b8894a" stroke-width="1.8"/>' +
        '<path d="M4 15 h18 v5 a9 9 0 0 1 -18 0 Z" fill="#fff9ec" stroke="#b8894a" stroke-width="1.5"/>' +
        '<ellipse cx="13" cy="15" rx="9" ry="2" fill="#a8643a"/>' +
        '<circle cx="13" cy="31" r="4.2" ' + HAND + '/>' +
      '</svg></div>' +
      '<div class="mp-prop mp-sun"><svg viewBox="0 0 50 22">' +
        '<rect x="3" y="4" width="19" height="13" rx="6" fill="#2a2f3d" stroke="#f6efe0" stroke-width="1.5"/>' +
        '<rect x="28" y="4" width="19" height="13" rx="6" fill="#2a2f3d" stroke="#f6efe0" stroke-width="1.5"/>' +
        '<path d="M22 8 Q25 6 28 8 M8 8 L12 6 M33 8 L37 6" fill="none" stroke="#f6efe0" stroke-width="1.5" stroke-linecap="round"/>' +
      '</svg></div>' +
      '<div class="mp-prop mp-sigh"><svg viewBox="0 0 30 22">' +
        '<g fill="none" stroke="#8a8f9f" stroke-width="2" stroke-linecap="round">' +
          '<path d="M2 6 q8 -4 14 0"/><path d="M5 12 q9 -4 17 0"/><path d="M3 18 q8 -4 12 0"/>' +
        '</g>' +
      '</svg></div>' +
    '</div>';

  box.insertAdjacentHTML('beforeend', OVERLAY);
  var headEl = q1('.mp-head');
  var layerEl = q1('.mp-layer');
  function bodyParts() { return [headEl, layerEl].filter(Boolean); }

  /* ───────────────────────── foley (Web Audio, synthesized) ───────────────────────── */
  var Snd = (function () {
    var KEY = 'arziMascotSound_v1';
    var ctx = null, enabled = lsGet(KEY) !== '0', lastScratch = 0, lastBlip = 0;   // on unless the user switched it off
    function ensure() {
      if (!enabled) return null;
      try {
        if (!ctx) {
          var AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return null;
          ctx = new AC();
        }
        if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
        return ctx;
      } catch (e) { return null; }
    }
    function noise(c, dur) {
      var n = Math.max(1, Math.floor(c.sampleRate * dur));
      var buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      var s = c.createBufferSource(); s.buffer = buf; return s;
    }
    function env(g, t, attack, peak, decay) {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    }
    function tone(c, freq, t, peak, decay) {
      var o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      env(g, t, 0.01, peak, decay);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + decay + 0.1);
    }
    return {
      get: function () { return enabled; },
      set: function (v) { enabled = !!v; lsSet(KEY, enabled ? '1' : '0'); if (enabled) ensure(); },
      scratch: function () {
        var c = ensure(); if (!c) return;
        var now = performance.now(); if (now - lastScratch < 55) return; lastScratch = now;
        var t = c.currentTime, s = noise(c, 0.05), bp = c.createBiquadFilter(), g = c.createGain();
        bp.type = 'bandpass'; bp.frequency.value = 2400 + Math.random() * 1800; bp.Q.value = 1.2;
        env(g, t, 0.004, 0.028, 0.04);
        s.connect(bp); bp.connect(g); g.connect(c.destination); s.start(t); s.stop(t + 0.06);
      },
      thud: function (k) {
        var c = ensure(); if (!c) return; k = k || 1;
        var t = c.currentTime, o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
        env(g, t, 0.004, 0.15 * k, 0.16); o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.24);
        var s = noise(c, 0.04), lp = c.createBiquadFilter(), g2 = c.createGain();
        lp.type = 'lowpass'; lp.frequency.value = 900; env(g2, t, 0.002, 0.06 * k, 0.04);
        s.connect(lp); lp.connect(g2); g2.connect(c.destination); s.start(t); s.stop(t + 0.06);
      },
      chime: function () {
        var c = ensure(); if (!c) return; var t = c.currentTime;
        tone(c, 784, t, 0.05, 0.5); tone(c, 1175, t + 0.11, 0.045, 0.6);
      },
      whoosh: function () {
        var c = ensure(); if (!c) return;
        var t = c.currentTime, s = noise(c, 0.5), bp = c.createBiquadFilter(), g = c.createGain();
        bp.type = 'bandpass'; bp.Q.value = 0.9;
        bp.frequency.setValueAtTime(500, t); bp.frequency.exponentialRampToValueAtTime(2400, t + 0.45);
        env(g, t, 0.08, 0.035, 0.38);
        s.connect(bp); bp.connect(g); g.connect(c.destination); s.start(t); s.stop(t + 0.52);
      },
      tap: function () {
        var c = ensure(); if (!c) return; var t = c.currentTime;
        tone(c, 420, t, 0.05, 0.08);
      },
      /* tiny "talking" chirp, one per couple of letters */
      blip: function (ch) {
        var c = ensure(); if (!c) return;
        var now = performance.now(); if (now - lastBlip < 38) return; lastBlip = now;
        var t = c.currentTime, o = c.createOscillator(), g = c.createGain();
        var vowel = /[aeiou]/i.test(ch || '');
        o.type = 'triangle';
        o.frequency.setValueAtTime((vowel ? 560 : 470) + Math.random() * 170, t);
        o.frequency.exponentialRampToValueAtTime((vowel ? 700 : 600) + Math.random() * 120, t + 0.05);
        env(g, t, 0.006, vowel ? 0.045 : 0.032, 0.055);
        o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.09);
      },
      unlock: function () { ensure(); }
    };
  })();

  /* ───────────────────────── spoken voice (browser speech synthesis) ───────────────────────── */
  var Voice = (function () {
    var KEY = 'arziMascotVoice_v1';
    var enabled = lsGet(KEY) !== '0';
    var ss = window.speechSynthesis, voice = null;
    function pick() {
      if (!ss || !ss.getVoices) return;
      var vs = ss.getVoices(); if (!vs || !vs.length) return;
      var prefs = [/en[-_]IN/i, /en[-_]GB/i, /en[-_]US/i, /^en/i];
      for (var i = 0; i < prefs.length && !voice; i++) {
        for (var j = 0; j < vs.length; j++) if (prefs[i].test(vs[j].lang || '')) { voice = vs[j]; break; }
      }
    }
    if (ss) { pick(); if (ss.addEventListener) ss.addEventListener('voiceschanged', pick); }
    return {
      supported: !!ss,
      get: function () { return enabled; },
      set: function (v) { enabled = !!v; lsSet(KEY, enabled ? '1' : '0'); if (!enabled) this.cancel(); },
      cancel: function () { try { if (ss) ss.cancel(); } catch (e) {} },
      say: function (text) {
        if (!enabled || !ss || !text) return;
        try {
          ss.cancel();
          var clean = String(text).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').replace(/\s+/g, ' ').trim();
          if (!clean) return;
          var u = new SpeechSynthesisUtterance(clean);
          if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'en-IN';
          u.rate = 1.02; u.pitch = 1.25; u.volume = 0.9;
          ss.speak(u);
        } catch (e) {}
      }
    };
  })();

  /* ───────────────────────── activity + lean engine ───────────────────────── */
  var act = { name: '', prio: 0, timer: null, face: false, bias: false };
  var lean = { act: { r: 0, x: 0, y: 0 }, prox: { r: 0, x: 0, y: 0 }, mood: { r: 0, x: 0, y: 0 } };
  var lastLean = '';

  function applyLean() {
    var r = lean.act.r + lean.prox.r + lean.mood.r;
    var x = lean.act.x + lean.prox.x + lean.mood.x;
    var y = lean.act.y + lean.prox.y + lean.mood.y;
    var key = r.toFixed(1) + ',' + x.toFixed(1) + ',' + y.toFixed(1);
    if (key === lastLean) return;
    lastLean = key;
    box.style.setProperty('--mp-r', r.toFixed(1) + 'deg');
    box.style.setProperty('--mp-x', x.toFixed(1) + 'px');
    box.style.setProperty('--mp-y', y.toFixed(1) + 'px');
  }
  function setActLean(l) {
    if (reduce) l = null;
    lean.act = l ? { r: l.r || 0, x: l.x || 0, y: l.y || 0 } : { r: 0, x: 0, y: 0 };
    applyLean();
  }

  function startAct(name, prio, ms, o) {
    o = o || {};
    if (act.name && prio < act.prio) return false;
    clearTimeout(act.timer);
    act.name = name; act.prio = prio;
    box.setAttribute('data-act', name);
    act.face = !!o.face;
    if (o.face) C.play(o.face, { hold: true });
    act.bias = (o.bx !== undefined || o.by !== undefined);
    C.setBias(o.bx || 0, o.by || 0);
    setActLean(o.lean || null);
    if (ms) act.timer = setTimeout(function () { endAct(name); }, ms);
    return true;
  }
  function endAct(name) {
    if (name && act.name !== name) return;
    clearTimeout(act.timer);
    var hadFace = act.face;
    act.name = ''; act.prio = 0; act.face = false; act.bias = false;
    box.removeAttribute('data-act');
    C.setBias(0, 0);
    setActLean(null);
    if (hadFace) C.play('idle');
  }

  function wiggle(frames, ms) {
    if (reduce) return;
    bodyParts().forEach(function (n) {
      if (n.animate) n.animate(frames, { duration: ms, easing: 'ease-in-out' });
    });
  }
  function nod() {
    wiggle([{ transform: 'translateY(0)' }, { transform: 'translateY(4px)' }, { transform: 'translateY(-1px)' }, { transform: 'translateY(3px)' }, { transform: 'translateY(0)' }], 640);
  }
  function shake() {
    wiggle([{ transform: 'rotate(0)' }, { transform: 'rotate(-7deg)' }, { transform: 'rotate(6deg)' }, { transform: 'rotate(-5deg)' }, { transform: 'rotate(3deg)' }, { transform: 'rotate(0)' }], 620);
  }
  function giggleShake() {
    var f = [];
    for (var i = 0; i < 9; i++) f.push({ transform: 'rotate(' + (i % 2 ? 6 : -6) + 'deg) translateY(' + (i % 2 ? -2 : 1) + 'px)' });
    f.push({ transform: 'rotate(0)' });
    wiggle(f, 900);
  }

  /* ───────────────────────── 1. Ink Inspector ───────────────────────── */
  var inkTimer = null, verdictAt = {};
  function readInk() {
    var real = $('toggleInkRealism'), pr = $('togglePressure'), bl = $('toggleInkBleed'), it = $('realismIntensity');
    var I = it ? +it.value : 40;
    if (!real || !real.checked) return 'off';
    if (I > 72) return 'heavy';
    if (I < 12) return 'faint';
    if ((pr && pr.checked) || (bl && bl.checked)) return 'natural';
    return 'plain';
  }
  function inkTouch() {
    if (C.isQuiet()) return;
    var d = dirTo($('paper'));
    var ok = startAct('inspect', 3, 0, {
      face: 'squint', bx: d.x * 5, by: d.y * 3,
      lean: { r: d.x * 8, x: d.x * 3, y: d.y * 2 }
    });
    if (!ok) return;
    clearTimeout(inkTimer);
    inkTimer = setTimeout(inkVerdict, 950);
  }
  function inkVerdict() {
    var v = readInk(), now = Date.now();
    if (v === 'natural') {
      startAct('thumb', 3, 1900, { face: 'happy' });
      nod();
      if (!verdictAt.natural || now - verdictAt.natural > 20000) {
        verdictAt.natural = now;
        say('That reads like a real pen — nicely natural.', 3200);
      }
    } else if (v === 'heavy') {
      endAct('inspect');
      shake();
      if (!verdictAt.heavy || now - verdictAt.heavy > 20000) {
        verdictAt.heavy = now;
        say('A touch heavy — real pens rarely look this uneven.', 3600);
      }
    } else {
      endAct('inspect');
    }
  }
  function initInk() {
    ['toggleInkRealism', 'realismIntensity', 'toggleInkBleed', 'togglePressure'].forEach(function (id) {
      on($(id), 'input', inkTouch);
      on($(id), 'change', inkTouch);
    });
    on($('realismReseed'), 'click', inkTouch);
  }

  /* ───────────────────────── 2. Handwriting Mimic ───────────────────────── */
  var writeRest = null, scribble = 0, writing = false;
  var TEXT_SEL = '.form-pane textarea, .form-pane input[type="text"], .form-pane input[type="number"], #fontSize';
  function scribbleStep() {
    var p1 = q1('.mp-sc1'), p2 = q1('.mp-sc2');
    if (!p1 || !p2) return;
    scribble += 7;
    if (scribble <= 100) { p1.style.strokeDashoffset = String(100 - scribble); }
    else if (scribble <= 200) { p1.style.strokeDashoffset = '0'; p2.style.strokeDashoffset = String(200 - scribble); }
    else {
      p1.style.transition = p2.style.transition = 'none';
      p1.style.strokeDashoffset = p2.style.strokeDashoffset = '100';
      void p1.getBoundingClientRect();
      p1.style.transition = p2.style.transition = '';
      scribble = 7; p1.style.strokeDashoffset = String(100 - scribble);
    }
  }
  function quillKick() {
    var qv = q1('.mp-quill svg');
    if (!qv || reduce || !qv.animate) return;
    qv.animate([
      { transform: 'rotate(0deg) translate(0,0)' },
      { transform: 'rotate(-10deg) translate(-2px,1px)' },
      { transform: 'rotate(3deg) translate(1px,0)' },
      { transform: 'rotate(0deg) translate(0,0)' }
    ], { duration: 105 + Math.random() * 55, easing: 'ease-out' });
  }
  function onType(e) {
    var t = e.target;
    if (!t || !t.matches || !t.matches(TEXT_SEL)) return;
    if (C.isQuiet()) return;
    if (!writing) {
      var s = sideSign();
      if (!startAct('write', 3, 0, { face: 'writing', bx: s * 4, by: 5 })) return;
      writing = true; scribble = 0;
    } else if (act.name === 'write' && C.face() !== 'writing') {
      C.play('writing', { hold: true });
    }
    if (act.name !== 'write') { writing = false; return; }
    quillKick(); scribbleStep(); Snd.scratch();
    clearTimeout(writeRest);
    writeRest = setTimeout(endWrite, 750);
  }
  function endWrite() {
    writing = false;
    var s1 = q1('.mp-sc1'), s2 = q1('.mp-sc2');
    endAct('write');
    setTimeout(function () { if (s1) s1.style.strokeDashoffset = '100'; if (s2) s2.style.strokeDashoffset = '100'; scribble = 0; }, 400);
  }

  /* ───────────────────────── 3. Signature Guard ───────────────────────── */
  var sigGroup = null, sigReleaseTimer = null, lastSigSrc = null;
  function sigOpen() {
    if (C.isQuiet()) return;
    var d = dirTo(sigGroup);
    var ok = startAct('stamp', 2, 0, { face: 'solemn', bx: d.x * 4, by: d.y * 3, lean: { r: d.x * 6, x: d.x * 2, y: d.y * 2 } });
    clearTimeout(sigReleaseTimer);
    sigReleaseTimer = setTimeout(function () { endAct('stamp'); }, 9000);
    if (ok && once('sig-hint') && !C.seen('mp-sig-hint')) {
      C.mark('mp-sig-hint');
      say('Signature box — I will stamp it onto the letter once it is placed.', 3600);
    }
  }
  function sigClose() { clearTimeout(sigReleaseTimer); sigReleaseTimer = setTimeout(function () { endAct('stamp'); }, 1400); }

  function paperSigTarget() {
    var s = document.querySelector('#paper .sig-img') || document.querySelector('#paper .sig-line') || $('paper');
    return s ? visibleRect(s) : null;
  }
  function stampOnto(img) {
    var quiet = C.isQuiet();
    var target = visibleRect(img);
    var d = dirTo(img);
    startAct('stamp-hit', 4, 760, {
      face: quiet ? null : 'happy',
      lean: { r: d.x * 7, x: d.x * 9, y: d.y * 8 }
    });
    setTimeout(function () {
      Snd.thud(1);
      if (!target.onScreen) { say('Signature placed on the letter.', 2600); return; }
      var r = target.rect;
      var el = document.createElement('div');
      el.className = 'mp-impact';
      el.textContent = 'Received';
      el.style.setProperty('--ix', Math.round(r.left + r.width / 2) + 'px');
      el.style.setProperty('--iy', Math.round(r.top + r.height / 2) + 'px');
      body.appendChild(el);
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1700);
      if (!quiet) { wiggle([{ transform: 'translateY(0)' }, { transform: 'translateY(2px)' }, { transform: 'translateY(0)' }], 220); }
    }, reduce ? 0 : 290);
  }
  function watchSignature() {
    var paper = $('paper');
    if (!paper || !window.MutationObserver) return;
    var queued = false;
    var mo = new MutationObserver(function () {
      if (queued) return; queued = true;
      requestAnimationFrame(function () {
        queued = false;
        var img = paper.querySelector('.sig-img');
        var src = img ? img.getAttribute('src') : null;
        if (src && src !== lastSigSrc) {
          lastSigSrc = src;
          if (img.complete) stampOnto(img); else img.addEventListener('load', function () { stampOnto(img); }, { once: true });
        } else if (!src) { lastSigSrc = null; }
      });
    });
    mo.observe(paper, { childList: true, subtree: true });
  }
  function initSignature() {
    var up = $('sigUpload');
    sigGroup = up ? (up.closest ? up.closest('.field-group') : up.parentNode) : null;
    if (sigGroup) {
      on(sigGroup, 'focusin', sigOpen);
      on(sigGroup, 'click', sigOpen);
      on(sigGroup, 'focusout', function (e) { if (!e.relatedTarget || !sigGroup.contains(e.relatedTarget)) sigClose(); });
      on(sigGroup, 'mouseleave', sigClose);
    }
    var wrap = $('sigCropWrap');
    if (wrap && window.MutationObserver) {
      new MutationObserver(function () { if (wrap.style.display !== 'none') sigOpen(); }).observe(wrap, { attributes: true, attributeFilter: ['style'] });
    }
    ['sigCropUse', 'sigCropCancel'].forEach(function (id) { on($(id), 'click', sigClose); });
    watchSignature();

    /* export = crisp stamp thud */
    ['export-image', 'export-pdf'].forEach(function (id) {
      on($(id), 'click', function () {
        startAct('stamp-hit', 4, 700, { lean: { r: 0, x: 0, y: 5 } });
        setTimeout(function () { Snd.thud(1); }, reduce ? 0 : 290);
      });
    });
  }

  /* ───────────────────────── 4. Contextual reasons ───────────────────────── */
  var REASONS = [
    { re: /medical/i,                 mood: 'medical', face: 'gentle',  msg: 'Take care of your health first.' },
    { re: /witness|court/i,           mood: 'court',   face: 'solemn',  msg: 'Duty calls — ensuring formal grounds are clean.' },
    { re: /bereave|emergency/i,       mood: 'bow',     face: 'bow',     quiet: true },
    { re: /urgent|urgency|unforeseen/i, mood: 'urgent', face: 'alert' }
  ];
  var reasonMood = null, night = false, moodChosen = false;

  function refreshBaseFace() {
    C.setMood(reasonMood ? reasonMood.face : (night ? 'relaxed' : null));
  }
  function applyMood(m, announce) {
    var wasQuiet = C.isQuiet();
    reasonMood = m || null;
    if (reasonMood) box.setAttribute('data-mood', reasonMood.mood); else box.removeAttribute('data-mood');
    var quiet = !!(reasonMood && reasonMood.quiet);
    C.setQuiet(quiet);
    lean.mood = quiet ? { r: 0, x: 0, y: 2.5 } : { r: 0, x: 0, y: 0 };
    if (quiet) { endAct(act.name); }
    applyLean();
    refreshBaseFace();
    C.play('idle');
    if (!announce || !reasonMood) return;
    if (reasonMood.mood === 'court') {
      box.setAttribute('data-tap', '0'); void box.offsetWidth; box.setAttribute('data-tap', '1');
      startAct('salute', 1, 1300);
      if (!reduce) setTimeout(Snd.tap, 350);
      setTimeout(Snd.thud, reduce ? 0 : 520, 0.5);
      setTimeout(function () { if (act.name === 'salute') endAct('salute'); }, 1300);
    }
    if (reasonMood.msg) say(reasonMood.msg, 3800);
    if (wasQuiet && !quiet) C.play('idle');
  }
  function currentReasonMood() {
    var sel = $('reasonPreset'); if (!sel || sel.value === 'custom') return null;
    for (var i = 0; i < REASONS.length; i++) if (REASONS[i].re.test(sel.value)) return REASONS[i];
    return null;
  }
  function reasonVisible() {
    var f = $('reasonField'); return !!f && f.style.display !== 'none';
  }
  function initReasons() {
    on($('reasonPreset'), 'change', function () {
      moodChosen = true;
      applyMood(reasonVisible() ? currentReasonMood() : null, true);
    });
    on($('leaveType'), 'change', function (e) {
      var type = e.target.value;
      setTimeout(function () {
        if (moodChosen) applyMood(reasonVisible() ? currentReasonMood() : null, false);
        if (C.isQuiet()) return;
        if (type === 'casualN') {
          startAct('sun', 1, 1700, { face: 'relaxed' });
        } else if (type === 'casual1' || type === 'halfday' || type === 'stationLeave') {
          startAct('sigh', 1, 2200, { face: 'relaxed' });
        }
      }, 60);
    });
  }

  /* ───────────────────────── 5. Drag & drop catch ───────────────────────── */
  var dragDepth = 0, dragging = false;
  function hasFiles(e) {
    var t = e.dataTransfer && e.dataTransfer.types;
    if (!t) return false;
    for (var i = 0; i < t.length; i++) if (t[i] === 'Files') return true;
    return false;
  }
  function dragStart() {
    if (dragging) return;
    dragging = true;
    body.classList.add('mp-dragging');
    if (sigGroup) sigGroup.classList.add('mp-drop-ready');
    startAct('catch', 5, 0, { face: 'catch', by: -7, lean: { r: 0, x: 0, y: -2 } });
  }
  function dragStop() {
    dragging = false; dragDepth = 0;
    body.classList.remove('mp-dragging');
    if (sigGroup) sigGroup.classList.remove('mp-drop-ready', 'mp-drop-hot');
    if (act.name === 'catch') endAct('catch');
  }
  function feedUpload(file) {
    var inp = $('sigUpload');
    try {
      var dt = new DataTransfer(); dt.items.add(file);
      inp.files = dt.files;
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (err) {
      if (typeof openCropper === 'function') {
        var rd = new FileReader();
        rd.onload = function (ev) { openCropper(ev.target.result); };
        rd.readAsDataURL(file);
        return true;
      }
    }
    return false;
  }
  function slideOntoDocument(file, x, y) {
    var url = null;
    try { url = URL.createObjectURL(file); } catch (e) {}
    if (reduce || !url || !document.body.animate) { dragStop(); if (url) URL.revokeObjectURL(url); return; }
    var c = C.center(), hx = c.x, hy = c.y - 38;
    var tgt = paperSigTarget() || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    var g = document.createElement('div');
    g.className = 'mp-ghost';
    g.style.backgroundImage = 'url("' + url + '")';
    body.appendChild(g);
    function T(px, py, s, r) { return 'translate(' + px + 'px,' + py + 'px) translate(-50%,-50%) rotate(' + r + 'deg) scale(' + s + ')'; }
    var a1 = g.animate([{ transform: T(x, y, 1.1, -6) }, { transform: T(hx, hy, .8, 0) }], { duration: 320, easing: 'cubic-bezier(.3,.8,.3,1)', fill: 'forwards' });
    a1.onfinish = function () {
      C.play('happy'); nod(); Snd.tap();
      var a2 = g.animate([
        { transform: T(hx, hy, .8, 0), opacity: 1 },
        { transform: T(hx, hy - 8, .8, 0), opacity: 1, offset: .22 },
        { transform: T(tgt.x, tgt.y, .5, 4), opacity: 0 }
      ], { duration: 640, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
      a2.onfinish = function () {
        if (g.parentNode) g.parentNode.removeChild(g);
        try { URL.revokeObjectURL(url); } catch (e) {}
        dragStop();
      };
    };
  }
  function onDrop(e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    var files = e.dataTransfer.files, file = null;
    for (var i = 0; files && i < files.length; i++) if (files[i].type && files[i].type.indexOf('image/') === 0) { file = files[i]; break; }
    if (!file) {
      dragStop();
      say('I can only catch image files — a photo or scan of your signature.', 4200, true);
      return;
    }
    dragDepth = 0;
    if (feedUpload(file)) slideOntoDocument(file, e.clientX, e.clientY);
    else dragStop();
  }
  function initDrop() {
    on(document, 'dragenter', function (e) { if (!hasFiles(e)) return; dragDepth++; dragStart(); });
    on(document, 'dragover', function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      try { e.dataTransfer.dropEffect = 'copy'; } catch (err) {}
      C.pointerTo(e.clientX, e.clientY);
      if (sigGroup) sigGroup.classList.toggle('mp-drop-hot', sigGroup.contains(e.target));
    });
    on(document, 'dragleave', function (e) {
      if (!hasFiles(e)) return;
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) dragStop();
    });
    on(document, 'drop', onDrop);
    on(document, 'dragend', dragStop);
  }

  /* ───────────────────────── 6. Clear desk (paper airplane) ───────────────────────── */
  var clearBusy = false, snapshot = null, undoTimer = null;
  function formControls() {
    return Array.prototype.slice.call(document.querySelectorAll('.form-pane input, .form-pane select, .form-pane textarea')).filter(function (n) {
      var t = (n.type || '').toLowerCase();
      return t !== 'file' && t !== 'button' && t !== 'submit' && t !== 'reset' && n.id !== 'sigSizeSlider' && !/^sig(Transparent|InkLevel|InkColor|AutoTrim|LiveOn)$/.test(n.id);
    });
  }
  function takeSnapshot() {
    return {
      vals: formControls().map(function (n) { return { n: n, v: n.value, c: n.checked }; }),
      sig: (typeof signatureDataUrl !== 'undefined') ? signatureDataUrl : null
    };
  }
  function afterValues() {
    var lt = $('leaveType');
    if (typeof toggleFieldsForType === 'function' && lt) toggleFieldsForType(lt.value);
    var a = $('addresseeCustomField'), ap = $('addresseePreset');
    if (a && ap) a.style.display = ap.value === 'custom' ? '' : 'none';
    var d = $('designationCustomField'), dp = $('designationPreset');
    if (d && dp) d.style.display = dp.value === 'custom' ? '' : 'none';
    if (typeof initDefaultDates === 'function') initDefaultDates();
  }
  function finishRender() {
    if (typeof render === 'function') render();
    document.dispatchEvent(new Event('input'));
  }
  function performClear() {
    formControls().forEach(function (n) {
      var t = (n.type || '').toLowerCase();
      if (n.tagName === 'SELECT') {
        var idx = 0;
        for (var i = 0; i < n.options.length; i++) if (n.options[i].defaultSelected) { idx = i; break; }
        n.selectedIndex = idx;
      } else if (t === 'checkbox' || t === 'radio') { n.checked = n.defaultChecked; }
      else { n.value = n.defaultValue; }
    });
    afterValues();
    var wrap = $('sigCropWrap');
    if (wrap && wrap.style.display !== 'none' && $('sigCropCancel')) $('sigCropCancel').click();
    if (typeof setCurrentSignature === 'function') setCurrentSignature(null);
    moodChosen = false; applyMood(null, false);
    finishRender();
  }
  function restoreSnapshot(s) {
    s.vals.forEach(function (r) {
      var n = r.n, t = (n.type || '').toLowerCase();
      if (t === 'checkbox' || t === 'radio') n.checked = r.c; else n.value = r.v;
    });
    afterValues();
    if (s.sig && typeof setCurrentSignature === 'function') setCurrentSignature(s.sig);
    finishRender();
  }
  function setUndo(on_) {
    var btn = $('arzi-clear-desk'); if (!btn) return;
    clearTimeout(undoTimer);
    if (on_) {
      btn.textContent = 'Undo clear'; btn.classList.add('mp-undo');
      undoTimer = setTimeout(function () { setUndo(false); snapshot = null; }, 12000);
    } else { btn.textContent = 'Clear desk'; btn.classList.remove('mp-undo'); }
  }
  function launchPlane() {
    if (reduce || !document.body.animate) return;
    var c = C.center(), s = sideSign();
    var sx = c.x + s * 34, sy = c.y - 4;
    var p = document.createElement('div');
    p.className = 'mp-plane';
    p.innerHTML = '<svg viewBox="0 0 38 30"><path d="M2 14 L36 2 L24 28 L18 18 Z" fill="#fbf7ea" stroke="#9a9078" stroke-width="1.2" stroke-linejoin="round"/><path d="M18 18 L36 2" stroke="#9a9078" stroke-width="1" fill="none"/><path d="M2 14 L18 18" stroke="#c9bfa5" stroke-width="1" fill="none"/></svg>';
    body.appendChild(p);
    function T(dx, dy, r, sc) { return 'translate(' + (sx + dx) + 'px,' + (sy + dy) + 'px) translate(-50%,-50%) rotate(' + r + 'deg) scale(' + sc + ')'; }
    var top = -(sy + 160);
    var a = p.animate([
      { transform: T(0, 0, 8, .85), opacity: 1 },
      { transform: T(-70, -60, 24, 1), opacity: 1, offset: .22 },
      { transform: T(-210, -190, 30, 1), opacity: 1, offset: .55 },
      { transform: T(-480, top, 14, .7), opacity: 1 }
    ], { duration: 1250, easing: 'cubic-bezier(.35,.1,.5,1)', fill: 'forwards' });
    a.onfinish = function () { if (p.parentNode) p.parentNode.removeChild(p); };
  }
  function clearDesk() {
    var btn = $('arzi-clear-desk');
    if (clearBusy) return;
    if (snapshot) { var s = snapshot; snapshot = null; setUndo(false); restoreSnapshot(s); say('Restored — your desk is back as it was.', 2800, true); return; }
    clearBusy = true;
    snapshot = takeSnapshot();
    var animated = !C.isQuiet() && !reduce;
    function finish() {
      clearBusy = false; setUndo(true);
      say('Desk cleared. Use “Undo clear” if that was a slip.', 3600, true);
      if (!C.isQuiet()) C.play('happy');
    }
    if (animated) {
      startAct('fold', 5, 900, { face: 'thinking' });
      setTimeout(function () { performClear(); launchPlane(); Snd.whoosh(); }, 650);
      setTimeout(finish, 1000);
    } else {
      performClear(); finish();
    }
    if (btn) btn.blur();
  }

  /* ───────────────────────── 7. Mouse play ───────────────────────── */
  var pokes = [], tickleStep = 0, mouse = { x: -999, y: -999 }, mouseQueued = false;
  function updateProximity() {
    mouseQueued = false;
    var c = C.center();
    var dx = mouse.x - c.x, dy = mouse.y - c.y, d = Math.sqrt(dx * dx + dy * dy);
    var p = { r: 0, x: 0, y: 0 };
    if (!reduce && !C.isQuiet() && d < 50) {
      var k = 1 - d / 50;
      p = { r: clamp(dx / 50, -1, 1) * 9 * (0.4 + k), x: clamp(dx / 50, -1, 1) * 2, y: clamp(dy / 50, -1, 1) * 1.5 };
    }
    lean.prox = p; applyLean();
  }
  function onPoke() {
    var now = Date.now();
    pokes = pokes.filter(function (t) { return now - t < 1100; });
    pokes.push(now);
    if (pokes.length < 3) return false;
    pokes = [];
    if (C.isQuiet()) { nod(); return true; }
    var step = tickleStep++ % 3;
    var c = C.center(), dir = c.x > window.innerWidth / 2 ? -1 : 1;
    if (step === 0) {
      startAct('giggle', 4, 1500, { face: 'giggle' });
      giggleShake(); say('Hehe — that tickles!', 1800);
    } else if (step === 1) {
      startAct('dodge', 4, 950, { face: 'giggle', lean: { r: -7 * dir, x: dir * 26, y: -4 } });
      say('Missed me!', 1500);
    } else {
      startAct('balance', 4, 2600, { face: 'happy' });
      say('Ta-da! One-leg balance — and back to duty.', 2400);
    }
    return true;
  }
  function initMouse() {
    on(window, 'mousemove', function (e) {
      mouse.x = e.clientX; mouse.y = e.clientY;
      if (!mouseQueued) { mouseQueued = true; requestAnimationFrame(updateProximity); }
    }, { passive: true });
    on(document, 'mouseleave', function () { mouse.x = mouse.y = -999; updateProximity(); });
    setInterval(function () {
      var c = C.center(), cur = box.getAttribute('data-side');
      var want = cur === 'l' ? (c.x > window.innerWidth / 2 - 40 ? 'l' : 'r') : (c.x > window.innerWidth / 2 + 40 ? 'l' : 'r');
      if (want !== cur) box.setAttribute('data-side', want);
      if (act.name === '' && !C.isQuiet()) updateProximity();
    }, 250);
    box.setAttribute('data-side', C.center().x > window.innerWidth / 2 ? 'l' : 'r');
  }

  /* ───────────────────────── 8. Night ambience + completion chime ───────────────────────── */
  var nightTimer = null, yawnTimer = null, nightMode = 'auto';
  function isLate() {
    var m = /[?&]mascotNight=(1|0)\b/.exec(location.search);
    if (m) return m[1] === '1';
    if (nightMode === 'night') return true;
    if (nightMode === 'day') return false;
    var h = new Date().getHours();
    return h >= 19 || h < 7;
  }
  function scheduleNightYawn() {
    clearTimeout(yawnTimer);
    if (!night) return;
    yawnTimer = setTimeout(function () {
      if (night && !C.isQuiet() && !act.name && (C.face() === 'idle' || C.face() === 'sleepy')) C.play('yawn');
      scheduleNightYawn();
    }, 30000 + Math.random() * 25000);
  }
  function applyNight(on_, announce) {
    if (night === on_) return;
    night = on_;
    if (night) box.setAttribute('data-night', '1'); else box.removeAttribute('data-night');
    C.setBubbleGap(night ? 38 : 24);
    refreshBaseFace(); C.play('idle');
    scheduleNightYawn();
    if (night && announce && !C.isQuiet() && !C.seen('mp-night-nudge')) {
      C.mark('mp-night-nudge');
      setTimeout(function () {
        if (C.isQuiet()) return;
        C.play('yawn');
        say("Working late? Let's get this leave draft sorted quickly.", 5200);
      }, 2600);
    }
  }
  function initNight() {
    applyNight(isLate(), true);
    nightTimer = setInterval(function () { applyNight(isLate(), true); }, 5 * 60 * 1000);
  }

  var wasComplete = null, chimeTimer = null;
  function checkComplete() {
    var s; try { s = C.stats(); } catch (e) { return; }
    var done = s.total > 0 && s.filled >= s.total;
    if (wasComplete === null) { wasComplete = done; return; }
    if (done && !wasComplete) { Snd.chime(); }
    wasComplete = done;
  }
  function initCompletion() {
    setTimeout(checkComplete, 1200);
    var h = function () { clearTimeout(chimeTimer); chimeTimer = setTimeout(checkComplete, 350); };
    on(document, 'input', h); on(document, 'change', h);
  }

  /* ───────────────────────── header controls ───────────────────────── */
  function initControls() {
    var s = $('arzi-sound-toggle'), v = $('arzi-voice-toggle');
    function paint() {
      if (s) { s.setAttribute('aria-pressed', Snd.get() ? 'true' : 'false'); s.innerHTML = '&#9834; Sound: ' + (Snd.get() ? 'on' : 'off'); }
      if (v) {
        v.setAttribute('aria-pressed', Voice.get() ? 'true' : 'false');
        v.innerHTML = '&#128483; Voice: ' + (Voice.get() ? 'on' : 'off');
        if (!Voice.supported) { v.disabled = true; v.title = 'This browser has no built-in voice'; v.innerHTML = '&#128483; Voice: n/a'; }
      }
    }
    on(s, 'click', function () { Snd.set(!Snd.get()); paint(); if (Snd.get()) Snd.chime(); });
    on(v, 'click', function () { Voice.set(!Voice.get()); paint(); if (Voice.get()) Voice.say('Hello! I am Arzi.'); });
    paint();

    /* browsers only allow sound after the first click / key press */
    function unlock() { Snd.unlock(); }
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { document.addEventListener(ev, unlock, { once: true, capture: true }); });

    /* the bubble tells us when the bot starts talking */
    document.addEventListener('arzi-speak', function (e) {
      var d = e.detail || {};
      if (d.phase === 'start') Voice.say(d.text);
      else if (d.phase === 'tick') { if (d.ch && /\S/.test(d.ch)) Snd.blip(d.ch); }
      else if (d.phase === 'cancel') Voice.cancel();
    });
    on($('arzi-clear-desk'), 'click', clearDesk);
  }

  /* ───────────────────────── boot ───────────────────────── */
  guard('controls', initControls);
  guard('ink', initInk);
  guard('writing', function () { on(document, 'input', onType); });
  guard('signature', initSignature);
  guard('reasons', initReasons);
  guard('drop', initDrop);
  guard('mouse', initMouse);
  guard('night', initNight);
  guard('completion', initCompletion);

  window.arziMascotPro = {
    onPoke: onPoke,
    clearDesk: clearDesk,
    sound: { get: Snd.get, set: function (v) { Snd.set(v); var s = $('arzi-sound-toggle'); if (s) { s.setAttribute('aria-pressed', v ? 'true' : 'false'); s.innerHTML = '&#9834; Sound: ' + (v ? 'on' : 'off'); } } },
    voice: { get: Voice.get, set: function (v) { Voice.set(v); var b = $('arzi-voice-toggle'); if (b) { b.setAttribute('aria-pressed', v ? 'true' : 'false'); b.innerHTML = '&#128483; Voice: ' + (v ? 'on' : 'off'); } } },
    /* 'night' | 'day' | 'auto' — handy for testing the after-hours ambience */
    setTimeOfDay: function (mode) { nightMode = mode || 'auto'; applyNight(isLate(), true); },
    /* act directly on the stamp / inspector for demos & tests */
    stampOnto: stampOnto,
    inspectInk: inkTouch
  };
})();
