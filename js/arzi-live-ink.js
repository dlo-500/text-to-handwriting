/* ═══════════════════════════════════════════════════════════════
   Arzi — Live ink preview for the letter page
   Why the controls looked dead: js/arzi-realism.js was written for the
   Quill *editor* page and only ever touched `.ql-editor` / `#canvasWrapper`.
   The letter page has neither, so Real Ink, Intensity, Bleed, Pressure and
   the dice changed nothing on screen (they only acted at export time).
   This module applies the same effects to the letter preview (#paper),
   and the export re-uses exactly what you see (WYSIWYG).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var paper = document.getElementById('paper');
  var R = window.arziRealism;
  if (!paper || !R || !window.ArziNoise) return;

  function $(id) { return document.getElementById(id); }

  /* Apply the current ink state to the freshly rendered letter. */
  function apply() {
    var st = R.getState();
    var bleed = $('toggleInkBleed'), press = $('togglePressure');
    var on = !!st.enabled && st.intensity > 0;
    paper.classList.toggle('arzi-live-ink', !!st.enabled);
    paper.classList.toggle('arzi-ink-bleed', !!st.enabled && !!(bleed && bleed.checked));
    paper.classList.toggle('arzi-ink-pressure', !!st.enabled && !!(press && press.checked));
    paper.style.setProperty('--ink-i', st.intensity.toFixed(2));
    if (on) {
      try { window.ArziNoise.applyToDOM(paper, R.getNoise()); } catch (e) { if (window.console) console.warn('[live-ink]', e); }
    }
    var wrap = document.querySelector('.arzi-realism-controls');
    if (wrap) wrap.classList.toggle('arzi-ink-off', !st.enabled);
  }

  /* render() rebuilds the letter from scratch, so re-apply the ink each time. */
  var baseRender = window.render;
  if (typeof baseRender === 'function') {
    window.render = function () {
      var out = baseRender.apply(this, arguments);
      apply();
      return out;
    };
  }

  /* The sub-controls only matter while Real Ink is on, so using one of them
     switches Real Ink on instead of silently doing nothing. */
  function touched(kind, e) {
    var st = R.getState();
    if (!st.enabled) {
      var wantsOn = kind === 'intensity' || kind === 'dice' ||
        ((kind === 'bleed' || kind === 'pressure') && e && e.target && e.target.checked);
      if (wantsOn) R.setEnabled(true);
    }
    if (typeof window.render === 'function') window.render();
  }

  function init() {
    var map = { toggleInkRealism: 'real', realismIntensity: 'intensity', toggleInkBleed: 'bleed', togglePressure: 'pressure' };
    Object.keys(map).forEach(function (id) {
      var n = $(id); if (!n) return;
      var kind = map[id];
      n.addEventListener(kind === 'intensity' ? 'input' : 'change', function (e) { touched(kind, e); });
    });
    var dice = $('realismReseed');
    if (dice) dice.addEventListener('click', function (e) { touched('dice', e); });
    if (typeof window.render === 'function') window.render(); else apply();
  }
  init();

  window.ArziLiveInk = { apply: apply };
})();
