/* ═══════════════════════════════════════════════════════════════
   Arzi — PDF preview: choose pages to download + Smart-erase shortcut
   Upgrades the existing "PDF preview" dialog (Save as PDF) without
   changing how the PDF itself is built. Also exposes openErase() so the
   Print dialog can offer the same shortcut.
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var ERASE_URL = 'lab/tools/pdf-erase.html';
  var S = { canvases: [], layout: null, sel: [], ready: false };
  var ui = {};

  function $(id) { return document.getElementById(id); }

  /* ── Smart erase shortcut ──────────────────────────────────────── */
  function openErase(noteEl) {
    function note(msg) {
      if (!noteEl) { window.alert(msg); return; }
      noteEl.textContent = msg; noteEl.style.display = '';
      clearTimeout(noteEl.__t); noteEl.__t = setTimeout(function () { noteEl.style.display = 'none'; }, 6000);
    }
    var go = function () { window.open(ERASE_URL, '_blank', 'noopener'); };
    if (!window.fetch || location.protocol === 'file:') { go(); return; }
    fetch(ERASE_URL, { method: 'HEAD', cache: 'no-store' }).then(function (r) {
      if (r.ok) go();
      else {
        if (window.console) console.warn('[arzi] ' + ERASE_URL + ' was not found (HTTP ' + r.status + ').');
        note('Smart erase is not available on this site yet.');
      }
    }).catch(go);                                    // offline / blocked check: just try to open it
  }

  /* ── page selection helpers ────────────────────────────────────── */
  function parseRange(txt, total) {
    var set = [], ok = true; for (var i = 0; i < total; i++) set.push(false);
    txt = (txt || '').trim();
    if (!txt || /^all$/i.test(txt)) return { sel: set.map(function () { return true; }), ok: true };
    txt.split(',').forEach(function (part) {
      var m = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(part);
      if (!m) { ok = false; return; }
      var a = +m[1], b = m[2] ? +m[2] : a;
      if (a > b) { var t = a; a = b; b = t; }
      for (var k = a; k <= b; k++) if (k >= 1 && k <= total) set[k - 1] = true;
    });
    return { sel: set, ok: ok };
  }
  function indices() { var r = []; S.sel.forEach(function (v, i) { if (v) r.push(i); }); return r; }
  function rangeLabel(idx) {
    var parts = [], start = null, prev = null;
    idx.concat([-9]).forEach(function (n) {
      if (start === null) { start = prev = n; return; }
      if (n === prev + 1) { prev = n; return; }
      parts.push(start === prev ? String(start + 1) : (start + 1) + '-' + (prev + 1));
      start = prev = n;
    });
    return parts.join('_');
  }

  function paint() {
    var total = S.canvases.length, idx = indices(), k = idx.length;
    ui.count.textContent = k + ' of ' + total + ' page' + (total === 1 ? '' : 's') + ' selected';
    var dl = $('pdfModalDownload');
    if (dl) {
      dl.disabled = k === 0;
      dl.textContent = k === total ? (total === 1 ? 'Download PDF' : 'Download all ' + total + ' pages') : (k === 0 ? 'Select a page' : 'Download ' + k + ' page' + (k === 1 ? '' : 's'));
    }
    Array.prototype.forEach.call(ui.pages.querySelectorAll('.pp-card'), function (card, i) {
      card.classList.toggle('on', !!S.sel[i]);
      card.setAttribute('aria-checked', S.sel[i] ? 'true' : 'false');
    });
    if (k === total) ui.range.value = '';
    ui.bar.classList.toggle('single', total === 1);
  }

  /* ── build the dialog additions once ───────────────────────────── */
  function ensureUI() {
    if (ui.bar) return;
    var inner = document.querySelector('#pdfModal .pdf-modal-inner');
    ui.pages = $('pdfPreviewPages');
    if (!inner || !ui.pages) return;

    var bar = document.createElement('div');
    bar.className = 'pp-bar';
    bar.innerHTML =
      '<span class="pp-title">Select pages to download</span>' +
      '<span class="pp-count" id="ppCount"></span>' +
      '<span class="pp-spacer"></span>' +
      '<button type="button" class="btn" id="ppAll">All</button>' +
      '<button type="button" class="btn" id="ppNone">None</button>' +
      '<input type="text" class="pp-range" id="ppRange" placeholder="or type: 1, 3-4" aria-label="Pages to download" autocomplete="off">';
    inner.insertBefore(bar, ui.pages);

    var note = document.createElement('div');
    note.className = 'pp-note'; note.id = 'ppNote'; note.style.display = 'none'; note.setAttribute('role', 'status');
    inner.insertBefore(note, ui.pages);

    ui.bar = bar; ui.note = note;
    ui.count = $('ppCount'); ui.range = $('ppRange');

    $('ppAll').addEventListener('click', function () { S.sel = S.canvases.map(function () { return true; }); ui.range.value = ''; paint(); });
    $('ppNone').addEventListener('click', function () { S.sel = S.canvases.map(function () { return false; }); ui.range.value = ''; paint(); });
    ui.range.addEventListener('input', function () {
      var r = parseRange(ui.range.value, S.canvases.length);
      ui.range.classList.toggle('bad', !r.ok);
      if (r.ok) { S.sel = r.sel; paint(); }
    });

    /* extra header buttons: Print and Smart erase */
    var actions = document.querySelector('#pdfModal .pdf-modal-actions');
    var dl = $('pdfModalDownload');
    if (actions && dl) {
      var pr = document.createElement('button');
      pr.type = 'button'; pr.className = 'btn'; pr.id = 'pdfModalPrint'; pr.textContent = 'Print\u2026';
      pr.addEventListener('click', function () { if (global.ArziPrint) { $('pdfModal').style.display = 'none'; global.ArziPrint.open(); } });
      var er = document.createElement('button');
      er.type = 'button'; er.className = 'btn'; er.id = 'pdfModalErase'; er.innerHTML = 'Smart erase &#8599;';
      er.title = 'Open the Smart erase tool to black out names, numbers or text in a PDF';
      er.addEventListener('click', function () { openErase(ui.note); });
      actions.insertBefore(er, dl); actions.insertBefore(pr, er);
    }
  }

  /* ── called by previewPdf() ────────────────────────────────────── */
  function show(canvases, layout) {
    ensureUI();
    if (!ui.bar) return false;
    S.canvases = canvases; S.layout = layout; S.sel = canvases.map(function () { return true; }); S.ready = true;
    ui.range.value = ''; ui.range.classList.remove('bad'); ui.note.style.display = 'none';
    ui.pages.innerHTML = '';
    canvases.forEach(function (pc, i) {
      var card = document.createElement('div');
      card.className = 'pp-card on'; card.setAttribute('role', 'checkbox'); card.setAttribute('aria-checked', 'true'); card.tabIndex = 0;
      var tick = document.createElement('span'); tick.className = 'pp-check'; tick.setAttribute('aria-hidden', 'true');
      var img = document.createElement('img'); img.src = pc.toDataURL('image/png'); img.alt = 'Page ' + (i + 1);
      var label = document.createElement('div'); label.className = 'pdf-page-label'; label.textContent = 'Page ' + (i + 1) + ' of ' + canvases.length;
      card.appendChild(tick); card.appendChild(img); card.appendChild(label);
      function toggle() { S.sel[i] = !S.sel[i]; ui.range.value = ''; paint(); }
      card.addEventListener('click', toggle);
      card.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); } });
      ui.pages.appendChild(card);
    });
    paint();
    return true;
  }

  /* ── download only the ticked pages ────────────────────────────── */
  function download() {
    var idx = indices();
    if (!idx.length || !S.layout || !global.jspdf) return;
    var pdf = new global.jspdf.jsPDF({ unit: 'pt', format: S.layout.format });
    var pw = pdf.internal.pageSize.getWidth(), m = S.layout.margin, imgW = pw - m * 2;
    idx.forEach(function (i, k) {
      if (k > 0) pdf.addPage();
      var c = S.canvases[i];
      pdf.addImage(c.toDataURL('image/png'), 'PNG', m, m, imgW, (c.height / c.width) * imgW);
    });
    pdf.save(idx.length === S.canvases.length ? 'leave-application.pdf' : 'leave-application-pages-' + rangeLabel(idx) + '.pdf');
  }

  global.ArziPdfPages = {
    show: show,
    download: download,
    active: function () { return S.ready; },
    openErase: openErase,
    selected: function () { return indices(); }
  };
})(window);
