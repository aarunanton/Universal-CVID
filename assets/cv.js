/* Universal CV ID — core: data model, storage, rendering, checks, job match, sharing.
   Plain browser JavaScript, no build step. Exposes a single global: UCV. */
(function () {
  'use strict';

  const STORE_KEY = 'ucvid:v2';
  const LEGACY_KEY = 'universalCVs';
  const CANONICAL_BASE = 'https://aarunanton.github.io/Universal-CVID/';

  const SECTION_LABELS = {
    summary: 'Profile',
    work: 'Experience',
    education: 'Education',
    skills: 'Skills',
    projects: 'Projects',
    certificates: 'Certifications',
    languages: 'Languages'
  };
  const DEFAULT_ORDER = ['summary', 'work', 'education', 'skills', 'projects', 'certificates', 'languages'];
  const SIDEBAR_SECTIONS = ['skills', 'languages', 'certificates'];

  const TEMPLATES = [
    { id: 'meridian', name: 'Meridian', note: 'Single column, clear headings' },
    { id: 'ledger', name: 'Ledger', note: 'Two columns with a sidebar' },
    { id: 'slate', name: 'Slate', note: 'Minimal, lots of white space' },
    { id: 'plain', name: 'Plain ATS', note: 'No colour, safest for screening software' }
  ];
  const ACCENTS = ['#2446C7', '#0E7C66', '#B4462B', '#6B3FA0', '#1F2937', '#A16207'];

  const STATUSES = ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected'];

  // ---------- small helpers ----------
  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function uid(prefix) {
    return (prefix || '') + Math.random().toString(36).slice(2, 9);
  }
  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }
  function formatMonth(value) {
    if (!value) return '';
    const [y, m] = String(value).split('-').map(Number);
    if (!y) return value;
    if (!m) return String(y);
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1] + ' ' + y;
  }
  function dateRange(start, end) {
    const s = formatMonth(start);
    const e = end ? formatMonth(end) : 'Present';
    return s ? s + ' – ' + e : (end ? e : '');
  }
  function lines(text) {
    return String(text || '')
      .split('\n')
      .map(l => l.replace(/^\s*[•\-*·]\s*/, '').trim())
      .filter(Boolean);
  }

  // ---------- Universal ID ----------
  const ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I to avoid misreading
  function newId() {
    let s = '';
    for (let i = 0; i < 5; i++) s += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
    return '#UCVID-' + s;
  }
  function shortId(id) {
    return String(id || '').replace(/^#?UCVID-/, '');
  }
  // ICAO 9303 check digit (weights 7-3-1), the same scheme printed on passports
  function checkDigit(str) {
    const w = [7, 3, 1];
    let sum = 0;
    [...str].forEach((c, i) => {
      let v;
      if (/[0-9]/.test(c)) v = +c;
      else if (/[A-Z]/.test(c)) v = c.charCodeAt(0) - 55;
      else v = 0;
      sum += v * w[i % 3];
    });
    return String(sum % 10);
  }
  function mrzName(s) {
    return String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Z ]/g, '').trim().replace(/\s+/g, '<');
  }
  // Two machine-readable lines, passport style, 36 chars each
  function mrz(id, name, label) {
    const code = shortId(id);
    const parts = String(name || '').trim().split(/\s+/);
    const surname = parts.length > 1 ? parts[parts.length - 1] : parts[0] || '';
    const given = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
    const l1 = ('UCV<' + mrzName(surname) + '<<' + mrzName(given)).padEnd(36, '<').slice(0, 36);
    const l2 = (code + checkDigit(code) + '<' + mrzName(label)).padEnd(36, '<').slice(0, 36);
    return [l1, l2];
  }

  // ---------- data model ----------
  function blankCV() {
    return {
      basics: { name: '', label: '', email: '', phone: '', location: '', url: '', summary: '' },
      work: [], education: [], skills: [], projects: [], certificates: [], languages: []
    };
  }
  function blankItem(section) {
    return {
      work: { position: '', company: '', location: '', startDate: '', endDate: '', highlights: '' },
      education: { degree: '', institution: '', year: '', details: '' },
      projects: { name: '', description: '', url: '' },
      certificates: { name: '', issuer: '', date: '' },
      languages: { language: '', fluency: '' }
    }[section];
  }
  function sampleCV() {
    return {
      basics: {
        name: 'Maya Okafor',
        label: 'Senior Product Designer',
        email: 'maya.okafor@example.com',
        phone: '+353 87 000 0000',
        location: 'Dublin, Ireland',
        url: 'linkedin.com/in/example',
        summary: 'Product designer with 9 years in fintech and health tech. I turn messy research into shipped, measurable improvements, and I like working close to engineering.'
      },
      work: [
        {
          position: 'Senior Product Designer', company: 'Brightwater Health', location: 'Dublin',
          startDate: '2021-04', endDate: '',
          highlights: 'Led redesign of patient booking flow, cutting drop-off by 31%\nBuilt the design system now used by 4 product teams\nMentored 3 junior designers through promotion'
        },
        {
          position: 'Product Designer', company: 'Ledgerline', location: 'London',
          startDate: '2017-09', endDate: '2021-03',
          highlights: 'Designed onboarding for 120,000 small-business users\nResponsible for the mobile app settings screens'
        }
      ],
      education: [
        { degree: 'MSc Interaction Design', institution: 'University of Limerick', year: '2017', details: '' }
      ],
      skills: ['Figma', 'User research', 'Design systems', 'Prototyping', 'Accessibility (WCAG 2.2)', 'SQL'],
      projects: [
        { name: 'Open accessibility checklist', description: 'Free checklist used by 2,000+ designers', url: '' }
      ],
      certificates: [
        { name: 'Certified Usability Analyst', issuer: 'Human Factors International', date: '2019' }
      ],
      languages: [
        { language: 'English', fluency: 'Native' },
        { language: 'French', fluency: 'Professional' }
      ]
    };
  }

  function newVersion(name, cv) {
    return {
      vid: uid('v'),
      name: name || 'Main CV',
      cv: cv || blankCV(),
      template: 'meridian',
      accent: ACCENTS[0],
      order: DEFAULT_ORDER.slice(),
      target: { company: '', role: '', jd: '' },
      updatedAt: new Date().toISOString()
    };
  }

  function freshStore(withSample) {
    const v = newVersion(withSample ? 'Main CV' : 'Main CV', withSample ? sampleCV() : blankCV());
    return {
      schema: 2,
      id: newId(),
      createdAt: new Date().toISOString(),
      isSample: !!withSample,
      versions: [v],
      active: v.vid,
      applications: withSample ? [
        { aid: uid('a'), company: 'Northwind Labs', role: 'Lead Product Designer', vid: v.vid, status: 'Interview', date: '2026-09-15', url: '', notes: 'Portfolio review booked' },
        { aid: uid('a'), company: 'Harbour Bank', role: 'Senior UX Designer', vid: v.vid, status: 'Applied', date: '2026-09-22', url: '', notes: '' }
      ] : []
    };
  }

  // Bring CVs saved by the first prototype (key "universalCVs") into the new format
  function migrateLegacy(list) {
    if (!Array.isArray(list) || !list.length) return null;
    const store = freshStore(false);
    store.id = list[0].id || store.id;
    store.versions = list.map((old, i) => {
      const p = old.personalInfo || {};
      const cv = blankCV();
      Object.assign(cv.basics, {
        name: p.name || '', label: p.title || '', email: p.email || '', phone: p.phone || '',
        location: p.location || '', url: p.linkedin || '', summary: p.summary || ''
      });
      cv.work = (old.experiences || []).filter(e => e && (e.title || e.company)).map(e => ({
        position: e.title || '', company: e.company || '', location: e.location || '',
        startDate: e.startDate || '', endDate: e.endDate || '', highlights: e.description || ''
      }));
      cv.education = (old.educations || []).filter(e => e && (e.degree || e.school)).map(e => ({
        degree: e.degree || '', institution: e.school || '', year: e.year || '', details: e.details || ''
      }));
      cv.skills = (old.skills || []).slice();
      const v = newVersion(i === 0 ? 'Main CV' : (p.title || 'Version ' + (i + 1)), cv);
      return v;
    });
    store.active = store.versions[0].vid;
    return store;
  }

  let memory = null;
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return normalise(JSON.parse(raw));
      const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
      const migrated = migrateLegacy(legacy);
      if (migrated) { save(migrated); return migrated; }
    } catch (e) { /* storage blocked or corrupt */ }
    return memory || freshStore(true);
  }
  function save(store) {
    memory = store;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
      return true;
    } catch (e) {
      return false;
    }
  }
  function normalise(store) {
    store.versions.forEach(v => {
      v.cv = Object.assign(blankCV(), v.cv);
      v.cv.basics = Object.assign(blankCV().basics, v.cv.basics);
      v.order = (v.order || []).filter(s => DEFAULT_ORDER.includes(s));
      DEFAULT_ORDER.forEach(s => { if (!v.order.includes(s)) v.order.push(s); });
      v.target = Object.assign({ company: '', role: '', jd: '' }, v.target);
    });
    store.applications = store.applications || [];
    return store;
  }

  // ---------- rendering ----------
  function sectionHTML(key, cv) {
    const title = `<h2 class="cv-h">${SECTION_LABELS[key]}</h2>`;
    switch (key) {
      case 'summary':
        return cv.basics.summary ? `<section class="cv-sec">${title}<p class="cv-summary">${esc(cv.basics.summary)}</p></section>` : '';
      case 'work': {
        const items = cv.work.filter(w => w.position || w.company);
        if (!items.length) return '';
        return `<section class="cv-sec">${title}${items.map(w => `
          <div class="cv-item">
            <div class="cv-row"><strong>${esc(w.position || 'Role')}</strong><span class="cv-date">${esc(dateRange(w.startDate, w.endDate))}</span></div>
            <div class="cv-sub">${esc(w.company)}${w.location ? ' · ' + esc(w.location) : ''}</div>
            ${lines(w.highlights).length ? `<ul>${lines(w.highlights).map(h => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
          </div>`).join('')}</section>`;
      }
      case 'education': {
        const items = cv.education.filter(e => e.degree || e.institution);
        if (!items.length) return '';
        return `<section class="cv-sec">${title}${items.map(e => `
          <div class="cv-item">
            <div class="cv-row"><strong>${esc(e.degree || 'Qualification')}</strong><span class="cv-date">${esc(e.year)}</span></div>
            <div class="cv-sub">${esc(e.institution)}</div>
            ${e.details ? `<p class="cv-text">${esc(e.details)}</p>` : ''}
          </div>`).join('')}</section>`;
      }
      case 'skills':
        return cv.skills.length ? `<section class="cv-sec">${title}<ul class="cv-tags">${cv.skills.map(s => `<li>${esc(s)}</li>`).join('')}</ul></section>` : '';
      case 'projects': {
        const items = cv.projects.filter(p => p.name);
        if (!items.length) return '';
        return `<section class="cv-sec">${title}${items.map(p => `
          <div class="cv-item">
            <div class="cv-row"><strong>${esc(p.name)}</strong>${p.url ? `<span class="cv-date">${esc(p.url)}</span>` : ''}</div>
            ${p.description ? `<p class="cv-text">${esc(p.description)}</p>` : ''}
          </div>`).join('')}</section>`;
      }
      case 'certificates': {
        const items = cv.certificates.filter(c => c.name);
        if (!items.length) return '';
        return `<section class="cv-sec">${title}${items.map(c => `
          <div class="cv-item cv-compact">
            <div class="cv-row"><strong>${esc(c.name)}</strong><span class="cv-date">${esc(c.date)}</span></div>
            ${c.issuer ? `<div class="cv-sub">${esc(c.issuer)}</div>` : ''}
          </div>`).join('')}</section>`;
      }
      case 'languages': {
        const items = cv.languages.filter(l => l.language);
        if (!items.length) return '';
        return `<section class="cv-sec">${title}<ul class="cv-plain">${items.map(l => `<li><strong>${esc(l.language)}</strong>${l.fluency ? ' — ' + esc(l.fluency) : ''}</li>`).join('')}</ul></section>`;
      }
    }
    return '';
  }

  function renderCV(version, id) {
    const cv = version.cv;
    const b = cv.basics;
    const contact = [b.email, b.phone, b.location, b.url].filter(Boolean).map(c => `<span>${esc(c)}</span>`).join('');
    const head = `
      <header class="cv-head">
        <h1 class="cv-name">${esc(b.name || 'Your name')}</h1>
        ${b.label ? `<p class="cv-label">${esc(b.label)}</p>` : ''}
        <p class="cv-contact">${contact}</p>
        <p class="cv-id" title="Universal CV ID">${esc(id)}</p>
      </header>`;
    const tpl = version.template || 'meridian';
    const style = `--cv-accent:${tpl === 'plain' ? '#111' : esc(version.accent || ACCENTS[0])}`;
    if (tpl === 'ledger') {
      const main = version.order.filter(k => !SIDEBAR_SECTIONS.includes(k)).map(k => sectionHTML(k, cv)).join('');
      const side = version.order.filter(k => SIDEBAR_SECTIONS.includes(k)).map(k => sectionHTML(k, cv)).join('');
      return `<article class="cv t-ledger" style="${style}">${head}<div class="cv-cols"><div class="cv-main">${main}</div><aside class="cv-side">${side}</aside></div></article>`;
    }
    return `<article class="cv t-${esc(tpl)}" style="${style}">${head}${version.order.map(k => sectionHTML(k, cv)).join('')}</article>`;
  }

  // ---------- CV checks (writing feedback) ----------
  const WEAK_OPENERS = /^(responsible for|worked on|helped|assisted|involved in|participated in|duties included|tasked with|in charge of)\b/i;
  function checks(cv) {
    const out = [];
    const b = cv.basics;
    if (!b.name) out.push({ level: 'fix', text: 'Add your name.', where: 'basics' });
    if (!b.email) out.push({ level: 'fix', text: 'Add an email address so recruiters can reach you.', where: 'basics' });
    if (!b.label) out.push({ level: 'warn', text: 'Add a professional title under your name.', where: 'basics' });
    const words = (b.summary || '').split(/\s+/).filter(Boolean).length;
    if (!words) out.push({ level: 'warn', text: 'Add a short profile: 2–4 sentences on who you are and what you deliver.', where: 'summary' });
    else if (words > 90) out.push({ level: 'warn', text: `Your profile is ${words} words. Aim for under 80.`, where: 'summary' });

    const jobs = cv.work.filter(w => w.position || w.company);
    if (!jobs.length) out.push({ level: 'fix', text: 'Add at least one role under Experience.', where: 'work' });
    let bullets = 0, withNumbers = 0;
    jobs.forEach(w => {
      const role = w.position || w.company;
      if (!w.startDate) out.push({ level: 'warn', text: `“${role}”: add a start date.`, where: 'work' });
      const hs = lines(w.highlights);
      if (!hs.length) out.push({ level: 'warn', text: `“${role}”: add 2–5 bullet points on what you achieved.`, where: 'work' });
      hs.forEach(h => {
        bullets++;
        if (/\d/.test(h)) withNumbers++;
        if (WEAK_OPENERS.test(h)) out.push({ level: 'warn', text: `Start with an action verb instead of “${h.match(WEAK_OPENERS)[0]}”: “${h.slice(0, 48)}${h.length > 48 ? '…' : ''}”`, where: 'work' });
        else if (/^I\b/.test(h)) out.push({ level: 'tip', text: `Drop “I” at the start of bullets: “${h.slice(0, 48)}${h.length > 48 ? '…' : ''}”`, where: 'work' });
        const n = h.split(/\s+/).length;
        if (n > 32) out.push({ level: 'tip', text: `A ${n}-word bullet is hard to scan. Split it or cut it under 30 words.`, where: 'work' });
      });
    });
    if (bullets >= 3 && withNumbers / bullets < 0.4) {
      out.push({ level: 'warn', text: `Only ${withNumbers} of ${bullets} bullets include a number. Add results: %, €, time saved, team size.`, where: 'work' });
    }
    if (cv.skills.length < 5) out.push({ level: 'warn', text: `List at least 5 skills (you have ${cv.skills.length}).`, where: 'skills' });
    if (!cv.education.filter(e => e.degree || e.institution).length) out.push({ level: 'tip', text: 'Add your education, even if it was a while ago.', where: 'education' });

    const penalty = out.reduce((s, c) => s + (c.level === 'fix' ? 15 : c.level === 'warn' ? 6 : 2), 0);
    return { score: Math.max(0, 100 - penalty), items: out };
  }

  // ---------- job description match ----------
  const STOP = new Set(('a about above across after again against all also am an and any are as at be because been before being below between both but by can could did do does doing down during each either else etc even ever every few for from further get got had has have having he her here hers him his how i if in into is it its itself just least less like made make many may me might more most much must my no nor not now of off on once only or other our ours out over own per please rather same shall she should since so some such than that the their them then there these they this those though through thus to too under until up upon us very via was we well were what when where whether which while who whom whose why will with within without would yet you your yours ' +
    // generic job-advert words that don't help matching
    'ability able apply applicant applicants benefits candidate candidates company competitive day days description desirable environment essential excellent experience experienced full good great help ideal including job join key looking new offer opportunity opportunities part people plus position preferred proven relevant required requirement requirements responsibilities responsible role roles salary skills skill strong successful support team teams time using work working world year years based across ensure within related level range similar demonstrated knowledge understanding etc provide providing including include includes want wants seeking seek other others high highly clear across expert expertise running familiarity familiar nice tools tool scale standards managers manager plus hands proficiency proficient solid deep closely').split(/\s+/));

  function tokenize(text) {
    const out = [];
    const re = /[A-Za-z][A-Za-z0-9+#./&-]*[A-Za-z0-9+#]|[A-Za-z]/g;
    let m, prevEnd = 0, sentenceStart = true;
    while ((m = re.exec(text)) !== null) {
      const between = text.slice(prevEnd, m.index);
      if (/[.!?\n•:]/.test(between)) sentenceStart = true;
      const raw = m[0];
      out.push({ raw, low: raw.toLowerCase(), cap: /[A-Z]/.test(raw) && !sentenceStart, gap: /[,;()]/.test(between) });
      sentenceStart = false;
      prevEnd = m.index + raw.length;
    }
    return out;
  }
  function keywords(jd) {
    const toks = tokenize(jd);
    const score = new Map();
    const label = new Map();
    const bump = (term, w, raw) => { score.set(term, (score.get(term) || 0) + w); if (!label.has(term) || /[A-Z]/.test(raw)) label.set(term, raw); };
    toks.forEach((t, i) => {
      if (STOP.has(t.low) || t.low.length < 2) return;
      bump(t.low, 1 + (t.cap ? 1 : 0) + (/[A-Z]{2,}|[+#]/.test(t.raw) ? 1 : 0), t.cap || /[A-Z]{2,}/.test(t.raw) ? t.raw : t.low);
      const n = toks[i + 1];
      if (n && !n.gap && !STOP.has(n.low) && n.low.length > 1) bump(t.low + ' ' + n.low, 1.6, (t.cap || /[A-Z]{2,}/.test(t.raw) ? t.raw : t.low) + ' ' + (n.cap || /[A-Z]{2,}/.test(n.raw) ? n.raw : n.low));
    });
    // phrases must appear at least twice to count; single words are kept
    const list = [...score.entries()]
      .filter(([term, s]) => !term.includes(' ') || s >= 3.2)
      .sort((a, b) => b[1] - a[1]);
    const phrases = list.filter(([t]) => t.includes(' ')).slice(0, 10);
    const covered = new Set(phrases.flatMap(([t]) => t.split(' ')));
    const words = list.filter(([t]) => !t.includes(' ') && !covered.has(t) && (t.length > 2 || /[+#]/.test(t)));
    const picked = [...phrases, ...words]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 24)
      .map(([term, weight]) => ({ term, weight, label: label.get(term) || term }));
    return picked;
  }
  function cvText(cv) {
    const b = cv.basics;
    return [b.label, b.summary,
      ...cv.work.map(w => [w.position, w.company, w.highlights].join(' ')),
      ...cv.education.map(e => [e.degree, e.institution, e.details].join(' ')),
      cv.skills.join(' . '),
      ...cv.projects.map(p => p.name + ' ' + p.description),
      ...cv.certificates.map(c => c.name + ' ' + c.issuer),
      ...cv.languages.map(l => l.language)
    ].join(' \n ').toLowerCase();
  }
  function hasTerm(text, term) {
    const e = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s-]+');
    return new RegExp('(^|[^a-z0-9])' + e + '($|[^a-z0-9])').test(text);
  }
  function match(cv, jd) {
    const kws = keywords(jd || '');
    if (!kws.length) return null;
    const text = cvText(cv);
    let got = 0, total = 0;
    const found = [], missing = [];
    kws.forEach(k => {
      total += k.weight;
      if (hasTerm(text, k.term)) { got += k.weight; found.push(k.label); } else missing.push(k.label);
    });
    return { score: Math.round(100 * got / total), found, missing };
  }

  // ---------- sharing ----------
  function siteBase() {
    const h = location.hostname;
    if (/github\.io$/.test(h) || h === 'localhost' || h === '127.0.0.1' || location.protocol === 'file:') {
      return location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
    }
    return CANONICAL_BASE;
  }
  function encode(payload) {
    return LZString.compressToEncodedURIComponent(JSON.stringify(payload));
  }
  function decode(str) {
    try { return JSON.parse(LZString.decompressFromEncodedURIComponent(str)); } catch (e) { return null; }
  }
  function shareLink(store, version) {
    return siteBase() + 'p.html#' + encode({ v: 2, t: 'cv', id: store.id, cv: version.cv, tpl: version.template, ac: version.accent, ord: version.order });
  }
  function cardLink(store, version) {
    const b = version.cv.basics;
    return siteBase() + 'p.html#' + encode({ v: 2, t: 'card', id: store.id, n: b.name, l: b.label, e: b.email, p: b.phone, loc: b.location, u: b.url });
  }

  // ---------- JSON Resume (jsonresume.org) import / export ----------
  function toJSONResume(store, version) {
    const cv = version.cv, b = cv.basics;
    return {
      $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
      basics: {
        name: b.name, label: b.label, email: b.email, phone: b.phone, summary: b.summary,
        location: { city: b.location },
        profiles: b.url ? [{ network: 'Link', url: b.url }] : []
      },
      work: cv.work.map(w => ({ name: w.company, position: w.position, location: w.location, startDate: w.startDate, endDate: w.endDate, highlights: lines(w.highlights) })),
      education: cv.education.map(e => ({ institution: e.institution, studyType: e.degree, endDate: e.year, courses: e.details ? [e.details] : [] })),
      skills: cv.skills.map(s => ({ name: s })),
      projects: cv.projects.map(p => ({ name: p.name, description: p.description, url: p.url })),
      certificates: cv.certificates.map(c => ({ name: c.name, issuer: c.issuer, date: c.date })),
      languages: cv.languages.map(l => ({ language: l.language, fluency: l.fluency })),
      meta: { universalCvId: store.id, version: version.name, template: version.template }
    };
  }
  function fromJSONResume(j) {
    if (!j || typeof j !== 'object' || !j.basics) throw new Error('This file is not in JSON Resume format (no "basics" section).');
    const cv = blankCV(), b = j.basics || {};
    Object.assign(cv.basics, {
      name: b.name || '', label: b.label || '', email: b.email || '', phone: b.phone || '', summary: b.summary || '',
      location: typeof b.location === 'string' ? b.location : [b.location?.city, b.location?.region, b.location?.countryCode].filter(Boolean).join(', '),
      url: b.url || (b.profiles && b.profiles[0] && (b.profiles[0].url || b.profiles[0].username)) || ''
    });
    cv.work = (j.work || []).map(w => ({ position: w.position || '', company: w.name || w.company || '', location: w.location || '', startDate: (w.startDate || '').slice(0, 7), endDate: (w.endDate || '').slice(0, 7), highlights: [w.summary, ...(w.highlights || [])].filter(Boolean).join('\n') }));
    cv.education = (j.education || []).map(e => ({ degree: [e.studyType, e.area].filter(Boolean).join(' '), institution: e.institution || '', year: (e.endDate || '').slice(0, 4), details: (e.courses || []).join(', ') }));
    cv.skills = (j.skills || []).flatMap(s => s.keywords && s.keywords.length ? s.keywords : [s.name]).filter(Boolean);
    cv.projects = (j.projects || []).map(p => ({ name: p.name || '', description: p.description || '', url: p.url || '' }));
    cv.certificates = (j.certificates || []).map(c => ({ name: c.name || '', issuer: c.issuer || '', date: c.date || '' }));
    cv.languages = (j.languages || []).map(l => ({ language: l.language || '', fluency: l.fluency || '' }));
    return { cv, meta: j.meta || {} };
  }

  // ---------- text PDF (selectable, readable by screening software) ----------
  function pdf(store, version) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const cv = version.cv, b = cv.basics;
    const accent = version.template === 'plain' ? '#111111' : (version.accent || ACCENTS[0]);
    const M = 18, W = 210 - M * 2;
    let y = M;
    const ensure = h => { if (y + h > 297 - M) { doc.addPage(); y = M; } };
    const text = (str, size, style, color, indent) => {
      doc.setFont('helvetica', style || 'normal'); doc.setFontSize(size); doc.setTextColor(color || '#1a1a1a');
      const wrapped = doc.splitTextToSize(String(str), W - (indent || 0));
      wrapped.forEach(line => { ensure(size * 0.45); doc.text(line, M + (indent || 0), y); y += size * 0.43; });
    };
    const row = (left, right) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor('#1a1a1a');
      ensure(6);
      const rw = right ? doc.getTextWidth(right) + 4 : 0;
      const l = doc.splitTextToSize(left, W - rw);
      doc.text(l[0], M, y);
      if (right) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor('#555555'); doc.text(right, 210 - M, y, { align: 'right' }); }
      y += 4.6;
      if (l.length > 1) { doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor('#1a1a1a'); l.slice(1).forEach(x => { doc.text(x, M, y); y += 4.6; }); }
    };
    text(b.name || 'Your name', 20, 'bold', '#111111'); y += 1;
    if (b.label) text(b.label, 11.5, 'normal', accent);
    const contact = [b.email, b.phone, b.location, b.url].filter(Boolean).join('  |  ');
    if (contact) text(contact, 9, 'normal', '#444444');
    text('Universal CV ID ' + store.id, 8, 'normal', '#777777');
    y += 2;
    const heading = label => {
      ensure(12); y += 3;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(accent);
      doc.text(label.toUpperCase(), M, y); y += 1.6;
      doc.setDrawColor(accent); doc.setLineWidth(0.3); doc.line(M, y, 210 - M, y); y += 4.4;
    };
    version.order.forEach(key => {
      if (key === 'summary' && b.summary) { heading('Profile'); text(b.summary, 10, 'normal'); }
      if (key === 'work') {
        const items = cv.work.filter(w => w.position || w.company);
        if (!items.length) return; heading('Experience');
        items.forEach(w => {
          row(w.position || 'Role', dateRange(w.startDate, w.endDate));
          text([w.company, w.location].filter(Boolean).join(', '), 9.5, 'italic', '#444444');
          lines(w.highlights).forEach(h => {
            ensure(5); doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor('#1a1a1a');
            doc.text('•', M + 1, y); text(h, 10, 'normal', '#1a1a1a', 5);
          });
          y += 2;
        });
      }
      if (key === 'education') {
        const items = cv.education.filter(e => e.degree || e.institution);
        if (!items.length) return; heading('Education');
        items.forEach(e => { row(e.degree || 'Qualification', e.year); if (e.institution) text(e.institution, 9.5, 'italic', '#444444'); if (e.details) text(e.details, 9.5, 'normal'); y += 1.5; });
      }
      if (key === 'skills' && cv.skills.length) { heading('Skills'); text(cv.skills.join(', '), 10, 'normal'); }
      if (key === 'projects') {
        const items = cv.projects.filter(p => p.name);
        if (!items.length) return; heading('Projects');
        items.forEach(p => { row(p.name, p.url); if (p.description) text(p.description, 10, 'normal'); y += 1.5; });
      }
      if (key === 'certificates') {
        const items = cv.certificates.filter(c => c.name);
        if (!items.length) return; heading('Certifications');
        items.forEach(c => { row(c.name, c.date); if (c.issuer) text(c.issuer, 9.5, 'italic', '#444444'); y += 1; });
      }
      if (key === 'languages') {
        const items = cv.languages.filter(l => l.language);
        if (!items.length) return; heading('Languages');
        text(items.map(l => l.language + (l.fluency ? ' (' + l.fluency + ')' : '')).join(', '), 10, 'normal');
      }
    });
    const safe = (b.name || 'CV').replace(/[^A-Za-z0-9]+/g, '_');
    doc.save(`${safe}_${shortId(store.id)}_${version.name.replace(/[^A-Za-z0-9]+/g, '_')}.pdf`);
  }

  window.UCV = {
    SECTION_LABELS, DEFAULT_ORDER, TEMPLATES, ACCENTS, STATUSES,
    esc, uid, clone, formatMonth, dateRange, lines, newId, shortId, mrz,
    blankCV, blankItem, sampleCV, newVersion, freshStore, load, save,
    renderCV, checks, match, keywords, shareLink, cardLink, encode, decode, siteBase,
    toJSONResume, fromJSONResume, pdf
  };
})();
