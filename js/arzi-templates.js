/* ═══════════════════════════════════════════════════════════════
   Arzi — Letter wording templates + "Write your own"
   The default ("Standard") is the wording the page has always used and is
   never touched. Other styles only replace the BODY paragraph; the address,
   subject line, salutation, closing, signature and copy-to block stay as is.
   Hooks into buildLetter() through ArziTemplates.override().
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var K_STYLE = 'arziBodyTemplate_v1', K_TEXT = 'arziBodyCustom_v1', K_SUBJ = 'arziBodySubject_v1';

  function $(id) { return document.getElementById(id); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function val(id) { var n = $(id); return n ? n.value : ''; }

  /* ── the catalogue ─────────────────────────────────────────────── */
  var STYLES = [
    { id: 'standard', label: 'Standard (current wording)', desc: 'The wording this page has always used.' },
    { id: 'formal',   label: 'Formal & respectful',        desc: 'Traditional, deferential tone. Suits applications to senior officers.' },
    { id: 'short',    label: 'Short & direct',             desc: 'Two plain sentences. Quick to read and easy to sanction.' },
    { id: 'detailed', label: 'Detailed (with arrangements)', desc: 'Adds that pending work has been arranged. Good for planned or longer leave.' },
    { id: 'urgent',   label: 'Urgent / short notice',      desc: 'For sudden situations where you could not apply in advance.' },
    { id: 'custom',   label: '\u270D  Write your own\u2026', desc: 'Type the body yourself. Tags like {name} and {date} fill in automatically.' }
  ];
  /* which styles make sense for which letter */
  var LIMITED = { joining: ['standard', 'formal', 'short', 'custom'] };

  /* tagged version of the standard wording: the starting point for "Write your own" */
  var TAGGED = {
    casual1: 'With high regards it is submitted that due to {reason}, I am unable to attend my duties today, i.e., {date}. So it is requested to kindly sanction a one day leave in my favour.\n\nSame shall be your most kindness.',
    casualN: 'With respect and high regards it is submitted that due to {reason} I am unable to attend my duties for {days} days, i.e., from {from} to {to} (both dates inclusive). So it is requested to kindly sanction {days} days leave in my favour.\n\nSame shall be your most kindness.',
    halfday: 'With high regards it is submitted that due to {reason} I am unable to attend my duties in the {half} half today on {date}. So it is requested to kindly sanction a halfday leave in my favour.\n\nSame shall be your most kindness.',
    stationLeave: 'With high regards, it is submitted that due to {reason}, I am not able to attend my duties today, i.e., on {date}. So, it is requested to kindly sanction a one day casual leave in my favour, with permission to leave the station.\n\nSame shall be your most kindness.',
    earnedLetter: 'Most respectfully, I, **{name}**, {designation}, request that I may kindly be granted **Earned Leave for a period of {duration}, i.e., from {from} to {to} (both dates inclusive)**, on account of {reason}.\n\nI shall be highly obliged for your kind consideration and sanction of the leave for the aforesaid period.',
    joining: 'With respect it is submitted that the undersigned was on **{leave}** from {from} to {to} (both dates inclusive). Now the undersigned has resumed duties today on **{resume} ({session})**.\n\nHence the joining report is submitted for favour of information and further necessary action.'
  };

  /* ── values the wordings are built from ────────────────────────── */
  function context() {
    var c = {};
    var n = val('numDays') || 2;
    var rawDur = val('duration').trim();
    var session = val('session');
    c.name = val('applicantName') || '[Your Name]';
    c.designation = (typeof currentDesignation === 'function') ? currentDesignation() : val('designationPreset');
    var att = val('attendanceId').trim();
    c.attendance = att;
    c.att = att ? ', Attendance ID <b>' + att + '</b>,' : ',';
    c.reason = (typeof currentReason === 'function') ? currentReason() : val('reasonPreset');
    c.date = fmtDate(val('dateSingle'));
    c.from = fmtDate(val('dateFrom'));
    c.to = fmtDate(val('dateTo'));
    c.days = numToWord(n);
    c.session = session;
    c.half = session === 'Morning' ? 'first' : 'second';
    c.duration = rawDur ? (/^\d+$/.test(rawDur) ? rawDur + ' days' : rawDur) : '[duration]';
    c.leave = (typeof currentJoiningLeaveType === 'function') ? currentJoiningLeaveType() : '';
    c.resume = fmtDate(val('joiningResumeDate'));
    c.jsession = val('joiningSession');
    return c;
  }

  /* ── the alternative wordings ──────────────────────────────────── */
  var tail = {
    formal: '<br>I shall remain highly obliged for this kindness.',
    short: '<br>Kindly sanction the same.',
    detailed: ' I shall be grateful for your kind consideration.',
    urgent: '<br>I shall be thankful for your kind understanding.'
  };
  var arrange = 'I have made the necessary arrangements for my pending work so that office routine is not affected in my absence.';

  var BODY = {
    casual1: {
      formal: function (c) { return 'Most respectfully, I beg to state that owing to ' + c.reason + ', I shall not be able to attend office today, i.e., on ' + c.date + '. I, therefore, request that I may kindly be granted one day\u2019s Casual Leave for the said date.' + tail.formal; },
      short: function (c) { return 'I request that one day\u2019s Casual Leave may kindly be granted to me on ' + c.date + ' due to ' + c.reason + '.' + tail.short; },
      detailed: function (c) { return 'With due respect and humble submission, I beg to state that due to ' + c.reason + ', I am unable to attend my official duties today, i.e., on ' + c.date + '. ' + arrange + '<br>It is, therefore, requested that one day\u2019s Casual Leave may kindly be sanctioned in my favour for the said date.' + tail.detailed; },
      urgent: function (c) { return 'It is respectfully submitted that due to ' + c.reason + ', which arose at very short notice, I am unable to attend my duties today, i.e., on ' + c.date + ', and could not apply in advance. It is, therefore, requested that one day\u2019s Casual Leave may kindly be sanctioned in my favour and the inconvenience caused may kindly be condoned.' + tail.urgent; }
    },
    casualN: {
      formal: function (c) { return 'Most respectfully, I beg to state that owing to ' + c.reason + ', I shall not be able to attend office for ' + c.days + ' days, i.e., from ' + c.from + ' to ' + c.to + ' (both dates inclusive). I, therefore, request that I may kindly be granted ' + c.days + ' days\u2019 Casual Leave for the said period.' + tail.formal; },
      short: function (c) { return 'I request that ' + c.days + ' days\u2019 Casual Leave may kindly be granted to me from ' + c.from + ' to ' + c.to + ' (both dates inclusive) due to ' + c.reason + '.' + tail.short; },
      detailed: function (c) { return 'With due respect and humble submission, I beg to state that due to ' + c.reason + ', I am unable to attend my official duties for ' + c.days + ' days, i.e., from ' + c.from + ' to ' + c.to + ' (both dates inclusive). ' + arrange + '<br>It is, therefore, requested that ' + c.days + ' days\u2019 Casual Leave may kindly be sanctioned in my favour for the said period.' + tail.detailed; },
      urgent: function (c) { return 'It is respectfully submitted that due to ' + c.reason + ', which arose at very short notice, I am unable to attend my duties for ' + c.days + ' days, i.e., from ' + c.from + ' to ' + c.to + ' (both dates inclusive), and could not apply in advance. It is, therefore, requested that ' + c.days + ' days\u2019 Casual Leave may kindly be sanctioned in my favour and the inconvenience caused may kindly be condoned.' + tail.urgent; }
    },
    halfday: {
      formal: function (c) { return 'Most respectfully, I beg to state that owing to ' + c.reason + ', I shall not be able to attend office in the ' + c.half + ' half of today, i.e., ' + c.date + '. I, therefore, request that half-day Casual Leave may kindly be granted to me for the said session.' + tail.formal; },
      short: function (c) { return 'I request that half-day Casual Leave may kindly be granted to me for the ' + c.half + ' half of ' + c.date + ' due to ' + c.reason + '.' + tail.short; },
      detailed: function (c) { return 'With due respect and humble submission, I beg to state that due to ' + c.reason + ', I am unable to attend my official duties in the ' + c.half + ' half of today, i.e., ' + c.date + '. ' + arrange + '<br>It is, therefore, requested that half-day Casual Leave may kindly be sanctioned in my favour.' + tail.detailed; },
      urgent: function (c) { return 'It is respectfully submitted that due to ' + c.reason + ', which arose at very short notice, I am unable to attend my duties in the ' + c.half + ' half of today, i.e., ' + c.date + ', and could not apply in advance. It is, therefore, requested that half-day Casual Leave may kindly be sanctioned in my favour and the inconvenience caused may kindly be condoned.' + tail.urgent; }
    },
    stationLeave: {
      formal: function (c) { return 'Most respectfully, I beg to state that owing to ' + c.reason + ', I shall not be able to attend office today, i.e., on ' + c.date + '. I, therefore, request that one day\u2019s Casual Leave may kindly be granted to me for the said date, along with permission to leave the Station.' + tail.formal; },
      short: function (c) { return 'I request that one day\u2019s Casual Leave, with permission to leave the Station, may kindly be granted to me on ' + c.date + ' due to ' + c.reason + '.' + tail.short; },
      detailed: function (c) { return 'With due respect and humble submission, I beg to state that due to ' + c.reason + ', I am unable to attend my official duties today, i.e., on ' + c.date + ', and I shall need to leave the Station. ' + arrange + '<br>It is, therefore, requested that one day\u2019s Casual Leave, along with permission to leave the Station, may kindly be sanctioned in my favour.' + tail.detailed; },
      urgent: function (c) { return 'It is respectfully submitted that due to ' + c.reason + ', which arose at very short notice, I am unable to attend my duties today, i.e., on ' + c.date + ', and have to leave the Station. It is, therefore, requested that one day\u2019s Casual Leave, along with permission to leave the Station, may kindly be sanctioned in my favour and the short notice may kindly be condoned.' + tail.urgent; }
    },
    earnedLetter: {
      formal: function (c) { return 'With due respect and humble submission, I, <b>' + c.name + '</b>, ' + c.designation + c.att + ' beg to state that I am in need of leave on account of ' + c.reason + '. I, therefore, request that I may kindly be granted <b>Earned Leave for a period of ' + c.duration + ', i.e., from ' + c.from + ' to ' + c.to + ' (both dates inclusive)</b>.<br>I shall remain highly obliged for your kind consideration and sanction of the leave.'; },
      short: function (c) { return 'I, <b>' + c.name + '</b>, ' + c.designation + c.att + ' request <b>Earned Leave for ' + c.duration + ', i.e., from ' + c.from + ' to ' + c.to + ' (both dates inclusive)</b>, on account of ' + c.reason + '.' + tail.short; },
      detailed: function (c) { return 'With due respect, I, <b>' + c.name + '</b>, ' + c.designation + c.att + ' beg to state that on account of ' + c.reason + ', I need to remain away from duty for a period of ' + c.duration + '. ' + arrange + ' If any urgent official matter arises, I can be contacted.<br>I, therefore, request that I may kindly be granted <b>Earned Leave for ' + c.duration + ', i.e., from ' + c.from + ' to ' + c.to + ' (both dates inclusive)</b>. I shall be grateful for your kind consideration and sanction of the leave for the aforesaid period.'; },
      urgent: function (c) { return 'It is respectfully submitted that I, <b>' + c.name + '</b>, ' + c.designation + c.att + ' am compelled to seek leave at very short notice on account of ' + c.reason + '. I, therefore, request that I may kindly be granted <b>Earned Leave for ' + c.duration + ', i.e., from ' + c.from + ' to ' + c.to + ' (both dates inclusive)</b>, and that the short notice may kindly be condoned.' + tail.urgent; }
    },
    joining: {
      formal: function (c) { return 'Most respectfully, I beg to report that I was on <b>' + c.leave + '</b> from ' + c.from + ' to ' + c.to + ' (both dates inclusive). I have resumed my duties today, i.e., on <b>' + c.resume + ' (' + c.jsession + ')</b>.<br>The joining report is, therefore, submitted for your kind information and necessary action.'; },
      short: function (c) { return 'I was on <b>' + c.leave + '</b> from ' + c.from + ' to ' + c.to + ' (both dates inclusive) and have resumed duty on <b>' + c.resume + ' (' + c.jsession + ')</b>.<br>Submitted for information.'; }
    }
  };

  /* ── write-your-own: tags, safe HTML ───────────────────────────── */
  function renderCustom(text, c) {
    var tags = {
      name: c.name, designation: c.designation, attendance: c.attendance, date: c.date, from: c.from, to: c.to,
      days: c.days, reason: c.reason, session: c.session, half: c.half, duration: c.duration,
      leave: c.leave, resume: c.resume
    };
    var out = esc(text).replace(/\{(\w+)\}/g, function (m, k) { return tags.hasOwnProperty(k) ? esc(tags[k]) : m; });
    out = out.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    return out.replace(/\r?\n\r?\n+/g, '</p><p>').replace(/\r?\n/g, '<br>');
  }

  /* ── hook used by buildLetter() ────────────────────────────────── */
  function currentStyle() { var s = $('bodyTemplate'); return s ? s.value : 'standard'; }

  function override(type, subject, body) {
    var style = currentStyle();
    if (style === 'standard' || type === 'earnedFormI') return null;
    var c = context();
    if (style === 'custom') {
      var txt = val('bodyCustomText');
      var subj = val('bodyCustomSubject').trim();
      return {
        body: txt.trim() ? renderCustom(txt, c) : body,        // nothing typed yet: keep the standard wording
        subject: subj ? esc(subj) : subject
      };
    }
    var fn = BODY[type] && BODY[type][style];
    return fn ? { body: fn(c), subject: subject } : null;
  }

  /* ── UI ────────────────────────────────────────────────────────── */
  function available(type) { return LIMITED[type] || STYLES.map(function (s) { return s.id; }); }

  function buildOptions() {
    var sel = $('bodyTemplate'); if (!sel) return;
    var type = val('leaveType'), ok = available(type), keep = sel.value;
    sel.innerHTML = '';
    STYLES.forEach(function (s) {
      if (ok.indexOf(s.id) < 0) return;
      var o = document.createElement('option'); o.value = s.id; o.textContent = s.label; sel.appendChild(o);
    });
    sel.value = ok.indexOf(keep) >= 0 ? keep : 'standard';
  }

  function paintUI() {
    var group = $('bodyTemplateField'), sel = $('bodyTemplate'); if (!group || !sel) return;
    var type = val('leaveType');
    group.style.display = type === 'earnedFormI' ? 'none' : '';            // Form I is a fixed official format
    var st = STYLES.filter(function (s) { return s.id === sel.value; })[0];
    var d = $('bodyTemplateDesc'); if (d && st) d.textContent = st.desc;
    var box = $('bodyCustomBox'); if (box) box.style.display = sel.value === 'custom' ? '' : 'none';
    var ph = $('bodyCustomText');
    if (ph && TAGGED[type]) ph.placeholder = 'Write the body of your letter here.\n\nExample:\n' + TAGGED[type].replace(/\*\*/g, '');
  }

  function save() {
    lsSet(K_STYLE, currentStyle());
    lsSet(K_TEXT, val('bodyCustomText'));
    lsSet(K_SUBJ, val('bodyCustomSubject'));
  }

  function rerender() { if (typeof window.render === 'function') window.render(); }

  /* re-read the controls (used after "Clear desk" / "Undo") */
  function sync() { buildOptions(); paintUI(); save(); rerender(); }

  function insertAtCursor(text) {
    var ta = $('bodyCustomText'); if (!ta) return;
    var s = ta.selectionStart || 0, e = ta.selectionEnd || 0;
    ta.value = ta.value.slice(0, s) + text + ta.value.slice(e);
    ta.focus(); ta.selectionStart = ta.selectionEnd = s + text.length;
    save(); rerender();
  }

  function init() {
    var sel = $('bodyTemplate'); if (!sel) return;
    buildOptions();
    var saved = lsGet(K_STYLE);
    if (saved) { for (var i = 0; i < sel.options.length; i++) if (sel.options[i].value === saved) { sel.value = saved; break; } }
    var t = lsGet(K_TEXT); if (t && $('bodyCustomText')) $('bodyCustomText').value = t;
    var sj = lsGet(K_SUBJ); if (sj && $('bodyCustomSubject')) $('bodyCustomSubject').value = sj;
    paintUI();

    sel.addEventListener('change', function () {
      paintUI(); save(); rerender();
      if (sel.value === 'custom' && $('bodyCustomText') && !$('bodyCustomText').value.trim()) $('bodyCustomText').focus();
    });
    ['bodyCustomText', 'bodyCustomSubject'].forEach(function (id) {
      var n = $(id); if (n) n.addEventListener('input', function () { save(); rerender(); });
    });
    var tagBox = $('bodyTags');
    if (tagBox) tagBox.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.bt-tag') : null;
      if (b) insertAtCursor(b.getAttribute('data-tag'));
    });
    var fill = $('bodyCustomFill');
    if (fill) fill.addEventListener('click', function () {
      var ta = $('bodyCustomText'), t0 = TAGGED[val('leaveType')];
      if (!ta || !t0) return;
      if (ta.value.trim() && !window.confirm('Replace what you have written with the standard wording?')) return;
      ta.value = t0; save(); rerender();
    });
    var lt = $('leaveType');
    if (lt) lt.addEventListener('change', function () { buildOptions(); paintUI(); save(); });
    rerender();
  }
  global.ArziTemplates = { override: override, sync: sync, styles: STYLES };   // must exist before init() re-renders
  init();
})(window);
