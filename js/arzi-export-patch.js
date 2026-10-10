/**
 * Arzi — Export Pipeline Patch
 * ------------------------------------------------
 * Drop-in helpers that improve the existing html2canvas + jsPDF export
 * already present in editor.html / template.html.
 *
 * Features:
 *  - Hooks realism (ArziRealism.enhanceExportClone) before capture
 *  - Waits for custom fonts to be ready
 *  - Higher-quality capture defaults
 *  - Clean multi-page slicing (same logic you already use, centralised)
 *  - Optional "scan effect" (slight noise + vignette) on final canvas
 *
 * Usage inside your existing exportAs() function:
 *
 *   // After you build the off-screen clone:
 *   if (window.arziRealism) window.arziRealism.enhanceExportClone(clone);
 *   const canvas = await ArziExport.capture(clone, { scale: 2 });
 *   // then continue with your existing sliceCanvasToPages / jsPDF code
 */
(function (global) {
  'use strict';

  function waitForFonts(timeoutMs) {
    timeoutMs = timeoutMs || 2500;
    if (!document.fonts || !document.fonts.ready) {
      return Promise.resolve();
    }
    return Promise.race([
      document.fonts.ready,
      new Promise(function (r) { setTimeout(r, timeoutMs); })
    ]);
  }

  /**
   * Capture a DOM node to canvas via html2canvas with sensible defaults.
   * @param {HTMLElement} node
   * @param {object} [opts]
   * @param {number} [opts.scale=2]
   * @param {string} [opts.backgroundColor='#ffffff']
   * @param {boolean} [opts.useCORS=true]
   */
  function capture(node, opts) {
    opts = opts || {};
    if (typeof html2canvas !== 'function') {
      return Promise.reject(new Error('html2canvas is not loaded'));
    }

    var scale = opts.scale != null ? opts.scale : 2;
    var bg = opts.backgroundColor != null ? opts.backgroundColor : '#ffffff';

    return waitForFonts().then(function () {
      // Brief pause so layout + fonts settle
      return new Promise(function (r) { setTimeout(r, 40); });
    }).then(function () {
      return html2canvas(node, {
        scale: scale,
        useCORS: opts.useCORS !== false,
        allowTaint: false,
        backgroundColor: bg,
        logging: false,
        imageTimeout: 4000,
        onclone: function (doc) {
          // Ensure the clone is fully visible
          var body = doc.body;
          if (body) {
            body.style.overflow = 'visible';
          }
        }
      });
    });
  }

  /**
   * Slice a tall canvas into page-sized canvases.
   * Same algorithm you already use — extracted for reuse.
   *
   * @param {HTMLCanvasElement} sourceCanvas
   * @param {number} pageWidthPt   PDF page content width in pt
   * @param {number} pageHeightPt  PDF page content height in pt
   * @returns {HTMLCanvasElement[]}
   */
  function sliceCanvasToPages(sourceCanvas, pageWidthPt, pageHeightPt) {
    var pages = [];
    var srcW = sourceCanvas.width;
    var srcH = sourceCanvas.height;
    if (!srcW || !srcH) return pages;

    // How many source pixels correspond to one page height
    var pxPerPt = srcW / pageWidthPt;
    var pageHeightPx = Math.floor(pageHeightPt * pxPerPt);
    if (pageHeightPx < 1) pageHeightPx = srcH;

    var y = 0;
    while (y < srcH) {
      var sliceH = Math.min(pageHeightPx, srcH - y);
      var c = document.createElement('canvas');
      c.width = srcW;
      c.height = sliceH;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(sourceCanvas, 0, y, srcW, sliceH, 0, 0, srcW, sliceH);
      pages.push(c);
      y += pageHeightPx;
    }
    return pages;
  }

  /**
   * Optional post-process: mild scan / paper noise on a canvas.
   * Call after capture if user enabled "Scanner" texture or a new toggle.
   */
  function applyScanEffect(canvas, strength) {
    strength = strength == null ? 0.35 : strength;
    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;
    var img = ctx.getImageData(0, 0, w, h);
    var d = img.data;
    // Deterministic-ish noise using position
    for (let i = 0; i < d.length; i += 4) {
      const px = (i / 4) % w;
      const py = Math.floor((i / 4) / w);
      // cheap hash
      let n = ((px * 374761393 + py * 668265263) ^ (px * py)) >>> 0;
      n = (n % 1000) / 1000; // 0..1
      const delta = (n - 0.5) * 18 * strength;
      d[i]     = Math.max(0, Math.min(255, d[i] + delta));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + delta));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + delta));
    }
    ctx.putImageData(img, 0, 0);

    // Soft vignette
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(30,20,10,' + (0.08 * strength).toFixed(3) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    return canvas;
  }

  /**
   * High-level helper: clone → realism → capture → optional scan → pages.
   * Returns { canvas, pages, dataUrls }.
   */
  function captureForExport(sourceWrapper, opts) {
    opts = opts || {};
    var scale = opts.scale != null ? opts.scale : 2;
    var applyScan = !!opts.scanEffect;
    var scanStrength = opts.scanStrength != null ? opts.scanStrength : 0.3;

    // Deep clone off-screen
    var clone = sourceWrapper.cloneNode(true);
    clone.style.position = 'fixed';
    clone.style.left = '-9999px';
    clone.style.top = '0';
    clone.style.width = sourceWrapper.clientWidth + 'px';
    clone.style.height = 'auto';
    clone.style.overflow = 'visible';
    clone.style.boxShadow = 'none';
    clone.style.backgroundColor = '#ffffff';
    document.body.appendChild(clone);

    // Apply realism noise on the clone
    if (global.arziRealism && typeof global.arziRealism.enhanceExportClone === 'function') {
      global.arziRealism.enhanceExportClone(clone);
    }

    return capture(clone, { scale: scale, backgroundColor: '#ffffff' })
      .then(function (canvas) {
        document.body.removeChild(clone);
        if (applyScan) applyScanEffect(canvas, scanStrength);
        return canvas;
      })
      .catch(function (err) {
        try { document.body.removeChild(clone); } catch (e) {}
        throw err;
      });
  }

  global.ArziExport = {
    waitForFonts: waitForFonts,
    capture: capture,
    sliceCanvasToPages: sliceCanvasToPages,
    applyScanEffect: applyScanEffect,
    captureForExport: captureForExport
  };
})(typeof window !== 'undefined' ? window : globalThis);
