/* ═══════════════════════════════════════════════════════════════
   Arzi — Desk: pass a file from one page to another, on this device only
   ─────────────────────────────────────────────────────────────────
   Nothing is uploaded. A file is parked for a few minutes in this
   browser's own storage (IndexedDB), the next page picks it up and the
   copy is deleted straight away.

   Sender   ArziDesk.handoff(blob, name, { target: 'lab/tools/pdf-erase.html' })   (blob may also be a Promise)
   Receiver every Lab tool: lab-common.js calls ArziDesk.autoReceive(), which
            feeds the file into the tool's own <input type="file">, exactly as
            if the user had chosen it — so every tool works without changes.
   Results  PDFs a tool produces can be kept for 30 minutes so the next tool
            can continue with them ("Keep working on this file").

   Safe to load from any page: it only defines window.ArziDesk.
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.ArziDesk) return;

  var script = document.currentScript;
  var ROOT = (script && script.src) ? new URL('../', script.src).href : '';   // the site root (lab-desk.js lives in /lab/)
  var DB_NAME = 'arzi-lab', STORE = 'transfer';
  var TTL = { handoff: 10 * 60 * 1000, result: 30 * 60 * 1000 };
  var MAX_RESULTS = 5, MAX_BYTES = 120 * 1024 * 1024;
  var K_REMEMBER = 'arzi_desk_remember_v1';

  /* ── tiny IndexedDB wrapper ────────────────────────────────────── */
  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!global.indexedDB) { reject(new Error('IndexedDB is not available')); return; }
      var req;
      try { req = global.indexedDB.open(DB_NAME, 1); } catch (e) { reject(e); return; }
      req.onupgradeneeded = function () { req.result.createObjectStore(STORE, { keyPath: 'id' }); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }
  function run(mode, fn) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(STORE, mode), req = fn(t.objectStore(STORE));
        t.oncomplete = function () { db.close(); resolve(req ? req.result : undefined); };
        t.onerror = t.onabort = function () { db.close(); reject(t.error || new Error('storage error')); };
      });
    });
  }
  function put(rec) { return run('readwrite', function (s) { return s.put(rec); }); }
  function get(id) { return run('readonly', function (s) { return s.get(id); }); }
  function del(id) { return run('readwrite', function (s) { return s.delete(id); }); }
  function all() { return run('readonly', function (s) { return s.getAll(); }).then(function (r) { return r || []; }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  /* remove anything that has outlived its time */
  function sweep() {
    return all().then(function (list) {
      var now = Date.now();
      return Promise.all(list.filter(function (r) { return now - r.created > (TTL[r.kind] || TTL.handoff); })
        .map(function (r) { return del(r.id); }));
    }).catch(function () {});
  }

  function toFile(rec) { return new File([rec.data], rec.name, { type: rec.type || 'application/pdf', lastModified: rec.created }); }

  /* does this <input type=file accept=""> take this file? */
  function acceptsFile(input, file) {
    var acc = (input.getAttribute('accept') || '').trim();
    if (!acc) return true;
    var name = (file.name || '').toLowerCase(), type = (file.type || '').toLowerCase();
    return acc.split(',').some(function (tok) {
      tok = tok.trim().toLowerCase();
      if (!tok) return false;
      if (tok.charAt(0) === '.') return name.slice(-tok.length) === tok;
      if (tok.slice(-2) === '/*') return type.indexOf(tok.slice(0, -1)) === 0;
      return type === tok;
    });
  }

  function urlFor(target, id, param) {
    return ROOT + target + (target.indexOf('?') >= 0 ? '&' : '?') + (param || 'handoff') + '=' + encodeURIComponent(id);
  }

  /* ── sending ───────────────────────────────────────────────────── */
  function store(blob, name, kind, source) {
    if (blob.size > MAX_BYTES) return Promise.reject(new Error('This file is too large to pass on automatically.'));
    return blob.arrayBuffer().then(function (buf) {
      var id = uid();
      return put({ id: id, kind: kind, name: name, type: blob.type || 'application/pdf', size: blob.size, data: buf, created: Date.now(), source: source || '' })
        .then(function () { return id; });
    });
  }

  /* Open `target` (a path from the site root) with the file already loaded.
     Call straight from a click: the new tab has to be opened synchronously or pop-up blockers stop it. */
  function handoff(blob, name, opts) {
    opts = opts || {};
    var target = opts.target || 'lab/tools/pdf-erase.html';
    var win = null;
    if (!opts.sameTab) {
      try {
        win = global.open('about:blank', '_blank');
        if (win) { win.document.title = 'Opening\u2026'; win.document.body.innerHTML = '<p style="font:16px/1.5 system-ui,sans-serif;padding:2rem;color:#6b6152">Opening your PDF\u2026</p>'; }
      } catch (e) {}
    }
    return sweep().then(function () { return Promise.resolve(blob); }).then(function (b) { return store(b, name, 'handoff', opts.source); }).then(function (id) {
      var url = urlFor(target, id);
      if (win) { win.location.replace(url); return { ok: true, id: id, url: url }; }
      if (opts.sameTab) { global.location.href = url; return { ok: true, id: id, url: url }; }
      return { ok: false, reason: 'popup', url: url };                 // the browser blocked the new tab; caller can offer the link
    }).catch(function (err) {
      if (win) win.location.replace(ROOT + target);                     // storage unavailable: open the tool, user chooses the file
      return { ok: false, reason: 'storage', error: err };
    });
  }

  /* ── receiving (every Lab tool) ────────────────────────────────── */
  function say(msg, type) { if (typeof global.toast === 'function') global.toast(msg, type); }

  function feed(file) {
    var inputs = Array.prototype.slice.call(document.querySelectorAll('input[type="file"]'));
    var input = null;
    for (var i = 0; i < inputs.length; i++) if (acceptsFile(inputs[i], file)) { input = inputs[i]; break; }
    if (!input) { say('This tool cannot open \u201c' + file.name + '\u201d.', 'error'); return false; }
    try {
      var dt = new DataTransfer(); dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (e) { say('Could not pass the file on \u2014 please choose it again.', 'error'); return false; }
  }

  function dropParam(name) {
    try {
      var u = new URL(location.href); u.searchParams.delete(name);
      history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
    } catch (e) {}
  }

  function autoReceive() {
    var q = new URLSearchParams(location.search);
    var hid = q.get('handoff'), uid_ = q.get('use');
    if (!hid && !uid_) return Promise.resolve(false);
    var job = hid
      ? get(hid).then(function (rec) { if (rec) del(rec.id).catch(function () {}); return rec; })      // one-shot: delete as soon as it is read
      : get(uid_);                                                                                    // "use": keep it until it expires
    return job.then(function (rec) {
      dropParam(hid ? 'handoff' : 'use');
      if (!rec) { say('That file is no longer available \u2014 please choose it again.', 'error'); return false; }
      var ok = feed(toFile(rec));
      if (ok) say('Opened \u201c' + rec.name + '\u201d' + (rec.source ? ' from ' + rec.source : '') + '.');
      return ok;
    }).catch(function () { dropParam(hid ? 'handoff' : 'use'); return false; });
  }

  /* ── results: keep the last few PDFs a tool produced, briefly ──── */
  function remember() { try { return localStorage.getItem(K_REMEMBER) !== '0'; } catch (e) { return true; } }
  function setRemember(on) {
    try { localStorage.setItem(K_REMEMBER, on ? '1' : '0'); } catch (e) {}
    return on ? Promise.resolve() : clearAll();
  }
  function rememberResult(blob, name, source) {
    if (!remember()) return Promise.resolve(null);
    return sweep().then(function () { return store(blob, name, 'result', source); }).then(function (id) {
      return all().then(function (list) {
        var res = list.filter(function (r) { return r.kind === 'result'; }).sort(function (a, b) { return b.created - a.created; });
        return Promise.all(res.slice(MAX_RESULTS).map(function (r) { return del(r.id); }));
      }).then(function () { return id; });
    }).catch(function () { return null; });
  }
  function results() {
    return sweep().then(all).then(function (list) {
      return list.filter(function (r) { return r.kind === 'result'; })
        .sort(function (a, b) { return b.created - a.created; })
        .map(function (r) { return { id: r.id, name: r.name, size: r.size, created: r.created, source: r.source }; });
    }).catch(function () { return []; });
  }
  function getFile(id) { return get(id).then(function (rec) { return rec ? toFile(rec) : null; }); }
  function clearAll() { return all().then(function (l) { return Promise.all(l.map(function (r) { return del(r.id); })); }).catch(function () {}); }

  /* After a tool downloads a PDF: offer to carry on with it in the Playground. */
  function injectBarStyle() {
    if (document.getElementById('arzi-desk-style')) return;
    var st = document.createElement('style'); st.id = 'arzi-desk-style';
    st.textContent =
      '.arzi-continue{position:fixed;left:50%;bottom:1.1rem;z-index:9999;transform:translate(-50%,16px);opacity:0;pointer-events:none;' +
      'display:flex;align-items:center;gap:.8rem;max-width:calc(100vw - 1.5rem);padding:.65rem .8rem .65rem 1rem;border-radius:6px;' +
      'background:#262119;color:#fdfbf5;font:500 .84rem/1.35 Inter,system-ui,sans-serif;box-shadow:0 10px 30px rgba(38,33,25,.35);' +
      'transition:opacity .25s ease,transform .3s cubic-bezier(.34,1.3,.64,1)}' +
      '.arzi-continue.show{opacity:1;transform:translate(-50%,0);pointer-events:auto}' +
      '.arzi-continue b{font-weight:600;overflow-wrap:anywhere}' +
      '.arzi-continue a{flex:none;background:#9c3b2e;color:#fff;text-decoration:none;font-weight:600;padding:.45rem .8rem;border-radius:4px;white-space:nowrap}' +
      '.arzi-continue a:hover{background:#b5473a}' +
      '.arzi-continue button{flex:none;background:none;border:0;color:#cfc6b0;font-size:1.2rem;line-height:1;cursor:pointer;padding:.15rem .35rem}' +
      '@media(max-width:520px){.arzi-continue{flex-wrap:wrap}}';
    document.head.appendChild(st);
  }
  function showContinue(id, name) {
    injectBarStyle();
    var old = document.getElementById('arzi-continue'); if (old) old.remove();
    var bar = document.createElement('div'); bar.id = 'arzi-continue'; bar.className = 'arzi-continue'; bar.setAttribute('role', 'status');
    var msg = document.createElement('span'); msg.innerHTML = '\u2713 Saved <b></b>. Keep working on it with another tool?';
    msg.querySelector('b').textContent = name;
    var go = document.createElement('a'); go.href = urlFor('lab/pdf-playground.html', id, 'use'); go.target = '_blank'; go.rel = 'noopener'; go.textContent = 'Open in PDF Playground';
    var x = document.createElement('button'); x.type = 'button'; x.setAttribute('aria-label', 'Dismiss'); x.innerHTML = '&times;';
    x.addEventListener('click', function () { bar.classList.remove('show'); setTimeout(function () { bar.remove(); }, 400); });
    bar.appendChild(msg); bar.appendChild(go); bar.appendChild(x);
    document.body.appendChild(bar);
    requestAnimationFrame(function () { bar.classList.add('show'); });
    setTimeout(function () { if (bar.parentNode) { bar.classList.remove('show'); setTimeout(function () { bar.remove(); }, 400); } }, 15000);
  }
  function autoRemember(blob, filename) {
    if (!/\.pdf$/i.test(filename || '') && blob.type !== 'application/pdf') return Promise.resolve(null);
    var label = (document.title || '').replace(/\s*\|.*$/, '').trim();
    return rememberResult(blob, filename, label).then(function (id) { if (id) showContinue(id, filename); return id; });
  }

  global.ArziDesk = {
    root: ROOT,
    supported: !!global.indexedDB,
    handoff: handoff, autoReceive: autoReceive, feed: feed, acceptsFile: acceptsFile, urlFor: urlFor,
    remember: remember, setRemember: setRemember, rememberResult: rememberResult, results: results,
    getFile: getFile, clearAll: clearAll, autoRemember: autoRemember
  };
})(window);
