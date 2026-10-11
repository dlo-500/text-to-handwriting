/* ═══════════════════════════════════════════════════════════════
   Arzi — Signature scan: ink-only extraction + flexible cropper
   - Photo/camera/upload -> transparent PNG that contains ONLY the ink
   - Selection box with 8 handles (every edge + corner), move, redraw
   - Live ink-only preview, also over the live camera view
   Public API: window.ArziSigScan { open, commit, close, startLive, stopLive }
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var WORK_MAX = 1800;     // longest side of the working copy of the photo
  var OUT_MAX = 800;       // max width of the saved signature
  var PREVIEW_MAX = 440;   // max width of the live preview
  var MIN = 0.035;         // smallest selection (fraction of the image)

  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* ─────────────── ink extraction ─────────────── */

  /* Paper "brightness map": a coarse grid where each cell holds the 80th-percentile
     luminance of that area (pen strokes are thin, so they never reach the 80th
     percentile), grown and smoothed so that strokes are filled in. This models
     uneven lighting, shadows and tinted paper across the whole photo. */
  function buildBackground(L, w, h) {
    var block = Math.max(6, Math.round(Math.max(w, h) / 64));
    var gw = Math.ceil(w / block), gh = Math.ceil(h / block);
    var g = new Float32Array(gw * gh), hist = new Uint32Array(256);
    for (var gy = 0; gy < gh; gy++) {
      for (var gx = 0; gx < gw; gx++) {
        hist.fill(0);
        var x0 = gx * block, y0 = gy * block, x1 = Math.min(w, x0 + block), y1 = Math.min(h, y0 + block), cnt = 0;
        for (var y = y0; y < y1; y += 2) for (var x = x0; x < x1; x += 2) { hist[L[y * w + x]]++; cnt++; }
        var target = cnt * 0.8, acc = 0, v = 255;
        for (var k = 0; k < 256; k++) { acc += hist[k]; if (acc >= target) { v = k; break; } }
        g[gy * gw + gx] = v;
      }
    }
    g = maxFilter(g, gw, gh); g = boxBlur(g, gw, gh);     // one grow step: follows steep shadows, still skips thin strokes
    return { g: g, gw: gw, gh: gh, block: block };
  }
  function maxFilter(g, gw, gh) {
    var o = new Float32Array(g.length);
    for (var y = 0; y < gh; y++) for (var x = 0; x < gw; x++) {
      var m = 0;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        var yy = clamp(y + dy, 0, gh - 1), xx = clamp(x + dx, 0, gw - 1), v = g[yy * gw + xx];
        if (v > m) m = v;
      }
      o[y * gw + x] = m;
    }
    return o;
  }
  function boxBlur(g, gw, gh) {
    var o = new Float32Array(g.length);
    for (var y = 0; y < gh; y++) for (var x = 0; x < gw; x++) {
      var s = 0;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) s += g[clamp(y + dy, 0, gh - 1) * gw + clamp(x + dx, 0, gw - 1)];
      o[y * gw + x] = s / 9;
    }
    return o;
  }
  function bgAt(bg, x, y) {
    var fx = clamp(x / bg.block - 0.5, 0, bg.gw - 1), fy = clamp(y / bg.block - 0.5, 0, bg.gh - 1);
    var x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(bg.gw - 1, x0 + 1), y1 = Math.min(bg.gh - 1, y0 + 1);
    var tx = fx - x0, ty = fy - y0, g = bg.g, w = bg.gw;
    var a = g[y0 * w + x0] * (1 - tx) + g[y0 * w + x1] * tx;
    var b = g[y1 * w + x0] * (1 - tx) + g[y1 * w + x1] * tx;
    return a * (1 - ty) + b * ty;
  }
  function lumaOf(d, n) {
    var L = new Uint8ClampedArray(n);
    for (var i = 0, j = 0; i < n; i++, j += 4) L[i] = (d[j] * 299 + d[j + 1] * 587 + d[j + 2] * 114) / 1000;
    return L;
  }

  /* In-place: turn an RGBA photo region into "ink on transparent".
     (sx0, sy0, sc) map this ImageData's pixels to the coordinates the background map was built in. */
  function applyInk(im, w, h, bg, o, sx0, sy0, sc) {
    var d = im.data;
    var t0 = 0.30 - 0.26 * o.level, t1 = t0 + 0.22;
    var fixed = o.mode === 'black' ? [17, 17, 20] : (o.mode === 'blue' ? [24, 42, 140] : null);
    var inkPx = 0, minX = w, minY = h, maxX = -1, maxY = -1;
    for (var p = 0, j = 0, y = 0; y < h; y++) {
      var by = sy0 + y / sc;
      for (var x = 0; x < w; x++, p++, j += 4) {
        var R = d[j], G = d[j + 1], B = d[j + 2];
        var L = 0.299 * R + 0.587 * G + 0.114 * B;
        var bv = bgAt(bg, sx0 + x / sc, by); if (bv < 60) bv = 60;
        var dk = (bv - L) / bv;
        if (dk <= t0) { d[j + 3] = 0; continue; }
        var a = (dk - t0) / (t1 - t0); if (a > 1) a = 1; a = a * a * (3 - 2 * a);
        if (a < 0.06) { d[j + 3] = 0; continue; }       // drop near-invisible specks
        if (fixed) { d[j] = fixed[0]; d[j + 1] = fixed[1]; d[j + 2] = fixed[2]; }
        else {
          /* flatten the lighting, then "unmix" the paper from edge pixels to recover the pen colour */
          var cov = dk / 0.6; cov = cov > 1 ? 1 : (cov < 0.3 ? 0.3 : cov);
          var k = 255 / bv, off = 255 * (1 - cov), inv = 1 / cov;
          var r2 = (R * k - off) * inv, g2 = (G * k - off) * inv, b2 = (B * k - off) * inv;
          d[j]     = (r2 < 0 ? 0 : (r2 > 255 ? 255 : r2)) * 0.72;
          d[j + 1] = (g2 < 0 ? 0 : (g2 > 255 ? 255 : g2)) * 0.72;
          d[j + 2] = (b2 < 0 ? 0 : (b2 > 255 ? 255 : b2)) * 0.72;
        }
        d[j + 3] = Math.round(a * 255);
        if (a > 0.12) { inkPx++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
      }
    }
    return { inkPx: inkPx, box: inkPx ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } : null };
  }

  /* Crop a region (source px) of the working canvas and return {canvas, hasInk}. */
  function extract(src, bg, r, o, maxW) {
    var sc = Math.min(1, maxW / r.w);
    var ow = Math.max(1, Math.round(r.w * sc)), oh = Math.max(1, Math.round(r.h * sc));
    var c = document.createElement('canvas'); c.width = ow; c.height = oh;
    var ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, ow, oh);
    if (!o.ink) return { canvas: c, hasInk: true };
    var im = ctx.getImageData(0, 0, ow, oh);
    var res = applyInk(im, ow, oh, bg, o, r.x, r.y, sc);
    ctx.putImageData(im, 0, 0);
    var hasInk = res.inkPx >= Math.max(8, ow * oh * 0.0004);
    if (hasInk && o.trim && res.box) {
      var pad = Math.max(2, Math.round(Math.max(res.box.w, res.box.h) * 0.04));
      var tx = clamp(res.box.x - pad, 0, ow - 1), ty = clamp(res.box.y - pad, 0, oh - 1);
      var tw = clamp(res.box.w + pad * 2, 1, ow - tx), th = clamp(res.box.h + pad * 2, 1, oh - ty);
      var t = document.createElement('canvas'); t.width = tw; t.height = th;
      t.getContext('2d').drawImage(c, tx, ty, tw, th, 0, 0, tw, th);
      c = t;
    }
    return { canvas: c, hasInk: hasInk };
  }

  /* ─────────────── state ─────────────── */
  var S = { src: null, bg: null, sel: { x: 0.1, y: 0.15, w: 0.8, h: 0.7 }, timer: null };

  function readOpts() {
    var lv = $('sigInkLevel'), cl = $('sigInkColor'), tr = $('sigAutoTrim'), ink = $('sigTransparent');
    return {
      ink: !ink || ink.checked,
      level: (lv ? +lv.value : 50) / 100,
      mode: cl ? cl.value : 'original',
      trim: !tr || tr.checked
    };
  }

  function setSource(canvas) {
    S.src = canvas;
    var im = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height);
    S.bg = buildBackground(lumaOf(im.data, canvas.width * canvas.height), canvas.width, canvas.height);
    var img = $('sigCropImage');
    img.src = canvas.toDataURL('image/jpeg', 0.92);
  }

  /* Find where the ink is so the box starts around it. */
  function guessSelection() {
    var s = S.src; if (!s) return { x: 0.1, y: 0.15, w: 0.8, h: 0.7 };
    var full = { x: 0, y: 0, w: s.width, h: s.height };
    var r = extract(s, S.bg, full, { ink: true, level: 0.5, mode: 'original', trim: false }, 400);
    var c = r.canvas, W = c.width, H = c.height;
    var d = c.getContext('2d').getImageData(0, 0, W, H).data, cell = 8;
    var cw = Math.ceil(W / cell), chh = Math.ceil(H / cell), cnt = new Uint16Array(cw * chh);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 140) cnt[((y / cell) | 0) * cw + ((x / cell) | 0)]++;
    var x0 = cw, y0 = chh, x1 = -1, y1 = -1, solid = cell * cell * 0.55;
    for (var cy = 1; cy < chh - 1; cy++) for (var cx = 1; cx < cw - 1; cx++) {     // ignore the outer border (table edges, fingers)
      var n = cnt[cy * cw + cx];
      if (n >= 4 && n <= solid) {                                                   // pen strokes are thin: solid dark blobs are not ink
        if (cx < x0) x0 = cx; if (cx > x1) x1 = cx; if (cy < y0) y0 = cy; if (cy > y1) y1 = cy;
      }
    }
    if (x1 < 0) return { x: 0.1, y: 0.15, w: 0.8, h: 0.7 };
    var fx = x0 * cell / W, fy = y0 * cell / H, fw = ((x1 + 1) * cell) / W - fx, fh = ((y1 + 1) * cell) / H - fy;
    var padX = Math.max(0.03, fw * 0.12), padY = Math.max(0.04, fh * 0.2);
    var l = clamp(fx - padX, 0, 1), t = clamp(fy - padY, 0, 1);
    var rr = clamp(fx + fw + padX, 0, 1), bb = clamp(fy + fh + padY, 0, 1);
    if ((rr - l) * (bb - t) > 0.92) return { x: 0.1, y: 0.15, w: 0.8, h: 0.7 };   // nothing sensible found
    return { x: l, y: t, w: Math.max(MIN, rr - l), h: Math.max(MIN, bb - t) };
  }

  function selPx() {
    var s = S.sel, w = S.src.width, h = S.src.height;
    var x = Math.round(s.x * w), y = Math.round(s.y * h);
    return { x: x, y: y, w: Math.max(1, Math.min(w - x, Math.round(s.w * w))), h: Math.max(1, Math.min(h - y, Math.round(s.h * h))) };
  }

  /* ─────────────── selection box UI ─────────────── */
  function paintRect() {
    var r = $('sigCropRect'); if (!r) return;
    r.style.display = 'block';
    r.style.left = (S.sel.x * 100) + '%'; r.style.top = (S.sel.y * 100) + '%';
    r.style.width = (S.sel.w * 100) + '%'; r.style.height = (S.sel.h * 100) + '%';
  }
  function setSel(s, quiet) {
    S.sel = s; paintRect();
    if (!quiet) schedulePreview();
  }

  function initCrop() {
    var cont = $('sigCropContainer'), rect = $('sigCropRect');
    if (!cont || !rect) return;
    ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(function (k) {
      var h = document.createElement('div'); h.className = 'sig-h'; h.setAttribute('data-h', k); rect.appendChild(h);
    });
    rect.setAttribute('data-h', 'move');
    var drag = null;

    function pt(e) {
      var b = cont.getBoundingClientRect();
      return { x: clamp((e.clientX - b.left) / b.width, 0, 1), y: clamp((e.clientY - b.top) / b.height, 0, 1) };
    }
    cont.addEventListener('pointerdown', function (e) {
      if (!S.src) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      var t = e.target, mode = (t && t.getAttribute && t.getAttribute('data-h')) || 'new';
      var p = pt(e);
      drag = { mode: mode, sp: p, ss: { x: S.sel.x, y: S.sel.y, w: S.sel.w, h: S.sel.h } };
      if (mode === 'new') setSel({ x: p.x, y: p.y, w: 0, h: 0 }, true);
      try { cont.setPointerCapture(e.pointerId); } catch (_) {}
      cont.classList.add('dragging');
      e.preventDefault();
    });
    cont.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var p = pt(e), dx = p.x - drag.sp.x, dy = p.y - drag.sp.y, s = drag.ss, m = drag.mode;
      if (m === 'new') {
        setSel({ x: Math.min(drag.sp.x, p.x), y: Math.min(drag.sp.y, p.y), w: Math.abs(dx), h: Math.abs(dy) });
      } else if (m === 'move') {
        setSel({ x: clamp(s.x + dx, 0, 1 - s.w), y: clamp(s.y + dy, 0, 1 - s.h), w: s.w, h: s.h });
      } else {
        var l = s.x, r = s.x + s.w, t = s.y, b = s.y + s.h;
        if (m.indexOf('w') >= 0) l = clamp(s.x + dx, 0, r - MIN);
        if (m.indexOf('e') >= 0) r = clamp(s.x + s.w + dx, l + MIN, 1);
        if (m.indexOf('n') >= 0) t = clamp(s.y + dy, 0, b - MIN);
        if (m.indexOf('s') >= 0) b = clamp(s.y + s.h + dy, t + MIN, 1);
        setSel({ x: l, y: t, w: r - l, h: b - t });
      }
      e.preventDefault();
    });
    function end(e) {
      if (!drag) return;
      var m = drag.mode, prev = drag.ss;
      drag = null; cont.classList.remove('dragging');
      if (m === 'new' && (S.sel.w < MIN || S.sel.h < MIN)) setSel(prev);   // a stray click must not destroy the box
      try { cont.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    cont.addEventListener('pointerup', end);
    cont.addEventListener('pointercancel', end);
  }

  /* ─────────────── preview + commit ─────────────── */
  function schedulePreview() {
    clearTimeout(S.timer);
    S.timer = setTimeout(drawPreview, 45);
  }
  function drawPreview() {
    var pv = $('sigInkPreview'), note = $('sigInkNote');
    if (!S.src || !pv) return;
    var o = readOpts(), r = extract(S.src, S.bg, selPx(), o, PREVIEW_MAX);
    pv.width = r.canvas.width; pv.height = r.canvas.height;
    var ctx = pv.getContext('2d'); ctx.clearRect(0, 0, pv.width, pv.height); ctx.drawImage(r.canvas, 0, 0);
    if (note) {
      if (o.ink && !r.hasInk) { note.textContent = 'No ink found in the box — widen the box or raise “Ink sensitivity”.'; note.style.display = ''; }
      else note.style.display = 'none';
    }
  }

  function commit() {
    if (!S.src) return null;
    var o = readOpts(), r = extract(S.src, S.bg, selPx(), o, OUT_MAX);
    if (o.ink && !r.hasInk) {
      alert('No ink was found inside the box. Widen the box, raise “Ink sensitivity”, or scan again on plain white paper with a dark pen.');
      return null;
    }
    return r.canvas.toDataURL('image/png');
  }

  function open(dataUrl) {
    var wrap = $('sigCropWrap'); if (!wrap) return;
    var im = new Image();
    im.onload = function () {
      var sc = Math.min(1, WORK_MAX / Math.max(im.naturalWidth, im.naturalHeight));
      var c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(im.naturalWidth * sc)); c.height = Math.max(1, Math.round(im.naturalHeight * sc));
      var ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);     // transparent PNG uploads: treat as white paper
      ctx.drawImage(im, 0, 0, c.width, c.height);
      setSource(c);
      wrap.style.display = '';
      var img = $('sigCropImage');
      var go = function () { setSel(guessSelection()); };
      if (img.complete) go(); else img.onload = go;
    };
    im.onerror = function () { alert('That image could not be opened.'); };
    im.src = dataUrl;
  }
  function close() {
    var wrap = $('sigCropWrap'); if (wrap) wrap.style.display = 'none';
    S.src = null; S.bg = null;
    var img = $('sigCropImage'); if (img) img.removeAttribute('src');
  }
  function rotate() {
    if (!S.src) return;
    var s = S.src, c = document.createElement('canvas'); c.width = s.height; c.height = s.width;
    var ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.translate(c.width, 0); ctx.rotate(Math.PI / 2); ctx.drawImage(s, 0, 0);
    setSource(c);
    var img = $('sigCropImage');
    img.onload = function () { setSel(guessSelection()); };
  }

  /* ─────────────── live camera preview (ink only) ─────────────── */
  var live = { timer: null, work: null };
  function tickLive() {
    var v = $('sigVideo'), c = $('sigLive'), on = $('sigLiveOn');
    if (!v || !c) return;
    if (!on || !on.checked || !v.videoWidth) { c.style.display = 'none'; return; }
    var w = Math.min(360, v.videoWidth), h = Math.max(1, Math.round(w * v.videoHeight / v.videoWidth));
    if (!live.work) live.work = document.createElement('canvas');
    if (live.work.width !== w || live.work.height !== h) { live.work.width = w; live.work.height = h; }
    var wctx = live.work.getContext('2d', { willReadFrequently: true });
    wctx.drawImage(v, 0, 0, w, h);
    var im = wctx.getImageData(0, 0, w, h);
    var bg = buildBackground(lumaOf(im.data, w * h), w, h);
    applyInk(im, w, h, bg, readOpts(), 0, 0, 1);
    c.width = w; c.height = h; c.getContext('2d').putImageData(im, 0, 0);
    c.style.display = 'block';
  }
  function startLive() { stopLive(); live.timer = setInterval(tickLive, 170); }
  function stopLive() {
    clearInterval(live.timer); live.timer = null;
    var c = $('sigLive'); if (c) c.style.display = 'none';
  }

  /* ─────────────── wiring ─────────────── */
  function init() {
    initCrop();
    var use = $('sigCropUse'), cancel = $('sigCropCancel');
    if (use) use.addEventListener('click', function () {
      var url = commit(); if (!url) return;
      if (typeof setCurrentSignature === 'function') setCurrentSignature(url);
      close();
    });
    if (cancel) cancel.addEventListener('click', close);
    var all = $('sigCropAll'), fit = $('sigCropReset'), rot = $('sigCropRotate');
    if (all) all.addEventListener('click', function () { setSel({ x: 0, y: 0, w: 1, h: 1 }); });
    if (fit) fit.addEventListener('click', function () { setSel(guessSelection()); });
    if (rot) rot.addEventListener('click', rotate);
    ['sigInkLevel', 'sigInkColor', 'sigAutoTrim', 'sigTransparent'].forEach(function (id) {
      var n = $(id); if (!n) return;
      n.addEventListener('input', schedulePreview); n.addEventListener('change', function () {
        if (id === 'sigTransparent') { var o = $('sigInkOpts'); if (o) o.classList.toggle('off', !n.checked); }
        schedulePreview();
      });
    });
    window.addEventListener('resize', function () { if (S.src) paintRect(); });
  }
  init();

  global.ArziSigScan = { open: open, commit: commit, close: close, startLive: startLive, stopLive: stopLive };
})(window);
