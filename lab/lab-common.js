/* Arzi Lab — shared helpers, no dependencies. */

/* File hand-off between pages (see lab-desk.js): lets Arzi's PDF preview and the PDF Playground
   open any tool with a PDF already loaded. Loaded here so every tool gets it without edits. */
(function () {
  var cs = document.currentScript;
  if (window.ARZI_NO_AUTO_HANDOFF) return;
  function receive() {
    if (!window.ArziDesk) return;
    var go = function () { setTimeout(function () { window.ArziDesk.autoReceive(); }, 120); };
    if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
  }
  if (window.ArziDesk) { receive(); return; }
  if (!cs || !cs.src) return;
  var tag = document.createElement('script');
  tag.src = new URL('lab-desk.js', cs.src).href;
  tag.onload = receive;
  document.head.appendChild(tag);
})();

function formatBytes(bytes){
  if (bytes === 0) return '0 KB';
  const units = ['B','KB','MB','GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1){ n /= 1024; i++; }
  return (i === 0 ? n : n.toFixed(n < 10 ? 2 : 1)) + ' ' + units[i];
}

function toast(msg, type){
  let elx = document.getElementById('lab-toast');
  if (!elx){
    elx = document.createElement('div');
    elx.id = 'lab-toast';
    elx.className = 'toast';
    document.body.appendChild(elx);
  }
  elx.textContent = msg;
  elx.className = 'toast show' + (type === 'error' ? ' error' : '');
  clearTimeout(elx._t);
  elx._t = setTimeout(() => { elx.className = 'toast'; }, 3200);
}

function downloadBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  // a finished PDF can be carried on to the next tool (kept on this device for 30 minutes)
  try { if (window.ArziDesk && window.ArziDesk.autoRemember) window.ArziDesk.autoRemember(blob, filename); } catch (e) {}
}

/**
 * Wire a dropzone element + hidden file input.
 * opts: { onFiles(fileList) }
 */
function wireDropzone(zoneEl, inputEl, opts){
  opts = opts || {};
  zoneEl.addEventListener('click', () => inputEl.click());
  zoneEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); inputEl.click(); }
  });
  inputEl.addEventListener('change', () => {
    if (inputEl.files && inputEl.files.length && opts.onFiles) opts.onFiles(inputEl.files);
    inputEl.value = '';
  });
  ['dragenter','dragover'].forEach(evt => {
    zoneEl.addEventListener(evt, (e) => {
      e.preventDefault(); e.stopPropagation();
      zoneEl.classList.add('drag');
    });
  });
  ['dragleave','drop'].forEach(evt => {
    zoneEl.addEventListener(evt, (e) => {
      e.preventDefault(); e.stopPropagation();
      zoneEl.classList.remove('drag');
    });
  });
  zoneEl.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files && files.length && opts.onFiles) opts.onFiles(files);
  });
}

function setProgress(barEl, pct){
  barEl.classList.add('active');
  barEl.querySelector('i').style.width = Math.max(0, Math.min(100, pct)) + '%';
  if (pct >= 100){
    setTimeout(() => barEl.classList.remove('active'), 500);
  }
}

function el(tag, cls, text){
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
