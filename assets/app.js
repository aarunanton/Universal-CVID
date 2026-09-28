/* Universal CV ID — app UI */
(function () {
  'use strict';
  const { esc } = UCV;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  let store = UCV.load();
  let tab = 'edit';
  const openGroups = new Set(['basics', 'work', 'skills']);
  let storageWarned = false;

  const onOwnSite = /github\.io$/.test(location.hostname) || ['localhost', '127.0.0.1'].includes(location.hostname) || location.protocol === 'file:';

  const TABS = [
    ['edit', 'Edit'], ['design', 'Design'], ['match', 'Job match'],
    ['versions', 'Versions'], ['share', 'Share & export'], ['tracker', 'Tracker']
  ];

  // ---------- state helpers ----------
  const active = () => store.versions.find(v => v.vid === store.active) || store.versions[0];
  function persist() {
    active().updatedAt = new Date().toISOString();
    const ok = UCV.save(store);
    if (!ok && !storageWarned) {
      storageWarned = true;
      toast('Your browser is blocking storage, so changes last only until you close this tab. Export your CV to keep it.', true);
    }
  }
  function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj); }
  function setPath(obj, path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce((o, k) => o[k], obj);
    target[last] = value;
  }
  const timers = new Map();
  function debounce(fn, ms) { clearTimeout(timers.get(fn)); timers.set(fn, setTimeout(fn, ms)); }
  const refreshMatch = () => { const r = $('#matchResults'); if (r) r.innerHTML = matchResultsHTML(); };

  function toast(msg, warn) {
    const wrap = $('#toasts');
    const t = document.createElement('div');
    t.className = 'toast' + (warn ? ' warn' : '');
    t.setAttribute('role', 'status');
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(() => t.remove(), warn ? 6000 : 2600);
  }
  // two-click confirm, no browser dialogs
  function armed(btn, label, fn) {
    if (btn.dataset.armed) { fn(); return; }
    btn.dataset.armed = '1';
    const old = btn.innerHTML;
    btn.classList.add('armed');
    btn.textContent = label;
    setTimeout(() => {
      if (btn.isConnected) { delete btn.dataset.armed; btn.classList.remove('armed'); btn.innerHTML = old; }
    }, 3000);
  }
  async function copy(text, done) {
    try { await navigator.clipboard.writeText(text); toast(done || 'Copied'); }
    catch (e) { toast('Copy was blocked. Select the text and copy it manually.', true); }
  }

  // ---------- top bar ----------
  function renderBar() {
    $('#idChip').textContent = store.id;
    $('#versionSelect').innerHTML = store.versions.map(v =>
      `<option value="${v.vid}" ${v.vid === store.active ? 'selected' : ''}>${esc(v.name)}</option>`).join('');
    $('#tabs').innerHTML = TABS.map(([id, label]) => {
      let badge = '';
      if (id === 'versions') badge = `<span class="badge">${store.versions.length}</span>`;
      if (id === 'tracker' && store.applications.length) badge = `<span class="badge">${store.applications.length}</span>`;
      if (id === 'edit') badge = `<span class="badge" id="checkBadge">${UCV.checks(active().cv).score}</span>`;
      return `<button class="tab" role="tab" data-tab="${id}" aria-selected="${tab === id}" id="tab-${id}">${label}${badge}</button>`;
    }).join('');
    $('#sampleBanner').hidden = !store.isSample;
  }

  // ---------- preview ----------
  function renderPreview() {
    const paper = $('#paper');
    paper.innerHTML = UCV.renderCV(active(), store.id);
    fitPaper();
  }
  function fitPaper() {
    const wrap = $('#paperWrap');
    const scaler = $('#paper');
    const avail = wrap.clientWidth - 36;
    const scale = Math.min(1, avail / 794);
    scaler.style.transform = `scale(${scale})`;
    const cv = scaler.firstElementChild;
    scaler.style.height = cv ? (cv.offsetHeight * scale) + 'px' : '';
    scaler.style.width = (794 * scale) + 'px';
  }

  // ---------- form helpers ----------
  function field(label, path, value, type = 'text', extra = '') {
    const id = 'f-' + path.replace(/\./g, '-');
    if (type === 'textarea') {
      return `<label class="field" for="${id}">${label}${extra}<textarea id="${id}" data-path="${path}" rows="4">${esc(value)}</textarea></label>`;
    }
    return `<label class="field" for="${id}">${label}${extra}<input id="${id}" type="${type}" data-path="${path}" value="${esc(value)}"></label>`;
  }
  function itemTitle(section, it) {
    switch (section) {
      case 'work': return it.position || it.company || 'New role';
      case 'education': return it.degree || it.institution || 'New qualification';
      case 'projects': return it.name || 'New project';
      case 'certificates': return it.name || 'New certification';
      case 'languages': return it.language || 'New language';
    }
  }
  function itemFields(section, i, it) {
    const p = `${section}.${i}.`;
    switch (section) {
      case 'work': return `
        <div class="grid-2">${field('Job title', p + 'position', it.position)}${field('Company', p + 'company', it.company)}</div>
        <div class="grid-2">${field('Start', p + 'startDate', it.startDate, 'month')}${field('End', p + 'endDate', it.endDate, 'month', ' <span class="hint">blank = current</span>')}</div>
        ${field('Location', p + 'location', it.location)}
        ${field('Achievements', p + 'highlights', it.highlights, 'textarea', ' <span class="hint">one per line</span>')}`;
      case 'education': return `
        <div class="grid-2">${field('Degree or qualification', p + 'degree', it.degree)}${field('Year', p + 'year', it.year)}</div>
        ${field('Institution', p + 'institution', it.institution)}
        ${field('Details', p + 'details', it.details, 'textarea')}`;
      case 'projects': return `
        <div class="grid-2">${field('Project', p + 'name', it.name)}${field('Link', p + 'url', it.url)}</div>
        ${field('What it is and the result', p + 'description', it.description, 'textarea')}`;
      case 'certificates': return `
        <div class="grid-2">${field('Certification', p + 'name', it.name)}${field('Year', p + 'date', it.date)}</div>
        ${field('Issued by', p + 'issuer', it.issuer)}`;
      case 'languages': return `
        <div class="grid-2">${field('Language', p + 'language', it.language)}${field('Level', p + 'fluency', it.fluency)}</div>`;
    }
  }
  function listGroup(section, label, addLabel) {
    const items = active().cv[section];
    const body = items.length ? items.map((it, i) => `
      <div class="item">
        <div class="item-head">
          <span class="title" data-title="${section}.${i}">${esc(itemTitle(section, it))}</span>
          <button class="icon-btn" data-action="move-item" data-section="${section}" data-i="${i}" data-dir="-1" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="icon-btn" data-action="move-item" data-section="${section}" data-i="${i}" data-dir="1" aria-label="Move down" ${i === items.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="icon-btn" data-action="remove-item" data-section="${section}" data-i="${i}" aria-label="Remove">✕</button>
        </div>
        ${itemFields(section, i, it)}
      </div>`).join('') : `<p class="empty">Nothing here yet.</p>`;
    return groupShell(section, label, items.length, `${body}<div><button class="btn btn-sm" data-action="add-item" data-section="${section}">+ ${addLabel}</button></div>`);
  }
  function groupShell(key, label, count, body) {
    return `<details class="group" data-group="${key}" ${openGroups.has(key) ? 'open' : ''}>
      <summary>${label}${count != null ? `<span class="count">${count}</span>` : ''}</summary>
      <div class="group-body">${body}</div></details>`;
  }

  function checksHTML() {
    const r = UCV.checks(active().cv);
    const color = r.score >= 80 ? 'var(--good)' : r.score >= 55 ? 'var(--warn)' : 'var(--bad)';
    const verdict = r.score >= 80 ? 'Ready to send' : r.score >= 55 ? 'Nearly there' : 'Needs work';
    return `
      <div class="score">
        <div class="ring" style="--v:${r.score};--c:${color}"><span>${r.score}</span></div>
        <div><div class="eyebrow">CV check</div><h2>${verdict}</h2><p class="sub" style="color:var(--ink-2);font-size:14px">${r.items.length ? r.items.length + ' suggestion' + (r.items.length > 1 ? 's' : '') + ' below. Updates as you type.' : 'No issues found.'}</p></div>
      </div>
      ${r.items.length ? `<ul class="checklist">${r.items.slice(0, 8).map(c => `<li><span class="lv lv-${c.level}">${c.level === 'fix' ? 'Fix' : c.level === 'warn' ? 'Improve' : 'Tip'}</span><span>${esc(c.text)}</span></li>`).join('')}</ul>` : ''}
      ${r.items.length > 8 ? `<p class="hint" style="margin-top:.5rem">+ ${r.items.length - 8} more</p>` : ''}`;
  }

  // ---------- tabs ----------
  function renderEdit() {
    const cv = active().cv;
    const b = cv.basics;
    return `
      <section class="panel" id="checksPanel">${checksHTML()}</section>
      ${groupShell('basics', 'Personal details', null, `
        <div class="grid-2">${field('Full name', 'basics.name', b.name)}${field('Professional title', 'basics.label', b.label)}</div>
        <div class="grid-2">${field('Email', 'basics.email', b.email, 'email')}${field('Phone', 'basics.phone', b.phone, 'tel')}</div>
        <div class="grid-2">${field('Location', 'basics.location', b.location)}${field('LinkedIn or website', 'basics.url', b.url)}</div>`)}
      ${groupShell('summary', 'Profile', null, field('A short profile', 'basics.summary', b.summary, 'textarea', ' <span class="hint">2–4 sentences</span>'))}
      ${listGroup('work', 'Experience', 'Add role')}
      ${listGroup('education', 'Education', 'Add qualification')}
      ${groupShell('skills', 'Skills', cv.skills.length, `
        <div class="tag-input" id="skillBox">
          ${cv.skills.map((s, i) => `<span class="chip">${esc(s)}<button data-action="remove-skill" data-i="${i}" aria-label="Remove ${esc(s)}">×</button></span>`).join('')}
          <input id="skillInput" type="text" placeholder="Type a skill, press Enter" aria-label="Add a skill">
        </div>
        <p class="hint">Press Enter or comma after each one. Paste a comma-separated list to add several.</p>`)}
      ${listGroup('projects', 'Projects', 'Add project')}
      ${listGroup('certificates', 'Certifications', 'Add certification')}
      ${listGroup('languages', 'Languages', 'Add language')}`;
  }

  function tplThumb(id) {
    const bars = {
      meridian: '<i style="left:30%;right:30%;top:8px;height:5px;background:#94A3B8"></i><i style="left:20%;right:20%;top:17px"></i><i style="left:10%;right:10%;top:28px;height:1px;background:var(--th)"></i><i style="left:10%;right:30%;top:36px"></i><i style="left:10%;right:20%;top:44px"></i><i style="left:10%;right:40%;top:52px"></i>',
      ledger: '<i style="left:0;right:0;top:0;height:18px;border-radius:0;background:var(--th)"></i><i style="left:66%;right:0;top:18px;bottom:0;height:auto;border-radius:0;background:#EEF1F6"></i><i style="left:8%;right:40%;top:26px"></i><i style="left:8%;right:44%;top:34px"></i><i style="left:8%;right:38%;top:42px"></i><i style="left:72%;right:8%;top:26px"></i><i style="left:72%;right:12%;top:34px"></i>',
      slate: '<i style="left:10%;right:50%;top:9px;height:5px;background:#94A3B8"></i><i style="left:10%;width:14%;top:26px;background:#E2E8F0"></i><i style="left:30%;right:10%;top:26px"></i><i style="left:30%;right:20%;top:34px"></i><i style="left:10%;width:14%;top:46px;background:#E2E8F0"></i><i style="left:30%;right:14%;top:46px"></i>',
      plain: '<i style="left:10%;right:55%;top:8px;height:5px;background:#111"></i><i style="left:10%;right:10%;top:20px;height:1px;background:#111"></i><i style="left:10%;right:20%;top:27px"></i><i style="left:10%;right:30%;top:35px"></i><i style="left:10%;right:10%;top:45px;height:1px;background:#111"></i><i style="left:10%;right:25%;top:52px"></i>'
    }[id];
    return `<div class="tpl-thumb" style="--th:${active().accent}">${bars}</div>`;
  }
  function renderDesign() {
    const v = active();
    return `
      <section class="panel">
        <h2>Template</h2><p class="sub">Each version of your CV can use its own template.</p>
        <div class="tpl-grid">${UCV.TEMPLATES.map(t => `
          <button class="tpl" data-action="set-template" data-id="${t.id}" aria-pressed="${v.template === t.id}">
            ${tplThumb(t.id)}<b>${t.name}</b><small>${t.note}</small></button>`).join('')}
        </div>
      </section>
      <section class="panel">
        <h2>Accent colour</h2><p class="sub">${v.template === 'plain' ? 'Plain ATS always prints in black.' : 'Used for headings and your title.'}</p>
        <div class="swatches">${UCV.ACCENTS.map(c => `<button class="swatch" style="background:${c}" data-action="set-accent" data-color="${c}" aria-label="Accent ${c}" aria-pressed="${v.accent === c}"></button>`).join('')}</div>
      </section>
      <section class="panel">
        <h2>Section order</h2><p class="sub">Drag to reorder, or use the arrows. Empty sections are left out automatically.</p>
        <ol class="order-list" id="orderList">${v.order.map((k, i) => `
          <li draggable="true" data-key="${k}">
            <span class="grip" aria-hidden="true">⋮⋮</span><span class="name">${UCV.SECTION_LABELS[k]}</span>
            <button class="icon-btn" data-action="move-sec" data-i="${i}" data-dir="-1" aria-label="Move ${UCV.SECTION_LABELS[k]} up" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button class="icon-btn" data-action="move-sec" data-i="${i}" data-dir="1" aria-label="Move ${UCV.SECTION_LABELS[k]} down" ${i === v.order.length - 1 ? 'disabled' : ''}>↓</button>
          </li>`).join('')}</ol>
      </section>`;
  }

  function matchResultsHTML() {
    const v = active();
    const r = UCV.match(v.cv, v.target.jd);
    if (!r) return `<p class="empty">Paste a job advert above to see how well this version matches it.</p>`;
    const color = r.score >= 70 ? 'var(--good)' : r.score >= 45 ? 'var(--warn)' : 'var(--bad)';
    return `
      <div class="score">
        <div class="ring" style="--v:${r.score};--c:${color}"><span>${r.score}%</span></div>
        <div><div class="eyebrow">Keyword match</div><h2>${r.found.length} of ${r.found.length + r.missing.length} keywords found</h2>
        <p class="hint">${r.score >= 70 ? 'Strong match.' : 'Add missing terms where they are true for you, in your skills or achievements.'}</p></div>
      </div>
      <div class="kw-legend"><span>Missing — click to add to skills</span></div>
      <div class="chips">${r.missing.map(k => `<button class="chip chip-miss" data-action="add-kw" data-kw="${esc(k)}">+ ${esc(k)}</button>`).join('') || '<span class="hint">None</span>'}</div>
      <div class="kw-legend"><span>Found in your CV</span></div>
      <div class="chips">${r.found.map(k => `<span class="chip chip-good">✓ ${esc(k)}</span>`).join('') || '<span class="hint">None yet</span>'}</div>`;
  }
  function renderMatch() {
    const v = active();
    return `
      <section class="panel">
        <h2>Tailor to a job</h2>
        <p class="sub">Paste the job advert. Matching runs on your device; nothing is sent anywhere.</p>
        <div class="stack">
          <div class="grid-2">
            <label class="field" for="t-company">Company<input id="t-company" type="text" data-target="company" value="${esc(v.target.company)}"></label>
            <label class="field" for="t-role">Role<input id="t-role" type="text" data-target="role" value="${esc(v.target.role)}"></label>
          </div>
          <label class="field" for="t-jd">Job advert<textarea id="t-jd" data-target="jd" rows="8" placeholder="Paste the full job description here">${esc(v.target.jd)}</textarea></label>
          <div class="row">
            <button class="btn btn-primary" data-action="tailor">Save as a new tailored version</button>
            <button class="btn" data-action="track-target">Add to tracker</button>
          </div>
        </div>
      </section>
      <section class="panel" id="matchResults">${matchResultsHTML()}</section>`;
  }

  function renderVersions() {
    return `
      <section class="panel">
        <h2>One ID, many versions</h2>
        <p class="sub">All versions share <span class="mono">${esc(store.id)}</span>. Keep a main CV and tailored copies for specific jobs.</p>
        <div class="apps">${store.versions.map(v => {
          const m = UCV.match(v.cv, v.target.jd);
          const apps = store.applications.filter(a => a.vid === v.vid).length;
          return `
          <div class="app-row">
            <div class="top">
              <input type="text" value="${esc(v.name)}" data-rename="${v.vid}" aria-label="Version name" style="max-width:280px;font-weight:700">
              ${v.vid === store.active ? '<span class="pill st-Applied">Open</span>' : ''}
            </div>
            <div class="meta">${UCV.TEMPLATES.find(t => t.id === v.template).name} template · updated ${new Date(v.updatedAt).toLocaleDateString()} · CV check ${UCV.checks(v.cv).score}${m ? ` · ${m.score}% match to ${esc(v.target.company || 'job')}` : ''}${apps ? ` · used in ${apps} application${apps > 1 ? 's' : ''}` : ''}</div>
            <div class="ctrls">
              ${v.vid !== store.active ? `<button class="btn btn-sm btn-primary" data-action="open-version" data-vid="${v.vid}">Open</button>` : ''}
              <button class="btn btn-sm" data-action="dup-version" data-vid="${v.vid}">Duplicate</button>
              ${store.versions.length > 1 ? `<button class="btn btn-sm btn-danger" data-action="del-version" data-vid="${v.vid}">Delete</button>` : ''}
            </div>
          </div>`;
        }).join('')}</div>
      </section>`;
  }

  function renderShare() {
    const v = active();
    const b = v.cv.basics;
    const [l1, l2] = UCV.mrz(store.id, b.name, b.label);
    const initials = (b.name || '?').split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase();
    return `
      <section class="panel">
        <h2>Your Universal CV ID</h2>
        <p class="sub">This ID stays the same across every version and every update.</p>
        <div class="idcard" aria-label="Universal CV ID card">
          <div class="idcard-top"><span>Universal CV ID</span><span>Professional</span></div>
          <div class="idcard-body">
            <div class="idcard-photo" aria-hidden="true">${esc(initials)}</div>
            <div style="min-width:0">
              <div class="idcard-name">${esc(b.name || 'Your name')}</div>
              <div class="idcard-label">${esc(b.label || 'Your title')}</div>
              <div class="idcard-id">${esc(store.id)}</div>
            </div>
          </div>
          <div class="idcard-mrz" aria-hidden="true">${esc(l1)}\n${esc(l2)}</div>
        </div>
      </section>
      <section class="panel">
        <h2>Share</h2>
        <p class="sub">Links carry your CV inside them, so they work without an account or a server. Anyone with the link can read it.</p>
        <div class="share-grid">
          <div class="stack">
            <label class="field" for="shareLink">Full CV link (“${esc(v.name)}”)
              <div class="linkbox"><input id="shareLink" type="text" readonly value="${esc(UCV.shareLink(store, v))}"><button class="btn" data-action="copy" data-src="shareLink">Copy</button></div>
            </label>
            <label class="field" for="cardLink">Contact card link <span class="hint">short, used by the QR code</span>
              <div class="linkbox"><input id="cardLink" type="text" readonly value="${esc(UCV.cardLink(store, v))}"><button class="btn" data-action="copy" data-src="cardLink">Copy</button></div>
            </label>
            <div class="row"><button class="btn" data-action="copy-id">Copy ID</button></div>
            ${onOwnSite ? '' : '<p class="hint">Links open on your published site (aarunanton.github.io/Universal-CVID) once GitHub Pages is switched on.</p>'}
          </div>
          <div class="stack" style="justify-items:center">
            <div class="qr" id="qr" aria-label="QR code for your contact card"></div>
            <span class="hint">For business cards and badges</span>
          </div>
        </div>
      </section>
      <section class="panel">
        <h2>Export</h2>
        <p class="sub">The PDF uses real text, so screening software can read it.</p>
        <div class="row">
          <button class="btn btn-primary" data-action="pdf">Download PDF</button>
          ${onOwnSite ? '<button class="btn" data-action="print">Print with this template</button>' : ''}
          <button class="btn" data-action="export-json">Download JSON Resume</button>
          <button class="btn" data-action="copy-json">Copy JSON</button>
        </div>
        ${onOwnSite ? '' : '<p class="hint" style="margin-top:.6rem">Downloads and printing are switched off in this preview window. They work on your published site. Copy JSON works everywhere.</p>'}
      </section>
      <section class="panel">
        <h2>Import</h2>
        <p class="sub">Load a CV saved in the open <a href="https://jsonresume.org" target="_blank" rel="noopener">JSON Resume</a> format. It becomes a new version.</p>
        <div class="stack">
          <label class="field" for="importFile">From a file<input id="importFile" type="file" accept=".json,application/json"></label>
          <label class="field" for="importText">Or paste JSON<textarea id="importText" rows="4" placeholder='{"basics": {"name": "..."}}'></textarea></label>
          <div><button class="btn" data-action="import-text">Import pasted JSON</button></div>
        </div>
      </section>`;
  }

  function renderTracker() {
    const counts = Object.fromEntries(UCV.STATUSES.map(s => [s, store.applications.filter(a => a.status === s).length]));
    const verOpts = sel => store.versions.map(v => `<option value="${v.vid}" ${v.vid === sel ? 'selected' : ''}>${esc(v.name)}</option>`).join('');
    const apps = store.applications.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return `
      <section class="panel">
        <h2>Applications</h2>
        <p class="sub">Keep track of where you applied and which version of your CV you sent.</p>
        <div class="pipeline">${UCV.STATUSES.map(s => `<div class="pipe"><b>${counts[s]}</b><span class="pill st-${s}">${s}</span></div>`).join('')}</div>
      </section>
      <section class="panel">
        <h2>Add an application</h2>
        <form id="appForm" class="stack" style="margin-top:.6rem">
          <div class="grid-2">
            <label class="field" for="a-company">Company<input id="a-company" name="company" type="text" required></label>
            <label class="field" for="a-role">Role<input id="a-role" name="role" type="text" required></label>
          </div>
          <div class="grid-2">
            <label class="field" for="a-vid">CV version sent<select id="a-vid" name="vid">${verOpts(store.active)}</select></label>
            <label class="field" for="a-date">Date<input id="a-date" name="date" type="date" value="${new Date().toISOString().slice(0, 10)}"></label>
          </div>
          <label class="field" for="a-url">Job link <span class="hint">optional</span><input id="a-url" name="url" type="url"></label>
          <div><button class="btn btn-primary" type="submit">Add application</button></div>
        </form>
      </section>
      <section class="apps">${apps.length ? apps.map(a => `
        <div class="app-row">
          <div class="top"><span class="who">${esc(a.company)}</span><span class="meta">${esc(a.role)}</span><span class="spacer"></span><span class="pill st-${a.status}">${a.status}</span></div>
          <div class="meta">${a.date ? new Date(a.date + 'T00:00').toLocaleDateString() : 'No date'}${a.url ? ` · <a href="${esc(a.url)}" target="_blank" rel="noopener">Job advert</a>` : ''}</div>
          <div class="ctrls">
            <select data-app="${a.aid}" data-field="status" aria-label="Status">${UCV.STATUSES.map(s => `<option ${s === a.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
            <select data-app="${a.aid}" data-field="vid" aria-label="CV version">${verOpts(a.vid)}</select>
            <input type="text" data-app="${a.aid}" data-field="notes" value="${esc(a.notes)}" placeholder="Notes" aria-label="Notes" style="flex:1;min-width:160px;padding:.35rem .5rem;font-size:13px">
            <button class="btn btn-sm btn-danger" data-action="del-app" data-aid="${a.aid}">Delete</button>
          </div>
        </div>`).join('') : '<p class="empty">No applications yet.</p>'}
      </section>`;
  }

  function renderPanel() {
    const html = { edit: renderEdit, design: renderDesign, match: renderMatch, versions: renderVersions, share: renderShare, tracker: renderTracker }[tab]();
    const panel = $('#panel');
    panel.innerHTML = html;
    panel.setAttribute('aria-labelledby', 'tab-' + tab);
    if (tab === 'share') renderQR();
    if (tab === 'design') wireDrag();
  }
  function renderAll() {
    renderBar();
    renderPanel();
    renderPreview();
  }

  function renderQR() {
    const el = $('#qr');
    if (!el) return;
    el.innerHTML = '';
    if (typeof QRCode === 'undefined') { el.innerHTML = '<span class="hint">QR code could not load</span>'; return; }
    try {
      new QRCode(el, { text: UCV.cardLink(store, active()), width: 150, height: 150, correctLevel: QRCode.CorrectLevel.M });
      el.removeAttribute('title');
    } catch (e) {
      el.innerHTML = '<span class="hint">Too much text for a QR code</span>';
    }
  }

  // ---------- section drag ----------
  function wireDrag() {
    const list = $('#orderList');
    let dragKey = null;
    list.addEventListener('dragstart', e => {
      const li = e.target.closest('li'); if (!li) return;
      dragKey = li.dataset.key; li.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', dragKey); } catch (_) {}
    });
    list.addEventListener('dragend', e => { e.target.closest('li')?.classList.remove('dragging'); });
    list.addEventListener('dragover', e => {
      e.preventDefault();
      $$('li', list).forEach(li => li.classList.remove('drop'));
      e.target.closest('li')?.classList.add('drop');
    });
    list.addEventListener('drop', e => {
      e.preventDefault();
      const target = e.target.closest('li');
      if (!target || !dragKey || target.dataset.key === dragKey) return;
      const order = active().order;
      order.splice(order.indexOf(dragKey), 1);
      order.splice(order.indexOf(target.dataset.key), 0, dragKey);
      persist(); renderPanel(); renderPreview();
    });
  }

  // ---------- actions ----------
  function addSkills(raw) {
    const cv = active().cv;
    const added = raw.split(/[,\n;]/).map(s => s.trim()).filter(s => s && !cv.skills.some(k => k.toLowerCase() === s.toLowerCase()));
    if (!added.length) return 0;
    cv.skills.push(...added);
    persist();
    return added.length;
  }
  function refreshChecks() {
    const cp = $('#checksPanel');
    if (cp) cp.innerHTML = checksHTML();
    const badge = $('#checkBadge');
    if (badge) badge.textContent = UCV.checks(active().cv).score;
  }
  function importJSON(text) {
    let parsed;
    try { parsed = JSON.parse(text); } catch (e) { toast('That is not valid JSON. Check that you copied the whole file.', true); return; }
    try {
      const { cv, meta } = UCV.fromJSONResume(parsed);
      const v = UCV.newVersion(meta.version ? meta.version + ' (imported)' : 'Imported CV', cv);
      if (meta.template) v.template = meta.template;
      store.versions.push(v);
      store.active = v.vid;
      store.isSample = false;
      persist(); tab = 'edit'; renderAll();
      toast(`Imported “${v.name}”`);
    } catch (e) { toast(e.message, true); }
  }
  function download(filename, text, type) {
    const blob = new Blob([text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  document.addEventListener('click', e => {
    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) { tab = tabBtn.dataset.tab; history.replaceState(null, '', '#' + tab); renderBar(); renderPanel(); $('#panel').scrollIntoView({ block: 'nearest' }); return; }

    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const v = active();
    const a = btn.dataset.action;
    const sec = btn.dataset.section;
    const i = +btn.dataset.i;

    switch (a) {
      case 'add-item':
        v.cv[sec].push(UCV.blankItem(sec)); openGroups.add(sec); persist(); renderPanel(); renderPreview();
        setTimeout(() => { const items = $$(`[data-group="${sec}"] .item`); items[items.length - 1]?.querySelector('input')?.focus(); }, 0);
        break;
      case 'remove-item':
        armed(btn, 'Remove?', () => { v.cv[sec].splice(i, 1); persist(); renderPanel(); renderPreview(); refreshChecks(); });
        break;
      case 'move-item': {
        const j = i + +btn.dataset.dir, list = v.cv[sec];
        if (j < 0 || j >= list.length) return;
        [list[i], list[j]] = [list[j], list[i]]; persist(); renderPanel(); renderPreview();
        break;
      }
      case 'remove-skill':
        v.cv.skills.splice(i, 1); persist(); renderPanel(); renderPreview(); $('#skillInput')?.focus();
        break;
      case 'set-template': v.template = btn.dataset.id; persist(); renderPanel(); renderPreview(); break;
      case 'set-accent': v.accent = btn.dataset.color; persist(); renderPanel(); renderPreview(); break;
      case 'move-sec': {
        const j = i + +btn.dataset.dir;
        [v.order[i], v.order[j]] = [v.order[j], v.order[i]]; persist(); renderPanel(); renderPreview();
        break;
      }
      case 'add-kw': {
        const n = addSkills(btn.dataset.kw);
        if (n) toast(`Added “${btn.dataset.kw}” to skills`);
        $('#matchResults').innerHTML = matchResultsHTML(); renderPreview(); renderBar();
        break;
      }
      case 'tailor': {
        const t = v.target;
        if (!t.jd.trim()) { toast('Paste a job advert first.', true); return; }
        const nv = UCV.newVersion([t.company, t.role].filter(Boolean).join(' – ') || 'Tailored CV', UCV.clone(v.cv));
        Object.assign(nv, { template: v.template, accent: v.accent, order: v.order.slice(), target: UCV.clone(t) });
        store.versions.push(nv); store.active = nv.vid; persist(); renderAll();
        toast(`Created “${nv.name}”. Edits here won't change your other versions.`);
        break;
      }
      case 'track-target': {
        const t = v.target;
        if (!t.company && !t.role) { toast('Add the company and role first.', true); return; }
        store.applications.push({ aid: UCV.uid('a'), company: t.company || 'Company', role: t.role || 'Role', vid: v.vid, status: 'Saved', date: new Date().toISOString().slice(0, 10), url: '', notes: '' });
        persist(); renderBar(); toast('Added to tracker as Saved');
        break;
      }
      case 'open-version': store.active = btn.dataset.vid; persist(); tab = 'edit'; renderAll(); break;
      case 'dup-version': {
        const src = store.versions.find(x => x.vid === btn.dataset.vid);
        const nv = UCV.clone(src); nv.vid = UCV.uid('v'); nv.name = src.name + ' (copy)'; nv.updatedAt = new Date().toISOString();
        store.versions.push(nv); persist(); renderAll(); toast(`Duplicated “${src.name}”`);
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
        try { UCV.pdf(store, v); toast('PDF ready'); } catch (err) { toast('Could not create the PDF.', true); }
        break;
      case 'print': {
        const paper = $('#paper'); paper.classList.add('print-target');
        window.print(); setTimeout(() => paper.classList.remove('print-target'), 500);
        break;
      }
      case 'export-json': download(`${(v.cv.basics.name || 'cv').replace(/\W+/g, '_')}_resume.json`, JSON.stringify(UCV.toJSONResume(store, v), null, 2), 'application/json'); break;
      case 'copy-json': copy(JSON.stringify(UCV.toJSONResume(store, v), null, 2), 'JSON copied'); break;
      case 'import-text': importJSON($('#importText').value); break;
      case 'del-app':
        armed(btn, 'Click again', () => { store.applications = store.applications.filter(x => x.aid !== btn.dataset.aid); persist(); renderBar(); renderPanel(); });
        break;
      case 'new-version': {
        const nv = UCV.clone(v); nv.vid = UCV.uid('v'); nv.name = 'Version ' + (store.versions.length + 1);
        nv.target = { company: '', role: '', jd: '' }; nv.updatedAt = new Date().toISOString();
        store.versions.push(nv); store.active = nv.vid; persist(); renderAll();
        toast(`Created “${nv.name}” from “${v.name}”. Rename it under Versions.`);
        break;
      }
      case 'start-own':
        armed(btn, 'Click again to clear the example', () => { store = UCV.freshStore(false); UCV.save(store); tab = 'edit'; openGroups.add('basics'); renderAll(); toast('Blank CV ready. Your new ID is ' + store.id); });
        break;
      case 'keep-example': store.isSample = false; persist(); renderBar(); break;
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
    const t = e.target;
    const v = active();
    if (t.dataset.path) {
      setPath(v.cv, t.dataset.path, t.value);
      const m = t.dataset.path.match(/^(\w+)\.(\d+)\./);
      if (m) { const title = $(`[data-title="${m[1]}.${m[2]}"]`); if (title) title.textContent = itemTitle(m[1], v.cv[m[1]][+m[2]]); }
      persist(); renderPreview();
      debounce(refreshChecks, 250);
    } else if (t.dataset.target) {
      v.target[t.dataset.target] = t.value; persist();
      debounce(refreshMatch, 250);
    } else if (t.dataset.rename) {
      const ver = store.versions.find(x => x.vid === t.dataset.rename);
      ver.name = t.value || 'Untitled'; UCV.save(store);
      $('#versionSelect').innerHTML = store.versions.map(x => `<option value="${x.vid}" ${x.vid === store.active ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
    } else if (t.dataset.app && t.tagName === 'INPUT') {
      const ap = store.applications.find(x => x.aid === t.dataset.app);
      ap[t.dataset.field] = t.value; UCV.save(store);
    }
  });

  document.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'versionSelect') { store.active = t.value; persist(); renderAll(); return; }
    if (t.dataset.app && t.tagName === 'SELECT') {
      const ap = store.applications.find(x => x.aid === t.dataset.app);
      ap[t.dataset.field] = t.value; UCV.save(store);
      if (t.dataset.field === 'status') renderPanel();
      return;
    }
    if (t.id === 'importFile' && t.files[0]) {
      const r = new FileReader();
      r.onload = () => importJSON(r.result);
      r.readAsText(t.files[0]);
    }
  });

  document.addEventListener('keydown', e => {
    if (e.target.id === 'skillInput' && (e.key === 'Enter' || e.key === ',')) {
      e.preventDefault();
      if (addSkills(e.target.value)) { renderPanel(); renderPreview(); refreshChecks(); renderBar(); $('#skillInput').focus(); }
      else e.target.value = '';
    }
    if (e.target.id === 'skillInput' && e.key === 'Backspace' && !e.target.value && active().cv.skills.length) {
      active().cv.skills.pop(); persist(); renderPanel(); renderPreview(); $('#skillInput').focus();
    }
  });
  document.addEventListener('paste', e => {
    if (e.target.id !== 'skillInput') return;
    const text = e.clipboardData.getData('text');
    if (!/[,\n;]/.test(text)) return;
    e.preventDefault();
    if (addSkills(text)) { renderPanel(); renderPreview(); refreshChecks(); $('#skillInput').focus(); }
  });
  document.addEventListener('toggle', e => {
    const g = e.target.closest && e.target.closest('details.group');
    if (!g || g !== e.target) return;
    g.open ? openGroups.add(g.dataset.group) : openGroups.delete(g.dataset.group);
  }, true);
  document.addEventListener('submit', e => {
    if (e.target.id !== 'appForm') return;
    e.preventDefault();
    const f = new FormData(e.target);
    store.applications.push({ aid: UCV.uid('a'), company: f.get('company').trim(), role: f.get('role').trim(), vid: f.get('vid'), status: 'Applied', date: f.get('date'), url: f.get('url').trim(), notes: '' });
    persist(); renderBar(); renderPanel(); toast('Application added');
  });

  window.addEventListener('resize', () => debounce(fitPaper, 80));

  // ---------- boot ----------
  try { const th = localStorage.getItem('ucvid:theme'); if (th) document.documentElement.dataset.theme = th; } catch (_) {}
  const h = location.hash.replace('#', '');
  if (TABS.some(([id]) => id === h)) tab = h;
  renderAll();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitPaper);
})();
