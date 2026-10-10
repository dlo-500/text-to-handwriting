/**
 * Arzi Core — OCR pipeline helpers (Tesseract.js)
 * Preprocess + multi-page PDF page rendering for higher accuracy.
 */
(function (global) {
  'use strict';

  /**
   * Light preprocess on a canvas: grayscale + mild contrast stretch.
   * Improves Tesseract on washed-out phone photos without heavy deps.
   * @param {HTMLCanvasElement} src
   * @returns {HTMLCanvasElement}
   */
  function preprocessCanvas(src) {
    var w = src.width;
    var h = src.height;
    var out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    var ctx = out.getContext('2d');
    ctx.drawImage(src, 0, 0);
    var img = ctx.getImageData(0, 0, w, h);
    var d = img.data;
    var i, min = 255, max = 0, g;
    for (i = 0; i < d.length; i += 4) {
      g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
      if (g < min) min = g;
      if (g > max) max = g;
      d[i] = d[i + 1] = d[i + 2] = g;
    }
    var range = max - min || 1;
    for (i = 0; i < d.length; i += 4) {
      g = ((d[i] - min) / range) * 255;
      // slight contrast curve
      g = Math.max(0, Math.min(255, (g - 128) * 1.15 + 128));
      d[i] = d[i + 1] = d[i + 2] = g | 0;
    }
    ctx.putImageData(img, 0, 0);
    return out;
  }

  /**
   * Render a pdf.js page to canvas at target scale (capped width).
   * @param {object} pdf  pdf.js document
   * @param {number} pageNum 1-based
   * @param {number} [scale=2]
   * @param {number} [maxWidth=2000]
   */
  async function renderPdfPage(pdf, pageNum, scale, maxWidth) {
    scale = scale != null ? scale : 2;
    maxWidth = maxWidth != null ? maxWidth : 2000;
    var page = await pdf.getPage(pageNum);
    var base = page.getViewport({ scale: 1 });
    var s = Math.min(scale, maxWidth / base.width);
    var viewport = page.getViewport({ scale: s });
    var canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({
      canvasContext: canvas.getContext('2d'),
      viewport: viewport
    }).promise;
    return canvas;
  }

  /**
   * OCR all pages of a PDF or a single image File.
   * @param {object} worker  Tesseract worker
   * @param {File|Blob} file
   * @param {{isPdf?:boolean, scale?:number, preprocess?:boolean, onProgress?:function}} opts
   * @returns {Promise<string[]>} page texts
   */
  async function recognizeFile(worker, file, opts) {
    opts = opts || {};
    var preprocess = opts.preprocess !== false;
    var scale = opts.scale != null ? opts.scale : 2;
    var pageTexts = [];

    if (opts.isPdf || (file && file.type === 'application/pdf')) {
      if (typeof pdfjsLib === 'undefined') {
        throw new Error('pdf.js required for PDF OCR');
      }
      var bytes = await file.arrayBuffer();
      var pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
      var n = pdf.numPages;
      for (var i = 1; i <= n; i++) {
        if (opts.onProgress) opts.onProgress(i, n, 'render');
        var canvas = await renderPdfPage(pdf, i, scale);
        if (preprocess) canvas = preprocessCanvas(canvas);
        if (opts.onProgress) opts.onProgress(i, n, 'ocr');
        var rec = await worker.recognize(canvas);
        var t = (rec.data && rec.data.text || '').trim();
        if (t) pageTexts.push(t);
      }
    } else {
      if (opts.onProgress) opts.onProgress(1, 1, 'ocr');
      // For images: optional draw through canvas for preprocess
      if (preprocess && typeof createImageBitmap === 'function') {
        var bmp = await createImageBitmap(file);
        var c = document.createElement('canvas');
        c.width = bmp.width;
        c.height = bmp.height;
        c.getContext('2d').drawImage(bmp, 0, 0);
        bmp.close && bmp.close();
        c = preprocessCanvas(c);
        var rec = await worker.recognize(c);
        var t = (rec.data && rec.data.text || '').trim();
        if (t) pageTexts.push(t);
      } else {
        var rec2 = await worker.recognize(file);
        var t2 = (rec2.data && rec2.data.text || '').trim();
        if (t2) pageTexts.push(t2);
      }
    }
    return pageTexts;
  }

  global.ArziOcr = {
    preprocessCanvas: preprocessCanvas,
    renderPdfPage: renderPdfPage,
    recognizeFile: recognizeFile
  };
})(typeof window !== 'undefined' ? window : this);
