/**
 * Arzi — Deterministic Handwriting Noise Engine
 * ------------------------------------------------
 * Seeded PRNG + per-line / per-word variation so the same text
 * always produces the same "handwriting" look (no jitter on re-render).
 *
 * Inspired by modern text-to-handwriting tools (SatvikHGupta, text2scribble).
 * Drop-in for editor.html and template.html.
 *
 * Usage:
 *   const noise = ArziNoise.create({ seed: 'my-doc', intensity: 0.55 });
 *   const lineFx  = noise.line(0);
 *   const wordFx  = noise.word(0, 3);
 */
(function (global) {
  'use strict';

  /* ---------- MurmurHash3 finalizer (fast, deterministic) ---------- */
  function murmur3(str) {
    let h = 0x811c9dc5 | 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
  }

  /* ---------- Mulberry32 PRNG from a 32-bit seed ---------- */
  function mulberry32(seed) {
    return function () {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * @param {object} opts
   * @param {string|number} [opts.seed='arzi-default']
   * @param {number} [opts.intensity=0.5]  0 = none, 1 = strong
   * @param {object} [opts.limits]         override max ranges
   */
  function create(opts) {
    opts = opts || {};
    const seedStr = String(opts.seed != null ? opts.seed : 'arzi-default');
    const intensity = Math.max(0, Math.min(1, opts.intensity != null ? opts.intensity : 0.5));

    const limits = Object.assign({
      lineSlopeDeg: 0.9,       // max line tilt in degrees
      lineYShiftPx: 2.5,       // vertical offset of whole line
      lineSizePct: 0.04,       // ± font-size variation per line
      wordRotDeg: 1.4,         // max word rotation
      wordYShiftPx: 1.8,       // baseline jitter per word
      wordXShiftPx: 0.8,       // horizontal micro-shift
      wordSizePct: 0.035,      // ± size per word
      wordSpacingPx: 1.2,      // extra letter-spacing jitter
      opacityJitter: 0.12      // ink pressure simulation
    }, opts.limits || {});

    const baseSeed = murmur3(seedStr);

    function rngFor(tag) {
      return mulberry32(murmur3(seedStr + '::' + tag) ^ baseSeed);
    }

    function range(rng, min, max) {
      return min + rng() * (max - min);
    }

    /** Per-line effects */
    function line(lineIndex) {
      const r = rngFor('line:' + lineIndex);
      const i = intensity;
      return {
        rotate: range(r, -limits.lineSlopeDeg, limits.lineSlopeDeg) * i,
        translateY: range(r, -limits.lineYShiftPx, limits.lineYShiftPx) * i,
        scale: 1 + range(r, -limits.lineSizePct, limits.lineSizePct) * i,
        opacity: 1 - range(r, 0, limits.opacityJitter * 0.5) * i
      };
    }

    /** Per-word effects (lineIndex + wordIndex) */
    function word(lineIndex, wordIndex) {
      const r = rngFor('word:' + lineIndex + ':' + wordIndex);
      const i = intensity;
      return {
        rotate: range(r, -limits.wordRotDeg, limits.wordRotDeg) * i,
        translateY: range(r, -limits.wordYShiftPx, limits.wordYShiftPx) * i,
        translateX: range(r, -limits.wordXShiftPx, limits.wordXShiftPx) * i,
        scale: 1 + range(r, -limits.wordSizePct, limits.wordSizePct) * i,
        letterSpacing: range(r, -limits.wordSpacingPx * 0.3, limits.wordSpacingPx) * i,
        opacity: 1 - range(r, 0, limits.opacityJitter) * i
      };
    }

    /** CSS transform string helpers */
    function lineStyle(fx) {
      return {
        display: 'inline-block',
        width: '100%',
        transform: 'rotate(' + fx.rotate.toFixed(3) + 'deg) translateY(' + fx.translateY.toFixed(2) + 'px) scale(' + fx.scale.toFixed(4) + ')',
        transformOrigin: 'left center',
        opacity: fx.opacity.toFixed(3)
      };
    }

    function wordStyle(fx) {
      return {
        display: 'inline-block',
        transform: 'rotate(' + fx.rotate.toFixed(3) + 'deg) translate(' + fx.translateX.toFixed(2) + 'px,' + fx.translateY.toFixed(2) + 'px) scale(' + fx.scale.toFixed(4) + ')',
        transformOrigin: 'center bottom',
        letterSpacing: fx.letterSpacing.toFixed(2) + 'px',
        opacity: fx.opacity.toFixed(3)
      };
    }

    return {
      seed: seedStr,
      intensity: intensity,
      line: line,
      word: word,
      lineStyle: lineStyle,
      wordStyle: wordStyle,
      /** Rebuild with new intensity / seed */
      withOptions: function (next) {
        return create(Object.assign({}, opts, next));
      }
    };
  }

  /**
   * Apply noise to a plain-text block by wrapping words in spans.
   * Returns an HTML string safe for innerHTML (escapes text).
   */
  function applyToPlainText(text, noiseEngine) {
    if (!text) return '';
    const esc = function (s) {
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    };

    const lines = String(text).split(/\r?\n/);
    const out = [];

    lines.forEach(function (lineText, li) {
      const lineFx = noiseEngine.line(li);
      const ls = noiseEngine.lineStyle(lineFx);
      const words = lineText.split(/(\s+)/); // keep spaces
      let wi = 0;
      const parts = words.map(function (token) {
        if (/^\s+$/.test(token) || token === '') return esc(token);
        const wf = noiseEngine.word(li, wi++);
        const ws = noiseEngine.wordStyle(wf);
        return '<span class="arzi-word" style="' +
          'display:inline-block;' +
          'transform:' + ws.transform + ';' +
          'transform-origin:center bottom;' +
          'letter-spacing:' + ws.letterSpacing + ';' +
          'opacity:' + ws.opacity + '">' + esc(token) + '</span>';
      });

      out.push(
        '<span class="arzi-line" style="' +
          'display:inline-block;width:100%;' +
          'transform:' + ls.transform + ';' +
          'transform-origin:left center;' +
          'opacity:' + ls.opacity + '">' +
          (parts.join('') || '&nbsp;') +
        '</span>'
      );
    });

    return out.join('<br>');
  }

  /**
   * Walk a DOM subtree (e.g. cloned Quill editor) and wrap text nodes
   * with noisy word spans. Mutates the clone in place.
   * Skips SCRIPT/STYLE and elements that already have .arzi-word.
   */
  function applyToDOM(root, noiseEngine) {
    if (!root || !noiseEngine) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        const tag = p.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA') return NodeFilter.FILTER_REJECT;
        if (p.classList && (p.classList.contains('arzi-word') || p.classList.contains('arzi-line'))) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    // Group by approximate "line" using offsetTop of parent
    const lineBuckets = new Map();
    textNodes.forEach(function (tn) {
      const parent = tn.parentElement;
      const top = parent ? Math.round(parent.getBoundingClientRect().top) : 0;
      if (!lineBuckets.has(top)) lineBuckets.set(top, []);
      lineBuckets.get(top).push(tn);
    });

    let lineIndex = 0;
    lineBuckets.forEach(function (nodes) {
      let wordIndex = 0;
      nodes.forEach(function (tn) {
        const text = tn.nodeValue;
        const parts = text.split(/(\s+)/);
        const frag = document.createDocumentFragment();

        parts.forEach(function (token) {
          if (token === '') return;
          if (/^\s+$/.test(token)) {
            frag.appendChild(document.createTextNode(token));
            return;
          }
          const span = document.createElement('span');
          span.className = 'arzi-word';
          const fx = noiseEngine.word(lineIndex, wordIndex++);
          const st = noiseEngine.wordStyle(fx);
          span.style.display = 'inline-block';
          span.style.transform = st.transform;
          span.style.transformOrigin = 'center bottom';
          span.style.letterSpacing = st.letterSpacing;
          span.style.opacity = st.opacity;
          span.textContent = token;
          frag.appendChild(span);
        });

        tn.parentNode.replaceChild(frag, tn);
      });
      lineIndex++;
    });
  }

  global.ArziNoise = {
    create: create,
    applyToPlainText: applyToPlainText,
    applyToDOM: applyToDOM,
    murmur3: murmur3
  };
})(typeof window !== 'undefined' ? window : globalThis);
