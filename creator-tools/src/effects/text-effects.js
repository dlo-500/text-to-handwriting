// Four Canvas2D text effects. Each is a pure function of time t (seconds), so export is deterministic.
const rng = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), lerp = (a, b, k) => a + (b - a) * k;
const pick = (r, a) => a[r() * a.length | 0];
const outBack = k => 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2;
const outBounce = k => { const n = 7.5625, d = 2.75; if (k < 1 / d) return n * k * k; if (k < 2 / d) return n * (k -= 1.5 / d) * k + .75; if (k < 2.5 / d) return n * (k -= 2.25 / d) * k + .9375; return n * (k -= 2.625 / d) * k + .984375; };
const SERIF = 'Georgia,"Times New Roman",serif', SANS = '"Arial Black",Impact,"Helvetica Neue",Arial,sans-serif';
const FONTS = [SERIF, SANS, '"Courier New",monospace', 'Impact,"Arial Narrow",sans-serif', '"Trebuchet MS",Verdana,sans-serif', '"Palatino Linotype",Palatino,serif'];
const PAPER = ['#f4efe3', '#e9d8a6', '#f2b5b0', '#a9d6e5', '#f7e463', '#c7e2b8', '#ffffff', '#1d2433'];
const INK = ['#1d2433', '#b3261e', '#1f4fb3', '#0d6b3f'], DARK = '#1d2433';
const shade = (h, f = .7) => '#' + [1, 3, 5].map(i => Math.round(parseInt(h.slice(i, i + 2), 16) * f).toString(16).padStart(2, '0')).join('');
const shOn = (ctx, a, b, y) => { ctx.shadowColor = `rgba(0,0,0,${a})`; ctx.shadowBlur = b; ctx.shadowOffsetY = y; };
const shOff = ctx => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; };
const poly = (ctx, r, w, h) => { const j = () => (r() - .5) * .1; ctx.beginPath(); [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5]].forEach(([x, y], i) => { const X = (x + j()) * w, Y = (y + j()) * h; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.closePath(); };
const TEXT = ['text', 'Text', 'text'], SPEED = ['speed', 'Speed', .5, 2, .05], SHADOW = ['shadow', 'Shadow', 0, 1, .05], SEED = ['seed', 'Variation', 1, 99, 1];
const fitCell = (text, cell, maxW) => Math.min(cell, maxW / Math.max(...words(text).map(x => x.length)));
const words = s => (s || ' ').trim().split(/\s+/);

// Per-character layout centred on (0,0). Wraps on words, splits words longer than a line.
function layout(text, cell, maxW, gap = .45, lh = 1.15) {
  const max = Math.max(1, Math.floor(maxW / cell)), len = a => a.reduce((s, x) => s + x.length, 0) + a.length - 1;
  const lines = []; let cur = [];
  for (let wd of words(text)) {
    while (wd.length > max) { if (cur.length) { lines.push(cur); cur = []; } lines.push([wd.slice(0, max)]); wd = wd.slice(max); }
    if (cur.length && len([...cur, wd]) > max) { lines.push(cur); cur = []; }
    cur.push(wd);
  }
  if (cur.length) lines.push(cur);
  const out = []; let i = 0;
  lines.forEach((ln, row) => {
    const chars = [...ln.join(' ')], total = chars.reduce((s, c) => s + (c === ' ' ? cell * gap : cell), 0); let x = -total / 2;
    for (const c of chars) { const wd = c === ' ' ? cell * gap : cell; if (c !== ' ') out.push({ c, x: x + wd / 2, y: (row - (lines.length - 1) / 2) * cell * lh, i: i++ }); x += wd; }
  });
  return out;
}

export const ransomNote = {
  id: 'ransom-note', kind: '2d', title: 'Ransom note title', blurb: 'Mismatched cut-out letters stamp in, then keep reshuffling.',
  defaults: { text: 'Breaking news', speed: 1, size: 1, jitter: 1, shuffle: 6, shadow: 0.6, seed: 7, key: '#00ff00' },
  ui: [TEXT, SPEED, ['size', 'Letter size', .6, 1.4, .05], ['jitter', 'Jitter', 0, 2, .05], ['shuffle', 'Reshuffles per second', [0, 3, 6, 12]], SHADOW, SEED],
  duration: p => 1.2 + [...(p.text || ' ')].length * .07 / p.speed + 2.5,
  draw(ctx, t, p, w, h) {
    const cell = fitCell(p.text, Math.min(w, h) * .13 * p.size, w * .9), step = p.shuffle ? Math.floor(t * p.shuffle) : 0;
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const g of layout(p.text, cell, w * .9)) {
      const age = t - (.25 + g.i * .07 / p.speed); if (age < 0) continue;
      const r = rng(p.seed * 977 + g.i * 131 + step * 17), bg = pick(r, PAPER), pop = age < .14 ? 1 + (1 - age / .14) * .55 : 1;
      const rot = (r() - .5) * .24 * p.jitter, dx = (r() - .5) * cell * .12 * p.jitter, dy = (r() - .5) * cell * .12 * p.jitter, sc = .9 + r() * .2;
      const font = pick(r, FONTS), up = r() < .55, bold = r() < .5 ? 'bold ' : '', tw = cell * (.82 + r() * .2), th = cell * (.9 + r() * .15), ink = pick(r, INK);
      ctx.save(); ctx.translate(g.x + dx, g.y + dy); ctx.rotate(rot); ctx.scale(pop * sc, pop * sc); ctx.globalAlpha = Math.min(1, age / .05);
      shOn(ctx, .4 * p.shadow, cell * .1, cell * .05); ctx.fillStyle = bg; poly(ctx, r, tw, th); ctx.fill(); shOff(ctx);
      ctx.fillStyle = bg === DARK ? '#f4efe3' : ink; ctx.font = `${bold}${th * .62 | 0}px ${font}`;
      ctx.fillText(up ? g.c.toUpperCase() : g.c.toLowerCase(), 0, th * .04); ctx.restore();
    }
    ctx.restore();
  },
};

