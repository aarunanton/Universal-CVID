/* Universal CV ID — builder interface (v3) */
(function () {
  'use strict';
  const { esc } = UCV;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // every library ships with the site: nothing is fetched from other servers
  const LIBS = {
    pdfjs: 'assets/vendor/pdf.min.js',
    pdfworker: 'assets/vendor/pdf.worker.min.js',
    mammoth: 'assets/vendor/mammoth.browser.min.js',
    docx: 'assets/vendor/docx.umd.js'
  };

  let store = UCV.load();
  let tab = 'edit';
  let pages = 1;
  let pendingImport = null;
  let importNote = false;
  const openGroups = new Set(['version', 'basics', 'work', 'skills']);
  let storageWarned = false;

  const onOwnSite = !/claude/.test(location.hostname); // downloads and printing are blocked inside the Claude preview window
  // Two places: the dashboard (everything across your CVs) and a CV workspace (one CV, step by step).
  const DASH_TABS = [['home', 'Dashboard'], ['tracker', 'Applications'], ['profile', 'Profile']];
  const CV_TABS = [['edit', 'Content'], ['design', 'Design'], ['match', 'Job match', 'Match'], ['score', 'CV check', 'Check'], ['letter', 'Cover letter', 'Letter'], ['share', 'Export']];
  const ALL_TABS = DASH_TABS.concat(CV_TABS).map(t => t[0]).concat('versions');
  const isDash = t => !CV_TABS.some(x => x[0] === t);
  const TAB_ICON = {
    home: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    tracker: '<rect x="4" y="4" width="4" height="16" rx="1"/><rect x="10" y="4" width="4" height="10" rx="1"/><rect x="16" y="4" width="4" height="13" rx="1"/>',
    profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    edit: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 8h3M9 12h7M9 16h7"/>',
    design: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    match: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
    score: '<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-6"/>',
    letter: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 8l9 6 9-6"/>',
    share: '<path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>'
  };
  const isPhone = () => matchMedia('(max-width: 760px)').matches;
  function syncPreviewBtn() {
    const b = $('#previewFab'); if (!b) return;
    const on = document.body.classList.contains('show-preview');
    b.setAttribute('aria-pressed', on);
    b.lastElementChild.textContent = on ? 'Back to editing' : 'Preview';
  }

  // ---------- state helpers ----------
  const active = () => store.versions.find(v => v.vid === store.active) || store.versions[0];
  const res = () => Object.assign(UCV.resolve(store, active()), { jd: active().target.jd, jdCompany: active().target.company });
  const hidden = id => active().hidden.includes(id);
  function persist() {
    active().updatedAt = new Date().toISOString();
    const ok = UCV.save(store);
    const s = $('#saveState');
    if (s) { s.textContent = ok ? 'Saved' : 'Not saved'; s.classList.add('on'); clearTimeout(persist.t); persist.t = setTimeout(() => s.classList.remove('on'), 1200); }
    if (!ok && !storageWarned) { storageWarned = true; toast('Your browser is blocking storage, so changes last only until you close this tab. Export your CV to keep it.', true); }
  }
  function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj); }
  function setPath(obj, path, value) { const keys = path.split('.'); const last = keys.pop(); keys.reduce((o, k) => o[k], obj)[last] = value; }
  const timers = new Map();
  function debounce(fn, ms) { clearTimeout(timers.get(fn)); timers.set(fn, setTimeout(fn, ms)); }
  function toast(msg, warn) {
    const t = document.createElement('div');
    t.className = 'toast' + (warn ? ' warn' : ''); t.setAttribute('role', 'status'); t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), warn ? 6000 : 2600);
  }
  function armed(btn, label, fn) { // two-click confirm, no browser dialogs
    if (btn.dataset.armed) { fn(); return; }
    btn.dataset.armed = '1';
    const old = btn.innerHTML;
    btn.classList.add('armed'); btn.textContent = label;
    setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.classList.remove('armed'); btn.innerHTML = old; } }, 3000);
  }
  async function copy(text, done) {
    try { await navigator.clipboard.writeText(text); toast(done || 'Copied'); }
    catch (e) { toast('Copy was blocked. Select the text and copy it manually.', true); }
  }
  function loadScript(url) {
    return new Promise((ok, fail) => {
      if ($(`script[src="${url}"]`)) return ok();
      const s = document.createElement('script'); s.src = url; s.onload = ok; s.onerror = () => fail(new Error('Could not load a tool this needs. Check your connection.'));
      document.head.appendChild(s);
    });
  }
  function download(filename, data, type) {
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const hasRealContent = () => !store.isSample && (store.master.work.length || store.master.basics.name || store.master.skills.length);

  // ---------- top bar ----------
  function renderBar() {
    $('#versionSelect').innerHTML = store.versions.map(v => `<option value="${v.vid}" ${v.vid === store.active ? 'selected' : ''}>${esc(v.name)}</option>`).join('');
    $('#verName').textContent = active().name;
    const sc = UCV.score(res(), pages);
    const dash = isDash(tab);
    document.body.classList.toggle('mode-dash', dash);
    $('#tabs').innerHTML = (dash ? DASH_TABS : CV_TABS).map(([id, label, short], i) => {
      let badge = '';
      if (id === 'score') badge = `<span class="badge" id="scoreBadge">${sc.score}</span>`;
      if (id === 'tracker' && store.applications.length) badge = `<span class="badge">${store.applications.length}</span>`;
      return `<button class="tab" role="tab" data-tab="${id}" aria-selected="${tab === id || (id === 'home' && tab === 'versions')}" id="tab-${id}"><span class="tab-ic" aria-hidden="true"><svg viewBox="0 0 24 24">${TAB_ICON[id]}</svg></span><span class="tab-tx">${label}</span><span class="tab-sh" aria-hidden="true">${short || label}</span>${badge}</button>`;
    }).join('');
    document.body.classList.toggle('is-start', !!store.isNew);
  }

  // ---------- preview ----------
  function renderPreview() {
    const paper = $('#paper');
    const r = res();
    if (tab === 'letter') { pages = UCV.renderLetter(paper, r, active(), store.id); $('#pageCount').textContent = 'Cover letter · A4'; }
    else { pages = UCV.paginate(paper, Object.assign(UCV.resolve(store, active(), { keep: editKeep }), { jd: r.jd }), store.id); $('#pageCount').textContent = `Click any text to edit · ${pages} page${pages > 1 ? 's' : ''} · A4`; armPage(); }
    fitPaper();
  }
  // ---------- editing on the page ----------
  let editKeep = null, pageBusy = false;
  const BULLET = /^work\.(\d+)\.bullets\.(\d+)\.text$/;
  const edRef = el => ({ obj: el.dataset.e[0] === 'v' ? active() : store.master, path: el.dataset.e.slice(2) });
  function armPage() {
    $$('#paper [data-e]').forEach(el => {
      el.setAttribute('contenteditable', 'plaintext-only');
      if (el.contentEditable !== 'plaintext-only') el.setAttribute('contenteditable', 'true');
      el.spellcheck = true;
    });
  }
  function pageRefresh(focus, atEnd) {
    pageBusy = true;
    renderPreview(); if (tab === 'edit') renderPanel(); debounce(refreshScoreBadge, 300);
    pageBusy = false;
    const el = focus && $(`#paper [data-e="${focus}"]`);
    if (el) { el.focus(); const r = document.createRange(); r.selectNodeContents(el); r.collapse(!atEnd); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
  }
  const pageEl = e => e.target && e.target.closest ? e.target.closest('#paper [data-e]') : null;
  document.addEventListener('focusin', e => {
    const el = pageEl(e); if (!el) return;
    const { obj, path } = edRef(el), raw = String(getPath(obj, path) == null ? '' : getPath(obj, path));
    if (el.textContent !== raw) el.textContent = raw; // show the stored text (with any **bold** marks) while editing
  });
  document.addEventListener('input', e => {
    const el = pageEl(e); if (!el) return;
    const { obj, path } = edRef(el);
    setPath(obj, path, el.textContent.replace(/\s*\n\s*/g, ' '));
    persist();
  });
  document.addEventListener('paste', e => {
    const el = pageEl(e); if (!el || el.contentEditable === 'plaintext-only') return;
    e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text').replace(/\s*\n\s*/g, ' '));
  });
  document.addEventListener('keydown', e => {
    const el = pageEl(e); if (!el) return;
    const { path } = edRef(el), bm = path.match(BULLET);
    if (e.key === 'Escape') { el.blur(); return; }
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      if (!bm) { el.blur(); return; }
      const nb = { id: UCV.uid('b'), text: '' };
      store.master.work[+bm[1]].bullets.splice(+bm[2] + 1, 0, nb); editKeep = nb.id; persist();
      pageRefresh(`m:work.${bm[1]}.bullets.${+bm[2] + 1}.text`);
    } else if (e.key === 'Backspace' && bm && !el.textContent && +bm[2] > 0) {
      e.preventDefault();
      store.master.work[+bm[1]].bullets.splice(+bm[2], 1); editKeep = null; persist();
      const prev = $$(`#paper [data-e^="m:work.${bm[1]}.bullets."]`).map(x => x.dataset.e).filter(x => +x.match(/bullets\.(\d+)/)[1] < +bm[2]).pop();
      pageRefresh(prev, true);
    }
  });
  document.addEventListener('focusout', e => {
    const el = pageEl(e); if (!el || pageBusy) return;
    const { obj, path } = edRef(el), val = String(getPath(obj, path) == null ? '' : getPath(obj, path));
    const bm = path.match(BULLET), sm = path.match(/^skills\.(\d+)\.name$/);
    let structural = false;
    if (!val.trim() && bm) { store.master.work[+bm[1]].bullets.splice(+bm[2], 1); structural = true; }
    if (!val.trim() && sm) { store.master.skills.splice(+sm[1], 1); structural = true; }
    if (structural) persist();
    editKeep = null;
    if (/(summary|text|details|description)$/.test(path)) el.innerHTML = UCV.fmt(val);
    setTimeout(() => {
      const a = document.activeElement;
      if (!structural && a && a.closest && a.closest('#paper [data-e]')) return; // still editing elsewhere on the page
      if (!structural && a && a.closest && a.closest('#panel')) { renderPreview(); debounce(refreshScoreBadge, 300); return; } // moved into the side panel: keep its focus
      pageRefresh();
    }, 0);
  });

  function fitPaper() {
    const wrap = $('#paperWrap'), paper = $('#paper');
    const scale = Math.max(0.2, Math.min(1, (wrap.clientWidth - 36) / 794));
    paper.style.transform = `scale(${scale})`;
    paper.style.width = '794px';
    paper.style.marginBottom = (paper.offsetHeight * (scale - 1)) + 'px';
    paper.style.marginRight = (794 * (scale - 1)) + 'px';
  }
  const refreshScoreBadge = () => { const b = $('#scoreBadge'); if (b) b.textContent = UCV.score(res(), pages).score; if (tab === 'score') $('#panel').innerHTML = renderScore() + nextBar(); };
  const refreshMatch = () => { const r = $('#matchResults'); if (r) r.innerHTML = matchResultsHTML(); };

  // ---------- form helpers ----------
  function field(label, attr, path, value, type = 'text', extra = '') {
    const id = 'f-' + attr + '-' + path.replace(/[.:]/g, '-');
    const bind = `data-${attr}="${path}"`;
    if (type === 'textarea') return `<label class="field" for="${id}">${label}${extra}<textarea id="${id}" ${bind} rows="3">${esc(value)}</textarea></label>`;
    return `<label class="field" for="${id}">${label}${extra}<input id="${id}" type="${type}" ${bind} value="${esc(value)}"></label>`;
  }
  const check = (id, label) => `<label class="tick" title="Show in this version"><input type="checkbox" data-toggle="${id}" ${hidden(id) ? '' : 'checked'}><span class="sr">${label}</span></label>`;
  function itemTitle(section, it) {
    switch (section) {
      case 'work': return it.position || it.company || 'New role';
      case 'education': return it.degree || it.institution || 'New qualification';
      case 'projects': return it.name || 'New project';
      case 'certificates': return it.name || 'New certification';
      case 'languages': return it.language || 'New language';
      default: return it.title || 'New entry';
    }
  }
  function bulletRow(path, b, i) {
    return `<div class="bullet${hidden(b.id) ? ' off' : ''}" data-row="${path}" data-i="${i}">
      <span class="grip" draggable="true" data-drag="${path}" data-i="${i}" title="Drag to reorder" aria-hidden="true">⋮⋮</span>
      ${check(b.id, 'Show this bullet')}
      <textarea rows="1" data-m="${path}.${i}.text" data-bullet="${path}" data-i="${i}" placeholder="What you did and the result, with a number if you can" aria-label="Bullet ${i + 1}">${esc(b.text)}</textarea>
      <button class="icon-btn sm" data-action="remove-bullet" data-path="${path}" data-i="${i}" aria-label="Remove bullet">✕</button></div>`;
  }
  function itemFields(section, base, it) {
    const p = base + '.';
    switch (section) {
      case 'work': return `
        <div class="grid-2">${field('Job title', 'm', p + 'position', it.position)}${field('Company', 'm', p + 'company', it.company)}</div>
        <div class="grid-3">${field('Start', 'm', p + 'startDate', it.startDate, 'month')}${field('End', 'm', p + 'endDate', it.endDate, 'month', ' <span class="hint">blank = current</span>')}${field('Location', 'm', p + 'location', it.location)}</div>
        <div class="bullets-head"><span>Achievements</span><span class="hint">Tick the ones to show in this version. **bold** and *italic* work.</span></div>
        <div class="bullets" data-list="${p}bullets">${it.bullets.map((b, i) => bulletRow(p + 'bullets', b, i)).join('')}</div>
        <div><button class="btn btn-sm" data-action="add-bullet" data-path="${p}bullets">+ Add bullet</button></div>`;
      case 'education': return `
        <div class="grid-2">${field('Degree or qualification', 'm', p + 'degree', it.degree)}${field('Year', 'm', p + 'year', it.year)}</div>
        ${field('Institution', 'm', p + 'institution', it.institution)}${field('Details', 'm', p + 'details', it.details, 'textarea')}`;
      case 'projects': return `
        <div class="grid-2">${field('Project', 'm', p + 'name', it.name)}${field('Link', 'm', p + 'url', it.url)}</div>
        ${field('What it is and the result', 'm', p + 'description', it.description, 'textarea')}`;
      case 'certificates': return `
        <div class="grid-2">${field('Certification', 'm', p + 'name', it.name)}${field('Year', 'm', p + 'date', it.date)}</div>${field('Issued by', 'm', p + 'issuer', it.issuer)}`;
      case 'languages': return `<div class="grid-2">${field('Language', 'm', p + 'language', it.language)}${field('Level', 'm', p + 'fluency', it.fluency)}</div>`;
      default: return `
        <div class="grid-2">${field('Title', 'm', p + 'title', it.title)}${field('Date', 'm', p + 'date', it.date)}</div>
        ${field('Subtitle', 'm', p + 'sub', it.sub)}${field('Details', 'm', p + 'text', it.text, 'textarea', ' <span class="hint">one point per line</span>')}`;
    }
  }
  function itemsHTML(section, path, items) {
    return items.length ? items.map((it, i) => `
      <div class="item${hidden(it.id) ? ' off' : ''}">
        <div class="item-head">
          ${check(it.id, 'Show this entry')}
          <span class="title" data-title="${path}.${i}">${esc(itemTitle(section, it))}</span>
          <button class="icon-btn" data-action="move-item" data-path="${path}" data-i="${i}" data-dir="-1" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="icon-btn" data-action="move-item" data-path="${path}" data-i="${i}" data-dir="1" aria-label="Move down" ${i === items.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="icon-btn" data-action="remove-item" data-path="${path}" data-i="${i}" aria-label="Remove">✕</button>
        </div>
        ${itemFields(section, path + '.' + i, it)}
      </div>`).join('') : `<p class="empty">Nothing here yet.</p>`;
  }
  function groupShell(key, label, count, body, extra = '') {
    return `<details class="group" data-group="${key}" ${openGroups.has(key) ? 'open' : ''}>
      <summary>${label}${count != null ? `<span class="count">${count}</span>` : ''}${extra}</summary>
      <div class="group-body">${body}</div></details>`;
  }
  const shownCount = arr => { const n = arr.filter(x => !hidden(x.id)).length; return n === arr.length ? String(n) : `${n} of ${arr.length} shown`; };
  function listGroup(section, label, addLabel) {
    const items = store.master[section];
    return groupShell(section, label, shownCount(items), `${itemsHTML(section, section, items)}<div><button class="btn btn-sm" data-action="add-item" data-section="${section}" data-path="${section}">+ ${addLabel}</button></div>`);
  }

  // ---------- start screen ----------
  function renderStart() {
    return `
      <section class="panel start">
        <h2>How do you want to start?</h2>
        <p class="sub">Everything stays in this browser. <a href="privacy.html">How your data is handled</a>. You can switch approach later.</p>
        <div class="start-grid">
          <label class="start-card primary" for="startFile">
            <b>Import my CV</b><span>Upload a PDF or Word file and we fill in the sections for you.</span>
            <input id="startFile" type="file" data-import accept=".pdf,.docx,.txt,.json,application/pdf" class="sr">
            <em>Choose a file</em>
          </label>
          <button class="start-card" data-action="start-blank"><b>Start from scratch</b><span>A blank CV with a live preview beside you.</span><em>Start blank</em></button>
          <button class="start-card" data-action="start-example"><b>Explore an example</b><span>See every feature working on a sample CV first.</span><em>Open example</em></button>
        </div>
        <details class="paste"><summary>Or paste your CV as text</summary>
          <div class="stack" style="margin-top:.6rem"><textarea id="importText" rows="6" placeholder="Paste the text of your CV here"></textarea>
          <div><button class="btn" data-action="import-text">Import pasted text</button></div></div>
        </details>
      </section>`;
  }

  // ---------- tabs ----------
  function selection(v) {
    const m = store.master, off = id => v.hidden.includes(id);
    const all = m.work.flatMap(w => w.bullets.map(x => ({ id: x.id, parent: w.id })));
    return { bullets: all.length, bulletsShown: all.filter(x => !off(x.id) && !off(x.parent)).length, skills: m.skills.length, skillsShown: m.skills.filter(x => !off(x.id)).length };
  }
  const journeyState = () => {
    const m = store.master, j = store.journey || {};
    return [
      ['edit', 'Check your CV details', !!(m.basics.name && (m.work.length || m.education.length))],
      ['design', 'Choose a design', !!j.design],
      ['match', 'Tailor for a job', store.versions.some(x => (x.target.jd || '').trim())],
      ['share', 'Download or share', !!j.exported],
      ['tracker', 'Track your application', store.applications.length > 0]
    ];
  };
  function cvStats() {
    let tmp = $('#measure');
    if (!tmp) { tmp = document.createElement('div'); tmp.id = 'measure'; tmp.setAttribute('aria-hidden', 'true'); document.body.appendChild(tmp); }
    const out = store.versions.map(v => {
      const r = Object.assign(UCV.resolve(store, v), { jd: v.target.jd, jdCompany: v.target.company });
      let pg = pages;
      if (v.vid !== store.active) { try { pg = UCV.paginate(tmp, r, store.id); } catch (e) { pg = 1; } }
      const mt = UCV.match(r.cv, v.target.jd, v.target.company), apps = store.applications.filter(a => a.vid === v.vid);
      return { v, score: UCV.score(r, pg).score, match: mt ? mt.score : null, apps: apps.length, sent: apps.filter(a => a.status !== 'Saved').length, interviews: apps.filter(a => a.status === 'Interview' || a.status === 'Offer').length };
    });
    tmp.innerHTML = '';
    return out;
  }
  function renderHome() {
    const m = store.master, first = (m.basics.name || '').trim().split(/\s+/)[0];
    const stats = cvStats(), apps = store.applications;
    const count = st => apps.filter(a => a.status === st).length;
    const sent = apps.filter(a => a.status !== 'Saved').length, today = new Date().toISOString().slice(0, 10);
    const live = apps.filter(a => ['Saved', 'Applied', 'Interview'].includes(a.status)).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const avg = Math.round(stats.reduce((n, x) => n + x.score, 0) / stats.length);
    return `
      <section class="dash-head">
        <div>
          <h2>${first ? esc(first) + '’s' : 'Your'} Universal CV</h2>
          <p>Everything across your CVs and applications, in one place.</p></div>
        <div class="row"><button class="btn btn-primary" data-action="app-add-go">+ Add application</button><button class="btn dash-alt" data-action="new-version">+ New CV</button></div>
      </section>
      <div class="kpis five">
        <div class="kpi k-night"><b>${store.versions.length}</b><span>CV${store.versions.length === 1 ? '' : 's'}</span></div>
        <div class="kpi k-lime"><b>${sent}</b><span>Applications sent</span></div>
        <div class="kpi k-sky"><b>${count('Interview')}</b><span>Interviews</span></div>
        <div class="kpi k-plain"><b>${count('Offer')}</b><span>Offers</span></div>
        <div class="kpi k-plain"><b>${avg}</b><span>Average CV score</span></div>
      </div>
      <section class="panel">
        <div class="trk-top">
          <div><h2>Live applications</h2><p class="sub" style="margin:0">Jobs you have saved, applied for or are interviewing for.</p></div>
          ${apps.length ? `<button class="btn btn-sm" data-tab="tracker">See all ${apps.length}</button>` : ''}
        </div>
        <div class="apps live">${live.length ? live.slice(0, 6).map(a => `
          <div class="app-row live-row">
            <button class="trk-main" data-action="app-goto" data-aid="${a.aid}"><b>${esc(a.role)}</b><span>${esc(a.company)}${a.date ? ' · ' + new Date(a.date + 'T00:00').toLocaleDateString() : ''}</span>${a.followUp && a.followUp <= today && a.status !== 'Saved' ? '<em>Follow up due</em>' : ''}</button>
            <span class="live-cv">${esc((store.versions.find(x => x.vid === a.vid) || {}).name || 'CV removed')}</span>
            <select class="st-sel st-${a.status}" data-app="${a.aid}" data-field="status" aria-label="Stage">${UCV.STATUSES.map(st => `<option ${st === a.status ? 'selected' : ''}>${st}</option>`).join('')}</select>
          </div>`).join('') : '<p class="empty">Nothing live yet. Add the first job you are going for and track it from here.</p>'}</div>
      </section>
      <section class="panel">
        <h2>Your CVs</h2>
        <p class="sub">Click a CV to open it and work on its content, design, job match and export.</p>
        ${versionCards(stats)}
      </section>`;
  }
  function renderProfile() {
    const r = res(), b = r.cv.basics, m = store.master, mb = m.basics, pf = store.prefs || {};
    const done = [mb.name, mb.email, mb.phone, mb.location, mb.url, m.work.length, m.education.length, m.skills.length >= 5, active().summary, pf.roles].filter(Boolean).length;
    const pref = (label, key, ph) => `<label class="field">${label}<input type="text" data-pref="${key}" value="${esc(pf[key] || '')}" placeholder="${ph}"></label>`;
    return `
      <div class="prof-top">
        <section class="panel prof-id">
          <h2>${esc(b.name || 'Your profile')}</h2>
          <p class="sub">${esc(b.label || 'Add your professional title under About you.')}</p>
          <div class="row" style="margin-top:.9rem"><button class="btn btn-sm btn-primary" data-action="open-version" data-vid="${active().vid}">Open my CV</button></div>
          <div class="soon-note"><b>Coming soon: your Universal CV ID</b><span>One permanent ID that links every version of your CV and every application. <a href="blog/universal-cv-id.html">Read more</a></span></div>
        </section>
        <section class="panel">
          <h2>Profile strength</h2>
          <div class="score" style="margin:.4rem 0 1rem"><div class="ring big" style="--v:${done * 10};--c:${ringColor(done * 10)}"><span>${done * 10}</span></div>
            <p class="hint">${done >= 10 ? 'Your profile is complete.' : 'A fuller profile gives every CV more to draw on.'}</p></div>
          <div class="cat-row" style="margin-top:0">
            ${[[m.work.length, 'Roles'], [m.education.length, 'Qualifications'], [m.skills.length, 'Skills'], [m.projects.length, 'Projects'], [m.certificates.length, 'Certifications']].map(([n, l]) => `<div class="cat"><b>${n}</b><span>${l}</span></div>`).join('')}
          </div>
        </section>
      </div>
      <section class="panel">
        <h2>About you</h2>
        <p class="sub">Used on every CV. Change it once here and all your CVs update.</p>
        <div class="stack">
          <div class="grid-2">${field('Full name', 'm', 'basics.name', mb.name)}${field('Email', 'm', 'basics.email', mb.email, 'email')}</div>
          <div class="grid-2">${field('Phone', 'm', 'basics.phone', mb.phone, 'tel')}${field('Location', 'm', 'basics.location', mb.location)}</div>
          ${field('LinkedIn or website', 'm', 'basics.url', mb.url)}
        </div>
      </section>
      <section class="panel">
        <h2>What you are looking for</h2>
        <p class="sub">Kept on this device to guide your search. It is never added to a CV or a shared link.</p>
        <div class="stack">
          <div class="grid-2">${pref('Target roles', 'roles', 'e.g. Senior Product Designer')}${pref('Locations', 'locations', 'e.g. Dublin, remote')}</div>
          <div class="grid-3">
            <label class="field">Way of working<select data-pref="workStyle">${['', 'Remote', 'Hybrid', 'On site', 'Any'].map(o => `<option ${o === (pf.workStyle || '') ? 'selected' : ''} value="${o}">${o || 'Not set'}</option>`).join('')}</select></label>
            ${pref('Salary goal', 'salary', 'Optional')}
            <label class="field">Applications per week<input type="number" min="0" max="50" data-pref="weeklyGoal" value="${esc(pf.weeklyGoal || '')}" placeholder="e.g. 5"></label>
          </div>
        </div>
        <p class="hint" style="margin-top:.7rem">Set a weekly number and the Applications tab shows your progress against it.</p>
      </section>
      <section class="panel">
        <h2>Credentials <span class="tag tag-soon" style="margin-left:.4rem;vertical-align:middle">Coming soon</span></h2>
        <p class="sub" style="margin:0">Backing for your education, employment, certifications and professional registrations. Nothing here is live yet.</p>
      </section>
      ${importPanel()}
      <p class="hint"><a href="privacy.html">How your data is handled</a></p>`;
  }
  function nextBar() {
    const n = { edit: ['design', 'Choose a design'], design: ['match', 'Tailor this CV to a job'], match: ['score', 'Run the CV checks'], score: ['share', 'Download and apply'], letter: ['share', 'Download and apply'], share: ['tracker', 'Track this application'], versions: ['edit', 'Back to the CV'] }[tab];
    if (!n) return '';
    return `<div class="nextbar"><span class="eyebrow">Next</span><button class="btn btn-primary" data-tab="${n[0]}">${n[1]} →</button>${tab === 'score' ? '<button class="btn btn-ghost btn-sm" data-tab="letter">Add a cover letter first</button>' : ''}</div>`;
  }
  function renderEdit() {
    const m = store.master, v = active(), b = m.basics, sel = selection(v);
    const banners = `${importNote ? `<div class="banner info"><span>Imported. Importing is a best guess, so check each section, especially job titles and dates.</span><button class="btn btn-sm" data-action="dismiss-import">Got it</button></div>` : ''}`;
    return `${banners}
      <section class="ver-banner">
        <div><span class="eyebrow">Current version</span><h2>${esc(v.name)}</h2>
          <p>${sel.bulletsShown} of ${sel.bullets} achievements and ${sel.skillsShown} of ${sel.skills} skills selected</p></div>
        <button class="btn btn-sm" data-tab="home">Back to dashboard</button>
      </section>
      ${groupShell('version', 'Title and profile for this version', null, `
        <p class="hint">These two are saved for this version only, so you can reword them for each job.</p>
        ${field('Professional title', 'v', 'label', v.label)}
        ${field('Profile', 'v', 'summary', v.summary, 'textarea', ' <span class="hint">2–4 sentences</span>')}`)}
      <div class="master-head"><span class="eyebrow">Master CV</span><h2>Everything about your career lives here</h2>
        <p>Tick what the current version shows. Anything unticked stays stored for your other versions.</p></div>
      ${groupShell('basics', 'Personal details', null, `
        <div class="grid-2">${field('Full name', 'm', 'basics.name', b.name)}${field('Email', 'm', 'basics.email', b.email, 'email')}</div>
        <div class="grid-2">${field('Phone', 'm', 'basics.phone', b.phone, 'tel')}${field('Location', 'm', 'basics.location', b.location)}</div>
        ${field('LinkedIn or website', 'm', 'basics.url', b.url)}
        <div class="photo-row">
          ${b.photo ? `<img src="${esc(b.photo)}" alt="Your photo" class="photo-thumb">` : '<div class="photo-thumb empty" aria-hidden="true"></div>'}
          <label class="btn btn-sm" for="photoFile">${b.photo ? 'Change photo' : 'Add photo'}<input id="photoFile" type="file" accept="image/*" class="sr"></label>
          ${b.photo ? '<button class="btn btn-sm btn-ghost" data-action="remove-photo">Remove</button>' : ''}
          <span class="hint">Optional. Common in Europe; leave it out for US and UK applications.</span>
        </div>`)}
      ${listGroup('work', 'Experience', 'Add role')}
      ${listGroup('education', 'Education', 'Add qualification')}
      ${groupShell('skills', 'Skills', shownCount(m.skills), `
        <div class="tag-input" id="skillBox">
          ${m.skills.map((s, i) => `<span class="chip skill${hidden(s.id) ? ' off' : ''}"><button class="skill-name" data-action="toggle" data-id="${s.id}" aria-pressed="${!hidden(s.id)}" title="Click to show or hide in this version">${esc(s.name)}</button><button data-action="remove-skill" data-i="${i}" aria-label="Remove ${esc(s.name)}">×</button></span>`).join('')}
          <input id="skillInput" type="text" placeholder="Type a skill, press Enter" aria-label="Add a skill">
        </div>
        <p class="hint">Click a skill to hide it from this version. Paste a comma-separated list to add several.</p>`)}
      ${listGroup('projects', 'Projects', 'Add project')}
      ${listGroup('certificates', 'Certifications', 'Add certification')}
      ${listGroup('languages', 'Languages', 'Add language')}
      ${m.custom.map((c, ci) => groupShell('c:' + c.id, esc(c.title || 'Custom section'), shownCount(c.items), `
        <div class="row">${field('Section name', 'm', `custom.${ci}.title`, c.title)}<button class="btn btn-sm btn-danger" data-action="remove-section" data-i="${ci}" style="align-self:end">Delete section</button></div>
        ${itemsHTML('custom', `custom.${ci}.items`, c.items)}
        <div><button class="btn btn-sm" data-action="add-item" data-section="customItem" data-path="custom.${ci}.items">+ Add entry</button></div>`)).join('')}
      <section class="panel add-section">
        <b>Add a section</b>
        <div class="row">${['Publications', 'Awards', 'Volunteering', 'Training', 'Interests'].map(t => `<button class="btn btn-sm" data-action="add-section" data-title="${t}">+ ${t}</button>`).join('')}<button class="btn btn-sm" data-action="add-section" data-title="">+ Custom</button></div>
      </section>`;
  }

  function tplThumb(id) {
    const g = '#CBD2DC';
    const bars = {
      meridian: `<i style="left:30%;right:30%;top:8px;height:5px;background:#94A3B8"></i><i style="left:20%;right:20%;top:17px"></i><i style="left:10%;right:10%;top:28px;height:1px;background:var(--th)"></i><i style="left:10%;right:30%;top:36px"></i><i style="left:10%;right:20%;top:44px"></i><i style="left:10%;right:40%;top:52px"></i>`,
      classic: `<i style="left:28%;right:28%;top:8px;height:5px;background:#111"></i><i style="left:18%;right:18%;top:17px"></i><i style="left:10%;right:10%;top:26px;height:1px;background:#111"></i><i style="left:38%;right:38%;top:31px;background:#111"></i><i style="left:10%;right:20%;top:39px"></i><i style="left:10%;right:30%;top:46px"></i><i style="left:10%;right:10%;top:53px;height:1px;background:#111"></i>`,
      slate: `<i style="left:10%;right:50%;top:9px;height:5px;background:#94A3B8"></i><i style="left:10%;width:14%;top:26px;background:#E2E8F0"></i><i style="left:30%;right:10%;top:26px"></i><i style="left:30%;right:20%;top:34px"></i><i style="left:10%;width:14%;top:46px;background:#E2E8F0"></i><i style="left:30%;right:14%;top:46px"></i>`,
      ledger: `<i style="left:0;right:0;top:0;height:18px;border-radius:0;background:var(--th)"></i><i style="left:66%;right:0;top:18px;bottom:0;height:auto;border-radius:0;background:#EEF1F6"></i><i style="left:8%;right:40%;top:26px"></i><i style="left:8%;right:44%;top:34px"></i><i style="left:8%;right:38%;top:42px"></i><i style="left:72%;right:8%;top:26px"></i><i style="left:72%;right:12%;top:34px"></i>`,
      compact: `<i style="left:8%;right:50%;top:6px;height:4px;background:#94A3B8"></i><i style="left:8%;right:8%;top:14px;height:1px;background:var(--th)"></i><i style="left:8%;right:20%;top:19px;height:2px"></i><i style="left:8%;right:30%;top:24px;height:2px"></i><i style="left:8%;right:14%;top:29px;height:2px"></i><i style="left:8%;right:8%;top:36px;height:1px;background:var(--th)"></i><i style="left:8%;right:24%;top:41px;height:2px"></i><i style="left:8%;right:18%;top:46px;height:2px"></i><i style="left:8%;right:34%;top:51px;height:2px"></i>`,
      plain: `<i style="left:10%;right:55%;top:8px;height:5px;background:#111"></i><i style="left:10%;right:10%;top:20px;height:1px;background:#111"></i><i style="left:10%;right:20%;top:27px"></i><i style="left:10%;right:30%;top:35px"></i><i style="left:10%;right:10%;top:45px;height:1px;background:#111"></i><i style="left:10%;right:25%;top:52px"></i>`
    }[id];
    return `<div class="tpl-thumb" style="--th:${active().design.accent}">${bars.replace(/<i style="/g, `<i style="background:${g};`)}</div>`;
  }
  function slider(label, key, min, max, step, unit) {
    const d = active().design;
    return `<label class="field" for="d-${key}">${label} <span class="hint" id="d-${key}-val">${d[key]}${unit}</span><input id="d-${key}" type="range" min="${min}" max="${max}" step="${step}" value="${d[key]}" data-d="${key}" data-unit="${unit}"></label>`;
  }
  function renderDesign() {
    const v = active(), d = v.design;
    return `
      <section class="panel">
        <h2>Template</h2><p class="sub">Each version can use its own design.</p>
        <div class="tpl-grid">${UCV.TEMPLATES.map(t => `<button class="tpl" data-action="set-template" data-id="${t.id}" aria-pressed="${d.template === t.id}">${tplThumb(t.id)}<b>${t.name}</b><small>${t.note}</small></button>`).join('')}</div>
      </section>
      <section class="panel">
        <h2>Type and spacing</h2><p class="sub">Tighten these to pull a CV back onto one page.</p>
        <div class="stack">
          <div class="grid-2">
            <label class="field" for="d-font">Font<select id="d-font" data-d="font">${UCV.FONTS.map(f => `<option value="${f.id}" ${d.font === f.id ? 'selected' : ''}>${f.name}</option>`).join('')}</select></label>
            <label class="field" for="d-dateFmt">Date format<select id="d-dateFmt" data-d="dateFmt">${UCV.DATE_FORMATS.map(f => `<option value="${f.id}" ${d.dateFmt === f.id ? 'selected' : ''}>${f.name}</option>`).join('')}</select></label>
          </div>
          <div class="grid-2">${slider('Font size', 'size', 8.5, 12, 0.5, ' pt')}${slider('Line spacing', 'line', 1.15, 1.8, 0.05, '')}</div>
          <div class="grid-2">${slider('Page margins', 'margin', 8, 25, 1, ' mm')}${slider('Space between sections', 'gap', 6, 28, 1, ' px')}</div>
          <div><span class="field">Accent colour${d.template === 'plain' ? ' <span class="hint">Plain ATS always prints in black</span>' : ''}</span>
            <div class="swatches" style="margin-top:.4rem">${UCV.ACCENTS.map(c => `<button class="swatch" style="background:${c}" data-action="set-accent" data-color="${c}" aria-label="Accent ${c}" aria-pressed="${d.accent === c}"></button>`).join('')}</div></div>
          <div class="row">
            <label class="switch"><input type="checkbox" data-dbool="photo" ${d.photo ? 'checked' : ''} ${store.master.basics.photo ? '' : 'disabled'}> Show photo${store.master.basics.photo ? '' : ' <span class="hint">(add one under Content)</span>'}</label>
          </div>
        </div>
      </section>
      <section class="panel">
        <h2>Sections</h2><p class="sub">Drag to reorder. Untick a section to leave it out of this version.</p>
        <ol class="order-list" id="orderList">${v.order.map((k, i) => `
          <li data-row="order" data-i="${i}" class="${v.hiddenSections.includes(k) ? 'off' : ''}">
            <span class="grip" draggable="true" data-drag="order" data-i="${i}" aria-hidden="true">⋮⋮</span>
            <label class="tick"><input type="checkbox" data-sec="${k}" ${v.hiddenSections.includes(k) ? '' : 'checked'}><span class="sr">Show section</span></label>
            <span class="name">${esc(UCV.sectionTitle(store, k))}</span>
            <button class="icon-btn" data-action="move-sec" data-i="${i}" data-dir="-1" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button class="icon-btn" data-action="move-sec" data-i="${i}" data-dir="1" aria-label="Move down" ${i === v.order.length - 1 ? 'disabled' : ''}>↓</button>
          </li>`).join('')}</ol>
      </section>`;
  }

  const ringColor = n => n >= 80 ? 'var(--good)' : n >= 55 ? 'var(--warn)' : 'var(--bad)';
  function renderScore() {
    const s = UCV.score(res(), pages);
    const verdict = s.score >= 85 ? 'Ready to send' : s.score >= 65 ? 'Nearly there' : 'Needs work';
    return `
      <section class="panel">
        <div class="score">
          <div class="ring big" style="--v:${s.score};--c:${ringColor(s.score)}"><span>${s.score}</span></div>
          <div><div class="eyebrow">CV score</div><h2>${verdict}</h2>
          <p class="hint">${s.fails ? `${s.fails} thing${s.fails > 1 ? 's' : ''} to fix. The score updates as you type.` : 'Every check passes.'}${s.match ? '' : ' Paste a job advert under Job match to add keyword checks.'}</p></div>
        </div>
        <div class="cat-row">${s.cats.map(c => `<div class="cat"><b style="color:${ringColor(c.pct)}">${c.pct}%</b><span>${c.name}</span></div>`).join('')}</div>
      </section>
      ${s.cats.map(c => `
        <section class="panel">
          <h2>${c.name}</h2>
          <ul class="checks">${c.list.slice().sort((a, b) => a.ok - b.ok).map(k => `
            <li class="${k.ok ? 'ok' : 'no'}"><span class="mark" aria-hidden="true">${k.ok ? '✓' : '✕'}</span>
              <div><b>${esc(k.label)}</b>${k.detail ? `<p>${esc(k.detail)}</p>` : ''}</div><span class="sr">${k.ok ? 'Passed' : 'Needs attention'}</span></li>`).join('')}</ul>
        </section>`).join('')}`;
  }

  function matchResultsHTML() {
    const r = UCV.match(res().cv, active().target.jd, active().target.company);
    if (!r) return `<p class="empty">Paste a job advert above to see how well this version matches it.</p>`;
    return `
      <div class="score">
        <div class="ring" style="--v:${r.score};--c:${r.score >= 70 ? 'var(--good)' : r.score >= 45 ? 'var(--warn)' : 'var(--bad)'}"><span>${r.score}%</span></div>
        <div><div class="eyebrow">Keyword match</div><h2>${r.found.length} of ${r.found.length + r.missing.length} keywords found</h2>
        <p class="hint">${r.score >= 70 ? 'Strong match.' : 'Add missing terms where they are true for you. Also check your unticked bullets and skills: one of them may already cover it.'}</p></div>
      </div>
      <div class="kw-legend"><span>Missing — click to add to this version's skills</span></div>
      <div class="chips">${r.missing.map(k => `<button class="chip chip-miss" data-action="add-kw" data-kw="${esc(k)}">+ ${esc(k)}</button>`).join('') || '<span class="hint">None</span>'}</div>
      <div class="kw-legend"><span>Found in your CV</span></div>
      <div class="chips">${r.found.map(k => `<span class="chip chip-good">✓ ${esc(k)}</span>`).join('') || '<span class="hint">None yet</span>'}</div>`;
  }
  function targetFields() {
    const t = active().target;
    return `<div class="grid-2">
        <label class="field" for="t-company">Company<input id="t-company" type="text" data-target="company" value="${esc(t.company)}"></label>
        <label class="field" for="t-role">Role<input id="t-role" type="text" data-target="role" value="${esc(t.role)}"></label></div>`;
  }
  function renderMatch() {
    return `
      <section class="panel">
        <h2>Tailor to a job</h2>
        <p class="sub">Paste the job advert. Matching runs on your device; nothing is sent anywhere.</p>
        <div class="stack">${targetFields()}
          <label class="field" for="t-jd">Job advert<textarea id="t-jd" data-target="jd" rows="8" placeholder="Paste the full job description here">${esc(active().target.jd)}</textarea></label>
          <div class="row"><button class="btn btn-primary" data-action="tailor">Save as a new tailored version</button><button class="btn" data-action="track-target">Add to tracker</button></div>
        </div>
      </section>
      <section class="panel" id="matchResults">${matchResultsHTML()}</section>`;
  }

  function renderLetterTab() {
    const v = active();
    return `
      <section class="panel">
        <h2>Cover letter for “${esc(v.name)}”</h2>
        <p class="sub">Uses the same design as this version. The draft is a starting point built from your CV, not AI: rewrite it in your own words.</p>
        <div class="stack">${targetFields()}
          <label class="field" for="l-recipient">Addressed to <span class="hint">leave blank for “Hiring Manager”</span><input id="l-recipient" type="text" data-letter="recipient" value="${esc(v.letter.recipient)}"></label>
          <label class="field" for="l-body">Letter <span class="hint">leave a blank line between paragraphs</span><textarea id="l-body" data-letter="body" rows="14">${esc(v.letter.body)}</textarea></label>
          <div class="row">
            <button class="btn btn-primary" data-action="draft-letter">Draft from my CV</button>
            <button class="btn" data-action="copy-letter">Copy text</button>
            <button class="btn" data-action="docx-letter">Download Word</button>
            ${onOwnSite ? '<button class="btn" data-action="print">Download PDF</button>' : ''}
          </div>
        </div>
      </section>`;
  }

  function versionCards(stats) {
    return `<div class="vgrid">${(stats || cvStats()).map(x => {
      const v = x.v, open = v.vid === store.active;
      const accent = v.design.template === 'plain' ? '#111111' : (v.design.accent || '#2446C7');
      return `
        <article class="vcard${open ? ' is-open' : ''}">
          <button class="vthumb" data-action="open-version" data-vid="${v.vid}" style="--th:${esc(accent)}" aria-label="Open ${esc(v.name)}">${tplThumb(v.design.template)}${open ? '<span class="vnow">Last opened</span>' : ''}</button>
          <div class="vbody">
            <input type="text" value="${esc(v.name)}" data-rename="${v.vid}" aria-label="CV name" title="Click to rename">
            <p class="meta">${esc(v.label || 'No title yet')} · updated ${new Date(v.updatedAt).toLocaleDateString()}</p>
            <div class="vstats"><span><b>${x.score}</b> score</span><span><b>${x.match == null ? '–' : x.match + '%'}</b> match</span><span><b>${x.sent}</b> sent</span></div>
            <div class="ctrls">
              <button class="btn btn-sm btn-primary" data-action="open-version" data-vid="${v.vid}">Open</button>
              <button class="btn btn-sm" data-action="dup-version" data-vid="${v.vid}">Duplicate</button>
              ${store.versions.length > 1 ? `<button class="btn btn-sm btn-danger" data-action="del-version" data-vid="${v.vid}">Delete</button>` : ''}
            </div>
          </div>
        </article>`;
    }).join('')}</div>`;
  }
  function renderVersions() {
    return `
      <section class="panel">
        <h2>Your CVs</h2>
        <p class="sub">All of them draw on the same master CV. Each keeps its own title, profile, ticked items, design and cover letter.</p>
        ${versionCards()}
      </section>`;
  }

  function importPanel() {
    return `
      <section class="panel">
        <h2>Import a CV</h2>
        <p class="sub">Upload a PDF, Word (.docx), text or JSON Resume file. ${hasRealContent() ? 'This replaces your current CV content; your ID and tracker stay.' : 'We fill in the sections for you to check.'}</p>
        <div class="stack">
          <label class="field" for="importFile">From a file<input id="importFile" type="file" data-import accept=".pdf,.docx,.txt,.json,application/pdf"></label>
          <label class="field" for="importText">Or paste the text<textarea id="importText" rows="4" placeholder="Paste the text of your CV"></textarea></label>
          <div class="row"><button class="btn" data-action="import-text">Import pasted text</button><span class="spacer"></span><button class="btn btn-ghost btn-sm" data-action="restart">Start over</button></div>
        </div>
      </section>`;
  }
  function renderShare() {
    const r = res();
    return `
      <section class="panel">
        <h2>Download</h2>
        <p class="sub">The PDF matches the preview exactly and uses real text, so screening software can read it.</p>
        <div class="row">
          ${onOwnSite ? '<button class="btn btn-primary" data-action="print">Download PDF</button>' : ''}
          <button class="btn${onOwnSite ? '' : ' btn-primary'}" data-action="docx">Download Word</button>
          <button class="btn" data-action="pdf">Plain-text PDF</button>
          <button class="btn" data-action="export-json">JSON Resume</button>
          <button class="btn" data-action="copy-json">Copy JSON</button>
        </div>
        <p class="hint" style="margin-top:.6rem">${onOwnSite ? 'Download PDF opens your browser\'s print window: choose “Save as PDF” as the printer.' : 'Downloads are switched off in this preview window. They work on your published site.'}</p>
      </section>
      <section class="panel">
        <h2>Share</h2>
        <p class="sub">Links carry your CV inside them, so they work without an account. <b>A link can't be taken back once sent</b>, and anyone who has it can read it. Photos are never included.</p>
        <div class="share-opts"><span>Contact details to include:</span>
          ${[['email', 'Email'], ['phone', 'Phone'], ['location', 'Location']].map(([k, l]) => `<label class="switch"><input type="checkbox" data-share="${k}" ${(store.share || {})[k] ? 'checked' : ''}> ${l}</label>`).join('')}
        </div>
        <div class="share-grid">
          <div class="stack">
            <label class="field" for="shareLink">Full CV link (“${esc(r.name)}”)<div class="linkbox"><input id="shareLink" type="text" readonly value="${esc(UCV.shareLink(store, r))}"><button class="btn" data-action="copy" data-src="shareLink">Copy</button></div></label>
            <label class="field" for="cardLink">Contact card link <span class="hint">short, used by the QR code</span><div class="linkbox"><input id="cardLink" type="text" readonly value="${esc(UCV.cardLink(store, r))}"><button class="btn" data-action="copy" data-src="cardLink">Copy</button></div></label>
          </div>
          <div class="stack" style="justify-items:center"><div class="qr" id="qr" aria-label="QR code for your contact card"></div><span class="hint">For business cards and badges</span></div>
        </div>
      </section>`;
  }

  let appFilter = 'All', appOpen = null, appAdding = false;
  // After a download or a copied link, offer to log the application (once per CV per visit).
  const logAsked = new Set();
  function offerLog() {
    const v = active(), t = v.target;
    if (isDash(tab) || logAsked.has(v.vid)) return;
    if (t.company && store.applications.some(a => a.vid === v.vid && a.company === t.company)) return;
    logAsked.add(v.vid);
    let el = $('#logPrompt');
    if (!el) { el = document.createElement('div'); el.id = 'logPrompt'; el.className = 'log-prompt'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Log this application'); document.body.appendChild(el); }
    el.innerHTML = `<form id="logForm"><div><b>Sending this CV to an employer?</b><span>Log it now so you know which CV went where.</span></div>
      <div class="row"><input name="role" type="text" placeholder="Role" aria-label="Role" value="${esc(t.role)}" required><input name="company" type="text" placeholder="Company" aria-label="Company" value="${esc(t.company)}" required>
      <button class="btn btn-primary" type="submit">Log application</button><button class="btn" type="button" data-action="log-dismiss">Not now</button></div></form>`;
    el.hidden = false;
  }
  function renderTracker() {
    const all = store.applications, today = new Date().toISOString().slice(0, 10);
    const count = st => st === 'All' ? all.length : all.filter(a => a.status === st).length;
    const verOpts = sel => store.versions.map(v => `<option value="${v.vid}" ${v.vid === sel ? 'selected' : ''}>${esc(v.name)}</option>`).join('');
    const apps = all.filter(a => appFilter === 'All' || a.status === appFilter).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const goal = +((store.prefs || {}).weeklyGoal) || 0;
    const weekAgo = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
    const thisWeek = all.filter(a => a.status !== 'Saved' && a.date && a.date >= weekAgo && a.date <= today).length;
    const due = a => a.followUp && a.followUp <= today && (a.status === 'Applied' || a.status === 'Interview');
    const dueCount = all.filter(due).length;
    return `
      <section class="panel">
        <div class="trk-top">
          <div><h2>Applications</h2><p class="sub" style="margin:0">Every job you are going for, which CV you sent, and what happens next.</p></div>
          <button class="btn btn-primary" data-action="app-add">${appAdding ? 'Close' : '+ Add application'}</button>
        </div>
        <div class="trk-filters" role="group" aria-label="Filter by stage">${['All', ...UCV.STATUSES].map(st => `<button class="trk-f f-${st}" data-action="app-filter" data-st="${st}" aria-pressed="${appFilter === st}"><b>${count(st)}</b><span>${st}</span></button>`).join('')}</div>
        ${goal || dueCount ? `<div class="trk-notes">
          ${goal ? `<div class="trk-goal"><span>This week: <b>${thisWeek} of ${goal}</b> applications sent</span><div class="bar"><i style="width:${Math.min(100, thisWeek / goal * 100)}%"></i></div></div>` : ''}
          ${dueCount ? `<span class="pill st-Interview">${dueCount} follow-up${dueCount > 1 ? 's' : ''} due</span>` : ''}</div>` : ''}
      </section>
      ${appAdding ? `<section class="panel">
        <h2>Add an application</h2>
        <form id="appForm" class="stack" style="margin-top:.6rem">
          <div class="grid-2"><label class="field" for="a-role">Role<input id="a-role" name="role" type="text" required></label><label class="field" for="a-company">Company<input id="a-company" name="company" type="text" required></label></div>
          <div class="grid-3"><label class="field" for="a-vid">CV sent<select id="a-vid" name="vid">${verOpts(store.active)}</select></label><label class="field" for="a-status">Stage<select id="a-status" name="status">${UCV.STATUSES.map(st => `<option ${st === 'Applied' ? 'selected' : ''}>${st}</option>`).join('')}</select></label><label class="field" for="a-date">Date<input id="a-date" name="date" type="date" value="${today}"></label></div>
          <label class="field" for="a-url">Job link <span class="hint">optional</span><input id="a-url" name="url" type="url"></label>
          <div class="row"><button class="btn btn-primary" type="submit">Add application</button><button class="btn" type="button" data-action="app-add">Cancel</button></div>
        </form>
      </section>` : ''}
      <section class="panel trk">
        ${apps.length ? `<div class="trk-row trk-headrow" aria-hidden="true"><span>Role</span><span>CV sent</span><span>Stage</span><span>Applied</span><span>Follow up</span><span>Interest</span><span></span></div>` : ''}
        <div class="apps">${apps.length ? apps.map(a => `
        <div class="app-row${appOpen === a.aid ? ' is-open' : ''}">
          <div class="trk-row">
            <button class="trk-main" data-action="app-open" data-aid="${a.aid}" aria-expanded="${appOpen === a.aid}"><b>${esc(a.role)}</b><span>${esc(a.company)}${a.location ? ' · ' + esc(a.location) : ''}</span>${due(a) ? '<em>Follow up due</em>' : ''}</button>
            <label class="trk-cell"><span class="trk-lab">CV sent</span><select data-app="${a.aid}" data-field="vid" aria-label="CV sent">${verOpts(a.vid)}</select></label>
            <label class="trk-cell"><span class="trk-lab">Stage</span><select class="st-sel st-${a.status}" data-app="${a.aid}" data-field="status" aria-label="Stage">${UCV.STATUSES.map(st => `<option ${st === a.status ? 'selected' : ''}>${st}</option>`).join('')}</select></label>
            <label class="trk-cell"><span class="trk-lab">Applied</span><input type="date" data-app="${a.aid}" data-field="date" value="${esc(a.date || '')}" aria-label="Date applied"></label>
            <label class="trk-cell"><span class="trk-lab">Follow up</span><input type="date" data-app="${a.aid}" data-field="followUp" value="${esc(a.followUp || '')}" aria-label="Follow-up date"></label>
            <span class="stars" role="group" aria-label="Interest, ${+a.excitement || 0} of 5">${[1, 2, 3, 4, 5].map(n => `<button data-action="app-star" data-aid="${a.aid}" data-n="${n}" class="${n <= (+a.excitement || 0) ? 'on' : ''}" aria-label="${n} of 5">★</button>`).join('')}</span>
            <button class="icon-btn" data-action="app-open" data-aid="${a.aid}" aria-label="${appOpen === a.aid ? 'Hide' : 'Show'} details">${appOpen === a.aid ? '–' : '+'}</button>
          </div>
          ${appOpen === a.aid ? `<div class="trk-detail">
            <div class="grid-3">
              <label class="field">Location<input type="text" data-app="${a.aid}" data-field="location" value="${esc(a.location || '')}" placeholder="City or remote"></label>
              <label class="field">Salary<input type="text" data-app="${a.aid}" data-field="salary" value="${esc(a.salary || '')}" placeholder="As advertised"></label>
              <label class="field">Contact<input type="text" data-app="${a.aid}" data-field="contact" value="${esc(a.contact || '')}" placeholder="Recruiter name or email"></label>
            </div>
            <label class="field">Job link<div class="linkbox"><input type="url" data-app="${a.aid}" data-field="url" value="${esc(a.url || '')}" placeholder="https://">${UCV.safeUrl(a.url) ? `<a class="btn" href="${esc(UCV.safeUrl(a.url))}" target="_blank" rel="noopener noreferrer">Open</a>` : ''}</div></label>
            <label class="field">Notes<textarea rows="3" data-app="${a.aid}" data-field="notes" placeholder="Interview dates, who you spoke to, what to follow up on">${esc(a.notes || '')}</textarea></label>
            <div class="row"><button class="btn btn-sm" data-action="open-version" data-vid="${esc(a.vid)}">Open the CV sent</button><span class="spacer"></span><button class="btn btn-sm btn-danger" data-action="del-app" data-aid="${a.aid}">Delete</button></div>
          </div>` : ''}
        </div>`).join('') : `<p class="empty">${all.length ? 'Nothing at this stage.' : 'No applications yet. Add one here, or use “Add to tracker” in a CV’s Job match step.'}</p>`}</div>
      </section>`;
  }

  function pendingBanner() {
    return pendingImport ? `<div class="banner"><span>Replace your current CV with the imported one? Your ID, versions list and tracker entries stay; CV content is replaced.</span><button class="btn btn-sm" data-action="cancel-import">Cancel</button><button class="btn btn-sm btn-primary" data-action="confirm-import" style="margin-left:0">Replace</button></div>` : '';
  }
  function renderPanel() {
    const panel = $('#panel');
    if (store.isNew) { panel.innerHTML = renderStart(); return; }
    const html = { home: renderHome, profile: renderProfile, edit: renderEdit, design: renderDesign, score: renderScore, match: renderMatch, letter: renderLetterTab, versions: renderVersions, share: renderShare, tracker: renderTracker }[tab]();
    panel.innerHTML = pendingBanner() + html + nextBar();
    panel.setAttribute('aria-labelledby', 'tab-' + (tab === 'versions' ? 'home' : tab));
    if (tab === 'share') renderQR();
    $$('textarea[data-bullet]', panel).forEach(autosize);
  }
  function renderAll() { document.body.classList.toggle('is-start', !!store.isNew); document.body.classList.toggle('mode-dash', isDash(tab)); renderPanel(); renderPreview(); renderBar(); }
  function autosize(el) { el.style.height = 'auto'; el.style.height = (el.scrollHeight + 2) + 'px'; }
  function renderQR() {
    const el = $('#qr');
    if (!el) return;
    el.innerHTML = '';
    if (typeof QRCode === 'undefined') { el.innerHTML = '<span class="hint">QR code could not load</span>'; return; }
    try { new QRCode(el, { text: UCV.cardLink(store, res()), width: 150, height: 150, correctLevel: QRCode.CorrectLevel.M }); el.removeAttribute('title'); }
    catch (e) { el.innerHTML = '<span class="hint">Too much text for a QR code</span>'; }
  }

  // ---------- import ----------
  async function pdfText(file) {
    await loadScript(LIBS.pdfjs);
    const lib = window.pdfjsLib;
    lib.GlobalWorkerOptions.workerSrc = LIBS.pdfworker;
    const doc = await lib.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false }).promise;
    const out = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const content = await (await doc.getPage(p)).getTextContent();
      const rows = [];
      content.items.forEach(it => {
        if (!it.str || !it.str.trim()) return;
        const y = it.transform[5];
        let row = rows.find(r => Math.abs(r.y - y) < 2.5);
        if (!row) { row = { y, parts: [] }; rows.push(row); }
        row.parts.push({ x: it.transform[4], s: it.str, w: it.width || 0, h: Math.hypot(it.transform[0], it.transform[1]) || 10 });
      });
      rows.forEach(r => r.parts.sort((a, b) => a.x - b.x));
      const base = Math.min(...rows.map(r => r.parts[0].x)); // left margin of the page
      rows.sort((a, b) => b.y - a.y).forEach(r => {
        let line = '', end = null;
        r.parts.forEach(pt => {
          if (end !== null) { const gap = pt.x - end; line += gap > pt.h * 1.1 ? '    ' : gap > pt.h * 0.22 && !/\s$/.test(line) && !/^\s/.test(pt.s) ? ' ' : ''; }
          line += pt.s; end = pt.x + pt.w;
        });
        // browsers draw bullet dots as graphics, not text: recognise bullets by their indent instead
        const x0 = r.parts[0].x, t = line.trim();
        if (x0 > base + 8 && x0 < base + 46 && /^[A-Z0-9"“(]/.test(t) && t.split(/\s+/).length >= 4 && !/^[•\-*·▪◦●○■➢►✓]/.test(t)) line = '• ' + t;
        out.push(line);
      });
    }
    return out.join('\n');
  }
  async function docxText(file) {
    await loadScript(LIBS.mammoth);
    // Word keeps bullets as list formatting, not as text, so read the structure and put the bullets back
    const r = await window.mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    const dom = new DOMParser().parseFromString(r.value, 'text/html');
    const out = [];
    dom.body.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, td').forEach(el => {
      if (el.tagName === 'TD' && el.querySelector('p, li')) return;
      if (el.tagName === 'P' && el.closest('li')) return;
      const html = el.innerHTML.replace(/<br\s*\/?>/gi, '\n');
      const tmp = document.createElement('div'); tmp.innerHTML = html;
      tmp.textContent.split('\n').forEach(t => { t = t.replace(/\t/g, '    ').trim(); if (t) out.push((el.tagName === 'LI' ? '• ' : '') + t); });
    });
    return out.join('\n');
  }
  async function importFile(file) {
    const name = file.name.toLowerCase();
    toast('Reading your CV…');
    try {
      let cv;
      if (name.endsWith('.json')) cv = UCV.fromJSONResume(JSON.parse(await file.text()));
      else {
        let text;
        if (name.endsWith('.pdf')) text = await pdfText(file);
        else if (name.endsWith('.docx')) text = await docxText(file);
        else if (name.endsWith('.doc')) throw new Error('Old .doc files can\'t be read. Save it as .docx or PDF and try again.');
        else text = await file.text();
        if (!text || text.replace(/\s/g, '').length < 40) throw new Error('No text found in that file. If it is a scanned image, paste the text instead.');
        cv = UCV.parseText(text);
      }
      offerImport(cv);
    } catch (e) { toast(e.message || 'Could not read that file.', true); }
  }
  function offerImport(cv) {
    cv = UCV.cleanCV(cv);
    if (hasRealContent() && !store.isNew) { pendingImport = cv; renderPanel(); $('#panel').scrollIntoView({ block: 'start' }); }
    else applyImport(cv);
  }
  function applyImport(cv) {
    store.master = UCV.toMaster(cv);
    const v = UCV.newVersion('Main CV');
    v.label = cv.basics.label || ''; v.summary = cv.basics.summary || '';
    const keep = active();
    v.design = UCV.clone(keep.design);
    store.versions = [v]; store.active = v.vid;
    store.applications.forEach(a => { a.vid = v.vid; });
    if (store.isSample) store.applications = [];
    store.isSample = false; store.isNew = false; pendingImport = null; importNote = true;
    UCV.fixOrder(store, v);
    ['work', 'education', 'skills'].forEach(g => openGroups.add(g));
    persist(); tab = 'edit'; renderAll();
    const n = store.master.work.length;
    toast(`Imported ${n} role${n === 1 ? '' : 's'}, ${store.master.education.length} qualification${store.master.education.length === 1 ? '' : 's'} and ${store.master.skills.length} skills.`);
  }
  function setPhoto(file) {
    const img = new Image();
    img.onload = () => {
      const S = 320, c = document.createElement('canvas'); c.width = c.height = S;
      const side = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, S, S);
      store.master.basics.photo = c.toDataURL('image/jpeg', 0.85);
      active().design.photo = true;
      persist(); renderAll(); URL.revokeObjectURL(img.src);
    };
    img.onerror = () => toast('That image could not be read.', true);
    img.src = URL.createObjectURL(file);
  }

  // ---------- actions ----------
  function addSkills(raw, onlyThisVersion) {
    const m = store.master;
    const added = raw.split(/[,\n;]/).map(s => s.trim()).filter(Boolean);
    let n = 0;
    added.forEach(name => {
      const hit = m.skills.find(k => k.name.toLowerCase() === name.toLowerCase());
      if (hit) { if (hidden(hit.id)) { active().hidden = active().hidden.filter(x => x !== hit.id); n++; } return; }
      const s = { id: UCV.uid('s'), name }; m.skills.push(s); n++;
      if (onlyThisVersion) store.versions.forEach(v => { if (v !== active()) v.hidden.push(s.id); });
    });
    if (n) persist();
    return n;
  }
  function toggleId(id) {
    const v = active();
    v.hidden = v.hidden.includes(id) ? v.hidden.filter(x => x !== id) : [...v.hidden, id];
    persist();
  }
  function print() {
    const old = document.title;
    let root = $('#printRoot');
    if (!root) { root = document.createElement('div'); root.id = 'printRoot'; document.body.appendChild(root); }
    root.innerHTML = $('#paper').innerHTML;
    document.title = UCV.fileStem(store, res()) + (tab === 'letter' ? '_cover_letter' : '');
    document.body.classList.add('printing');
    const done = () => { document.body.classList.remove('printing'); root.innerHTML = ''; document.title = old; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
    setTimeout(done, 120000);
  }
  async function exportDocx(letter) {
    try {
      await loadScript(LIBS.docx);
      const r = res(), v = active();
      const blob = await UCV.docxBlob(store, r, letter ? { recipient: v.letter.recipient, company: v.target.company, role: v.target.role, body: UCV.plain(v.letter.body) } : null);
      download(UCV.fileStem(store, r) + (letter ? '_cover_letter' : '') + '.docx', blob);
      toast('Word file ready');
    } catch (e) { toast(e.message || 'Could not create the Word file.', true); }
  }

  document.addEventListener('click', e => {
    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) {
      const was = tab; tab = tabBtn.dataset.tab;
      if (document.body.classList.contains('panel-off')) { document.body.classList.remove('panel-off'); const pb = $('[data-action="toggle-panel"]'); if (pb) pb.textContent = 'Hide panel'; }
      if (tab === 'design' && !(store.journey || {}).design) { (store.journey = store.journey || {}).design = true; persist(); }
      try { history.replaceState(null, '', '#' + tab); } catch (_) {}
      renderPanel(); if (was === 'letter' || tab === 'letter') renderPreview(); renderBar();
      if (isPhone()) {
        document.body.classList.remove('show-preview'); syncPreviewBtn(); window.scrollTo(0, 0);

      } else window.scrollTo(0, 0);
      fitPaper();
      return;
    }
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const v = active(), m = store.master, a = btn.dataset.action;
    if (['print', 'docx', 'pdf', 'copy', 'export-json'].includes(a) && !(store.journey || {}).exported) { (store.journey = store.journey || {}).exported = true; persist(); }
    if (['print', 'docx', 'pdf', 'copy', 'download-main'].includes(a)) setTimeout(offerLog, 700);
    const i = +btn.dataset.i;
    const redraw = () => { persist(); renderPanel(); renderPreview(); renderBar(); };

    switch (a) {
      case 'start-blank': store = UCV.freshStore(false); store.isNew = false; UCV.save(store); tab = 'edit'; renderAll(); toast('Blank CV ready.'); break;
      case 'start-example': store.isNew = false; persist(); tab = 'home'; renderAll(); break;
      case 'toggle-panel': document.body.classList.toggle('panel-off'); btn.textContent = document.body.classList.contains('panel-off') ? 'Show panel' : 'Hide panel'; fitPaper(); break;
      case 'toggle-preview': document.body.classList.toggle('show-preview'); syncPreviewBtn(); fitPaper(); window.scrollTo(0, 0); break;
      case 'restart': armed(btn, 'Click again to start over', () => { store = UCV.freshStore(true); UCV.save(store); tab = 'edit'; importNote = false; renderAll(); }); break;
      case 'dismiss-import': importNote = false; renderPanel(); break;
      case 'confirm-import': applyImport(pendingImport); break;
      case 'cancel-import': pendingImport = null; renderPanel(); break;
      case 'import-text': {
        const text = $('#importText').value.trim();
        if (text.length < 40) { toast('Paste the text of your CV first.', true); return; }
        try { offerImport(text.startsWith('{') ? UCV.fromJSONResume(JSON.parse(text)) : UCV.parseText(text)); } catch (err) { toast(err.message, true); }
        break;
      }
      case 'toggle': toggleId(btn.dataset.id); redraw(); break;
      case 'add-item': {
        const list = getPath(m, btn.dataset.path);
        const fresh = UCV.blankItem(btn.dataset.section);
        if (btn.dataset.section === 'work' && list.length) { // carry dates over from the neighbouring role; both stay editable
          const first = list[0], last = list[list.length - 1];
          const oldestFirst = list.length > 1 && first.startDate && last.startDate && first.startDate < last.startDate;
          if (oldestFirst) fresh.startDate = last.endDate || ''; else fresh.endDate = last.startDate || '';
        }
        list.push(fresh);
        openGroups.add(btn.dataset.path.startsWith('custom') ? 'c:' + m.custom[+btn.dataset.path.split('.')[1]].id : btn.dataset.section);
        redraw();
        setTimeout(() => { const items = $$('.item', btn.closest('.group-body')); items[items.length - 1]?.querySelector('input[type=text], input[type=email]')?.focus(); }, 0);
        break;
      }
      case 'remove-item': armed(btn, 'Remove?', () => { getPath(m, btn.dataset.path).splice(i, 1); redraw(); }); break;
      case 'move-item': {
        const list = getPath(m, btn.dataset.path), j = i + +btn.dataset.dir;
        if (j < 0 || j >= list.length) return;
        [list[i], list[j]] = [list[j], list[i]]; redraw(); break;
      }
      case 'add-bullet': {
        const list = getPath(m, btn.dataset.path); list.push({ id: UCV.uid('b'), text: '' }); redraw();
        setTimeout(() => $(`textarea[data-m="${btn.dataset.path}.${list.length - 1}.text"]`)?.focus(), 0);
        break;
      }
      case 'remove-bullet': getPath(m, btn.dataset.path).splice(i, 1); redraw(); break;
      case 'remove-skill': m.skills.splice(i, 1); redraw(); $('#skillInput')?.focus(); break;
      case 'add-section': {
        const c = { id: UCV.uid('c'), title: btn.dataset.title || 'New section', items: [Object.assign(UCV.blankItem('customItem'))] };
        m.custom.push(c); store.versions.forEach(x => UCV.fixOrder(store, x)); openGroups.add('c:' + c.id); redraw();
        break;
      }
      case 'remove-section': armed(btn, 'Delete section?', () => { m.custom.splice(i, 1); store.versions.forEach(x => UCV.fixOrder(store, x)); redraw(); }); break;
      case 'remove-photo': m.basics.photo = ''; store.versions.forEach(x => { x.design.photo = false; }); redraw(); break;
      case 'set-template':
        v.design.template = btn.dataset.id;
        redraw(); break;
      case 'set-accent': v.design.accent = btn.dataset.color; redraw(); break;
      case 'move-sec': { const j = i + +btn.dataset.dir; [v.order[i], v.order[j]] = [v.order[j], v.order[i]]; redraw(); break; }
      case 'add-kw': {
        if (addSkills(btn.dataset.kw, true)) toast(`Added “${btn.dataset.kw}” to this version's skills`);
        refreshMatch(); renderPreview(); renderBar(); break;
      }
      case 'tailor': {
        const t = v.target;
        if (!t.jd.trim()) { toast('Paste a job advert first.', true); return; }
        const nv = UCV.clone(v); nv.vid = UCV.uid('v'); nv.name = [t.company, t.role].filter(Boolean).join(' – ') || 'Tailored CV'; nv.updatedAt = new Date().toISOString();
        store.versions.push(nv); store.active = nv.vid; tab = 'edit'; persist(); renderAll();
        toast(`Created “${nv.name}”. Untick what doesn't fit this job; your other versions don't change.`);
        break;
      }
      case 'track-target': {
        const t = v.target;
        if (!t.company && !t.role) { toast('Add the company and role first.', true); return; }
        store.applications.push({ aid: UCV.uid('a'), company: t.company || 'Company', role: t.role || 'Role', vid: v.vid, status: 'Saved', date: new Date().toISOString().slice(0, 10), url: '', notes: '' });
        persist(); renderBar(); toast('Added to tracker as Saved'); break;
      }
      case 'draft-letter': {
        const go = () => { v.letter.body = UCV.draftLetter(res(), v); persist(); renderPanel(); renderPreview(); toast('Draft ready. Edit it to sound like you.'); };
        if (v.letter.body.trim()) armed(btn, 'Replace my letter?', go); else go();
        break;
      }
      case 'copy-letter': copy(UCV.letterText(res(), v), 'Letter copied'); break;
      case 'docx-letter': exportDocx(true); break;
      case 'docx': exportDocx(false); break;
      case 'open-version': store.active = btn.dataset.vid; tab = 'edit'; persist(); document.body.classList.remove('show-preview'); syncPreviewBtn(); renderAll(); window.scrollTo(0, 0); try { history.replaceState(null, '', '#edit'); } catch (_) {} break;
      case 'dup-version': case 'new-version': {
        const src = a === 'new-version' ? v : store.versions.find(x => x.vid === btn.dataset.vid);
        const nv = UCV.clone(src); nv.vid = UCV.uid('v'); nv.updatedAt = new Date().toISOString();
        nv.name = a === 'new-version' ? 'Version ' + (store.versions.length + 1) : src.name + ' (copy)';
        if (a === 'new-version') { nv.target = { company: '', role: '', jd: '' }; nv.letter = { recipient: '', body: '' }; store.active = nv.vid; }
        store.versions.push(nv); persist(); renderAll();
        toast(a === 'new-version' ? `Created “${nv.name}” from “${src.name}”. Rename it under Versions.` : `Duplicated “${src.name}”`);
        break;
      }
      case 'del-version':
        armed(btn, 'Click again to delete', () => {
          store.versions = store.versions.filter(x => x.vid !== btn.dataset.vid);
          if (store.active === btn.dataset.vid) store.active = store.versions[0].vid;
          store.applications.forEach(ap => { if (ap.vid === btn.dataset.vid) ap.vid = ''; });
          persist(); renderAll(); toast('Version deleted');
        });
        break;
      case 'copy': copy($('#' + btn.dataset.src).value, 'Link copied'); break;
      case 'copy-id': copy(store.id, 'ID copied'); break;
      case 'pdf':
        if (!window.jspdf) { toast('The PDF tool did not load. Check your connection and reload.', true); return; }
        try { UCV.pdf(store, res()); toast('PDF ready'); } catch (err) { toast('Could not create the PDF.', true); }
        break;
      case 'download-main': if (onOwnSite) print(); else if (window.jspdf) { UCV.pdf(store, res()); } break;
      case 'print': print(); break;
      case 'export-json': download(UCV.fileStem(store, res()) + '.json', JSON.stringify(UCV.toJSONResume(store, res()), null, 2), 'application/json'); break;
      case 'copy-json': copy(JSON.stringify(UCV.toJSONResume(store, res()), null, 2), 'JSON copied'); break;
      case 'app-add': appAdding = !appAdding; renderPanel(); if (appAdding) { const f = $('#a-role'); if (f) f.focus(); } break;
      case 'app-add-go': appAdding = true; appFilter = 'All'; tab = 'tracker'; renderAll(); window.scrollTo(0, 0); { const f = $('#a-role'); if (f) f.focus(); } break;
      case 'app-goto': appOpen = btn.dataset.aid; appFilter = 'All'; appAdding = false; tab = 'tracker'; renderAll(); { const r = $('.app-row.is-open'); if (r) r.scrollIntoView({ block: 'center' }); } break;
      case 'log-dismiss': { const lp = $('#logPrompt'); if (lp) lp.hidden = true; break; }
      case 'app-filter': appFilter = btn.dataset.st; renderPanel(); break;
      case 'app-open': appOpen = appOpen === btn.dataset.aid ? null : btn.dataset.aid; renderPanel(); break;
      case 'app-star': { const ap = store.applications.find(x => x.aid === btn.dataset.aid); ap.excitement = +ap.excitement === +btn.dataset.n ? 0 : +btn.dataset.n; UCV.save(store); renderPanel(); break; }
      case 'del-app': armed(btn, 'Click again', () => { store.applications = store.applications.filter(x => x.aid !== btn.dataset.aid); persist(); renderBar(); renderPanel(); }); break;
      case 'theme': {
        const root = document.documentElement;
        const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
        root.dataset.theme = dark ? 'light' : 'dark';
        try { localStorage.setItem('ucvid:theme', root.dataset.theme); } catch (_) {}
        break;
      }
    }
  });

  document.addEventListener('input', e => {
    const t = e.target, v = active(), d = t.dataset;
    if (d.m) {
      setPath(store.master, d.m, t.value);
      if (d.bullet) autosize(t);
      const mt = d.m.match(/^(.*)\.(\d+)\.[a-zA-Z]+$/);
      if (mt) { const el = $(`[data-title="${mt[1]}.${mt[2]}"]`); if (el) { const sec = mt[1].startsWith('custom') ? 'custom' : mt[1]; el.textContent = itemTitle(sec, getPath(store.master, mt[1] + '.' + mt[2])); } }
      persist(); renderPreview(); debounce(refreshScoreBadge, 300);
    } else if (d.v) { v[d.v] = t.value; persist(); renderPreview(); debounce(refreshScoreBadge, 300); }
    else if (d.target) { v.target[d.target] = t.value; persist(); debounce(refreshMatch, 250); debounce(refreshScoreBadge, 400); if (tab === 'letter') renderPreview(); }
    else if (d.letter) { v.letter[d.letter] = t.value; persist(); renderPreview(); }
    else if (d.d && t.type === 'range') { v.design[d.d] = +t.value; $('#d-' + d.d + '-val').textContent = t.value + (d.unit || ''); persist(); renderPreview(); debounce(refreshScoreBadge, 300); }
    else if (d.rename) {
      store.versions.find(x => x.vid === d.rename).name = t.value || 'Untitled'; UCV.save(store);
      $('#versionSelect').innerHTML = store.versions.map(x => `<option value="${x.vid}" ${x.vid === store.active ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
      $('#verName').textContent = active().name;
    } else if (d.app && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) { store.applications.find(x => x.aid === d.app)[d.field] = t.value; UCV.save(store); }
    else if (d.pref && t.tagName !== 'SELECT') { (store.prefs = store.prefs || {})[d.pref] = t.value; UCV.save(store); }
  });

  document.addEventListener('change', e => {
    const t = e.target, v = active(), d = t.dataset;
    if (t.id === 'versionSelect') { store.active = t.value; persist(); renderAll(); return; }
    if (d.toggle) { toggleId(d.toggle); renderPanel(); renderPreview(); renderBar(); return; }
    if (d.share) { store.share = store.share || { email: true, phone: false, location: true }; store.share[d.share] = t.checked; UCV.save(store); renderPanel(); return; }
    if (d.sec) { v.hiddenSections = t.checked ? v.hiddenSections.filter(k => k !== d.sec) : [...v.hiddenSections, d.sec]; persist(); renderPanel(); renderPreview(); renderBar(); return; }
    if (d.dbool) { v.design[d.dbool] = t.checked; persist(); renderPreview(); renderBar(); return; }
    if (d.d && t.tagName === 'SELECT') { v.design[d.d] = t.value; persist(); renderPreview(); return; }
    if (d.app && t.tagName === 'SELECT') { store.applications.find(x => x.aid === d.app)[d.field] = t.value; UCV.save(store); if (d.field === 'status') { renderPanel(); renderBar(); } return; }
    if (d.app && t.type === 'date') { renderPanel(); return; }
    if (d.pref && t.tagName === 'SELECT') { (store.prefs = store.prefs || {})[d.pref] = t.value; UCV.save(store); return; }
    if ('import' in d && t.files[0]) { importFile(t.files[0]); t.value = ''; return; }
    if (t.id === 'photoFile' && t.files[0]) setPhoto(t.files[0]);
  });

  document.addEventListener('keydown', e => {
    const t = e.target;
    if (t.id === 'skillInput' && (e.key === 'Enter' || e.key === ',')) {
      e.preventDefault();
      if (addSkills(t.value)) { renderPanel(); renderPreview(); renderBar(); $('#skillInput').focus(); } else t.value = '';
    }
    if (t.dataset && t.dataset.bullet && e.key === 'Enter' && !e.shiftKey) { // Enter makes the next bullet
      e.preventDefault();
      const list = getPath(store.master, t.dataset.bullet), i = +t.dataset.i;
      list.splice(i + 1, 0, { id: UCV.uid('b'), text: '' });
      persist(); renderPanel(); renderPreview();
      $(`textarea[data-m="${t.dataset.bullet}.${i + 1}.text"]`)?.focus();
    }
    if (t.dataset && t.dataset.bullet && e.key === 'Backspace' && !t.value) { // Backspace on an empty bullet removes it
      const list = getPath(store.master, t.dataset.bullet), i = +t.dataset.i;
      if (list.length > 1) { e.preventDefault(); list.splice(i, 1); persist(); renderPanel(); renderPreview(); const prev = $(`textarea[data-m="${t.dataset.bullet}.${Math.max(0, i - 1)}.text"]`); if (prev) { prev.focus(); prev.setSelectionRange(prev.value.length, prev.value.length); } }
    }
  });
  document.addEventListener('paste', e => {
    const t = e.target;
    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (t.id === 'skillInput' && /[,\n;]/.test(text)) { e.preventDefault(); if (addSkills(text)) { renderPanel(); renderPreview(); renderBar(); $('#skillInput').focus(); } return; }
    if (t.dataset && t.dataset.bullet && /\n/.test(text.trim())) { // paste several lines = several bullets
      e.preventDefault();
      const list = getPath(store.master, t.dataset.bullet), i = +t.dataset.i;
      const rows = UCV.lines(text);
      if (!t.value.trim()) { list[i].text = rows.shift(); }
      list.splice(i + 1, 0, ...rows.map(r => ({ id: UCV.uid('b'), text: r })));
      persist(); renderPanel(); renderPreview(); renderBar();
    }
  });
  document.addEventListener('toggle', e => {
    const g = e.target;
    if (!g.matches || !g.matches('details.group')) return;
    g.open ? openGroups.add(g.dataset.group) : openGroups.delete(g.dataset.group);
    if (g.open) $$('textarea[data-bullet]', g).forEach(autosize);
  }, true);
  document.addEventListener('submit', e => {
    if (e.target.id === 'logForm') {
      e.preventDefault();
      const lf = new FormData(e.target);
      store.applications.push({ aid: UCV.uid('a'), company: lf.get('company').trim(), role: lf.get('role').trim(), vid: store.active, status: 'Applied', date: new Date().toISOString().slice(0, 10), url: '', notes: '' });
      persist(); renderBar(); $('#logPrompt').hidden = true; toast('Logged. Find it under Applications on your dashboard.');
      return;
    }
    if (e.target.id !== 'appForm') return;
    e.preventDefault();
    const f = new FormData(e.target);
    store.applications.push({ aid: UCV.uid('a'), company: f.get('company').trim(), role: f.get('role').trim(), vid: f.get('vid'), status: f.get('status') || 'Applied', date: f.get('date'), url: UCV.safeUrl(f.get('url')), notes: '' });
    appAdding = false; appFilter = 'All'; persist(); renderBar(); renderPanel(); toast('Application added');
  });

  // drag to reorder: bullets, and sections on the Design tab
  let drag = null;
  document.addEventListener('dragstart', e => {
    const h = e.target.closest && e.target.closest('[data-drag]');
    if (!h) return;
    drag = { path: h.dataset.drag, i: +h.dataset.i };
    const row = h.closest('[data-row]');
    row.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', String(drag.i)); e.dataTransfer.setDragImage(row, 12, 12); } catch (_) {}
  });
  document.addEventListener('dragover', e => {
    if (!drag) return;
    const row = e.target.closest && e.target.closest(`[data-row="${drag.path}"]`);
    if (!row) return;
    e.preventDefault();
    $$('.drop').forEach(x => x.classList.remove('drop'));
    row.classList.add('drop');
  });
  document.addEventListener('drop', e => {
    if (!drag) return;
    const row = e.target.closest && e.target.closest(`[data-row="${drag.path}"]`);
    if (row) {
      e.preventDefault();
      const to = +row.dataset.i;
      const list = drag.path === 'order' ? active().order : getPath(store.master, drag.path);
      if (to !== drag.i) { const [x] = list.splice(drag.i, 1); list.splice(to, 0, x); persist(); renderPanel(); renderPreview(); }
    }
  });
  document.addEventListener('dragend', () => { drag = null; $$('.dragging, .drop').forEach(x => x.classList.remove('dragging', 'drop')); });
  // dropping a CV file anywhere on the start screen imports it
  document.addEventListener('dragover', e => { if (store.isNew && e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  document.addEventListener('drop', e => { if (store.isNew && e.dataTransfer && e.dataTransfer.files[0]) { e.preventDefault(); importFile(e.dataTransfer.files[0]); } });

  window.addEventListener('resize', () => debounce(fitPaper, 80));

  // ---------- boot ----------
  try { const th = localStorage.getItem('ucvid:theme'); if (th) document.documentElement.dataset.theme = th; } catch (_) {}
  const h = location.hash.replace('#', '');
  if (/[?&]example=1\b/.test(location.search) && store.isNew && store.isSample) { store.isNew = false; persist(); tab = 'home'; }
  if (ALL_TABS.includes(h)) { tab = h; if (store.isNew && h !== 'edit') store.isNew = false; }
  else if (!store.isNew) tab = 'home';
  renderAll();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { renderPreview(); renderBar(); });
})();
