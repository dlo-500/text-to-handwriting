/**
 * Arzi Core — file classification (MIME + PDF text-layer probe)
 * Fast, precise routing for Smart Convert and Lab tools.
 * Zero network. Pure client-side.
 */
(function (global) {
  'use strict';

  /**
   * @typedef {'pdf'|'image'|'docx'|'xlsx'|'html'|'txt'|'unknown'} ArziKind
   * @typedef {'text'|'scan'|'mixed'|'empty'|'unknown'} ArziPdfLayer
   */

  function extOf(name) {
    var m = (name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
    return m ? m[1] : '';
  }

  /**
   * Quick kind from File metadata (no parse).
   * @param {File} file
   * @returns {ArziKind}
   */
  function kindFromFile(file) {
    if (!file) return 'unknown';
    var t = (file.type || '').toLowerCase();
    var e = extOf(file.name);

    if (t === 'application/pdf' || e === 'pdf') return 'pdf';
    if (t.indexOf('image/') === 0 || /^(png|jpe?g|webp|gif|bmp|tiff?)$/.test(e)) return 'image';
    if (
      t === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      e === 'docx'
    ) return 'docx';
    if (
      t === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      e === 'xlsx' || e === 'xls'
    ) return 'xlsx';
    if (t === 'text/html' || e === 'html' || e === 'htm') return 'html';
    if (t.indexOf('text/') === 0 || e === 'txt' || e === 'md') return 'txt';
    return 'unknown';
  }

  /**
   * Probe whether a PDF has a usable text layer.
   * Requires pdf.js (pdfjsLib) already loaded.
   * Samples up to `maxPages` pages for speed.
   *
   * @param {ArrayBuffer} bytes
   * @param {{maxPages?:number, minChars?:number}} [opts]
   * @returns {Promise<{layer:ArziPdfLayer, chars:number, pages:number, samplePages:number}>}
   */
  async function probePdfTextLayer(bytes, opts) {
    opts = opts || {};
    var maxPages = opts.maxPages != null ? opts.maxPages : 5;
    var minChars = opts.minChars != null ? opts.minChars : 8;

    if (typeof pdfjsLib === 'undefined') {
      throw new Error('pdf.js is required for PDF probing');
    }

    var pdf = await pdfjsLib.getDocument({ data: bytes.slice ? bytes.slice(0) : bytes }).promise;
    var pages = pdf.numPages;
    var sample = Math.min(pages, maxPages);
    var totalChars = 0;
    var pagesWithText = 0;

    for (var i = 1; i <= sample; i++) {
      var page = await pdf.getPage(i);
      var content = await page.getTextContent();
      var n = 0;
      (content.items || []).forEach(function (it) {
        if (it.str) n += it.str.replace(/\s/g, '').length;
      });
      if (n >= minChars) pagesWithText++;
      totalChars += n;
    }

    var layer;
    if (totalChars < minChars) layer = 'scan';
    else if (pagesWithText === sample) layer = 'text';
    else if (pagesWithText === 0) layer = 'scan';
    else layer = 'mixed';

    return {
      layer: layer,
      chars: totalChars,
      pages: pages,
      samplePages: sample
    };
  }

  /**
   * Full classification for Smart Convert.
   * @param {File} file
   * @returns {Promise<{kind:ArziKind, layer?:ArziPdfLayer, chars?:number, pages?:number, route:string, label:string, hint:string}>}
   */
  async function classify(file) {
    var kind = kindFromFile(file);
    var result = {
      kind: kind,
      route: 'unknown',
      label: 'Unknown file',
      hint: 'Try a PDF, image, Word, or Excel file.'
    };

    if (kind === 'image') {
      result.route = 'ocr-to-word';
      result.label = 'Image / photo';
      result.hint = 'Will use OCR → Word (scanned text recognition).';
      return result;
    }

    if (kind === 'docx') {
      result.route = 'word-to-pdf';
      result.label = 'Word document';
      result.hint = 'Best path: Word → PDF (approximate layout in browser).';
      return result;
    }

    if (kind === 'xlsx') {
      result.route = 'excel-to-pdf';
      result.label = 'Spreadsheet';
      result.hint = 'Best path: Excel → PDF.';
      return result;
    }

    if (kind === 'html' || kind === 'txt') {
      result.route = 'html-to-pdf';
      result.label = kind === 'html' ? 'HTML' : 'Text';
      result.hint = 'Can render to PDF.';
      return result;
    }

    if (kind === 'pdf') {
      try {
        var bytes = await file.arrayBuffer();
        var probe = await probePdfTextLayer(bytes);
        result.layer = probe.layer;
        result.chars = probe.chars;
        result.pages = probe.pages;

        if (probe.layer === 'text') {
          result.route = 'pdf-to-word';
          result.label = 'Text PDF (' + probe.pages + ' pages)';
          result.hint = 'Has a text layer — fast PDF → Word extraction.';
        } else if (probe.layer === 'mixed') {
          result.route = 'ocr-to-word';
          result.label = 'Mixed PDF (' + probe.pages + ' pages)';
          result.hint = 'Some pages lack text — OCR → Word is safer.';
        } else {
          result.route = 'ocr-to-word';
          result.label = 'Scanned PDF (' + probe.pages + ' pages)';
          result.hint = 'No usable text layer — OCR → Word required.';
        }
      } catch (e) {
        result.route = 'pdf-to-word';
        result.label = 'PDF (could not probe)';
        result.hint = 'Open with PDF → Word or OCR → Word manually. ' + (e.message || '');
        result.layer = 'unknown';
      }
      return result;
    }

    return result;
  }

  global.ArziClassify = {
    kindFromFile: kindFromFile,
    probePdfTextLayer: probePdfTextLayer,
    classify: classify,
    extOf: extOf
  };
})(typeof window !== 'undefined' ? window : this);