export const paperCutout = {
  id: 'paper-cutout', kind: '2d', title: 'Paper cutout stop motion', blurb: 'Thick paper letters drop in on twos and wobble frame by frame.',
  defaults: { text: 'Hello world', speed: 1, size: 1, fps: 8, thickness: 1, shadow: 0.6, seed: 3, key: '#00ff00' },
  ui: [TEXT, SPEED, ['size', 'Letter size', .6, 1.4, .05], ['fps', 'Frames per second', [6, 8, 12]], ['thickness', 'Paper thickness', 0, 2, .05], SHADOW, SEED],
  duration: p => 1 + [...(p.text || ' ')].length * .1 / p.speed + 2,
  draw(ctx, t, p, w, h) {
    const cell = fitCell(p.text, Math.min(w, h) * .15 * p.size, w * .9), step = Math.floor(t * p.fps), ts = step / p.fps;
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const g of layout(p.text, cell, w * .9, .4, 1.25)) {
      const age = ts - (.2 + g.i * .1 / p.speed); if (age < 0) continue;
      const r = rng(p.seed * 313 + g.i * 57), r2 = rng(p.seed * 911 + g.i * 29 + step * 13);
      const col = pick(r, PAPER.slice(1, 6)), k = clamp(age / .55), y = lerp(-h * .55, 0, outBounce(k)), spin = (1 - k) * (r() - .5) * .8;
      ctx.save(); ctx.translate(g.x + (r2() - .5) * cell * .04, g.y + y); ctx.rotate((r2() - .5) * .1 + spin);
      ctx.font = `bold ${cell * 1.05 | 0}px ${SANS}`;
      shOn(ctx, .4 * p.shadow, cell * .12, cell * .06); ctx.strokeStyle = '#fff'; ctx.lineWidth = cell * .18; ctx.strokeText(g.c, 0, 0); shOff(ctx);
      ctx.fillStyle = shade(col); for (let i = Math.round(cell * .05 * p.thickness); i > 0; i--) ctx.fillText(g.c, i * .6, i * .9);
      ctx.fillStyle = col; ctx.fillText(g.c, 0, 0); ctx.restore();
    }
    ctx.restore();
  },
};

