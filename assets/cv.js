/* Universal CV ID — core engine (v3)
   Master CV + per-version selection, A4 pagination, scoring, job match,
   import parsing, sharing and exports. Plain browser JavaScript. Global: UCV. */
(function () {
  'use strict';

  const STORE_KEY = 'ucvid:v3';
  const V2_KEY = 'ucvid:v2';
  const LEGACY_KEY = 'universalCVs';
  const CANONICAL_BASE = 'https://cvid.app/';

  const SECTION_LABELS = {
    summary: 'Profile', work: 'Experience', education: 'Education', skills: 'Skills',
    projects: 'Projects', certificates: 'Certifications', languages: 'Languages'
  };
  const DEFAULT_ORDER = ['summary', 'work', 'education', 'skills', 'projects', 'certificates', 'languages'];
  const LIST_SECTIONS = ['work', 'education', 'projects', 'certificates', 'languages'];
  const SIDEBAR_SECTIONS = ['skills', 'languages', 'certificates'];

  const TEMPLATES = [
    { id: 'meridian', name: 'Meridian', note: 'Centred header, clear rules' },
    { id: 'classic', name: 'Classic', note: 'Traditional serif, academic feel' },
    { id: 'slate', name: 'Slate', note: 'Minimal, headings in a left rail' },
    { id: 'ledger', name: 'Ledger', note: 'Two columns with a sidebar' },
    { id: 'compact', name: 'Compact', note: 'Dense, fits more on a page' },
    { id: 'plain', name: 'Plain ATS', note: 'Black and white, safest for screening' }
  ];
  const ACCENTS = ['#2446C7', '#0E7C66', '#B4462B', '#6B3FA0', '#1F2937', '#A16207'];
  const FONTS = [
    { id: 'auto', name: 'Template default', css: '' },
    { id: 'plex', name: 'IBM Plex Sans', css: "'IBM Plex Sans', Arial, sans-serif" },
    { id: 'lato', name: 'Lato', css: "'Lato', Arial, sans-serif" },
    { id: 'source', name: 'Source Serif', css: "'Source Serif 4', Georgia, serif" },
    { id: 'merri', name: 'Merriweather', css: "'Merriweather', Georgia, serif" },
    { id: 'arial', name: 'Arial', css: 'Arial, Helvetica, sans-serif' }
  ];
  const DATE_FORMATS = [
    { id: 'short', name: 'Jan 2025' }, { id: 'long', name: 'January 2025' }, { id: 'num', name: '01/2025' }
  ];
  const DEFAULT_DESIGN = { template: 'meridian', accent: ACCENTS[0], font: 'auto', size: 10, line: 1.45, margin: 15, gap: 16, dateFmt: 'short', photo: false, showId: true };
  const STATUSES = ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected'];

  // ---------- helpers ----------
  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  // cryptographically strong randomness for IDs
  function randomBytes(n) { const a = new Uint8Array(n); (window.crypto || window.msCrypto).getRandomValues(a); return a; }
  function uid(prefix) { return (prefix || '') + [...randomBytes(6)].map(b => (b % 36).toString(36)).join(''); }
  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
  // light formatting: **bold**, *italic*, [text](https://link)
  function fmt(text) {
    return esc(text)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  }
  function plain(text) {
    return String(text ?? '')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1$2');
  }
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function formatMonth(value, f) {
    if (!value) return '';
    const [y, m] = String(value).split('-').map(Number);
    if (!y) return value;
    if (!m) return String(y);
    if (f === 'long') return MONTHS[m - 1] + ' ' + y;
    if (f === 'num') return String(m).padStart(2, '0') + '/' + y;
    return MONTHS[m - 1].slice(0, 3) + ' ' + y;
  }
  function dateRange(start, end, f) {
    const s = formatMonth(start, f);
    const e = end ? formatMonth(end, f) : 'Present';
    return s ? s + ' – ' + e : (end ? e : '');
  }
  function lines(text) {
    return String(text || '').split('\n').map(l => l.replace(/^\s*[•\-*·▪◦●○■]\s*/, '').trim()).filter(Boolean);
  }
  const words = t => plain(t).split(/\s+/).filter(Boolean);

  // ---------- Universal ID ----------
  const ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function newId() {
    let s = '';
    randomBytes(5).forEach(b => { s += ID_CHARS[b & 31]; }); // 32 symbols, so the low 5 bits give an unbiased pick
    return '#UCVID-' + s;
  }
  function shortId(id) { return String(id || '').replace(/^#?UCVID-/, ''); }
  function checkDigit(str) { // ICAO 9303, weights 7-3-1
    const w = [7, 3, 1];
    let sum = 0;
    [...str].forEach((c, i) => {
      const v = /[0-9]/.test(c) ? +c : /[A-Z]/.test(c) ? c.charCodeAt(0) - 55 : 0;
      sum += v * w[i % 3];
    });
    return String(sum % 10);
  }
  function mrzName(s) {
    return String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z ]/g, '').trim().replace(/\s+/g, '<');
  }
  function mrz(id, name, label) {
    const code = shortId(id);
    const parts = String(name || '').trim().split(/\s+/);
    const surname = parts.length > 1 ? parts[parts.length - 1] : parts[0] || '';
    const given = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
    return [
      ('UCV<' + mrzName(surname) + '<<' + mrzName(given)).padEnd(36, '<').slice(0, 36),
      (code + checkDigit(code) + '<' + mrzName(label)).padEnd(36, '<').slice(0, 36)
    ];
  }

  // ---------- validation: nothing from a share link, an import or storage is trusted ----------
  const clampN = (v, lo, hi, def) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def; };
  const str = (v, max) => (typeof v === 'string' || typeof v === 'number') ? String(v).slice(0, max || 2000) : '';
  const arr = v => Array.isArray(v) ? v.slice(0, 200) : [];
  const obj = v => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  // a photo may only be an image embedded in the page, never an address on another server
  const safePhoto = p => (typeof p === 'string' && p.length < 400000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p)) ? p : '';
  // only ordinary web links are ever made clickable
  function safeUrl(u) {
    u = String(u || '').trim();
    if (/^https?:\/\/[^\s<>"'`]+$/i.test(u)) return u;
    if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/[^\s<>"'`]*)?$/i.test(u)) return 'https://' + u;
    return '';
  }
  function cleanDesign(d) {
    d = obj(d); const D = DEFAULT_DESIGN;
    return {
      template: TEMPLATES.some(t => t.id === d.template) ? d.template : D.template,
      accent: /^#[0-9a-fA-F]{6}$/.test(d.accent) ? d.accent : D.accent,
      font: FONTS.some(f => f.id === d.font) ? d.font : D.font,
      size: clampN(d.size, 8, 12, D.size), line: clampN(d.line, 1, 2, D.line),
      margin: clampN(d.margin, 5, 30, D.margin), gap: clampN(d.gap, 0, 40, D.gap),
      dateFmt: DATE_FORMATS.some(f => f.id === d.dateFmt) ? d.dateFmt : D.dateFmt,
      photo: d.photo === true, showId: false
    };
  }
  function cleanOrder(o) {
    const seen = new Set();
    const out = (Array.isArray(o) ? o : DEFAULT_ORDER).filter(k => typeof k === 'string' && (DEFAULT_ORDER.includes(k) || /^c:[A-Za-z0-9]{1,16}$/.test(k)) && !seen.has(k) && seen.add(k));
    return out.length ? out : DEFAULT_ORDER.slice();
  }
  function cleanCV(c) {
    c = obj(c); const b = obj(c.basics);
    return {
      basics: { name: str(b.name, 200), label: str(b.label, 200), email: str(b.email, 200), phone: str(b.phone, 60), location: str(b.location, 200), url: str(b.url, 300), summary: str(b.summary, 4000), photo: safePhoto(b.photo) },
      work: arr(c.work).map(obj).map(w => ({ position: str(w.position, 200), company: str(w.company, 200), location: str(w.location, 200), startDate: str(w.startDate, 10), endDate: str(w.endDate, 10),
        highlights: (Array.isArray(w.highlights) ? w.highlights : lines(str(w.highlights, 20000))).slice(0, 60).map(h => str(h, 1500)).filter(Boolean) })),
      education: arr(c.education).map(obj).map(e => ({ degree: str(e.degree, 300), institution: str(e.institution, 300), year: str(e.year, 20), details: str(e.details, 2000) })),
      skills: arr(c.skills).map(s => str(s, 120)).filter(Boolean),
      projects: arr(c.projects).map(obj).map(p => ({ name: str(p.name, 300), description: str(p.description, 2000), url: str(p.url, 300) })),
      certificates: arr(c.certificates).map(obj).map(x => ({ name: str(x.name, 300), issuer: str(x.issuer, 300), date: str(x.date, 20) })),
      languages: arr(c.languages).map(obj).map(l => ({ language: str(l.language, 100), fluency: str(l.fluency, 100) })),
      custom: arr(c.custom).map(obj).map(x => ({ key: /^c:[A-Za-z0-9]{1,16}$/.test(x.key) ? x.key : '', title: str(x.title, 120),
        items: arr(x.items).map(obj).map(i => ({ title: str(i.title, 300), sub: str(i.sub, 300), date: str(i.date, 40), text: str(i.text, 6000) })) }))
    };
  }
  const validId = id => typeof id === 'string' && /^#UCVID-[A-Z0-9]{5,12}$/.test(id);

  // ---------- data model ----------
  function blankMaster() {
    return {
      basics: { name: '', email: '', phone: '', location: '', url: '', photo: '' },
      work: [], education: [], skills: [], projects: [], certificates: [], languages: [], custom: []
    };
  }
  function blankItem(section) {
    const base = {
      work: { position: '', company: '', location: '', startDate: '', endDate: '', bullets: [{ id: uid('b'), text: '' }] },
      education: { degree: '', institution: '', year: '', details: '' },
      projects: { name: '', description: '', url: '' },
      certificates: { name: '', issuer: '', date: '' },
      languages: { language: '', fluency: '' },
      customItem: { title: '', sub: '', date: '', text: '' }
    }[section];
    return Object.assign({ id: uid('i') }, clone(base));
  }
  function newVersion(name) {
    return {
      vid: uid('v'), name: name || 'Main CV', label: '', summary: '',
      hidden: [], hiddenSections: [], order: DEFAULT_ORDER.slice(),
      design: clone(DEFAULT_DESIGN),
      target: { company: '', role: '', jd: '' },
      letter: { recipient: '', body: '' },
      updatedAt: new Date().toISOString()
    };
  }
  const B = (...texts) => texts.map(text => ({ id: uid('b'), text }));
  function sampleMaster() {
    const I = o => Object.assign({ id: uid('i') }, o);
    return {
      basics: { name: 'Maya Okafor', email: 'maya.okafor@example.com', phone: '+353 87 000 0000', location: 'Dublin, Ireland', url: 'linkedin.com/in/example', photo: '' },
      work: [
        I({ position: 'Senior Product Designer', company: 'Brightwater Health', location: 'Dublin', startDate: '2021-04', endDate: '',
          bullets: B('Led redesign of patient booking flow, cutting drop-off by **31%**', 'Built the design system now used by 4 product teams', 'Mentored 3 junior designers through promotion', 'Ran 40+ usability sessions with patients and clinic staff') }),
        I({ position: 'Product Designer', company: 'Ledgerline', location: 'London', startDate: '2017-09', endDate: '2021-03',
          bullets: B('Designed onboarding for 120,000 small-business users', 'Responsible for the mobile app settings screens', 'Cut support tickets on invoicing by 18% through clearer flows') })
      ],
      education: [I({ degree: 'MSc Interaction Design', institution: 'University of Limerick', year: '2017', details: '' })],
      skills: ['Figma', 'User research', 'Design systems', 'Prototyping', 'Accessibility (WCAG 2.2)', 'SQL'].map(name => ({ id: uid('s'), name })),
      projects: [I({ name: 'Open accessibility checklist', description: 'Free checklist used by 2,000+ designers', url: '' })],
      certificates: [I({ name: 'Certified Usability Analyst', issuer: 'Human Factors International', date: '2019' })],
      languages: [I({ language: 'English', fluency: 'Native' }), I({ language: 'French', fluency: 'Professional' })],
      custom: []
    };
  }
  function freshStore(withSample) {
    const v = newVersion('Main CV');
    if (withSample) {
      v.label = 'Senior Product Designer';
      v.summary = 'Product designer with 9 years in fintech and health tech. I turn messy research into shipped, measurable improvements, and I like working close to engineering.';
    }
    return {
      schema: 3, id: newId(), createdAt: new Date().toISOString(), isSample: !!withSample, isNew: true,
      share: { email: true, phone: false, location: true },
      master: withSample ? sampleMaster() : blankMaster(),
      versions: [v], active: v.vid,
      applications: withSample ? [
        { aid: uid('a'), company: 'Northwind Labs', role: 'Lead Product Designer', vid: v.vid, status: 'Interview', date: '2026-09-15', url: '', notes: 'Portfolio review booked' },
        { aid: uid('a'), company: 'Harbour Bank', role: 'Senior UX Designer', vid: v.vid, status: 'Applied', date: '2026-09-22', url: '', notes: '' }
      ] : []
    };
  }

  // turn a flat CV (old format or import result) into master content
  function toMaster(cv) {
    const m = blankMaster();
    const b = cv.basics || {};
    Object.assign(m.basics, { name: b.name || '', email: b.email || '', phone: b.phone || '', location: b.location || '', url: b.url || '', photo: safePhoto(b.photo) });
    m.work = (cv.work || []).map(w => ({ id: uid('i'), position: w.position || '', company: w.company || '', location: w.location || '', startDate: w.startDate || '', endDate: w.endDate || '',
      bullets: (Array.isArray(w.highlights) ? w.highlights : lines(w.highlights)).map(text => ({ id: uid('b'), text })) }));
    m.education = (cv.education || []).map(e => ({ id: uid('i'), degree: e.degree || '', institution: e.institution || '', year: String(e.year || ''), details: e.details || '' }));
    m.skills = (cv.skills || []).filter(Boolean).map(name => ({ id: uid('s'), name: String(name) }));
    m.projects = (cv.projects || []).map(p => ({ id: uid('i'), name: p.name || '', description: p.description || '', url: p.url || '' }));
    m.certificates = (cv.certificates || []).map(c => ({ id: uid('i'), name: c.name || '', issuer: c.issuer || '', date: String(c.date || '') }));
    m.languages = (cv.languages || []).map(l => ({ id: uid('i'), language: l.language || '', fluency: l.fluency || '' }));
    m.custom = (cv.custom || []).map(c => ({ id: uid('c'), title: c.title || 'Section', items: (c.items || []).map(i => ({ id: uid('i'), title: i.title || '', sub: i.sub || '', date: i.date || '', text: i.text || '' })) }));
    return m;
  }

  // v2 stores kept a full CV per version: merge them into one master
  function migrateV2(old) {
    if (!old || !Array.isArray(old.versions) || !old.versions.length) return null;
    const act = old.versions.find(v => v.vid === old.active) || old.versions[0];
    const store = { schema: 3, id: old.id || newId(), createdAt: old.createdAt || new Date().toISOString(), isSample: !!old.isSample, isNew: false,
      master: toMaster(act.cv), versions: [], active: null, applications: old.applications || [] };
    const m = store.master;
    const keyOf = { work: w => (w.position + '|' + w.company).toLowerCase(), education: e => (e.degree + '|' + e.institution).toLowerCase(),
      projects: p => (p.name || '').toLowerCase(), certificates: c => (c.name || '').toLowerCase(), languages: l => (l.language || '').toLowerCase() };
    old.versions.forEach(ov => {
      const v = newVersion(ov.name);
      v.vid = ov.vid; v.label = ov.cv.basics?.label || ''; v.summary = ov.cv.basics?.summary || '';
      v.target = Object.assign(v.target, ov.target);
      v.design = Object.assign(v.design, { template: ov.template || 'meridian', accent: ov.accent || ACCENTS[0] });
      v.order = (ov.order || DEFAULT_ORDER).slice();
      const seen = new Set();
      const src = toMaster(ov.cv);
      LIST_SECTIONS.forEach(sec => {
        src[sec].forEach(item => {
          let hit = m[sec].find(x => keyOf[sec](x) === keyOf[sec](item));
          if (!hit) { m[sec].push(item); hit = item; }
          seen.add(hit.id);
          if (sec === 'work') item.bullets.forEach(bl => {
            let bh = hit.bullets.find(x => x.text === bl.text);
            if (!bh) { hit.bullets.push(bl); bh = bl; }
            seen.add(bh.id);
          });
        });
      });
      src.skills.forEach(s => {
        let hit = m.skills.find(x => x.name.toLowerCase() === s.name.toLowerCase());
        if (!hit) { m.skills.push(s); hit = s; }
        seen.add(hit.id);
      });
      v._seen = seen;
      store.versions.push(v);
    });
    store.versions.forEach(v => {
      v.hidden = allIds(m).filter(id => !v._seen.has(id));
      delete v._seen;
    });
    store.active = act.vid;
    return store;
  }
  function allIds(m) {
    return [
      ...LIST_SECTIONS.flatMap(sec => m[sec].map(x => x.id)),
      ...m.work.flatMap(w => w.bullets.map(b => b.id)),
      ...m.skills.map(s => s.id),
      ...m.custom.flatMap(c => c.items.map(i => i.id))
    ];
  }
  function migrateLegacy(list) {
    if (!Array.isArray(list) || !list.length) return null;
    const v2 = { id: list[0].id, versions: list.map((old, i) => {
      const p = old.personalInfo || {};
      return { vid: uid('v'), name: i === 0 ? 'Main CV' : (p.title || 'Version ' + (i + 1)), cv: {
        basics: { name: p.name, label: p.title, email: p.email, phone: p.phone, location: p.location, url: p.linkedin, summary: p.summary },
        work: (old.experiences || []).filter(e => e && (e.title || e.company)).map(e => ({ position: e.title, company: e.company, location: e.location, startDate: e.startDate, endDate: e.endDate, highlights: e.description || '' })),
        education: (old.educations || []).filter(e => e && (e.degree || e.school)).map(e => ({ degree: e.degree, institution: e.school, year: e.year, details: e.details })),
        skills: old.skills || [] } };
    }) };
    return migrateV2(v2);
  }

  let memory = null;
  function normalise(store) {
    store.master = Object.assign(blankMaster(), store.master);
    store.master.basics = Object.assign(blankMaster().basics, store.master.basics);
    store.versions.forEach(v => {
      v.design = cleanDesign(v.design);
      v.target = Object.assign({ company: '', role: '', jd: '' }, v.target);
      v.letter = Object.assign({ recipient: '', body: '' }, v.letter);
      v.hidden = v.hidden || []; v.hiddenSections = v.hiddenSections || [];
      fixOrder(store, v);
    });
    store.master.basics.photo = safePhoto(store.master.basics.photo);
    store.applications = arr(store.applications);
    store.applications.forEach(a => { a.url = safeUrl(a.url); });
    store.share = Object.assign({ email: true, phone: false, location: true }, obj(store.share)); // which contact details go into shared links
    if (!validId(store.id)) store.id = newId();
    return store;
  }
  function sectionKeys(store) { return [...DEFAULT_ORDER, ...store.master.custom.map(c => 'c:' + c.id)]; }
  function fixOrder(store, v) {
    const keys = sectionKeys(store);
    v.order = (v.order || []).filter(k => keys.includes(k));
    keys.forEach(k => { if (!v.order.includes(k)) v.order.push(k); });
  }
  function sectionTitle(store, key) {
    if (SECTION_LABELS[key]) return SECTION_LABELS[key];
    const c = store.master.custom.find(x => 'c:' + x.id === key);
    return c ? (c.title || 'Custom section') : key;
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return normalise(JSON.parse(raw));
      const v2 = migrateV2(JSON.parse(localStorage.getItem(V2_KEY) || 'null'));
      if (v2) { save(v2); return normalise(v2); }
      const v1 = migrateLegacy(JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null'));
      if (v1) { save(v1); return normalise(v1); }
    } catch (e) { /* storage blocked or corrupt */ }
    return memory || freshStore(true);
  }
  function save(store) {
    memory = store;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); return true; } catch (e) { return false; }
  }

  // what one version actually shows: master content minus what is unticked
  function resolve(store, v, ed) {
    const hid = new Set(v.hidden);
    const vis = x => !hid.has(x.id);
    const m = store.master;
    const idx = arr => arr.map((x, i) => ({ x, i })).filter(o => vis(o.x));
    const tag = (obj, path) => { if (ed) obj._e = path; return obj; };
    const skills = idx(m.skills).filter(o => o.x.name);
    const cv = {
      basics: tag({ name: m.basics.name, email: m.basics.email, phone: m.basics.phone, location: m.basics.location, url: m.basics.url,
        label: v.label, summary: v.summary, photo: v.design.photo ? m.basics.photo : '' }, 'basics'),
      work: idx(m.work).map(({ x: w, i }) => {
        const bs = w.bullets.map((b, j) => ({ b, j })).filter(o => vis(o.b) && (o.b.text.trim() || (ed && ed.keep === o.b.id)));
        const out = tag({ position: w.position, company: w.company, location: w.location, startDate: w.startDate, endDate: w.endDate, highlights: bs.map(o => o.b.text.trim()) }, 'work.' + i);
        if (ed) out._be = bs.map(o => `work.${i}.bullets.${o.j}.text`);
        return out;
      }),
      education: idx(m.education).map(({ x: e, i }) => tag({ degree: e.degree, institution: e.institution, year: e.year, details: e.details }, 'education.' + i)),
      skills: skills.map(o => o.x.name),
      projects: idx(m.projects).map(({ x: p, i }) => tag({ name: p.name, description: p.description, url: p.url }, 'projects.' + i)),
      certificates: idx(m.certificates).map(({ x: c, i }) => tag({ name: c.name, issuer: c.issuer, date: c.date }, 'certificates.' + i)),
      languages: idx(m.languages).map(({ x: l, i }) => tag({ language: l.language, fluency: l.fluency }, 'languages.' + i)),
      custom: m.custom.map((c, ci) => ({ key: 'c:' + c.id, title: c.title, items: idx(c.items).map(({ x: it, i }) => tag({ title: it.title, sub: it.sub, date: it.date, text: it.text }, `custom.${ci}.items.${i}`)) }))
    };
    if (ed) cv._se = skills.map(o => `skills.${o.i}.name`);
    return { cv, order: v.order.filter(k => !v.hiddenSections.includes(k)), design: v.design, name: v.name };
  }

  // ---------- rendering ----------
  function sectionsData(cv, order, design) {
    const f = design.dateFmt;
    const out = [];
    const A = (o, f) => o && o._e ? ` data-e="m:${o._e}.${f}"` : '';
    const bul = (arr, paths) => arr.map((h, i) => `<li${paths && paths[i] ? ` data-e="m:${paths[i]}"` : ''}>${fmt(h)}</li>`);
    order.forEach(key => {
      let items = [];
      let title = SECTION_LABELS[key];
      if (key === 'summary') {
        if (cv.basics.summary) items = [{ head: `<p class="cv-summary"${cv.basics._e ? ' data-e="v:summary"' : ''}>${fmt(cv.basics.summary)}</p>`, bullets: [] }];
      } else if (key === 'work') {
        items = cv.work.filter(w => w.position || w.company).map(w => ({
          head: `<div class="cv-row"><strong${A(w, 'position')}>${esc(w.position || 'Role')}</strong><span class="cv-date">${esc(dateRange(w.startDate, w.endDate, f))}</span></div><div class="cv-sub"><span${A(w, 'company')}>${esc(w.company)}</span>${w.location ? ` · <span${A(w, 'location')}>${esc(w.location)}</span>` : ''}</div>`,
          bullets: bul(w.highlights, w._be) }));
      } else if (key === 'education') {
        items = cv.education.filter(e => e.degree || e.institution).map(e => ({
          head: `<div class="cv-row"><strong${A(e, 'degree')}>${esc(e.degree || 'Qualification')}</strong><span class="cv-date"${A(e, 'year')}>${esc(e.year)}</span></div><div class="cv-sub"${A(e, 'institution')}>${esc(e.institution)}</div>${e.details ? `<p class="cv-text"${A(e, 'details')}>${fmt(e.details)}</p>` : ''}`, bullets: [] }));
      } else if (key === 'skills') {
        if (cv.skills.length) items = [{ head: `<ul class="cv-tags">${cv.skills.map((s, i) => `<li${cv._se ? ` data-e="m:${cv._se[i]}"` : ''}>${esc(s)}</li>`).join('')}</ul>`, bullets: [] }];
      } else if (key === 'projects') {
        items = cv.projects.filter(p => p.name).map(p => ({
          head: `<div class="cv-row"><strong${A(p, 'name')}>${esc(p.name)}</strong>${p.url ? `<span class="cv-date">${safeUrl(p.url) ? `<a href="${esc(safeUrl(p.url))}" target="_blank" rel="noopener noreferrer">${esc(p.url)}</a>` : esc(p.url)}</span>` : ''}</div>${p.description ? `<p class="cv-text"${A(p, 'description')}>${fmt(p.description)}</p>` : ''}`, bullets: [] }));
      } else if (key === 'certificates') {
        items = cv.certificates.filter(c => c.name).map(c => ({
          head: `<div class="cv-row"><strong${A(c, 'name')}>${esc(c.name)}</strong><span class="cv-date"${A(c, 'date')}>${esc(c.date)}</span></div>${c.issuer ? `<div class="cv-sub"${A(c, 'issuer')}>${esc(c.issuer)}</div>` : ''}`, bullets: [], compact: true }));
      } else if (key === 'languages') {
        const ls = cv.languages.filter(l => l.language);
        if (ls.length) items = [{ head: `<ul class="cv-plain">${ls.map(l => `<li><strong${A(l, 'language')}>${esc(l.language)}</strong>${l.fluency ? ` — <span${A(l, 'fluency')}>${esc(l.fluency)}</span>` : ''}</li>`).join('')}</ul>`, bullets: [] }];
      } else if (key.startsWith('c:')) {
        const c = (cv.custom || []).find(x => x.key === key);
        if (c) {
          title = c.title || 'Section';
          items = c.items.filter(i => i.title || i.text).map(i => ({
            head: (i.title || i.date ? `<div class="cv-row"><strong${A(i, 'title')}>${esc(i.title)}</strong><span class="cv-date"${A(i, 'date')}>${esc(i.date)}</span></div>` : '') + (i.sub ? `<div class="cv-sub"${A(i, 'sub')}>${esc(i.sub)}</div>` : ''),
            bullets: bul(lines(i.text)) }));
        }
      }
      if (items.length) out.push({ key, title, items });
    });
    return out;
  }
  function headInner(cv, id, design) {
    const b = cv.basics;
    const link = (href, text) => `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>`;
    const mail = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(b.email) ? link('mailto:' + b.email, b.email) : esc(b.email);
    const tel = b.phone.replace(/[^\d+]/g, '').length >= 7 ? link('tel:' + b.phone.replace(/[^\d+]/g, ''), b.phone) : esc(b.phone);
    const web = safeUrl(b.url) ? link(safeUrl(b.url), b.url) : esc(b.url);
    const contact = [['email', b.email && mail], ['phone', b.phone && tel], ['location', b.location && esc(b.location)], ['url', b.url && web]].filter(c => c[1]).map(c => `<span${b._e ? ` data-e="m:basics.${c[0]}"` : ''}>${c[1]}</span>`).join('');
    const photo = safePhoto(b.photo);
    return `${photo ? `<img class="cv-photo" src="${photo}" alt="">` : ''}<div class="cv-headtext">
        <h1 class="cv-name"${b._e ? ' data-e="m:basics.name"' : ''}>${esc(b.name || 'Your name')}</h1>
        ${b.label ? `<p class="cv-label"${b._e ? ' data-e="v:label"' : ''}>${esc(b.label)}</p>` : ''}
        <p class="cv-contact">${contact}</p>
        ${design.showId && id ? `<p class="cv-id" title="Universal CV ID">${esc(id)}</p>` : ''}</div>`;
  }
  function styleVars(design) {
    design = cleanDesign(design);
    const fid = !design.font || design.font === 'auto' ? ({ classic: 'source', plain: 'arial' }[design.template] || 'plex') : design.font;
    const font = (FONTS.find(x => x.id === fid) || FONTS[1]).css;
    const accent = design.template === 'plain' ? '#111111' : (design.accent || ACCENTS[0]);
    const k = design.template === 'compact' ? { size: 0.95, line: 0.93, margin: 0.8, gap: 0.65 } : { size: 1, line: 1, margin: 1, gap: 1 }; // Compact tightens whatever you set
    return `--cv-accent:${accent};--cv-font:${font};--cv-size:${(design.size * k.size * 96 / 72).toFixed(2)}px;--cv-line:${(design.line * k.line).toFixed(3)};--cv-margin:${Math.round(design.margin * k.margin * 3.7795)}px;--cv-gap:${Math.round(design.gap * k.gap)}px`;
  }
  const mk = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  // Lay the CV out on real A4 pages. Returns the number of pages.
  function paginate(host, res, id) {
    const { cv, order } = res;
    const design = cleanDesign(res.design);
    const tpl = design.template;
    host.innerHTML = '';
    const vars = styleVars(design);
    const head = headInner(cv, id, design);
    const pages = [];
    function newPage() {
      const first = pages.length === 0;
      const page = mk('article', `cv cv-page t-${tpl}`);
      page.setAttribute('style', vars);
      let flow, side = null;
      if (tpl === 'ledger') {
        if (first) page.appendChild(mk('header', 'cv-head' + (cv.basics.photo ? ' has-photo' : ''), head));
        const cols = mk('div', 'cv-cols');
        flow = mk('div', 'cv-main cv-flow'); side = mk('aside', 'cv-side');
        cols.append(flow, side); page.appendChild(cols);
      } else {
        flow = mk('div', 'cv-flow'); page.appendChild(flow);
        if (first) flow.appendChild(mk('header', 'cv-head' + (cv.basics.photo ? ' has-photo' : ''), head));
      }
      page.appendChild(mk('div', 'cv-pageno'));
      host.appendChild(page);
      const p = { page, flow, side }; pages.push(p); return p;
    }
    const over = p => p.flow.scrollHeight > p.flow.clientHeight + 1;
    const openSection = (sec, cont) => {
      const el = mk('section', 'cv-sec' + (cont ? ' cv-cont' : ''));
      el.appendChild(mk('h2', 'cv-h', esc(sec.title)));
      const body = mk('div', 'cv-body'); el.appendChild(body);
      return { el, body };
    };
    const itemEl = (item, bullets, withHead) => mk('div', 'cv-item' + (item.compact ? ' cv-compact' : ''),
      (withHead ? item.head : '') + (bullets.length ? `<ul class="cv-bul">${bullets.join('')}</ul>` : ''));

    let cur = newPage();
    const secs = sectionsData(cv, order, design);
    let main = secs;
    if (tpl === 'ledger') {
      main = secs.filter(s => !SIDEBAR_SECTIONS.includes(s.key));
      cur.side.innerHTML = secs.filter(s => SIDEBAR_SECTIONS.includes(s.key)).map(s =>
        `<section class="cv-sec"><h2 class="cv-h">${esc(s.title)}</h2><div class="cv-body">${s.items.map(i => `<div class="cv-item${i.compact ? ' cv-compact' : ''}">${i.head}</div>`).join('')}</div></section>`).join('');
    }
    main.forEach(sec => {
      let s = openSection(sec, false);
      cur.flow.appendChild(s.el);
      let placed = 0;
      const nextPage = () => { cur = newPage(); s = openSection(sec, placed > 0); cur.flow.appendChild(s.el); };
      sec.items.forEach(item => {
        let bullets = item.bullets, withHead = true, guard = 0;
        while (guard++ < 40) {
          const el = itemEl(item, bullets, withHead);
          s.body.appendChild(el);
          if (!over(cur)) { placed++; break; }
          const ul = el.querySelector('ul.cv-bul');
          let n = bullets.length;
          if (ul) while (n > 0 && over(cur)) { ul.lastElementChild.remove(); n--; }
          if (ul && n >= 1 && !over(cur)) { // part of the role fits: continue its bullets on the next page
            placed++; bullets = bullets.slice(n); withHead = false; nextPage(); continue;
          }
          el.remove();
          const fresh = s.body.children.length === 0 && cur.flow.children.length === 1;
          if (fresh) { s.body.appendChild(itemEl(item, bullets, withHead)); placed++; break; } // taller than a page: let it clip
          if (s.body.children.length === 0) s.el.remove(); // never leave a heading alone at the foot of a page
          nextPage();
        }
      });
    });
    const total = pages.length;
    if (total > 1) pages.forEach((p, i) => { p.page.querySelector('.cv-pageno').textContent = `${cv.basics.name || ''} · Page ${i + 1} of ${total}`; });
    return total;
  }

  // ---------- cover letter ----------
  function yearsOfExperience(cv) {
    const starts = cv.work.map(w => parseInt(String(w.startDate).slice(0, 4), 10)).filter(Boolean);
    return starts.length ? Math.max(1, new Date().getFullYear() - Math.min(...starts)) : 0;
  }
  const lowerFirst = s => s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
  function draftLetter(res, v) {
    const cv = res.cv, t = v.target;
    const role = t.role || cv.basics.label || 'the role';
    const company = t.company || 'your company';
    const yrs = yearsOfExperience(cv);
    const job = cv.work[0];
    const strong = job ? job.highlights.map(plain).filter(h => !WEAK_OPENERS.test(h) && !/^I\b/.test(h)) : [];
    const bullets = strong.filter(h => /\d/.test(h)).concat(strong).filter((x, i, a) => a.indexOf(x) === i).slice(0, 2);
    const m = match(cv, t.jd, t.company);
    const inTitle = new RegExp('\\b(' + (role + ' ' + (cv.basics.label || '')).toLowerCase().split(/\W+/).filter(Boolean).join('|') + ')\\b');
    const usable = m ? m.found.filter(k => k.length > 3 && !k.toLowerCase().split(' ').every(w => inTitle.test(w))) : [];
    const kws = usable.filter(k => k.includes(' ')).concat(usable.filter(k => !k.includes(' '))).slice(0, 3);
    const paras = [];
    const an = /^[aeiou]/i.test(cv.basics.label || '') ? 'an' : 'a';
    const who = cv.basics.label && yrs ? `I am ${an} ${cv.basics.label} with ${yrs} years of experience, and the role` : cv.basics.label ? `I am ${an} ${cv.basics.label}, and the role` : yrs ? `I have ${yrs} years of experience, and the role` : 'The role';
    paras.push(`I am writing to apply for the ${role} position at ${company}. ${who} is a close match for the work I do best.`);
    if (job) paras.push(`${job.endDate ? 'Most recently, as' : 'In my current role as'} ${job.position || 'a team member'}${job.company ? ' at ' + job.company : ''}, I ${bullets.map(b => lowerFirst(b.replace(/\.$/, ''))).join('. I also ') || 'delivered work I am proud of'}.`);
    if (kws.length) paras.push(`Your advert asks for ${kws.join(', ').replace(/, ([^,]*)$/, ' and $1')}. These have been central to my recent work, and I would welcome the chance to show how I would apply them at ${company}.`);
    paras.push(`I would be glad to discuss how my experience fits what you need. Thank you for your time and consideration.`);
    return paras.join('\n\n');
  }
  function renderLetter(host, res, v, id) {
    const cv = res.cv, design = cleanDesign(res.design);
    host.innerHTML = '';
    const page = mk('article', `cv cv-page cv-letter t-${design.template === 'ledger' ? 'meridian' : design.template}`);
    page.setAttribute('style', styleVars(design));
    const today = new Date().toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' });
    const body = (v.letter.body || '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
    page.innerHTML = `<div class="cv-flow"><header class="cv-head${cv.basics.photo ? ' has-photo' : ''}">${headInner(cv, id, design)}</header>
      <div class="cv-letter-body">
        <p>${esc(today)}</p>
        <p>${[v.letter.recipient, v.target.company].filter(Boolean).map(esc).join('<br>')}</p>
        ${v.target.role ? `<p><strong>Re: ${esc(v.target.role)}</strong></p>` : ''}
        <p>Dear ${esc(v.letter.recipient || 'Hiring Manager')},</p>
        ${body.length ? body.map(p => `<p>${fmt(p).replace(/\n/g, '<br>')}</p>`).join('') : '<p class="cv-placeholder">Your letter will appear here. Use “Draft from my CV” to start.</p>'}
        <p>Yours sincerely,</p><p><strong>${esc(cv.basics.name)}</strong></p>
      </div></div>`;
    host.appendChild(page);
    return 1;
  }
  function letterText(res, v) {
    return [`Dear ${v.letter.recipient || 'Hiring Manager'},`, plain(v.letter.body || ''), 'Yours sincerely,', res.cv.basics.name].join('\n\n');
  }

  // ---------- score: every check, pass or fail ----------
  const WEAK_OPENERS = /^(responsible for|worked on|helped( to)?|assisted( with| in)?|involved in|participated in|duties included|tasked with|in charge of)\b/i;
  const BUZZ = ['hardworking', 'hard-working', 'team player', 'detail-oriented', 'detail oriented', 'results-driven', 'results driven', 'go-getter', 'self-starter', 'self starter', 'synergy', 'think outside the box', 'dynamic', 'passionate', 'highly motivated', 'proactive', 'guru', 'ninja', 'rockstar'];
  const PASSIVE = /\b(was|were|been|being|is|are)\s+(\w+ed|built|made|done|given|led|run|written|sold|held|sent)\b/gi;
  function score(res, pages) {
    const cv = res.cv, d = res.design, b = cv.basics;
    const C = [];
    const add = (cat, ok, label, detail, weight) => C.push({ cat, ok: !!ok, label, detail: ok ? '' : detail, weight: weight || 1 });
    const jobs = cv.work.filter(w => w.position || w.company);
    const bullets = jobs.flatMap(w => w.highlights.map(plain));
    const allText = [b.summary, ...bullets, ...cv.projects.map(p => p.description), ...cv.custom.flatMap(c => c.items.map(i => i.text))].map(plain).join('\n');
    const short = s => s.length > 52 ? s.slice(0, 52) + '…' : s;

    // Content
    add('Content', b.name && b.email && b.phone, 'Name, email and phone are filled in', `Missing: ${[!b.name && 'name', !b.email && 'email', !b.phone && 'phone'].filter(Boolean).join(', ')}.`, 3);
    add('Content', b.label, 'Has a professional title', 'Add the title you are going for under your name.', 2);
    const sw = words(b.summary).length;
    add('Content', sw >= 25 && sw <= 90, 'Profile summary is 25–90 words', sw ? `Yours is ${sw} words.` : 'Add 2–4 sentences on who you are and what you deliver.', 2);
    add('Content', jobs.length > 0, 'At least one role under Experience', 'Add your work experience.', 3);
    const thin = jobs.filter(w => w.highlights.length < 3 || w.highlights.length > 6);
    add('Content', jobs.length && !thin.length, '3 to 6 bullets for every role', thin.length ? `Check: ${thin.map(w => `${w.position || w.company} (${w.highlights.length})`).join(', ')}.` : 'Add roles first.', 3);
    const withNum = bullets.filter(h => /\d/.test(h)).length;
    add('Content', bullets.length && withNum / bullets.length >= 0.5, 'At least half the bullets include a number', `${withNum} of ${bullets.length} do. Add results: %, €, time saved, team size.`, 3);
    const weak = bullets.filter(h => WEAK_OPENERS.test(h));
    add('Content', !weak.length, 'Bullets start with an action verb', weak.length ? `Rewrite: “${short(weak[0])}”${weak.length > 1 ? ` and ${weak.length - 1} more` : ''}.` : '', 2);
    const pron = (allText.match(/\b(I|me|my|mine)\b/g) || []).length - (plain(b.summary).match(/\b(I|me|my|mine)\b/g) || []).length;
    add('Content', pron === 0, 'No “I”, “me” or “my” in bullets', `Found ${pron}. Drop the pronoun and start with the verb.`, 1);
    const long = bullets.filter(h => h.split(/\s+/).length > 32), tiny = bullets.filter(h => h.split(/\s+/).length < 4);
    add('Content', !long.length && !tiny.length, 'Bullets are 4–32 words', long.length ? `Too long: “${short(long[0])}”.` : tiny.length ? `Too short to say much: “${short(tiny[0])}”.` : '', 1);
    add('Content', cv.education.some(e => e.degree || e.institution), 'Education is listed', 'Add your education, even if it was a while ago.', 1);

    // Format
    add('Format', pages <= 2, 'Fits on one or two pages', `It runs to ${pages} pages. Untick older roles or bullets, or try the Compact template.`, 3);
    add('Format', d.size >= 8.5 && d.size <= 11, 'Font size between 8.5 and 11 pt', `It is ${d.size} pt.`, 1);
    const noDates = jobs.filter(w => !w.startDate);
    add('Format', jobs.length && !noDates.length, 'Every role has a start date', noDates.length ? `Missing on: ${noDates.map(w => w.position || w.company).join(', ')}.` : 'Add roles first.', 2);
    add('Format', d.margin >= 10, 'Margins of at least 10 mm', 'Narrow margins can be cut off when printed.', 1);
    add('Format', !b.photo || d.template !== 'plain', 'No photo on the ATS template', 'Screening software can stumble on images.', 1);

    // Best practices
    const wc = words([allText, cv.skills.join(' '), ...jobs.map(w => w.position + ' ' + w.company)].join(' ')).length;
    add('Best practices', wc >= 300 && wc <= 1600, 'Between 300 and 1,600 words', `Yours has about ${wc}. ${wc < 300 ? 'Add detail on what you achieved.' : 'Cut older or weaker material.'}`, 2);
    const buzz = BUZZ.filter(z => new RegExp('\\b' + z.replace(/[-\s]/g, '[-\\s]') + '\\b', 'i').test(allText));
    add('Best practices', !buzz.length, 'No buzzwords or filler', `Replace with evidence: ${buzz.slice(0, 4).join(', ')}.`, 1);
    const passive = (bullets.join('\n').match(PASSIVE) || []);
    add('Best practices', passive.length <= 1, 'Active voice in bullets', `Passive phrasing found ${passive.length} times, e.g. “${passive[0]}”.`, 1);
    add('Best practices', cv.skills.length >= 6 && cv.skills.length <= 24, '6 to 24 skills listed', `You show ${cv.skills.length}.`, 2);
    const firsts = bullets.map(h => (h.match(/^[A-Za-z]+/) || [''])[0].toLowerCase()).filter(Boolean);
    const rep = Object.entries(firsts.reduce((a, w) => (a[w] = (a[w] || 0) + 1, a), {})).filter(([, n]) => n > 2);
    add('Best practices', !rep.length, 'Opening verbs are varied', rep.length ? `“${rep[0][0]}” opens ${rep[0][1]} bullets.` : '', 1);
    add('Best practices', b.url, 'LinkedIn or website included', 'Add a link so recruiters can find more.', 1);
    add('Best practices', b.location, 'Location included', 'City and country is enough.', 1);

    // Job match
    let m = null;
    if (res.jd && res.jd.trim()) {
      m = match(cv, res.jd, res.jdCompany);
      if (m) add('Job match', m.score >= 70, 'Covers 70% of the job advert’s keywords', `Currently ${m.score}%. Missing: ${m.missing.slice(0, 5).join(', ')}.`, 4);
    }
    const cats = ['Content', 'Format', 'Best practices', 'Job match'].map(name => {
      const list = C.filter(c => c.cat === name);
      const total = list.reduce((s, c) => s + c.weight, 0), got = list.filter(c => c.ok).reduce((s, c) => s + c.weight, 0);
      return { name, list, pct: total ? Math.round(100 * got / total) : null };
    }).filter(c => c.list.length);
    const total = C.reduce((s, c) => s + c.weight, 0), got = C.filter(c => c.ok).reduce((s, c) => s + c.weight, 0);
    return { score: Math.round(100 * got / total), cats, fails: C.filter(c => !c.ok).length, match: m };
  }

  // ---------- job description match ----------
  const STOP = new Set(('a about above across after again against all also am an and any are as at be because been before being below between both but by can could did do does doing down during each either else etc even ever every few for from further get got had has have having he her here hers him his how i if in into is it its itself just least less like made make many may me might more most much must my no nor not now of off on once only or other our ours out over own per please rather same shall she should since so some such than that the their them then there these they this those though through thus to too under until up upon us very via was we well were what when where whether which while who whom whose why will with within without would yet you your yours ' +
    'ability able apply applicant applicants benefits candidate candidates company competitive day days description desirable environment essential excellent experience experienced full good great help ideal including job join key looking new offer opportunity opportunities part people plus position preferred proven relevant required requirement requirements responsibilities responsible role roles salary skills skill strong successful support team teams time using work working world year years based across ensure within related level range similar demonstrated knowledge understanding etc provide providing including include includes want wants seeking seek other others high highly clear across expert expertise running familiarity familiar nice tools tool scale standards managers manager plus hands proficiency proficient solid deep closely ' +
    'run runs running build builds building built maintain maintains maintaining own owning create creates creating deliver delivers delivering drive drives driving end background hybrid remote onsite office location permanent contract hours week weekly month monthly annual competitive dublin london cork galway belfast manchester ireland uk').split(/\s+/));
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
  function keywords(jd, exclude) {
    const ex = new Set(String(exclude || '').toLowerCase().match(/[a-z0-9+#]+/g) || []);
    const toks = tokenize(jd);
    const sc = new Map(), label = new Map();
    const bump = (term, w, raw) => { sc.set(term, (sc.get(term) || 0) + w); if (!label.has(term) || /[A-Z]/.test(raw)) label.set(term, raw); };
    const disp = t => t.cap || /[A-Z]{2,}/.test(t.raw) ? t.raw : t.low;
    toks.forEach((t, i) => {
      if (STOP.has(t.low) || ex.has(t.low) || t.low.length < 2) return;
      bump(t.low, 1 + (t.cap ? 1 : 0) + (/[A-Z]{2,}|[+#]/.test(t.raw) ? 1 : 0), disp(t));
      const n = toks[i + 1];
      if (n && !n.gap && !STOP.has(n.low) && !ex.has(n.low) && n.low.length > 1) bump(t.low + ' ' + n.low, 1.6, disp(t) + ' ' + disp(n));
    });
    const list = [...sc.entries()].filter(([term, s]) => !term.includes(' ') || s >= 3.2).sort((a, b) => b[1] - a[1]);
    const phrases = list.filter(([t]) => t.includes(' ')).slice(0, 10);
    const covered = new Set(phrases.flatMap(([t]) => t.split(' ')));
    const singles = list.filter(([t]) => !t.includes(' ') && !covered.has(t) && (t.length > 2 || /[+#]/.test(t)));
    return [...phrases, ...singles].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([term, weight]) => ({ term, weight, label: label.get(term) || term }));
  }
  function cvText(cv) {
    const b = cv.basics;
    return plain([b.label, b.summary,
      ...cv.work.map(w => [w.position, w.company, w.highlights.join(' . ')].join(' ')),
      ...cv.education.map(e => [e.degree, e.institution, e.details].join(' ')),
      cv.skills.join(' . '),
      ...cv.projects.map(p => p.name + ' ' + p.description),
      ...cv.certificates.map(c => c.name + ' ' + c.issuer),
      ...cv.languages.map(l => l.language),
      ...(cv.custom || []).flatMap(c => c.items.map(i => i.title + ' ' + i.text))
    ].join(' \n ')).toLowerCase();
  }
  function hasTerm(text, term) {
    const e = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s-]+');
    return new RegExp('(^|[^a-z0-9])' + e + '($|[^a-z0-9])').test(text);
  }
  function match(cv, jd, exclude) {
    const kws = keywords(jd || '', exclude);
    if (!kws.length) return null;
    const text = cvText(cv);
    let got = 0, total = 0;
    const found = [], missing = [];
    kws.forEach(k => { total += k.weight; if (hasTerm(text, k.term)) { got += k.weight; found.push(k.label); } else missing.push(k.label); });
    return { score: Math.round(100 * got / total), found, missing };
  }

  // ---------- import: turn the text of an existing CV into structured content ----------
  const HEADS = [
    ['summary', /^(professional |personal |career |executive )?(summary|profile|statement|objective|about( me)?)$/i],
    ['work', /^((work|professional|employment|career|relevant) )?(experience|history)$|^employment$/i],
    ['education', /^(education|academic (background|qualifications)|qualifications|education (and|&) (training|qualifications))$/i],
    ['skills', /^((key|core|technical|professional|relevant) )?(skills|competenc(ies|es)|expertise)( (and|&) (competencies|expertise|tools))?$|^technical expertise$|^core expertise$/i],
    ['projects', /^((key|selected|personal|notable) )?projects$/i],
    ['certificates', /^(certifications?|certificates?|licen[sc]es?( (and|&) certifications?)?|professional (registrations?|memberships?|certifications?)( (and|&) certifications?)?|accreditations?)$/i],
    ['languages', /^languages?$/i]
  ];
  const CUSTOM_HEADS = /^(publications?|awards?( (and|&) honou?rs)?|honou?rs|volunteer(ing)?( experience)?|interests|hobbies( (and|&) interests)?|references|training|courses|achievements|patents|presentations|conferences|memberships?|affiliations|additional information|activities)$/i;
  const MON = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
  const DATE = `(?:${MON}\\.?,?\\s+\\d{4}|\\d{1,2}[/.]\\d{4}|\\d{4})`;
  const RANGE = new RegExp(`(${DATE})\\s*(?:-|–|—|to|until)\\s*(${DATE}|present|current|now|date|ongoing)`, 'i');
  const BULLET = /^\s*[•\-*·▪◦●○■➢►✓]\s+/;
  function toYM(s) {
    if (!s || /present|current|now|date|ongoing/i.test(s)) return '';
    const y = (s.match(/\d{4}/) || [''])[0];
    let m = s.match(new RegExp(MON, 'i'));
    if (m) { const i = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m[0].slice(0, 3).toLowerCase()); return `${y}-${String(i + 1).padStart(2, '0')}`; }
    m = s.match(/^(\d{1,2})[/.]\d{4}/);
    if (m) return `${y}-${m[1].padStart(2, '0')}`;
    return y ? `${y}-01` : '';
  }
  function headingOf(line) {
    const t = line.replace(/\u2003/g, ' ').replace(/[:\-–—_|]+$/g, '').replace(/\s+/g, ' ').trim();
    if (!t || t.length > 46 || BULLET.test(line) || /[.!?,]$/.test(t)) return null;
    for (const [key, re] of HEADS) if (re.test(t)) return { key, title: t };
    if (CUSTOM_HEADS.test(t)) return { key: 'custom', title: t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() };
    return null;
  }
  function splitRoleLine(text) {
    // "Position at Company", "Position | Company", "Position, Company", "Position - Company"
    let m = text.match(/^(.+?)\s+at\s+(.+)$/i) || text.match(/^(.+?)\s*[|•·@]\s*(.+)$/) || text.match(/^(.+?)\s+[-–—]\s+(.+)$/) || text.match(/^(.+?),\s+(.+)$/);
    return m ? [m[1].trim(), m[2].trim()] : [text.trim(), ''];
  }
  // join a line that the PDF wrapped back onto the line before it
  function joinWrap(prev, line) { return /[A-Za-z]-$/.test(prev) && /^[A-Za-z]/.test(line) ? prev + line : prev + ' ' + line; }
  const OPEN_END = /([,;&\/+\-–]|\b(and|or|of|the|to|for|with|in|on|at|a|an|including|across|by|from|into|through|within)$)/i;
  function parseWork(ls, report) {
    report = report || { joined: 0 };
    const jobs = [];
    let cur = null, headLines = [], inBullets = false;
    const flush = () => {
      if (!headLines.length && !cur) return;
      if (headLines.length) {
        let start = '', end = '';
        const cleaned = headLines.flatMap(l => l.split(/\s*\u2003\s*/)).map(l => {
          const r = l.match(RANGE);
          if (r) { start = toYM(r[1]); end = toYM(r[2]); return l.replace(r[0], '').replace(/[\s|,(\-–—]+$/, '').replace(/^[\s|,)\-–—]+/, '').replace(/\(\s*\)/, '').trim(); }
          return l.trim();
        }).filter(Boolean);
        let position = '', company = '', location = '';
        if (cleaned.length >= 2) { position = cleaned[0]; company = cleaned[1]; if (cleaned[2]) location = cleaned[2]; }
        else if (cleaned.length === 1) [position, company] = splitRoleLine(cleaned[0]);
        const cm = company.match(/^(.+?)(?:,|\s+[-–—|·•]\s+)\s*([A-Z][A-Za-z .'-]+(?:,\s*[A-Z][A-Za-z .'-]+)?)$/);
        if (cm && !location && cm[2].length < 40) { company = cm[1]; location = cm[2]; }
        cur = { position, company, location, startDate: start, endDate: end, highlights: [] };
        jobs.push(cur);
        headLines = [];
      }
    };
    const VERB = /^(?:[A-Z][a-z]+(?:ed|ing)|Led|Built|Ran|Cut|Won|Grew|Drove|Set|Made|Wrote|Sold|Taught|Oversaw|Began|Brought|Took|Held|Kept|Met|Spoke|Sat|Responsible|Lead|Run|Build|Manage|Deliver|Design|Develop|Support|Work)\b/;
    ls.forEach(line => {
      if (inBullets && cur && cur.highlights.length && !RANGE.test(line) && !BULLET.test(line)) {
        const prev = cur.highlights[cur.highlights.length - 1];
        if ((/^[a-z]/.test(line) && !/[.!?]$/.test(prev)) || OPEN_END.test(prev)) { cur.highlights[cur.highlights.length - 1] = joinWrap(prev, line.trim()); report.joined++; return; }
      }
      const startedRole = !!cur || headLines.some(h => RANGE.test(h));
      const looksLikeBullet = startedRole && !RANGE.test(line) && line.split(' ').length >= 5 && (VERB.test(line) || /[.;]$/.test(line));
      if (looksLikeBullet && !BULLET.test(line)) line = '• ' + line;
      const isBullet = BULLET.test(line);
      const hasRange = RANGE.test(line);
      const longSentence = !isBullet && line.length > 90;
      if (isBullet || (longSentence && (cur || headLines.length) && !hasRange)) {
        if (headLines.length) flush();
        if (!cur) { cur = { position: '', company: '', location: '', startDate: '', endDate: '', highlights: [] }; jobs.push(cur); }
        cur.highlights.push(line.replace(BULLET, '').trim());
        inBullets = true;
      } else {
        // a wrapped bullet continuation: lower-case start right after a bullet
        if (inBullets && cur && cur.highlights.length && !hasRange && /^[a-z(0-9]/.test(line)) { cur.highlights[cur.highlights.length - 1] += ' ' + line.trim(); report.joined++; return; }
        if (inBullets || (hasRange && headLines.some(h => RANGE.test(h)))) { flush(); cur = null; inBullets = false; }
        headLines.push(line);
      }
    });
    flush();
    return jobs.filter(j => j.position || j.company || j.highlights.length);
  }
  const DEGREE = /\b(b\.?\s?sc|b\.?\s?eng|b\.?\s?a\b|b\.?\s?tech|bachelor|m\.?\s?sc|m\.?\s?eng|m\.?\s?a\b|m\.?\s?tech|mba|master|ph\.?\s?d|doctor|diploma|certificate|degree|higher national|leaving cert|a-levels?|hnd|hnc|postgraduate)\b/i;
  function parseEducation(ls) {
    const out = [];
    let cur = null;
    ls.forEach(raw => {
      const line = raw.replace(BULLET, '').trim();
      const year = (line.match(/\b(19|20)\d{2}\b(?!.*\b(19|20)\d{2}\b)/) || [''])[0];
      const text = line.replace(RANGE, '').replace(new RegExp(`\\(?\\b${DATE}\\b\\)?`, 'ig'), '').replace(/[\s,|\-–—]+$/, '').replace(/^[\s,|\-–—]+/, '').trim();
      const isDegree = DEGREE.test(text);
      if (isDegree && (!cur || cur.degree)) { cur = { degree: '', institution: '', year: '', details: '' }; out.push(cur); }
      if (!cur) { cur = { degree: '', institution: '', year: '', details: '' }; out.push(cur); }
      if (year && !cur.year) cur.year = year;
      if (!text) return;
      if (isDegree && !cur.degree) {
        const parts = text.split(/\s+[|–—-]\s+|,\s+/).map(p => p.trim()).filter(Boolean);
        const inst = parts.find(p => /universit|college|institute|school|academy|polytechnic/i.test(p) && !DEGREE.test(p));
        cur.degree = parts.filter(p => p !== inst).join(', ');
        if (inst && !cur.institution) cur.institution = inst;
      } else if (!cur.institution && /universit|college|institute|school|academy|polytechnic/i.test(text)) {
        const parts = text.split(/\s+[|–—-]\s+/).map(p => p.trim()).filter(Boolean);
        const inst = parts.find(p => /universit|college|institute|school|academy|polytechnic/i.test(p)) || text;
        cur.institution = inst;
        const rest = parts.filter(p => p !== inst).join(', ');
        if (rest) cur.details = (cur.details ? cur.details + ' ' : '') + rest;
      }
      else if (!cur.degree && !cur.institution) cur.institution = text;
      else cur.details = (cur.details ? cur.details + ' ' : '') + text;
    });
    return out.filter(e => e.degree || e.institution);
  }
  function parseText(text) {
    const unspace = l => { // "E X P E R I E N C E" (letter-spaced headings in PDFs) -> "EXPERIENCE"
      const t = l.trim();
      return /^(?:[A-Z&]\s{1,2}){2,}[A-Z&](?:\s{2,}(?:[A-Z&]\s{1,2})*[A-Z&])*$/.test(t) ? t.split(/\s{2,}/).map(w => w.replace(/\s/g, '')).join(' ') : l;
    };
    const report = { footers: 0, joined: 0, skills: 0, removed: [] };
    const drop = t => { report.footers++; if (report.removed.length < 12 && !report.removed.includes(t)) report.removed.push(t); return false; };
    // Page headers and footers: page numbers anywhere, and lines repeated at the top or bottom of several pages (PDFs mark pages with \f)
    const PAGE_RE = /^(?:.{0,90}?[\s·|•,–—-]+)?page\s*\d+\s*(?:of|\/)\s*\d+\.?$|^page\s*\d+$|^\d+\s*(?:of|\/)\s*\d+$|^[-–—]\s*\d+\s*[-–—]$/i;
    const norm = t => t.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();
    const pageTexts = String(text || '').replace(/\r/g, '').replace(/\u00a0/g, ' ').split(/\f/);
    const edgeOf = ls => { const ne = ls.map((l, i) => [l.trim(), i]).filter(x => x[0]); return { top: ne.slice(0, 2).map(x => x[1]), bottom: ne.slice(-2).map(x => x[1]) }; };
    const edgeCount = new Map();
    if (pageTexts.length > 1) pageTexts.forEach(pt => { const ls = pt.split('\n'), e = edgeOf(ls); new Set([...e.top, ...e.bottom].map(i => norm(ls[i]))).forEach(k => edgeCount.set(k, (edgeCount.get(k) || 0) + 1)); });
    const kept = [];
    pageTexts.forEach((pt, pi) => {
      const ls = pt.split('\n'), e = edgeOf(ls);
      ls.forEach((l, i) => {
        const t = l.trim();
        const atEdge = (pi > 0 && e.top.includes(i)) || e.bottom.includes(i);
        if (t && atEdge && t.length < 100 && (edgeCount.get(norm(t)) || 0) >= 2) { drop(t); return; }
        kept.push(l);
      });
    });
    const raw = kept.map(l => unspace(l).replace(/[ \t]{4,}/g, ' \u2003 ').replace(/[ \t]+/g, ' ').trim())
      .filter(l => l && !/^(universal cv id\s*)?#?UCVID-[A-Z0-9]{5}$/i.test(l) && !(/· Page \d+ of \d+$/.test(l) || PAGE_RE.test(l.replace(/\s*\u2003\s*/g, ' ')) ? !drop(l.replace(/\s*\u2003\s*/g, ' ')) : false))
      .reduce((acc, l) => { if (acc.length && /^[•\-*·▪◦●○■➢►✓]$/.test(acc[acc.length - 1])) acc[acc.length - 1] += ' ' + l; else acc.push(l); return acc; }, []); // a bullet dot alone on its line belongs to the next line
    const cv = { basics: { name: '', label: '', email: '', phone: '', location: '', url: '', summary: '' }, work: [], education: [], skills: [], projects: [], certificates: [], languages: [], custom: [] };
    // split into sections
    const blocks = [{ key: 'top', title: '', lines: [] }];
    raw.forEach(line => {
      const h = headingOf(line);
      if (h) blocks.push({ key: h.key, title: h.title, lines: [] });
      else blocks[blocks.length - 1].lines.push(line);
    });
    // header block: name, title, contact
    const top = blocks[0].lines;
    const joined = raw.slice(0, 14).join(' \n ');
    cv.basics.email = (joined.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/) || [''])[0];
    cv.basics.phone = ((joined.match(/(\+?\d[\d\s().-]{7,}\d)/) || [''])[0] || '').trim();
    cv.basics.url = (joined.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[A-Za-z0-9\-_/%]+/i) || joined.match(/https?:\/\/[^\s|,]+/) || [''])[0];
    const isContact = l => /@|linkedin\.com|https?:\/\/|www\./i.test(l) || /\+?\d[\d\s().-]{7,}\d/.test(l);
    const clean = top.filter(l => !/^(curriculum vitae|resume|résumé|cv)$/i.test(l));
    const CRED = /,?\s+(?:CEng|C\.Eng|IntPE|PhD|Ph\.D|MBA|MSc|BEng|BSc|MEng|MIEI|FIEI|PMP|CPA|ACCA|CFA|MIMechE|MIET|CEnv|CSci|PEng|FRSA|MRICS|MCIPD)\b.*$/;
    const nameLine = clean.find(l => !isContact(l) && l.replace(CRED, '').split(' ').length <= 5 && /^[A-Za-zÀ-ÿ'’.\- ,()]+$/.test(l));
    if (nameLine) cv.basics.name = nameLine.replace(CRED, '').trim();
    if (cv.basics.name && cv.basics.name === cv.basics.name.toUpperCase()) cv.basics.name = cv.basics.name.toLowerCase().replace(/(^|[\s\-'’.])([a-zà-ÿ])/g, (m, a, b) => a + b.toUpperCase());
    const after = clean.slice(clean.indexOf(nameLine) + 1);
    const labelLine = after.find(l => !isContact(l) && l.length < 70 && l.split(' ').length <= 9);
    if (labelLine) cv.basics.label = labelLine.split(/\s*[|•·]\s*/)[0];
    const loc = clean.filter(isContact).join(' | ').split(/\s*[|•·]\s*/).find(p => !/@|linkedin|https?:|www\./i.test(p) && !/\d{5,}/.test(p.replace(/\s/g, '')) && /^[A-Z][A-Za-z .'-]+(,\s*[A-Z][A-Za-z .'-]+)+$/.test(p.trim()));
    if (loc) cv.basics.location = loc.trim();
    const topRest = after.filter(l => l !== labelLine && !isContact(l));
    if (topRest.join(' ').length > 120) cv.basics.summary = topRest.join(' ');

    blocks.slice(1).forEach(bk => {
      const ls = bk.lines;
      if (bk.key === 'summary') cv.basics.summary = ls.map(l => l.replace(BULLET, '')).join(' ');
      else if (bk.key === 'work') cv.work = cv.work.concat(parseWork(ls, report));
      else if (bk.key === 'education') cv.education = cv.education.concat(parseEducation(ls));
      else if (bk.key === 'skills') {
        // first undo line wraps ("Cross-" / "Functional & Global Collaboration"), then split on real separators only
        const SKILL_OPEN = /[-&\/+]$|\b(and|or|of|for|with|in|to)$/i;
        const merged = [];
        ls.map(l => l.replace(BULLET, '').trim()).filter(Boolean).forEach(l => {
          const p = merged[merged.length - 1];
          if (p && !/:\s*$/.test(p) && !/^[A-Za-z &/]{3,40}:/.test(l) && (SKILL_OPEN.test(p) || (/^[a-z]/.test(l) && !/[,;.|•·]$/.test(p)))) { merged[merged.length - 1] = joinWrap(p, l); report.skills++; }
          else merged.push(l);
        });
        merged.forEach(l => {
          const parts = l.replace(/^[A-Za-z &/]{3,40}:\s*/, '').split(/(\s*[,;|•·]\s*|\s*\u2003\s*)/);
          const items = [];
          for (let i = 0; i < parts.length; i += 2) {
            const s = (parts[i] || '').trim(), sep = i ? parts[i - 1] : '';
            if (!s) continue;
            const prev = items[items.length - 1];
            if (prev && /\u2003/.test(sep) && (SKILL_OPEN.test(prev) || /^[a-z]/.test(s))) { items[items.length - 1] = joinWrap(prev, s); report.skills++; continue; }
            items.push(s);
          }
          items.forEach(s => { s = s.replace(/\.$/, '').replace(/^[-–—]\s*/, '').trim(); if (s && s.length < 80 && !cv.skills.some(x => x.toLowerCase() === s.toLowerCase())) cv.skills.push(s); });
        });
      } else if (bk.key === 'projects') {
        let cur = null;
        ls.forEach(l => { if (!BULLET.test(l) && l.length < 80) { cur = { name: l.replace(/[:\-–—]+$/, ''), description: '', url: '' }; cv.projects.push(cur); } else if (cur) cur.description = (cur.description + ' ' + l.replace(BULLET, '')).trim(); else { cur = { name: l.replace(BULLET, '').slice(0, 60), description: '', url: '' }; cv.projects.push(cur); } });
      } else if (bk.key === 'certificates') {
        ls.forEach(l => { const t = l.replace(BULLET, ''); const ym = t.match(/[\s,(|–—-]+((?:19|20)\d{2})\)?\s*$/); const y = ym ? ym[1] : ''; const [name, issuer] = (ym ? t.slice(0, ym.index) : t).split(/\s*[|–—]\s*|\s+-\s+|,\s+(?=[A-Z])/); const prev = cv.certificates[cv.certificates.length - 1]; if (prev && !prev.issuer && prev.date && !y && !issuer && t.split(' ').length <= 6) { prev.issuer = t.trim(); return; } if (name) cv.certificates.push({ name: name.trim(), issuer: (issuer || '').trim(), date: y }); });
      } else if (bk.key === 'languages') {
        ls.join(', ').split(/\s*[,;|•·]\s*/).forEach(s => { const m = s.replace(BULLET, '').match(/^([A-Za-zÀ-ÿ ]+?)\s*(?:[(:\-–—]\s*(.+?)\)?)?$/); if (m && m[1].trim()) cv.languages.push({ language: m[1].trim(), fluency: (m[2] || '').trim() }); });
      } else if (bk.key === 'custom') {
        cv.custom.push({ title: bk.title, items: [{ title: '', sub: '', date: '', text: ls.map(l => l.replace(BULLET, '')).join('\n') }] });
      }
    });
    const scrub = o => { Object.keys(o).forEach(k => { if (typeof o[k] === 'string') o[k] = o[k].replace(/\s*\u2003\s*/g, ' ').trim(); else if (o[k] && typeof o[k] === 'object') scrub(o[k]); }); return o; };
    scrub(cv);
    cv.report = report;
    return cv;
  }

  // ---------- sharing ----------
  function siteBase() {
    // inside the Claude preview window the page can't host share links, so point at the published site
    if (/claude/.test(location.hostname)) return CANONICAL_BASE;
    return location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
  }
  const encode = payload => LZString.compressToEncodedURIComponent(JSON.stringify(payload));
  function decode(str) { try { return JSON.parse(LZString.decompressFromEncodedURIComponent(str)); } catch (e) { return null; } }
  function shareLink(store, res) {
    const sh = store.share || { email: true, location: true };
    const cv = clone(res.cv); cv.basics.photo = '';
    if (!sh.email) cv.basics.email = '';
    if (!sh.phone) cv.basics.phone = '';
    if (!sh.location) cv.basics.location = '';
    const d = Object.assign({}, res.design, { photo: false });
    return siteBase() + 'p.html#' + encode({ v: 3, t: 'cv', id: store.id, cv, d, ord: res.order });
  }
  function cardLink(store, res) {
    const b = res.cv.basics, sh = store.share || {};
    return siteBase() + 'p.html#' + encode({ v: 3, t: 'card', id: store.id, n: b.name, l: b.label, e: sh.email ? b.email : '', p: sh.phone ? b.phone : '', loc: sh.location ? b.location : '', u: b.url });
  }
  // A link can be written by anyone, so every field is checked before it is shown. Links made before v3 are upgraded.
  function fromShare(data) {
    data = obj(data);
    const cv = cleanCV(data.cv);
    cv.basics.photo = '';
    const design = cleanDesign(data.d || { template: data.tpl, accent: data.ac });
    design.photo = false;
    return { cv, design, order: cleanOrder(data.ord), name: 'CV' };
  }
  function fromCard(data) {
    data = obj(data);
    return { n: str(data.n, 200), l: str(data.l, 200), e: str(data.e, 200), p: str(data.p, 60), loc: str(data.loc, 200), u: str(data.u, 300) };
  }

  // ---------- JSON Resume ----------
  function toJSONResume(store, res) {
    const cv = res.cv, b = cv.basics;
    return {
      $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
      basics: { name: b.name, label: b.label, email: b.email, phone: b.phone, summary: plain(b.summary), location: { city: b.location }, profiles: b.url ? [{ network: 'Link', url: b.url }] : [] },
      work: cv.work.map(w => ({ name: w.company, position: w.position, location: w.location, startDate: w.startDate, endDate: w.endDate, highlights: w.highlights.map(plain) })),
      education: cv.education.map(e => ({ institution: e.institution, studyType: e.degree, endDate: e.year, courses: e.details ? [e.details] : [] })),
      skills: cv.skills.map(s => ({ name: s })),
      projects: cv.projects.map(p => ({ name: p.name, description: p.description, url: p.url })),
      certificates: cv.certificates.map(c => ({ name: c.name, issuer: c.issuer, date: c.date })),
      languages: cv.languages.map(l => ({ language: l.language, fluency: l.fluency })),
      meta: { universalCvId: store.id, version: res.name }
    };
  }
  function fromJSONResume(j) {
    if (!j || typeof j !== 'object' || !j.basics) throw new Error('This file is not in JSON Resume format (no "basics" section).');
    const b = j.basics || {};
    return {
      basics: { name: b.name || '', label: b.label || '', email: b.email || '', phone: b.phone || '', summary: b.summary || '',
        location: typeof b.location === 'string' ? b.location : [b.location?.city, b.location?.region, b.location?.countryCode].filter(Boolean).join(', '),
        url: b.url || (b.profiles && b.profiles[0] && (b.profiles[0].url || b.profiles[0].username)) || '' },
      work: (j.work || []).map(w => ({ position: w.position || '', company: w.name || w.company || '', location: w.location || '', startDate: (w.startDate || '').slice(0, 7), endDate: (w.endDate || '').slice(0, 7), highlights: [w.summary, ...(w.highlights || [])].filter(Boolean) })),
      education: (j.education || []).map(e => ({ degree: [e.studyType, e.area].filter(Boolean).join(' '), institution: e.institution || '', year: (e.endDate || '').slice(0, 4), details: (e.courses || []).join(', ') })),
      skills: (j.skills || []).flatMap(s => s.keywords && s.keywords.length ? s.keywords : [s.name]).filter(Boolean),
      projects: (j.projects || []).map(p => ({ name: p.name || '', description: p.description || '', url: p.url || '' })),
      certificates: (j.certificates || []).map(c => ({ name: c.name || '', issuer: c.issuer || '', date: c.date || '' })),
      languages: (j.languages || []).map(l => ({ language: l.language || '', fluency: l.fluency || '' })),
      custom: []
    };
  }
  const fileStem = (store, res) => `${(res.cv.basics.name || 'CV').replace(/[^A-Za-z0-9]+/g, '_')}_${(res.name || 'CV').replace(/[^A-Za-z0-9]+/g, '_')}`;

  // ---------- plain text PDF (always readable by screening software) ----------
  function pdf(store, res) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const cv = res.cv, b = cv.basics, d = res.design;
    const accent = d.template === 'plain' ? '#111111' : (d.accent || ACCENTS[0]);
    const M = 18, W = 210 - M * 2;
    let y = M;
    const ensure = h => { if (y + h > 297 - M) { doc.addPage(); y = M; } };
    const text = (str, size, style, color, indent) => {
      doc.setFont('helvetica', style || 'normal'); doc.setFontSize(size); doc.setTextColor(color || '#1a1a1a');
      doc.splitTextToSize(plain(str), W - (indent || 0)).forEach(line => { ensure(size * 0.45); doc.text(line, M + (indent || 0), y); y += size * 0.43; });
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
    const bullet = h => { ensure(5); doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor('#1a1a1a'); doc.text('•', M + 1, y); text(h, 10, 'normal', '#1a1a1a', 5); };
    text(b.name || 'Your name', 20, 'bold', '#111111'); y += 1;
    if (b.label) text(b.label, 11.5, 'normal', accent);
    const contact = [b.email, b.phone, b.location, b.url].filter(Boolean).join('  |  ');
    if (contact) text(contact, 9, 'normal', '#444444');
    if (d.showId) text('Universal CV ID ' + store.id, 8, 'normal', '#777777');
    y += 2;
    const heading = label => {
      ensure(12); y += 3;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(accent);
      doc.text(label.toUpperCase(), M, y); y += 1.6;
      doc.setDrawColor(accent); doc.setLineWidth(0.3); doc.line(M, y, 210 - M, y); y += 4.4;
    };
    const f = d.dateFmt;
    res.order.forEach(key => {
      if (key === 'summary' && b.summary) { heading('Profile'); text(b.summary, 10, 'normal'); }
      if (key === 'work') { const items = cv.work.filter(w => w.position || w.company); if (!items.length) return; heading('Experience');
        items.forEach(w => { row(w.position || 'Role', dateRange(w.startDate, w.endDate, f)); text([w.company, w.location].filter(Boolean).join(', '), 9.5, 'italic', '#444444'); w.highlights.forEach(bullet); y += 2; }); }
      if (key === 'education') { const items = cv.education.filter(e => e.degree || e.institution); if (!items.length) return; heading('Education');
        items.forEach(e => { row(e.degree || 'Qualification', e.year); if (e.institution) text(e.institution, 9.5, 'italic', '#444444'); if (e.details) text(e.details, 9.5, 'normal'); y += 1.5; }); }
      if (key === 'skills' && cv.skills.length) { heading('Skills'); text(cv.skills.join(', '), 10, 'normal'); }
      if (key === 'projects') { const items = cv.projects.filter(p => p.name); if (!items.length) return; heading('Projects');
        items.forEach(p => { row(p.name, p.url); if (p.description) text(p.description, 10, 'normal'); y += 1.5; }); }
      if (key === 'certificates') { const items = cv.certificates.filter(c => c.name); if (!items.length) return; heading('Certifications');
        items.forEach(c => { row(c.name, c.date); if (c.issuer) text(c.issuer, 9.5, 'italic', '#444444'); y += 1; }); }
      if (key === 'languages') { const items = cv.languages.filter(l => l.language); if (!items.length) return; heading('Languages');
        text(items.map(l => l.language + (l.fluency ? ' (' + l.fluency + ')' : '')).join(', '), 10, 'normal'); }
      if (key.startsWith('c:')) { const c = cv.custom.find(x => x.key === key); const items = c ? c.items.filter(i => i.title || i.text) : []; if (!items.length) return; heading(c.title || 'Section');
        items.forEach(i => { if (i.title || i.date) row(i.title || '', i.date); if (i.sub) text(i.sub, 9.5, 'italic', '#444444'); lines(i.text).forEach(bullet); y += 1.5; }); }
    });
    doc.save(fileStem(store, res) + '.pdf');
  }

  // ---------- Word (.docx) ----------
  function docxBlob(store, res, letter) {
    const D = window.docx;
    const cv = res.cv, b = cv.basics, f = res.design.dateFmt;
    const accent = (res.design.template === 'plain' ? '111111' : (res.design.accent || ACCENTS[0]).replace('#', ''));
    const FONT = 'Calibri';
    const run = (text, o) => new D.TextRun(Object.assign({ text: plain(text), font: FONT, size: 21 }, o));
    const para = (children, o) => new D.Paragraph(Object.assign({ children: Array.isArray(children) ? children : [children], spacing: { after: 60 } }, o));
    const kids = [];
    kids.push(para(run(b.name || 'Your name', { bold: true, size: 40 }), { spacing: { after: 40 } }));
    if (b.label) kids.push(para(run(b.label, { size: 24, color: accent }), { spacing: { after: 40 } }));
    const contact = [b.email, b.phone, b.location, b.url].filter(Boolean).join('  |  ');
    if (contact) kids.push(para(run(contact, { size: 18, color: '444444' })));
    if (letter) {
      const today = new Date().toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' });
      kids.push(para(run(today), { spacing: { before: 300, after: 200 } }));
      [letter.recipient, letter.company].filter(Boolean).forEach(l => kids.push(para(run(l), { spacing: { after: 0 } })));
      if (letter.role) kids.push(para(run('Re: ' + letter.role, { bold: true }), { spacing: { before: 200, after: 200 } }));
      kids.push(para(run(`Dear ${letter.recipient || 'Hiring Manager'},`), { spacing: { before: 200, after: 160 } }));
      (letter.body || '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean).forEach(p => kids.push(para(run(p), { spacing: { after: 160 } })));
      kids.push(para(run('Yours sincerely,'), { spacing: { before: 200, after: 300 } }));
      kids.push(para(run(b.name, { bold: true })));
    } else {
      if (res.design.showId) kids.push(para(run('Universal CV ID ' + store.id, { size: 16, color: '777777' })));
      const heading = t => kids.push(new D.Paragraph({ children: [run(t.toUpperCase(), { bold: true, size: 20, color: accent })], spacing: { before: 240, after: 100 },
        border: { bottom: { style: D.BorderStyle.SINGLE, size: 6, color: accent, space: 2 } } }));
      const row = (left, right) => kids.push(new D.Paragraph({ children: [run(left, { bold: true }), ...(right ? [run('\t' + right, { size: 18, color: '555555' })] : [])],
        tabStops: [{ type: D.TabStopType.RIGHT, position: 9638 }], spacing: { before: 80, after: 20 } }));
      const sub = t => t && kids.push(para(run(t, { italics: true, size: 19, color: '444444' }), { spacing: { after: 40 } }));
      const bul = t => kids.push(new D.Paragraph({ children: [run(t)], bullet: { level: 0 }, spacing: { after: 30 } }));
      res.order.forEach(key => {
        if (key === 'summary' && b.summary) { heading('Profile'); kids.push(para(run(b.summary))); }
        if (key === 'work') { const items = cv.work.filter(w => w.position || w.company); if (!items.length) return; heading('Experience');
          items.forEach(w => { row(w.position || 'Role', dateRange(w.startDate, w.endDate, f)); sub([w.company, w.location].filter(Boolean).join(', ')); w.highlights.forEach(bul); }); }
        if (key === 'education') { const items = cv.education.filter(e => e.degree || e.institution); if (!items.length) return; heading('Education');
          items.forEach(e => { row(e.degree || 'Qualification', e.year); sub(e.institution); if (e.details) kids.push(para(run(e.details))); }); }
        if (key === 'skills' && cv.skills.length) { heading('Skills'); kids.push(para(run(cv.skills.join(', ')))); }
        if (key === 'projects') { const items = cv.projects.filter(p => p.name); if (!items.length) return; heading('Projects');
          items.forEach(p => { row(p.name, p.url); if (p.description) kids.push(para(run(p.description))); }); }
        if (key === 'certificates') { const items = cv.certificates.filter(c => c.name); if (!items.length) return; heading('Certifications');
          items.forEach(c => { row(c.name, c.date); sub(c.issuer); }); }
        if (key === 'languages') { const items = cv.languages.filter(l => l.language); if (!items.length) return; heading('Languages');
          kids.push(para(run(items.map(l => l.language + (l.fluency ? ' (' + l.fluency + ')' : '')).join(', ')))); }
        if (key.startsWith('c:')) { const c = cv.custom.find(x => x.key === key); const items = c ? c.items.filter(i => i.title || i.text) : []; if (!items.length) return; heading(c.title || 'Section');
          items.forEach(i => { if (i.title || i.date) row(i.title || '', i.date); sub(i.sub); lines(i.text).forEach(bul); }); }
      });
    }
    const doc = new D.Document({ styles: { default: { document: { run: { font: FONT, size: 21 } } } },
      sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children: kids }] });
    return D.Packer.toBlob(doc);
  }

  window.UCV = {
    SECTION_LABELS, DEFAULT_ORDER, LIST_SECTIONS, TEMPLATES, ACCENTS, FONTS, DATE_FORMATS, DEFAULT_DESIGN, STATUSES,
    esc, uid, clone, fmt, plain, lines, formatMonth, dateRange, newId, shortId, mrz,
    blankMaster, blankItem, newVersion, freshStore, toMaster, load, save, resolve, sectionKeys, sectionTitle, fixOrder, allIds,
    paginate, renderLetter, draftLetter, letterText, score, match, keywords, parseText,
    shareLink, cardLink, fromShare, fromCard, cleanCV, cleanDesign, cleanOrder, safeUrl, safePhoto, validId, encode, decode, siteBase, toJSONResume, fromJSONResume, pdf, docxBlob, fileStem
  };
})();
