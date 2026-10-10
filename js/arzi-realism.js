/**
 * Arzi — Realism Controller
 * ------------------------------------------------
 * Wires the noise engine to the editor UI and export pipeline.
 * Works with your existing Quill editor + html2canvas + jsPDF setup.
 *
 * Include AFTER arzi-noise.js and AFTER Quill is initialised.
 *
 * Expected DOM ids (already present in your editor.html):
 *   #toggleInkRealism, #lineHeightInput, #letterSpacingInput,
 *   #canvasWrapper, #editor-body, #pageStats, #textStats
 *
 * Optional new controls (added by the CSS/HTML patch):
 *   #realismIntensity, #realismSeed, #toggleInkBleed, #togglePressure
 */
(function (global) {
  'use strict';

  var DEFAULTS = {
    intensity: 0.45,
    seedKey: 'arzi_realism_seed',
    intensityKey: 'arzi_realism_intensity',
    enabledKey: 'arzi_realism_enabled'
  };

  function $(id) { return document.getElementById(id); }

  function loadState() {
    var enabled = false;
    var intensity = DEFAULTS.intensity;
    var seed = null;
    try {
      enabled = localStorage.getItem(DEFAULTS.enabledKey) === '1';
      var i = parseFloat(localStorage.getItem(DEFAULTS.intensityKey));
      if (!isNaN(i)) intensity = Math.max(0, Math.min(1, i));
      seed = localStorage.getItem(DEFAULTS.seedKey) || null;
    } catch (e) {}
    if (!seed) seed = 'arzi-' + Date.now().toString(36);
    return { enabled: enabled, intensity: intensity, seed: seed };
  }

  function saveState(state) {
    try {
      localStorage.setItem(DEFAULTS.enabledKey, state.enabled ? '1' : '0');
      localStorage.setItem(DEFAULTS.intensityKey, String(state.intensity));
      localStorage.setItem(DEFAULTS.seedKey, state.seed);
    } catch (e) {}
  }

  /**
   * Create the controller.
   * @param {object} options
   * @param {object} options.quill       Quill instance
   * @param {function} [options.getExportClone]  optional custom clone builder
   */
  function create(options) {
    options = options || {};
    var quill = options.quill;
    var state = loadState();
    var noise = null;

    function rebuildNoise() {
      if (!global.ArziNoise) {
        console.warn('[ArziRealism] ArziNoise not loaded');
        return;
      }
      noise = global.ArziNoise.create({
        seed: state.seed,
        intensity: state.enabled ? state.intensity : 0
      });
    }
    rebuildNoise();

    /* ---- Live preview (subtle, non-destructive on Quill content) ---- */
    function applyLivePreview() {
      var ed = document.querySelector('#editor-body .ql-editor');
      if (!ed) return;

      // Remove previous live class
      ed.classList.toggle('arzi-ink-live', state.enabled);

      if (state.enabled) {
        // Light global tilt + pressure feel (cheap, keeps typing smooth)
        ed.style.setProperty('--arzi-ink-tilt', (0.15 + state.intensity * 0.25).toFixed(2) + 'deg');
        ed.style.setProperty('--arzi-ink-weight', String(Math.round(400 + state.intensity * 80)));
        ed.style.setProperty('--arzi-ink-tracking', (state.intensity * 0.35).toFixed(2) + 'px');
      } else {
        ed.style.removeProperty('--arzi-ink-tilt');
        ed.style.removeProperty('--arzi-ink-weight');
        ed.style.removeProperty('--arzi-ink-tracking');
      }

      // Optional ink-bleed / pressure classes on wrapper
      var wrapper = $('canvasWrapper');
      if (wrapper) {
        wrapper.classList.toggle('arzi-ink-bleed', state.enabled && !!($('toggleInkBleed') && $('toggleInkBleed').checked));
        wrapper.classList.toggle('arzi-ink-pressure', state.enabled && !!($('togglePressure') && $('togglePressure').checked));
        wrapper.classList.toggle('arzi-realism-on', state.enabled);
      }
    }

    /**
     * Apply full word-level noise to a cloned DOM node used for export.
     * Call this on the off-screen clone BEFORE html2canvas.
     */
    function enhanceExportClone(cloneRoot) {
      if (!state.enabled || !noise || !global.ArziNoise) return cloneRoot;

      // Rebuild with current intensity so export matches slider
      var exportNoise = global.ArziNoise.create({
        seed: state.seed,
        intensity: state.intensity
      });

      try {
        global.ArziNoise.applyToDOM(cloneRoot, exportNoise);
      } catch (err) {
        console.warn('[ArziRealism] applyToDOM failed', err);
      }

      // Extra visual polish on the clone
      cloneRoot.classList.add('arzi-export-realism');
      if ($('toggleInkBleed') && $('toggleInkBleed').checked) {
        cloneRoot.classList.add('arzi-ink-bleed');
      }
      if ($('togglePressure') && $('togglePressure').checked) {
        cloneRoot.classList.add('arzi-ink-pressure');
      }
      return cloneRoot;
    }

    /* ---- Wire UI controls ---- */
    function bindUI() {
      var toggle = $('toggleInkRealism');
      if (toggle) {
        toggle.checked = state.enabled;
        toggle.addEventListener('change', function () {
          state.enabled = toggle.checked;
          rebuildNoise();
          applyLivePreview();
          saveState(state);
        });
      }

      var intensitySlider = $('realismIntensity');
      if (intensitySlider) {
        intensitySlider.value = String(Math.round(state.intensity * 100));
        intensitySlider.addEventListener('input', function () {
          state.intensity = Math.max(0, Math.min(1, parseInt(intensitySlider.value, 10) / 100));
          rebuildNoise();
          applyLivePreview();
          saveState(state);
          var label = $('realismIntensityLabel');
          if (label) label.textContent = Math.round(state.intensity * 100) + '%';
        });
      }

      var seedBtn = $('realismReseed');
      if (seedBtn) {
        seedBtn.addEventListener('click', function () {
          state.seed = 'arzi-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
          rebuildNoise();
          applyLivePreview();
          saveState(state);
        });
      }

      ['toggleInkBleed', 'togglePressure'].forEach(function (id) {
        var el = $(id);
        if (el) {
          el.addEventListener('change', function () {
            applyLivePreview();
          });
        }
      });

      // Keep live preview in sync when spacing changes
      ['lineHeightInput', 'letterSpacingInput'].forEach(function (id) {
        var el = $(id);
        if (el) el.addEventListener('change', applyLivePreview);
      });
    }

    // Public API
    var api = {
      getState: function () { return Object.assign({}, state); },
      setEnabled: function (v) {
        state.enabled = !!v;
        var t = $('toggleInkRealism');
        if (t) t.checked = state.enabled;
        rebuildNoise();
        applyLivePreview();
        saveState(state);
      },
      setIntensity: function (v) {
        state.intensity = Math.max(0, Math.min(1, v));
        rebuildNoise();
        applyLivePreview();
        saveState(state);
      },
      reseed: function () {
        state.seed = 'arzi-' + Date.now().toString(36);
        rebuildNoise();
        applyLivePreview();
        saveState(state);
      },
      enhanceExportClone: enhanceExportClone,
      applyLivePreview: applyLivePreview,
      getNoise: function () { return noise; }
    };

    // Init
    bindUI();
    applyLivePreview();

    return api;
  }

  global.ArziRealism = { create: create, DEFAULTS: DEFAULTS };
})(typeof window !== 'undefined' ? window : globalThis);