const MARK = { Yellow: '#ffe14d', Pink: '#ff9ecb', Mint: '#7ee8c1' };
export const newsCallout = {
  id: 'newspaper-callout', kind: '2d', title: 'Newspaper highlight', blurb: 'A newsprint clipping with a marker swipe, underline and hand-drawn circle.',
  defaults: { text: 'Read this twice', speed: 1, size: 1, mode: 'all', marker: 'Yellow', shadow: 0.6, seed: 5, key: '#00ff00' },
  ui: [TEXT, SPEED, ['size', 'Text size', .6, 1.4, .05], ['mode', 'Callout', ['all', 'highlight', 'underline', 'circle']], ['marker', 'Marker', Object.keys(MARK)], SHADOW, SEED],
  duration: p => 3.4 / p.speed + 1.6,
  draw(ctx, t, p, w, h) {
    const s = t * p.speed, pw = w * .9, ph = Math.min(h * .86, pw * (h > w ? 1.1 : .62)), on = m => p.mode === 'all' || p.mode === m;
    const k = outBack(clamp(s / .5)), r = rng(p.seed * 71);
    ctx.save(); ctx.translate(w / 2, h / 2 + (1 - clamp(s / .5)) * h); ctx.rotate(-.025 * k);
    shOn(ctx, .45 * p.shadow, 24, 10); ctx.fillStyle = '#f1ecdf'; ctx.fillRect(-pw / 2, -ph / 2, pw, ph); shOff(ctx);
    let fs = Math.min(w, h) * .11 * p.size; ctx.font = `bold ${fs | 0}px ${SERIF}`;
    const tw0 = ctx.measureText(p.text || ' ').width; if (tw0 > pw * .84) fs *= pw * .84 / tw0;
    ctx.font = `bold ${fs | 0}px ${SERIF}`; const tw = ctx.measureText(p.text || ' ').width, rowH = fs * .34, rows = Math.floor(ph * .88 / rowH);
    ctx.fillStyle = '#4a4a4a'; ctx.fillRect(-pw * .44, -ph * .45, pw * .88, rowH * .5);
    ctx.fillStyle = '#b8b2a3';
    for (let i = 1; i < rows; i++) { if (Math.abs(i - rows / 2) < 2.4) { r(); continue; } ctx.fillRect(-pw * .44, -ph * .45 + i * rowH, pw * .88 * (i % 5 === 0 ? .6 : .9 + r() * .1), rowH * .45); }
    const x0 = -tw / 2, base = fs * .3, pad = fs * .25;
    if (on('highlight')) {
      const q = clamp((s - .6) / .7);
      if (q > 0) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = MARK[p.marker] || MARK.Yellow;
        ctx.beginPath(); ctx.moveTo(x0 - pad, -fs * .5); ctx.lineTo(x0 - pad + q * (tw + 2 * pad), -fs * .56); ctx.lineTo(x0 - pad + q * (tw + 2 * pad), base + fs * .12); ctx.lineTo(x0 - pad, base + fs * .06); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
    }
    ctx.fillStyle = '#1d2433'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(p.text || ' ', x0, base);
    ctx.strokeStyle = '#d62828'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (on('underline')) {
      const q = clamp((s - 1.3) / .5); ctx.lineWidth = fs * .06;
      for (let pass = 0; pass < 2; pass++) { ctx.beginPath(); for (let i = 0; i <= 40 * q; i++) { const x = x0 - pad + i / 40 * (tw + 2 * pad), y = base + fs * (.2 + pass * .08) + Math.sin(i * .9 + pass) * fs * .015; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
    }
    if (on('circle')) {
      const q = clamp((s - 1.8) / .8), N = 120, cx = 0, cy = base - fs * .3, rx = tw / 2 + fs * .6, ry = fs * .95; ctx.lineWidth = fs * .07; ctx.beginPath();
      for (let i = 0; i <= N * q; i++) { const a = -2.4 + i / N * 2.15 * Math.PI, wob = 1 + .03 * Math.sin(3 * a + p.seed) + .12 * i / N; i ? ctx.lineTo(cx + Math.cos(a) * rx * wob, cy + Math.sin(a) * ry * wob) : ctx.moveTo(cx + Math.cos(a) * rx * wob, cy + Math.sin(a) * ry * wob); }
      ctx.stroke();
    }
    ctx.restore();
  },
};

export const kineticCollage = {
  id: 'kinetic-collage', kind: '2d', title: 'Kinetic collage typography', blurb: 'Words on torn paper and tape fly in, overshoot and settle.',
  defaults: { text: 'Make it loud', speed: 1, size: 1, drift: 1, shadow: 0.6, seed: 11, key: '#00ff00' },
  ui: [TEXT, SPEED, ['size', 'Word size', .6, 1.4, .05], ['drift', 'Drift', 0, 2, .05], SHADOW, SEED],
  duration: p => 1.2 + words(p.text).length * .22 / p.speed + 2.5,
  draw(ctx, t, p, w, h) {
    const base = Math.min(w, h) * .13 * p.size, styleOf = i => rng(p.seed * 53 + i * 7);
    const items = words(p.text).map((wd, i) => {
      const r = styleOf(i), f = pick(r, FONTS), sz = base * (.8 + r() * .6), bold = r() < .6 ? 'bold ' : '';
      ctx.font = `${bold}${sz | 0}px ${f}`; return { wd, i, f, sz, bold, bw: ctx.measureText(wd).width + sz * .5, bh: sz * 1.25 };
    });
    const lines = []; let cur = [], cw = 0;
    for (const it of items) { if (cur.length && cw + it.bw > w * .9) { lines.push(cur); cur = []; cw = 0; } cur.push(it); cw += it.bw * .92; }
    if (cur.length) lines.push(cur);
    const lh = lines.map(l => Math.max(...l.map(i => i.bh))); let y = -lh.reduce((a, b) => a + b, 0) * .9 / 2;
    lines.forEach((ln, li) => { let x = -ln.reduce((s, i) => s + i.bw * .92, 0) / 2; for (const it of ln) { it.x = x + it.bw / 2; it.y = y + lh[li] / 2; x += it.bw * .92; } y += lh[li] * .9; });
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const it of items) {
      const r = rng(p.seed * 97 + it.i * 13), bg = pick(r, PAPER), tilt = (r() - .5) * .22, ang = r() * Math.PI * 2, far = Math.max(w, h) * .8;
      const k = clamp((t - (.15 + it.i * .22 / p.speed)) / .6); if (k <= 0) continue;
      const e = outBack(k), dr = base * .04 * p.drift, ink = bg === DARK ? '#f4efe3' : pick(r, INK);
      const px = lerp(it.x + Math.cos(ang) * far, it.x, e) + Math.cos(t * .9 + it.i) * dr, py = lerp(it.y + Math.sin(ang) * far, it.y, e) + Math.sin(t * 1.3 + it.i) * dr;
      ctx.save(); ctx.translate(px, py); ctx.rotate(tilt * (.4 + .6 * e) + Math.sin(t * 1.7 + it.i * 2) * .02 * p.drift);
      shOn(ctx, .4 * p.shadow, base * .12, base * .06); ctx.fillStyle = bg; poly(ctx, r, it.bw, it.bh); ctx.fill(); shOff(ctx);
      if (r() < .7) { ctx.save(); ctx.fillStyle = 'rgba(235,225,180,.8)'; ctx.translate(-it.bw * .5, -it.bh * .45); ctx.rotate(-.6); ctx.fillRect(-it.sz * .35, -it.sz * .1, it.sz * .7, it.sz * .2); ctx.restore(); }
      ctx.fillStyle = ink; ctx.font = `${it.bold}${it.sz | 0}px ${it.f}`; ctx.fillText(it.wd, 0, it.sz * .04); ctx.restore();
    }
    ctx.restore();
  },
};

export const textEffects = [ransomNote, paperCutout, newsCallout, kineticCollage];
