/**
 * Arzi Lab — geometric text layout engine
 * ---------------------------------------
 * Fast, precise helpers for reconstructing lines / columns / paragraphs
 * from pdf.js text items (or any {str,x,y,width,size} stream).
 *
 * Uses median + MAD (median absolute deviation) instead of fixed thresholds,
 * so results stay stable across font sizes and page scales.
 */
(function (global) {
  'use strict';

  function median(arr) {
    if (!arr.length) return 0;
    var a = arr.slice().sort(function (x, y) { return x - y; });
    var m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  function mad(arr, med) {
    if (med == null) med = median(arr);
    return median(arr.map(function (v) { return Math.abs(v - med); }));
  }

  /**
   * Cluster text items into reading-order lines.
   * @param {Array<{str,x,y,width?,size}>} items
   * @param {object} [opts]
   * @param {number} [opts.lineTolFactor=0.55]  MAD multiplier for same-line y tolerance
   * @returns {Array<{y,size,items,text}>}
   */
  function clusterLines(items, opts) {
    opts = opts || {};
    var factor = opts.lineTolFactor != null ? opts.lineTolFactor : 0.55;
    if (!items || !items.length) return [];

    var sizes = items.map(function (it) { return it.size || 10; });
    var medSize = median(sizes) || 10;
    // fallback tolerance if MAD is tiny (uniform text)
    var sizeMad = mad(sizes, medSize) || medSize * 0.15;
    var tol = Math.max(medSize * 0.25, sizeMad * factor * 2);

    // sort top→bottom, then left→right
    var sorted = items.slice().sort(function (a, b) {
      if (Math.abs(a.y - b.y) > tol * 0.3) return b.y - a.y;
      return a.x - b.x;
    });

    var lines = [];
    var cur = null;

    sorted.forEach(function (it) {
      if (cur && Math.abs(it.y - cur.y) <= Math.max(tol, cur.size * 0.45)) {
        cur.items.push(it);
        // running average y keeps multi-size lines stable
        cur.y = (cur.y * (cur.items.length - 1) + it.y) / cur.items.length;
        cur.size = Math.max(cur.size, it.size || 0);
      } else {
        cur = { y: it.y, size: it.size || medSize, items: [it] };
        lines.push(cur);
      }
    });

    return lines.map(function (l) {
      l.items.sort(function (a, b) { return a.x - b.x; });
      // insert spaces based on horizontal gaps
      var parts = [];
      var prevEnd = null;
      var avgSize = l.items.reduce(function (s, i) { return s + (i.size || medSize); }, 0) / l.items.length;
      l.items.forEach(function (it) {
        if (prevEnd != null) {
          var gap = it.x - prevEnd;
          if (gap > avgSize * 0.28) parts.push(' ');
        }
        parts.push(it.str);
        prevEnd = it.x + (it.width != null ? it.width : (it.str.length * (it.size || avgSize) * 0.5));
      });
      return {
        y: l.y,
        size: l.size,
        items: l.items,
        text: parts.join('').replace(/\s+/g, ' ').trim()
      };
    }).filter(function (l) { return l.text.length > 0; });
  }

  /**
   * Detect column boundaries via 1-D gap histogram on x positions.
   * @param {Array<{x,width?}>} items
   * @param {number} [gapFactor=1.8]  gap must exceed avgCharWidth * gapFactor
   * @returns {number[]} sorted split x positions (column starts)
   */
  function detectColumnBounds(items, gapFactor) {
    gapFactor = gapFactor != null ? gapFactor : 1.8;
    if (!items.length) return [0];

    var sorted = items.slice().sort(function (a, b) { return a.x - b.x; });
    var widths = sorted.map(function (it) {
      return it.width != null ? it.width : (it.str ? it.str.length * (it.size || 10) * 0.5 : 8);
    });
    var avgW = widths.reduce(function (a, b) { return a + b; }, 0) / widths.length || 8;
    var threshold = avgW * gapFactor;

    var bounds = [sorted[0].x];
    var prevEnd = sorted[0].x + widths[0];

    for (var i = 1; i < sorted.length; i++) {
      var gap = sorted[i].x - prevEnd;
      if (gap > threshold) {
        bounds.push(sorted[i].x);
      }
      prevEnd = Math.max(prevEnd, sorted[i].x + widths[i]);
    }
    return bounds;
  }

  /**
   * Split a line's items into cells using column bounds or gap threshold.
   */
  function lineToCells(lineItems, gapFactor) {
    gapFactor = gapFactor != null ? gapFactor : 1.6;
    if (!lineItems.length) return [''];
    var sorted = lineItems.slice().sort(function (a, b) { return a.x - b.x; });
    var cells = [];
    var cell = sorted[0].str;
    var prevEnd = sorted[0].x + (sorted[0].width != null ? sorted[0].width : sorted[0].str.length * 5);
    var avgSize = sorted.reduce(function (s, i) { return s + (i.size || 10); }, 0) / sorted.length;

    for (var i = 1; i < sorted.length; i++) {
      var it = sorted[i];
      var gap = it.x - prevEnd;
      if (gap > avgSize * gapFactor) {
        cells.push(cell.trim());
        cell = it.str;
      } else {
        cell += (gap > avgSize * 0.12 ? ' ' : '') + it.str;
      }
      prevEnd = it.x + (it.width != null ? it.width : it.str.length * avgSize * 0.5);
    }
    cells.push(cell.trim());
    return cells;
  }

  /**
   * Classify line role from size ratio vs body median.
   * @returns {'h1'|'h2'|'body'|'bullet'|'numbered'}
   */
  function classifyLine(text, size, bodySize) {
    var t = (text || '').trim();
    if (/^[•\-\*●▪○◦]\s+\S/.test(t)) return 'bullet';
    if (/^\d{1,3}[\.\)]\s+\S/.test(t)) return 'numbered';
    var ratio = size / (bodySize || size || 11);
    if (ratio > 1.55) return 'h1';
    if (ratio > 1.28) return 'h2';
    return 'body';
  }

  /**
   * Convert pdf.js textContent items into normalised geometry objects.
   */
  function normalisePdfItems(textContentItems) {
    return (textContentItems || [])
      .filter(function (it) { return it.str && it.str.trim().length > 0; })
      .map(function (it) {
        var t = it.transform || [1, 0, 0, 1, 0, 0];
        var size = Math.hypot(t[2], t[3]) || it.height || 10;
        var width = it.width != null ? it.width : (it.str.length * size * 0.5);
        return {
          str: it.str,
          x: t[4],
          y: t[5],
          width: width,
          size: size
        };
      });
  }

  global.ArziLayout = {
    median: median,
    mad: mad,
    clusterLines: clusterLines,
    detectColumnBounds: detectColumnBounds,
    lineToCells: lineToCells,
    classifyLine: classifyLine,
    normalisePdfItems: normalisePdfItems
  };
})(typeof window !== 'undefined' ? window : globalThis);
