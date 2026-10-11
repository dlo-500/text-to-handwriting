/* ═══════════════════════════════════════════════════════════════
   Arzi — Print dialog with custom page options
   Paper size (incl. custom), orientation, margins, scale, choose
   which pages to print, and "leave signature blank" for hand-signing.
   Uses the page's own captureFullPaperCanvas() so the print is
   exactly what the preview / PDF shows.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var PAPER = { a4: [210, 297], letter: [215.9, 279.4], legal: [215.9, 355.6], a5: [148, 210] };
  var modal = null, cache = null, selected = {}, building = 0, debounce = null;

  function $(id) { return document.getElementById(id); }
  function num(id, def, lo, hi) {
    var v = parseFloat($(id).value);
    if (isNaN(v)) v = def;
    return Math.max(lo, Math.min(hi, v));
  }

  function buildModal() {
    if (modal) return;
    modal = document.createElement('div');
    modal.className = 'pr-modal'; modal.id = 'printModal';
    modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-labelledby', 'prTitle');
    modal.innerHTML =
      '<div class="pr-inner">' +
        '<div class="pdf-modal-header"><span id="prTitle">Print</span>' +
          '<div class="pdf-modal-actions"><button type="button" class="btn primary" id="prGo">Print selected pages</button>' +
          '<button type="button" class="btn" id="prClose">Close</button></div></div>' +
        '<div class="pr-body">' +
          '<div class="pr-opts">' +
            '<label>Paper size<select id="prSize">' +
              '<option value="a4">A4 (210 × 297 mm)</option><option value="letter">Letter (8.5 × 11 in)</option>' +
              '<option value="legal">Legal (8.5 × 14 in)</option><option value="a5">A5 (148 × 210 mm)</option>' +
              '<option value="custom">Custom size…</option></select></label>' +
            '<div class="pr-pair" id="prCustomRow" style="display:none;">' +
              '<label>Width (mm)<input type="number" id="prW" value="210" min="50" max="1000"></label>' +
              '<label>Height (mm)<input type="number" id="prH" value="297" min="50" max="1500"></label></div>' +
            '<label>Orientation<select id="prOrient"><option value="p">Portrait</option><option value="l">Landscape</option></select></label>' +
            '<label>Margins<select id="prMargin">' +
              '<option value="0">None (letter\'s own margins)</option><option value="6">Narrow — 6 mm</option>' +
              '<option value="12">Normal — 12 mm</option><option value="20">Wide — 20 mm</option>' +
              '<option value="c">Custom…</option></select></label>' +
            '<div id="prMarginRow" style="display:none;"><label>Margin on every side (mm)<input type="number" id="prMm" value="10" min="0" max="60"></label></div>' +
            '<label>Scale — <b id="prScaleVal">100%</b><input type="range" id="prScale" min="50" max="100" value="100" step="1"></label>' +
            '<label class="pr-check"><input type="checkbox" id="prBlank"> Leave the signature blank (sign by hand after printing)</label>' +
            '<label>Pages to print<input type="text" id="prPages" placeholder="All — or e.g. 1, 3-4" autocomplete="off"></label>' +
            '<p class="pr-note" id="prNote"></p>' +
            '<p class="pr-tip">In the browser\'s print window choose <b>Margins: None</b> and turn off <b>Headers and footers</b>. Paper size and orientation are set from here.</p>' +
          '</div>' +
          '<div class="pr-preview"><div class="pr-status" id="prStatus">Preparing preview…</div><div class="pr-thumbs" id="prThumbs"></div></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    var ps = $('pageSize'); if (ps && PAPER[ps.value]) $('prSize').value = ps.value;

    $('prClose').addEventListener('click', close);
    modal.addEventListener('mousedown', function (e) { if (e.target === modal) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.style.display === 'flex') close(); });
    $('prGo').addEventListener('click', doPrint);

    ['prSize', 'prOrient', 'prMargin', 'prMm', 'prW', 'prH', 'prScale'].forEach(function (id) {
      var n = $(id); n.addEventListener('input', onSettings); n.addEventListener('change', onSettings);
    });
    $('prBlank').addEventListener('change', function () { cache = null; refresh(true); });
    $('prPages').addEventListener('input', function () { parsePages(); markThumbs(); });
    $('prPages').addEventListener('change', function () { syncPagesField(); });
  }

  function params() {
    var key = $('prSize').value, W, H;
    if (key === 'custom') { W = num('prW', 210, 50, 1000); H = num('prH', 297, 50, 1500); }
    else { W = PAPER[key][0]; H = PAPER[key][1]; }
    if ($('prOrient').value === 'l') { var t = W; W = H; H = t; }
    var mv = $('prMargin').value, m = mv === 'c' ? num('prMm', 10, 0, 60) : parseFloat(mv);
    m = Math.min(m, Math.min(W, H) / 4);
    return { W: W, H: H, m: m, zoom: num('prScale', 100, 50, 100) / 100 };
  }
  function plan(canvas) {
    var p = params(), pw = p.W - 2 * p.m, ph = p.H - 2 * p.m, imgW = pw * p.zoom;
    var sliceH = Math.max(1, Math.floor(canvas.width * ph / imgW));
    return { p: p, pw: pw, ph: ph, imgW: imgW, sliceH: sliceH, n: Math.max(1, Math.ceil(canvas.height / sliceH)) };
  }

  function onSettings() {
    $('prCustomRow').style.display = $('prSize').value === 'custom' ? '' : 'none';
    $('prMarginRow').style.display = $('prMargin').value === 'c' ? '' : 'none';
    $('prScaleVal').textContent = $('prScale').value + '%';
    clearTimeout(debounce);
    debounce = setTimeout(function () { refresh(false); }, 120);
  }

  /* ---- page selection ("All" or "1, 3-4") ---- */
  function parsePages() {
    var txt = $('prPages').value.trim(), total = cache ? plan(cache.canvas).n : 1, set = {}, ok = true;
    if (!txt || /^all$/i.test(txt)) { for (var i = 1; i <= total; i++) set[i] = true; }
    else {
      txt.split(',').forEach(function (part) {
        var m = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(part);
        if (!m) { ok = false; return; }
        var a = +m[1], b = m[2] ? +m[2] : a;
        if (a > b) { var t = a; a = b; b = t; }
        for (var k = a; k <= b; k++) if (k >= 1 && k <= total) set[k] = true;
      });
    }
    if (ok) selected = set;
    $('prPages').classList.toggle('bad', !ok);
    return ok;
  }
  function syncPagesField() {
    var total = cache ? plan(cache.canvas).n : 1, list = [];
    for (var i = 1; i <= total; i++) if (selected[i]) list.push(i);
    $('prPages').value = list.length === total ? '' : list.join(', ');
    $('prPages').classList.remove('bad');
  }
  function markThumbs() {
    var items = $('prThumbs').querySelectorAll('.pr-thumb');
    Array.prototype.forEach.call(items, function (t) {
      var n = +t.getAttribute('data-n'), on = !!selected[n];
      t.classList.toggle('off', !on); t.querySelector('input').checked = on;
    });
    var cnt = 0; for (var k in selected) if (selected[k]) cnt++;
    $('prGo').disabled = cnt === 0;
    $('prNote').textContent = cnt === 0 ? 'Select at least one page to print.' : '';
  }

  /* ---- preview ---- */
  function renderThumbs() {
    if (!cache) return;
    var canvas = cache.canvas, pl = plan(canvas), box = $('prThumbs');
    box.innerHTML = '';
    var TW = 150, TH = Math.round(TW * pl.p.H / pl.p.W), pxPerMm = TW / pl.p.W;
    for (var i = 0; i < pl.n; i++) {
      var y0 = i * pl.sliceH, hh = Math.min(pl.sliceH, canvas.height - y0);
      var c = document.createElement('canvas'); c.width = TW * 2; c.height = TH * 2;
      var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      var s = pxPerMm * 2, iw = pl.imgW * s, ih = (hh / canvas.width) * pl.imgW * s;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(canvas, 0, y0, canvas.width, hh, (pl.p.m + (pl.pw - pl.imgW) / 2) * s, pl.p.m * s, iw, ih);
      var t = document.createElement('label'); t.className = 'pr-thumb'; t.setAttribute('data-n', i + 1);
      t.innerHTML = '<span class="pr-pg"></span><span class="pr-cap"><input type="checkbox"> Page ' + (i + 1) + ' of ' + pl.n + '</span>';
      c.style.aspectRatio = pl.p.W + ' / ' + pl.p.H;
      t.querySelector('.pr-pg').appendChild(c);
      (function (n) {
        t.querySelector('input').addEventListener('change', function (e) { selected[n] = e.target.checked; syncPagesField(); markThumbs(); });
      })(i + 1);
      box.appendChild(t);
    }
    markThumbs();
  }

  async function refresh(recapture) {
    var token = ++building, st = $('prStatus');
    try {
      if (!cache || recapture) {
        st.textContent = 'Preparing preview…'; st.style.display = '';
        var canvas = await captureFullPaperCanvas({ scale: 3, blankSignature: $('prBlank').checked });
        if (token !== building) return;
        cache = { canvas: canvas };
        var pl = plan(canvas); selected = {}; for (var i = 1; i <= pl.n; i++) selected[i] = true;
        if ($('prPages').value) parsePages();
      } else {
        var total = plan(cache.canvas).n;
        if ($('prPages').value.trim()) parsePages(); else { selected = {}; for (var j = 1; j <= total; j++) selected[j] = true; }
      }
      st.style.display = 'none';
      renderThumbs();
    } catch (err) {
      st.style.display = ''; st.textContent = 'Could not prepare the print preview: ' + (err && err.message ? err.message : err);
    }
  }

  function open() {
    buildModal();
    modal.style.display = 'flex';
    var ps = $('pageSize'); if (ps && PAPER[ps.value]) $('prSize').value = ps.value;
    $('prCustomRow').style.display = $('prSize').value === 'custom' ? '' : 'none';
    cache = null; $('prPages').value = ''; $('prThumbs').innerHTML = '';
    refresh(true);
  }
  function close() { if (modal) modal.style.display = 'none'; }

  /* ---- print ---- */
  async function doPrint() {
    if (!cache) return;
    if (!parsePages()) { $('prNote').textContent = 'Check the page list — use numbers like 1, 3-4.'; return; }
    var canvas = cache.canvas, pl = plan(canvas), pages = [];
    for (var i = 1; i <= pl.n; i++) if (selected[i]) pages.push(i);
    if (!pages.length) return;

    var old = $('arziPrintRoot'); if (old) old.remove();
    var oldS = $('arziPrintStyle'); if (oldS) oldS.remove();
    var root = document.createElement('div'); root.id = 'arziPrintRoot';
    var imgs = [];
    pages.forEach(function (n) {
      var y0 = (n - 1) * pl.sliceH, hh = Math.min(pl.sliceH, canvas.height - y0);
      var c = document.createElement('canvas'); c.width = canvas.width; c.height = hh;
      var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, hh);
      ctx.drawImage(canvas, 0, y0, canvas.width, hh, 0, 0, canvas.width, hh);
      var page = document.createElement('div'); page.className = 'arzi-print-page';
      page.style.cssText = 'width:' + pl.p.W + 'mm;height:' + pl.p.H + 'mm;padding:' + pl.p.m + 'mm;';
      var img = new Image(); img.alt = '';
      img.style.cssText = 'display:block;margin:0 auto;width:' + pl.imgW + 'mm;height:' + ((hh / canvas.width) * pl.imgW) + 'mm;';
      img.src = c.toDataURL('image/png');
      imgs.push(img); page.appendChild(img); root.appendChild(page);
    });
    document.body.appendChild(root);
    var st = document.createElement('style'); st.id = 'arziPrintStyle';
    st.textContent = '@page{size:' + pl.p.W + 'mm ' + pl.p.H + 'mm;margin:0;}';
    document.head.appendChild(st);
    try { await Promise.all(imgs.map(function (im) { return im.decode ? im.decode().catch(function () {}) : Promise.resolve(); })); } catch (e) {}

    function cleanup() {
      document.body.classList.remove('arzi-printing');
      var r = $('arziPrintRoot'); if (r) r.remove();
      var s = $('arziPrintStyle'); if (s) s.remove();
      window.removeEventListener('afterprint', cleanup);
    }
    window.addEventListener('afterprint', cleanup);
    setTimeout(cleanup, 10 * 60 * 1000);
    close();
    document.body.classList.add('arzi-printing');
    setTimeout(function () { window.print(); }, 60);
  }

  var btn = $('print-btn');
  if (btn) btn.addEventListener('click', open);
  window.ArziPrint = { open: open, close: close };
})();
