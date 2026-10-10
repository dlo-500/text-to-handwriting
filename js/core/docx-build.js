/**
 * Arzi Core — reliable browser DOCX builder helpers
 * Wraps dolanmiu/docx UMD with defensive API access and MIME-correct blobs.
 */
(function (global) {
  'use strict';

  function getApi() {
    var api = (typeof docx !== 'undefined' && docx) || global.docx || null;
    if (!api || typeof api.Document !== 'function' || !api.Packer) {
      throw new Error(
        'docx library missing. Ensure vendor/docx.umd.js or CDN index.umd.js is loaded.'
      );
    }
    return api;
  }

  /**
   * Build paragraphs from plain text blocks (OCR or extracted lines).
   * @param {string[]} blocks  non-empty strings, each becomes one or more paragraphs
   * @param {{pageBreaks?:boolean}} [opts]
   */
  function paragraphsFromBlocks(blocks, opts) {
    opts = opts || {};
    var api = getApi();
    var children = [];
    var pageBreaks = !!opts.pageBreaks;

    (blocks || []).forEach(function (block, idx) {
      if (pageBreaks && idx > 0) {
        children.push(new api.Paragraph({ children: [], pageBreakBefore: true }));
      }
      var lines = String(block || '').split(/\n/);
      lines.forEach(function (line) {
        var t = line.trim();
        if (!t) {
          children.push(new api.Paragraph({ children: [] }));
          return;
        }
        children.push(
          new api.Paragraph({
            children: [new api.TextRun({ text: t, size: 22 })],
            spacing: { after: 120 }
          })
        );
      });
    });

    if (!children.length) {
      children.push(
        new api.Paragraph({
          children: [
            new api.TextRun({
              text: 'No text content was available to put in this document.',
              italics: true
            })
          ]
        })
      );
    }
    return children;
  }

  /**
   * Structured lines from layout engine → headings / bullets / body.
   * @param {Array<{text:string,size?:number,pageBreak?:boolean}>} lines
   * @param {number} bodySize
   */
  function paragraphsFromLayoutLines(lines, bodySize) {
    var api = getApi();
    var Paragraph = api.Paragraph;
    var TextRun = api.TextRun;
    var HeadingLevel = api.HeadingLevel;
    var children = [];
    var buf = [];
    bodySize = bodySize || 11;

    function flush() {
      if (!buf.length) return;
      children.push(
        new Paragraph({
          children: [new TextRun({ text: buf.join(' '), size: 22 })],
          spacing: { after: 160 }
        })
      );
      buf = [];
    }

    function roleOf(text, size) {
      if (global.ArziLayout && ArziLayout.classifyLine) {
        return ArziLayout.classifyLine(text, size, bodySize);
      }
      var ratio = (size || bodySize) / bodySize;
      if (/^[•\-\*●▪○◦]\s+\S/.test(text)) return 'bullet';
      if (/^\d{1,3}[\.\)]\s+\S/.test(text)) return 'numbered';
      if (ratio > 1.55) return 'h1';
      if (ratio > 1.28) return 'h2';
      return 'body';
    }

    (lines || []).forEach(function (l) {
      if (l.pageBreak) {
        flush();
        children.push(new Paragraph({ children: [], pageBreakBefore: true }));
        return;
      }
      var trimmed = (l.text || '').trim();
      if (!trimmed) return;
      var role = roleOf(trimmed, l.size || bodySize);

      if (role === 'bullet') {
        flush();
        children.push(
          new Paragraph({
            children: [new TextRun(trimmed.replace(/^[•\-\*●▪○◦]\s+/, ''))],
            bullet: { level: 0 },
            spacing: { after: 80 }
          })
        );
        return;
      }
      if (role === 'numbered') {
        flush();
        children.push(
          new Paragraph({
            children: [new TextRun(trimmed)],
            spacing: { after: 80 }
          })
        );
        return;
      }
      if (role === 'h1') {
        flush();
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: trimmed, bold: true })],
            spacing: { before: 240, after: 120 }
          })
        );
        return;
      }
      if (role === 'h2') {
        flush();
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: trimmed, bold: true })],
            spacing: { before: 180, after: 100 }
          })
        );
        return;
      }
      buf.push(trimmed);
      if (/[.!?]"?$/.test(trimmed) && trimmed.length > 40) flush();
    });
    flush();
    if (!children.length) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: 'No paragraph content could be built.', italics: true })]
        })
      );
    }
    return children;
  }

  /**
   * @param {object[]} children  docx Paragraphs
   * @returns {Promise<Blob>}
   */
  async function toBlob(children) {
    var api = getApi();
    var doc = new api.Document({
      sections: [{ properties: {}, children: children || [] }]
    });
    var raw = await api.Packer.toBlob(doc);
    var blob = new Blob([raw], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
    if (!blob || blob.size < 400) {
      throw new Error('Generated .docx was empty or too small (' + (blob && blob.size) + ' bytes)');
    }
    return blob;
  }

  /**
   * Explain-only document when conversion cannot extract text.
   */
  async function emptyExplainBlob(title, body) {
    var api = getApi();
    var children = [
      new api.Paragraph({
        children: [new api.TextRun({ text: title || 'No extractable text', bold: true, size: 28 })],
        spacing: { after: 200 }
      }),
      new api.Paragraph({
        children: [new api.TextRun({ text: body || '', size: 22 })]
      })
    ];
    return toBlob(children);
  }

  global.ArziDocx = {
    getApi: getApi,
    paragraphsFromBlocks: paragraphsFromBlocks,
    paragraphsFromLayoutLines: paragraphsFromLayoutLines,
    toBlob: toBlob,
    emptyExplainBlob: emptyExplainBlob
  };
})(typeof window !== 'undefined' ? window : this);
