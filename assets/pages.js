/* Universal CV ID — app pages (v37)
   Dashboard, Resumes, Find jobs, Cover letters, Contacts, Interviews and Resources.
   app.js owns the saved data and the tab state; this file draws the pages and handles their buttons.
   Everything the person writes stays in this browser. The one exception is Find jobs, which sends
   the words typed in the search box (and nothing from the CV) to our job-search server. */
(function () {
  'use strict';

  const JOBS_API = 'https://jobs.cvid.app'; // see worker/README.md
  // Find jobs mode. 'widget' = Careerjet's own search box (no server IP needed).
  // 'api' = our own search form + the Worker (needs Careerjet to accept the Worker's IP; see worker/README.md).
  const SEARCH_MODE = 'widget';
  const CJ_WIDGET = 'https://widget.careerjet.net/search-box/848f77cae4562850c1555c18cfe1c06d'; // public widget id, not a secret
  let cjHost = null; // kept between renders so results are not wiped when the page redraws
  function mountWidget() {
    const slot = document.getElementById('cjSlot'); if (!slot) return;
    if (!cjHost) {
      cjHost = document.createElement('div'); cjHost.className = 'cj-search-box'; cjHost.setAttribute('data-url', CJ_WIDGET);
      slot.appendChild(cjHost);
      const js = document.createElement('script'); js.id = 'cj-search-box'; js.async = true;
      js.src = 'https://static.careerjet.org/js/all_widget_search_box_3rd_party.min.js?t=' + Date.now();
      document.body.appendChild(js);
    } else if (cjHost.parentNode !== slot) slot.appendChild(cjHost);
  }

  const IC = {
    home: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    resumes: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 11h7M9 15h7"/>',
    tracker: '<rect x="4" y="4" width="4" height="16" rx="1"/><rect x="10" y="4" width="4" height="10" rx="1"/><rect x="16" y="4" width="4" height="13" rx="1"/>',
    find: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    cover: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 8l9 6 9-6"/>',
    contacts: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
    interviews: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>',
    resources: '<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M8 8h6M8 12h6"/>',
    profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'
  };
  const NAV = [['home', 'Dashboard'], ['resumes', 'Resumes'], ['tracker', 'Job tracker'], ['find', 'Find jobs'], ['cover', 'Cover letters'], ['contacts', 'Contacts'], ['interviews', 'Interviews'], ['resources', 'Resources']];
  const PAGES = NAV.map(n => n[0]).concat('profile');

  const QUESTIONS = [
    'Tell me about a time you handled a difficult person: a customer, patient or colleague.',
    'Tell me about a time you worked under pressure to meet a deadline.',
    'Tell me about a time you made a mistake. What did you do about it?',
    'Tell me about something you improved at work.',
    'Tell me about a time you worked as part of a team.',
    'Tell me about a time you had to learn something quickly.',
    'Tell me about a time you disagreed with someone. What happened?',
    'Tell me about a time you went beyond what was asked of you.'
  ];
  const PREP = ['Read the job advert again', 'Look up the employer and its team', 'Practise three answers', 'Prepare two questions to ask them', 'Plan your route and arrive 10 minutes early'];

  window.UCVPages = function (ctx) {
    const esc = ctx.esc;
    const today = () => new Date().toISOString().slice(0, 10);
    const arrIn = (s, k) => (s[k] = Array.isArray(s[k]) ? s[k] : []);
    const dateFmt = (d, o) => { try { return new Date(d.length === 10 ? d + 'T00:00' : d).toLocaleDateString(undefined, o || { day: 'numeric', month: 'short' }); } catch (_) { return ''; } };
    const cap = (s, n) => String(s == null ? '' : s).slice(0, n);
    const firstName = s => (s.master.basics.name || '').trim().split(/\s+/)[0] || '';
    const words = t => (String(t || '').toLowerCase().match(/[a-z][a-z+#.]{2,}/g) || []);
    const STOP = new Set('the and for with that this you your our are will from have has was were not but all any can able work role job team they their who per etc into out over more most such also than then them its it\'s about across within including'.split(' '));

    // ---------- navigation ----------
    function side(tab) {
      const s = ctx.store();
      const badge = id => id === 'tracker' && s.applications.length ? `<span class="sd-badge">${s.applications.length}</span>` : '';
      const link = (id, label) => `<a href="#${id}" class="sd-link" data-tab="${id}"${tab === id || (id === 'resumes' && tab === 'versions') ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${IC[id]}</svg><span>${label}</span>${badge(id)}</a>`;
      return `
        <a class="sd-brand" href="index.html"><span class="brand-mark" aria-hidden="true"></span><span>Universal CV ID</span></a>
        <nav class="sd-nav" aria-label="App">${NAV.map(([id, l]) => link(id, l)).join('')}</nav>
        <div class="sd-foot">
          <div class="sd-note"><b>Kept in this browser</b><span>Your CV, tracker and notes are saved on this device. Only Find jobs searches leave it, and they carry what you typed, not your CV.</span></div>
          ${link('profile', 'Profile and settings')}
          <a class="sd-link" href="https://tally.so/r/1A11el" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg><span>Give feedback</span></a>
        </div>`;
    }

    // ---------- dashboard ----------
    function home() {
      const s = ctx.store(), m = s.master, first = firstName(s);
      const stats = ctx.cvStats(), apps = s.applications, td = today();
      const count = st => apps.filter(a => a.status === st).length;
      const main = stats.find(x => x.v.vid === s.active) || stats[0], v = main.v;
      const hr = new Date().getHours(), hello = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
      const nx = ctx.dashNext(stats, apps, td);
      const pf = s.prefs || {};
      const steps = ctx.journey();
      const doneN = steps.filter(x => x[2]).length;
      const goTo = ([id]) => id === 'tracker' ? 'data-tab="tracker"' : `data-action="open-version" data-vid="${esc(s.active)}" data-to="${id}"`;
      const dueApps = apps.filter(a => a.followUp && a.followUp <= td && (a.status === 'Applied' || a.status === 'Interview'));
      const dueContacts = arrIn(s, 'contacts').filter(c => c.followUp && c.followUp <= td);
      const nextIv = upcoming(s)[0];
      const todayRows = [
        ...dueApps.map(a => `<button class="pg-row" data-action="app-goto" data-aid="${esc(a.aid)}"><span class="pg-dot warn"></span><span><b>Follow up: ${esc(a.role)}</b><i>${esc(a.company)}</i></span><em>Open</em></button>`),
        ...dueContacts.map(c => `<button class="pg-row" data-action="pg-contact-open" data-cid="${esc(c.cid)}"><span class="pg-dot warn"></span><span><b>Get back to ${esc(c.name)}</b><i>${esc(c.org || c.role || '')}</i></span><em>Open</em></button>`),
        nextIv ? `<button class="pg-row" data-tab="interviews"><span class="pg-dot ok"></span><span><b>Interview: ${esc(nextIv.role || 'Interview')}${nextIv.company ? ', ' + esc(nextIv.company) : ''}</b><i>${esc(dateFmt(nextIv.when, { weekday: 'long', day: 'numeric', month: 'long' }))}</i></span><em>Get ready</em></button>` : ''
      ].filter(Boolean);
      return `
        <header class="pg-head">
          <div><p class="pg-date">${new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p><h1>${hello}${first ? ', ' + esc(first) : ''}</h1></div>
          <div class="pg-actions"><button class="btn btn-primary" data-action="app-add-go">+ Add a job</button><button class="btn" data-tab="find">Find jobs</button></div>
        </header>
        <section class="pg-next"><span class="pg-next-ic" aria-hidden="true">→</span><div><b>${esc(nx.t)}</b><span>${esc(nx.d)}</span></div><button class="btn btn-primary" ${nx.a}>${esc(nx.b)}</button></section>
        <div class="pg-stats" role="group" aria-label="Your job search">
          ${['Saved', 'Applied', 'Interview', 'Offer'].map(st => `<button class="pg-stat st-${st}" data-tab="tracker"><b>${count(st)}</b><span>${st}</span></button>`).join('')}
        </div>
        <div class="pg-cols">
          <section class="pg-card" aria-labelledby="gsT">
            <div class="pg-card-top"><h2 id="gsT">Getting started</h2><span>${doneN} of ${steps.length}</span></div>
            <div class="pg-bar"><i style="width:${Math.round(doneN / steps.length * 100)}%"></i></div>
            ${steps.map(x => `<div class="pg-check ${x[2] ? 'done' : ''}"><span class="pg-tick" aria-hidden="true">${x[2] ? '✓' : ''}</span><span class="pg-check-t">${esc(x[1])}</span>${x[2] ? '' : `<button class="btn btn-sm" ${goTo(x)}>Do this</button>`}</div>`).join('')}
          </section>
          <section class="pg-card" aria-labelledby="glT">
            <div class="pg-card-top"><h2 id="glT">Your goal</h2><span>Kept on this device</span></div>
            <label class="field">Target role<input type="text" data-pref="roles" value="${esc(pf.roles || '')}" placeholder="e.g. Medical Secretary"></label>
            <div class="grid-2" style="margin-top:12px">
              <label class="field">Place<input type="text" data-pref="locations" value="${esc(pf.locations || '')}" placeholder="e.g. Waterford"></label>
              <label class="field">Hoping to start by<input type="date" data-pref="targetDate" value="${esc(pf.targetDate || '')}"></label>
            </div>
            ${pf.targetDate ? `<p class="hint" style="margin-top:12px">${goalLine(pf.targetDate)}</p>` : '<p class="hint" style="margin-top:12px">Find jobs uses these to start your search.</p>'}
          </section>
        </div>
        <div class="pg-cols">
          <section class="pg-card" aria-labelledby="tdT">
            <div class="pg-card-top"><h2 id="tdT">Today</h2></div>
            ${todayRows.length ? `<div class="pg-list">${todayRows.join('')}</div>` : '<p class="empty" style="margin:8px 0 0">Nothing needs you today. Find a job to go for, or tidy your CV.</p>'}
          </section>
          <section class="pg-card" aria-labelledby="cvT">
            <div class="pg-card-top"><h2 id="cvT">Your CV</h2><button class="btn btn-sm btn-ghost" data-tab="resumes">All resumes</button></div>
            <div class="pg-cv">
              <div class="ring big" style="--v:${main.score};--c:${ctx.ringColor(main.score)}"><span>${main.score}</span></div>
              <div><b>${esc(v.name)}</b><span>${esc(v.label || 'No title yet')}</span><span>${main.match == null ? 'No job matched yet' : main.match + '% job match'}</span></div>
            </div>
            <div class="ctrls"><button class="btn btn-primary" data-action="open-version" data-vid="${esc(v.vid)}">Write</button><button class="btn" data-action="open-version" data-vid="${esc(v.vid)}" data-to="design">Design</button><button class="btn" data-action="open-version" data-vid="${esc(v.vid)}" data-to="score">Check</button></div>
          </section>
        </div>`;
    }
    function goalLine(d) {
      const days = Math.ceil((new Date(d + 'T00:00') - new Date(today() + 'T00:00')) / 864e5);
      if (isNaN(days)) return '';
      if (days > 1) return `${days} days to go. Small steps each week add up.`;
      if (days === 1) return 'Tomorrow. One more push.';
      if (days === 0) return 'Today is the day you hoped to start.';
      return 'That date has passed. Change it if the plan has moved.';
    }

    // ---------- resumes ----------
    function resumes() {
      return `
        <header class="pg-head"><div><h1>Resumes</h1><p class="pg-sub">All of them draw on one master CV. Each keeps its own title, ticked items, design and cover letter.</p></div>
          <div class="pg-actions"><button class="btn btn-primary" data-action="new-version">+ New CV</button><button class="btn" data-tab="import">Import a CV</button></div></header>
        ${ctx.versionCards()}`;
    }

    // ---------- find jobs ----------
    const F = { what: null, where: null, country: 'ie', sort: 'match', status: 'idle', jobs: [], sel: '', err: '', sources: [], paste: { open: false, role: '', company: '', text: '', sel: false } };
    const isFindTab = () => ctx.tab() === 'find';
    function findDefaults() {
      const pf = ctx.store().prefs || {};
      if (F.what == null) F.what = (pf.roles || '').split(/[,;\n]/)[0].trim();
      if (F.where == null) F.where = (pf.locations || '').split(/[,;\n]/)[0].trim();
    }
    function scoreJob(j) {
      if (j._m !== undefined) return j._m;
      const mt = UCV.match(ctx.cv(), (j.title || '') + ' ' + (j.snippet || ''), j.company);
      j._m = mt || null;
      return j._m;
    }
    function launcher() {
      const q = encodeURIComponent((F.what || '').trim()), l = encodeURIComponent((F.where || '').trim());
      const ie = F.country === 'ie';
      const links = [
        [ie ? 'Indeed Ireland' : 'Indeed UK', `https://${ie ? 'ie' : 'uk'}.indeed.com/jobs?q=${q}&l=${l}`],
        ['LinkedIn', `https://www.linkedin.com/jobs/search/?keywords=${q}&location=${l}`],
        ['Careerjet', `https://www.careerjet.${ie ? 'ie' : 'co.uk'}/search/jobs?s=${q}&l=${l}`],
        ['Jooble', `https://${ie ? 'ie' : 'uk'}.jooble.org/SearchResult?ukw=${q}&rgns=${l}`],
        ['Google jobs', `https://www.google.com/search?q=${encodeURIComponent(((F.what || '') + ' jobs ' + (F.where || '')).trim())}&ibp=htl;jobs`]
      ].concat(ie ? [['Jobs Ireland', 'https://jobsireland.ie/'], ['Public jobs', 'https://www.publicjobs.ie/']] : []);
      return `<section class="pg-card" aria-labelledby="lnT"><div class="pg-card-top"><h2 id="lnT">Search other job boards</h2><span>Opens in a new tab</span></div>
        <p class="pg-sub" style="margin:0 0 12px">Found a good one? Paste it below to see how it fits your CV, then save it to your tracker.</p>
        <div class="pg-chips">${links.map(([n, u]) => `<a class="pg-chip" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(n)} ↗</a>`).join('')}</div></section>`;
    }
    function pastePanel() {
      const P = F.paste;
      return `<section class="pg-card" aria-labelledby="psT">
        <div class="pg-card-top"><h2 id="psT">Paste a job advert</h2><button class="btn btn-sm btn-ghost" data-action="pg-paste-toggle" aria-expanded="${P.open}">${P.open ? 'Hide' : 'Open'}</button></div>
        ${P.open ? `<div class="stack">
          <div class="grid-2"><label class="field">Job title<input type="text" data-pg="paste-role" value="${esc(P.role)}" placeholder="e.g. Medical Secretary"></label><label class="field">Company<input type="text" data-pg="paste-company" value="${esc(P.company)}" placeholder="e.g. Southeast Clinic"></label></div>
          <label class="field">The advert text<textarea rows="6" data-pg="paste-text" placeholder="Paste the whole advert here. It is read in your browser.">${esc(P.text)}</textarea></label>
          <div class="row"><button class="btn btn-primary" data-action="pg-paste-check">See how it fits my CV</button></div>
        </div>` : '<p class="pg-sub" style="margin:0">Works for any advert from anywhere. Nothing is sent anywhere.</p>'}
      </section>`;
    }
    function jobList() {
      const arr = F.jobs.map(j => ({ j, m: scoreJob(j) }));
      if (F.sort === 'match') arr.sort((a, b) => ((b.m ? b.m.score : -1) - (a.m ? a.m.score : -1)));
      else arr.sort((a, b) => String(b.j.date || '').localeCompare(String(a.j.date || '')));
      return arr.map(({ j, m }) => {
        const tone = m ? (m.score >= 60 ? 'good' : m.score >= 35 ? 'mid' : 'low') : 'none';
        return `<button class="pg-job${j.id === F.sel ? ' is-on' : ''}" data-action="pg-job" data-jid="${esc(j.id)}" aria-pressed="${j.id === F.sel}">
          <span class="pg-job-h"><b>${esc(j.title)}</b><span class="pg-match m-${tone}">${m ? m.score + '% fit' : 'No score'}</span></span>
          <span class="pg-job-s">${esc(j.company || 'Company not shown')}${j.location ? ' · ' + esc(j.location) : ''}</span>
          <span class="pg-job-x">${esc(cap(j.snippet, 140))}${(j.snippet || '').length > 140 ? '…' : ''}</span>
          <span class="pg-job-f">${j.date ? esc(dateFmt(j.date)) + ' · ' : ''}via ${esc(j.source || 'job board')}</span></button>`;
      }).join('');
    }
    function jobDetail() {
      const j = F.jobs.find(x => x.id === F.sel) || (F.paste.sel && F.paste.job);
      if (!j) return '<div class="pg-card pg-detail-empty"><p class="pg-sub" style="margin:0">Pick a job on the left to see how it fits your CV.</p></div>';
      const m = scoreJob(j), saved = !!ctx.store().applications.find(a => a.url && a.url === j.url);
      const chips = (arr, cls) => arr.length ? `<div class="pg-kw">${arr.slice(0, 14).map(k => `<span class="${cls}">${esc(k)}</span>`).join('')}</div>` : '';
      return `<article class="pg-card pg-detail">
        <h2>${esc(j.title)}</h2>
        <p class="pg-sub" style="margin:0 0 12px">${esc(j.company || 'Company not shown')}${j.location ? ' · ' + esc(j.location) : ''}${j.salary ? ' · ' + esc(j.salary) : ''}</p>
        ${m ? `<div class="pg-fit"><div class="ring" style="--v:${m.score};--c:${ctx.ringColor(m.score)}"><span>${m.score}</span></div><p>${m.score >= 60 ? 'Strong fit on the words in the advert.' : m.score >= 35 ? 'A fair fit. A few words are missing.' : 'Not many of its words are on your CV yet.'}</p></div>
          ${m.found.length ? `<h3>You already have</h3>${chips(m.found, 'kw-have')}` : ''}
          ${m.missing.length ? `<h3>Worth adding, if true</h3>${chips(m.missing, 'kw-miss')}` : ''}` : '<p class="pg-sub">Too little text to score. Open the advert for the full picture.</p>'}
        ${j.snippet ? `<h3>From the advert</h3><p class="pg-snip">${esc(j.snippet)}</p>` : ''}
        ${F.paste.sel ? '' : '<p class="hint">This score uses the short excerpt the job board gives us. Paste the full advert for a better read.</p>'}
        <div class="pg-btns">
          <button class="btn" data-action="pg-job-save"${saved ? ' disabled' : ''}>${saved ? 'In your tracker' : 'Save to tracker'}</button>
          ${j.url ? `<a class="btn${F.paste.sel ? '' : ' btn-primary'}" href="${esc(ctx.safeUrl(j.url))}" target="_blank" rel="noopener sponsored">${F.paste.sel ? 'Open the advert' : 'Apply on ' + esc(j.source || 'the job site')} ↗</a>` : ''}
          <button class="btn" data-action="pg-job-tailor">Tailor a copy of my CV</button>
        </div></article>`;
    }
    function find() {
      findDefaults();
      const st = F.status;
      let results = '';
      if (st === 'loading') results = '<div class="pg-card"><p class="pg-sub" style="margin:0">Searching…</p></div>';
      else if (st === 'error') results = `<div class="pg-card"><p style="margin:0"><b>${esc(F.err || 'The search did not work.')}</b></p><p class="pg-sub" style="margin:6px 0 0">Try again, or use the job boards below.</p></div>`;
      else if (st === 'off') results = `<div class="pg-card"><p style="margin:0"><b>Live search is not available yet.</b></p><p class="pg-sub" style="margin:6px 0 0">You can still search the big job boards from here, then paste any advert to see how it fits your CV.</p></div>`;
      else if (st === 'done' && !F.jobs.length) results = '<div class="pg-card"><p style="margin:0"><b>No jobs found.</b></p><p class="pg-sub" style="margin:6px 0 0">Try a simpler title, or widen the place. You can also search the boards below.</p></div>';
      else if (st === 'done') results = `<div class="pg-split"><section aria-label="Results">
          <div class="pg-resbar"><span><b>${F.jobs.length}</b> jobs · sorted by ${F.sort === 'match' ? 'best fit to your CV' : 'newest'}</span><span class="seg"><button data-action="pg-sort" data-s="match" aria-pressed="${F.sort === 'match'}">Best fit</button><button data-action="pg-sort" data-s="date" aria-pressed="${F.sort === 'date'}">Newest</button></span></div>
          <div class="pg-jobs">${jobList()}</div>
          <p class="hint">Results come from ${esc(F.sources.join(' and ') || 'job boards')}. We pass on only what you typed and your IP address, never your CV.</p>
          <p class="hint">Apply links go through the job site. We may earn a small fee when you apply through them. It costs you nothing and does not change which jobs we show.</p></section>
          <section aria-label="Job details">${jobDetail()}</section></div>`;
      if (F.paste.sel && st !== 'done') results += `<div class="pg-split pg-one">${jobDetail()}</div>`;
      return `
        <header class="pg-head"><div><h1>Find jobs</h1><p class="pg-sub">Search, see how well each job fits your CV, and save the good ones.</p></div></header>
        ${SEARCH_MODE === 'widget' ? `<section class="pg-card pg-cj" aria-label="Job search"><div id="cjSlot"></div>
          <p class="hint" style="margin-top:12px">This search is run by Careerjet. What you type goes to Careerjet, not to us, and they never see your CV. We may earn a small fee when you apply through them. It costs you nothing.</p>
          <p class="hint">Found one you like? Paste the advert below to see how it fits your CV, then save it to your tracker.</p></section>` : `<form class="pg-search" id="pgFindForm" role="search">
          <label class="pg-sf"><span>Job title or skill</span><input type="text" name="what" data-pg="find-what" value="${esc(F.what)}" placeholder="e.g. medical secretary" maxlength="80" autocomplete="off"></label>
          <label class="pg-sf"><span>Place</span><input type="text" name="where" data-pg="find-where" value="${esc(F.where)}" placeholder="e.g. Waterford" maxlength="80" autocomplete="off"></label>
          <label class="pg-sf pg-sf-s"><span>Country</span><select name="country" data-pg="find-country"><option value="ie"${F.country === 'ie' ? ' selected' : ''}>Ireland</option><option value="gb"${F.country === 'gb' ? ' selected' : ''}>UK</option></select></label>
          <button class="btn btn-primary" type="submit">Search</button>
        </form>
        <p class="hint pg-priv">Searches go through our server to the job sites, so they see what you typed and your IP address. They never see your CV.</p>`}
        ${results}
        <div class="pg-cols">${pastePanel()}${launcher()}</div>`;
    }
    async function runSearch() {
      const what = (F.what || '').trim(), where = (F.where || '').trim();
      if (!what && !where) { ctx.toast('Type a job title or a place first.', true); return; }
      F.status = 'loading'; F.err = ''; F.paste.sel = false; ctx.rerender();
      try {
        const u = new URL(JOBS_API + '/search');
        u.searchParams.set('what', what); u.searchParams.set('where', where); u.searchParams.set('country', F.country);
        const r = await fetch(u, { credentials: 'omit', referrerPolicy: 'no-referrer' });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) { F.status = (d && d.setup) ? 'off' : 'error'; F.err = (d && d.error) || ''; }
        else {
          F.jobs = (d.jobs || []).filter(j => j && j.title).map((j, i) => ({ id: String(j.id || 'j' + i), title: cap(j.title, 140), company: cap(j.company, 100), location: cap(j.location, 100), snippet: cap(j.snippet, 1200), salary: cap(j.salary, 80), date: cap(j.date, 40), url: ctx.safeUrl(j.url), source: cap(j.source, 30) }));
          F.sources = d.sources || []; F.status = 'done'; F.sel = F.jobs[0] ? F.jobs[0].id : '';
        }
      } catch (_) { F.status = 'off'; }
      if (isFindTab()) ctx.rerender();
    }
    function currentJob() { return F.jobs.find(x => x.id === F.sel) || (F.paste.sel && F.paste.job) || null; }
    function saveJob(j) {
      const s = ctx.store();
      if (j.url && s.applications.some(a => a.url === j.url)) { ctx.toast('Already in your tracker.'); return; }
      s.applications.push({ aid: ctx.uid('a'), company: j.company || 'Company', role: j.title, vid: s.active, status: 'Saved', date: today(), url: j.url || '', notes: '', location: j.location || '', salary: j.salary || '', jd: cap(j.snippet, 20000) });
      ctx.persist(); ctx.rerender(); ctx.toast('Saved to your tracker.');
    }
    function tailor(j) {
      const s = ctx.store(), src = s.versions.find(x => x.vid === s.active) || s.versions[0];
      const nv = UCV.clone(src); nv.vid = ctx.uid('v'); nv.updatedAt = new Date().toISOString();
      nv.name = cap((j.title + (j.company ? ' · ' + j.company : '')), 40);
      nv.target = { company: cap(j.company, 100), role: cap(j.title, 140), jd: cap(j.snippet, 20000) };
      nv.letter = { recipient: '', body: '' };
      s.versions.push(nv); s.active = nv.vid; ctx.persist();
      ctx.go('match');
      ctx.toast(F.paste.sel ? 'Made a copy of your CV for this job.' : 'Made a copy of your CV. Paste the full advert here for a better read.');
    }

    // ---------- cover letters ----------
    const C = { lid: '', adding: false };
    function letters() { return arrIn(ctx.store(), 'coverLetters'); }
    function curLetter() { const ls = letters(); return ls.find(l => l.lid === C.lid) || ls[0] || null; }
    function defOpening(role, company) {
      const w = (ctx.cv().work || [])[0];
      const who = w && w.position ? ` I currently work as ${/^[aeiou]/i.test(w.position) ? 'an' : 'a'} ${w.position}${w.company ? ' at ' + w.company : ''}, and I would like to bring that experience to your team.` : '';
      return `I am applying for the ${role || 'advertised'} role${company ? ' at ' + company : ''}.${who}`;
    }
    const DEF_CLOSE = 'I would welcome the chance to talk through how I could help. Thank you for your time and consideration.';
    function newLetter(app) {
      const s = ctx.store();
      const L = { lid: ctx.uid('l'), aid: app ? app.aid : '', role: app ? app.role : '', company: app ? app.company : '', to: 'Hiring team', opening: '', ev: [], closing: DEF_CLOSE, auto: true };
      L.opening = defOpening(L.role, L.company);
      const picks = evidence(L).slice(0, 2); L.ev = picks;
      letters().push(L); C.lid = L.lid; C.adding = false; ctx.persist();
      return L;
    }
    function evidence(L) {
      const cv = ctx.cv(), app = ctx.store().applications.find(a => a.aid === L.aid);
      const jd = new Set(words((app && app.jd) || '').concat(words(L.role)).filter(w => !STOP.has(w)));
      const all = [];
      (cv.work || []).forEach(w => (w.highlights || []).forEach(h => { h = UCV.plain(h).trim(); if (h.length > 12) all.push(h); }));
      const ranked = all.map((t, i) => ({ t, i, n: words(t).filter(w => jd.has(w)).length })).sort((a, b) => (b.n - a.n) || (a.i - b.i)).map(x => x.t);
      const list = ranked.slice(0, 6);
      (L.ev || []).forEach(t => { if (!list.includes(t)) list.push(t); });
      return list;
    }
    function letterBody(L) {
      const s = ctx.store(), b = s.master.basics, name = b.name || 'Your name';
      const contact = [b.location, b.phone, b.email].filter(Boolean).join(' · ');
      const to = (L.to || 'Hiring team').trim();
      const ev = (L.ev || []).filter(Boolean);
      return { name, contact, to, company: L.company, opening: L.opening, ev, closing: L.closing };
    }
    function letterPlain(L) {
      const b = letterBody(L);
      return [b.name, b.contact, '', b.to, b.company, '', `Dear ${b.to},`, '', b.opening, ...(b.ev.length ? ['', 'A few examples of my work:', ...b.ev.map(t => '• ' + t)] : []), '', b.closing, '', 'Yours sincerely,', b.name].filter((x, i, a) => !(x === '' && a[i - 1] === '' )).join('\n').replace(/\n{3,}/g, '\n\n');
    }
    function cover() {
      const s = ctx.store(), ls = letters(), L = curLetter(), apps = s.applications;
      const chip = l => `<button class="pg-tab${L && l.lid === L.lid && !C.adding ? ' is-on' : ''}" data-action="pg-letter" data-lid="${esc(l.lid)}">${esc(cap((l.role || 'Letter') + (l.company ? ', ' + l.company : ''), 38))}</button>`;
      const picker = `<section class="pg-card" aria-labelledby="ncT"><div class="pg-card-top"><h2 id="ncT">Write a letter for…</h2>${ls.length ? '<button class="btn btn-sm btn-ghost" data-action="pg-letter-cancel">Cancel</button>' : ''}</div>
        ${apps.length ? `<div class="pg-list">${apps.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 8).map(a => `<button class="pg-row" data-action="pg-letter-new" data-aid="${esc(a.aid)}"><span class="pg-dot"></span><span><b>${esc(a.role)}</b><i>${esc(a.company)} · ${esc(a.status)}</i></span><em>Write</em></button>`).join('')}</div>` : '<p class="pg-sub" style="margin:0 0 12px">Your job tracker is empty, so there is no job to pick from yet.</p>'}
        <div class="row" style="margin-top:12px"><button class="btn" data-action="pg-letter-new" data-aid="">Letter for a job not in my tracker</button></div></section>`;
      if (!ls.length || C.adding) return `<header class="pg-head"><div><h1>Cover letters</h1><p class="pg-sub">Three short parts: why you are writing, your best evidence, and a clear next step. You write it, we lay it out.</p></div></header>${picker}`;
      const cands = evidence(L);
      const b = letterBody(L);
      return `
        <header class="pg-head"><div><p class="pg-date">Cover letters</p><h1>${esc((L.role || 'Cover letter') + (L.company ? ', ' + L.company : ''))}</h1></div>
          <div class="pg-actions"><button class="btn" data-action="pg-letter-copy">Copy text</button><button class="btn btn-primary" data-action="pg-letter-pdf">Download PDF</button></div></header>
        <div class="pg-tabs">${ls.map(chip).join('')}<button class="pg-tab pg-tab-add" data-action="pg-letter-add">+ New letter</button></div>
        <div class="pg-cols pg-letter">
          <section class="pg-card" aria-label="Write your letter">
            <div class="stack">
              <label class="field">For which job?<select data-pg="cv-job">${`<option value="">Not in my tracker</option>` + apps.map(a => `<option value="${esc(a.aid)}"${a.aid === L.aid ? ' selected' : ''}>${esc(a.role)} · ${esc(a.company)}</option>`).join('')}</select></label>
              <div class="grid-2"><label class="field">Role<input type="text" data-pg="cv-role" value="${esc(L.role)}"></label><label class="field">Company<input type="text" data-pg="cv-company" value="${esc(L.company)}"></label></div>
              <label class="field">Who is it for?<input type="text" data-pg="cv-to" value="${esc(L.to)}" placeholder="e.g. Ms Collins, or Hiring team"></label>
              <label class="field"><b>1. Say why you are writing</b><textarea rows="4" data-pg="cv-opening">${esc(L.opening)}</textarea></label>
              <div class="field"><b>2. Show your best evidence</b>
                ${cands.length ? `<div class="pg-ev">${cands.map((t, i) => `<label class="pg-evrow"><input type="checkbox" data-pg="cv-ev" data-i="${i}"${(L.ev || []).includes(t) ? ' checked' : ''}><span>${esc(t)}</span></label>`).join('')}</div><span class="hint">Picked from your CV, best match to the job first. You choose what to keep.</span>` : '<span class="hint">Add work bullets to your CV and they will show up here.</span>'}
              </div>
              <label class="field"><b>3. Close with a clear next step</b><textarea rows="3" data-pg="cv-closing">${esc(L.closing)}</textarea></label>
              <div class="row"><button class="btn btn-sm" data-action="pg-letter-reset">Reset to suggestions</button><span class="spacer"></span><button class="btn btn-sm btn-danger" data-action="pg-letter-del">Delete letter</button></div>
            </div>
          </section>
          <section class="pg-card pg-paper-wrap" aria-label="Letter preview"><div class="pg-paper" id="pgLetterPaper">${letterPaper(b)}</div></section>
        </div>`;
    }
    function letterPaper(b) {
      return `<div class="lp-name">${esc(b.name)}</div><div class="lp-contact">${esc(b.contact)}</div>
        <div class="lp-to">${esc(b.to)}${b.company ? '<br>' + esc(b.company) : ''}</div>
        <p>Dear ${esc(b.to)},</p><p>${esc(b.opening).replace(/\n/g, '<br>')}</p>
        ${b.ev.length ? `<p>A few examples of my work:</p><ul>${b.ev.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
        <p>${esc(b.closing).replace(/\n/g, '<br>')}</p><p>Yours sincerely,<br>${esc(b.name)}</p>`;
    }
    function refreshPaper() { const el = document.getElementById('pgLetterPaper'); const L = curLetter(); if (el && L) el.innerHTML = letterPaper(letterBody(L)); }
    function letterPdf(L) {
      if (!window.jspdf) { ctx.toast('The PDF tool did not load. Check your connection and reload.', true); return; }
      const b = letterBody(L), { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const safe = t => String(t || '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/•/g, '-').replace(/[^\x09\x0a\x20-\x7e -ÿ]/g, '');
      const W = 210, M = 22, TW = W - 2 * M; let y = 26;
      const put = (t, size, bold, gap) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); safe(t).split('\n').forEach(par => { doc.splitTextToSize(par || ' ', TW).forEach(line => { if (y > 280) { doc.addPage(); y = 24; } doc.text(line, M, y); y += size * 0.45; }); }); y += gap; };
      put(b.name, 16, true, 1); if (b.contact) put(b.contact, 10, false, 8);
      put(b.to + (b.company ? '\n' + b.company : ''), 11, false, 6);
      put(`Dear ${b.to},`, 11, false, 4); put(b.opening, 11, false, 5);
      if (b.ev.length) { put('A few examples of my work:', 11, false, 2); b.ev.forEach(t => put('- ' + t, 11, false, 1.5)); y += 3; }
      put(b.closing, 11, false, 5); put('Yours sincerely,\n' + b.name, 11, false, 0);
      doc.save(UCV.fileStem(ctx.store(), ctx.res()).replace(/[^\w.-]+/g, '-') + '-cover-letter.pdf');
      ctx.toast('PDF ready');
    }

    // ---------- contacts ----------
    const K = { cid: '', filter: 'all', adding: false, draft: '' };
    const TYPES = ['Recruiter', 'Hiring manager', 'Former colleague', 'Friend or family', 'Other'];
    const contacts = () => arrIn(ctx.store(), 'contacts');
    function contactsPage() {
      const s = ctx.store(), cs = contacts(), td = today();
      const soon = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
      const f = { all: () => true, soon: c => c.followUp && c.followUp <= soon, rec: c => c.type === 'Recruiter', mgr: c => c.type === 'Hiring manager' }[K.filter] || (() => true);
      const list = cs.filter(f).sort((a, b) => (a.followUp || '9999').localeCompare(b.followUp || '9999') || a.name.localeCompare(b.name));
      const cur = cs.find(c => c.cid === K.cid) || list[0] || null;
      const chipB = (id, label, n) => `<button class="pg-fchip" data-action="pg-cfilter" data-f="${id}" aria-pressed="${K.filter === id}">${label}${n != null ? ' ' + n : ''}</button>`;
      const initials = n => (n.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('') || '?').toUpperCase();
      const row = c => {
        const due = c.followUp && c.followUp <= soon;
        return `<button class="pg-contact${cur && c.cid === cur.cid ? ' is-on' : ''}${due ? ' is-due' : ''}" data-action="pg-contact-open" data-cid="${esc(c.cid)}"><span class="pg-av">${esc(initials(c.name))}</span><span class="pg-contact-t"><b>${esc(c.name)}</b><i>${esc([c.type, c.org].filter(Boolean).join(' · ') || 'No details yet')}</i></span>${c.followUp ? `<em class="${c.followUp <= td ? 'late' : ''}">${c.followUp <= td ? 'Follow up now' : 'Follow up ' + esc(dateFmt(c.followUp))}</em>` : `<small>${c.lastSpoke ? 'Last spoke ' + esc(dateFmt(c.lastSpoke)) : 'No contact yet'}</small>`}</button>`;
      };
      const addForm = `<section class="pg-card" aria-labelledby="acT"><div class="pg-card-top"><h2 id="acT">Add a contact</h2><button class="btn btn-sm btn-ghost" data-action="pg-contact-add">Cancel</button></div>
        <form id="pgContactForm" class="stack">
          <div class="grid-2"><label class="field">Name<input type="text" name="name" required maxlength="80"></label><label class="field">Who are they?<select name="type">${TYPES.map(t => `<option>${t}</option>`).join('')}</select></label></div>
          <div class="grid-2"><label class="field">Job title<input type="text" name="role" maxlength="80"></label><label class="field">Organisation<input type="text" name="org" maxlength="80"></label></div>
          <div class="row"><button class="btn btn-primary" type="submit">Add contact</button></div></form></section>`;
      return `
        <header class="pg-head"><div><h1>Contacts</h1><p class="pg-sub">The people who can help you get hired, and when to get back to them.</p></div>
          <div class="pg-actions"><button class="btn btn-primary" data-action="pg-contact-add">${K.adding ? 'Close' : '+ Add a contact'}</button></div></header>
        ${K.adding ? addForm : ''}
        ${!cs.length && !K.adding ? '<section class="pg-card pg-empty"><h2>No contacts yet</h2><p class="pg-sub">Add the recruiter who called, the manager who interviewed you, or the friend who offered to put in a word. Set a date and we will remind you on your dashboard.</p><button class="btn btn-primary" data-action="pg-contact-add">+ Add a contact</button></section>' : cs.length ? `
        <div class="pg-split">
          <section class="pg-card pg-flush" aria-label="People">
            <div class="pg-fchips">${chipB('all', 'All', cs.length)}${chipB('soon', 'Follow up this week', cs.filter(c => c.followUp && c.followUp <= soon).length)}${chipB('rec', 'Recruiters')}${chipB('mgr', 'Hiring managers')}</div>
            ${list.length ? list.map(row).join('') : '<p class="empty" style="padding:16px">Nobody matches this filter.</p>'}
          </section>
          <section aria-label="Contact details">${cur ? contactDetail(cur) : ''}</section>
        </div>` : ''}`;
    }
    function contactDetail(c) {
      const s = ctx.store();
      const jobs = s.applications.map(a => `<option value="${esc(a.aid)}"${a.aid === c.aid ? ' selected' : ''}>${esc(a.role)} · ${esc(a.company)}</option>`).join('');
      return `<article class="pg-card pg-detail">
        <div class="pg-who"><span class="pg-av big">${esc((c.name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('') || '?').toUpperCase())}</span>
          <div><h2>${esc(c.name)}</h2><p class="pg-sub" style="margin:0">${esc([c.role, c.org].filter(Boolean).join(' · ') || c.type || '')}</p></div></div>
        <div class="stack">
          <div class="grid-2"><label class="field">Name<input type="text" data-pg="ct-name" data-cid="${esc(c.cid)}" value="${esc(c.name)}"></label>
            <label class="field">Who are they?<select data-pg="ct-type" data-cid="${esc(c.cid)}">${TYPES.map(t => `<option${t === c.type ? ' selected' : ''}>${t}</option>`).join('')}</select></label></div>
          <div class="grid-2"><label class="field">Job title<input type="text" data-pg="ct-role" data-cid="${esc(c.cid)}" value="${esc(c.role || '')}"></label><label class="field">Organisation<input type="text" data-pg="ct-org" data-cid="${esc(c.cid)}" value="${esc(c.org || '')}"></label></div>
          <div class="grid-2"><label class="field">Email or phone<input type="text" data-pg="ct-how" data-cid="${esc(c.cid)}" value="${esc(c.how || '')}"></label><label class="field">Next follow-up<input type="date" data-pg="ct-followUp" data-cid="${esc(c.cid)}" value="${esc(c.followUp || '')}"></label></div>
          <label class="field">Linked job<select data-pg="ct-aid" data-cid="${esc(c.cid)}"><option value="">None</option>${jobs}</select></label>
          <label class="field">Notes<textarea rows="3" data-pg="ct-notes" data-cid="${esc(c.cid)}" placeholder="What you talked about, what they prefer, what to say next">${esc(c.notes || '')}</textarea></label>
          <div class="pg-btns"><button class="btn btn-primary" data-action="pg-follow" data-cid="${esc(c.cid)}">Write a follow-up</button><button class="btn" data-action="pg-contacted" data-cid="${esc(c.cid)}">Mark as contacted</button><span class="spacer"></span><button class="btn btn-sm btn-danger" data-action="pg-contact-del" data-cid="${esc(c.cid)}">Delete</button></div>
          ${K.draft && K.draftFor === c.cid ? `<label class="field">Your note<textarea rows="8" id="pgDraft">${esc(K.draft)}</textarea></label><div class="row"><button class="btn btn-sm" data-action="pg-copy-draft">Copy text</button></div>` : ''}
        </div></article>`;
    }
    function followUpDraft(c) {
      const s = ctx.store(), app = s.applications.find(a => a.aid === c.aid), first = (c.name || '').trim().split(/\s+/)[0] || 'there';
      const job = app ? `the ${app.role} role${app.company ? ' at ' + app.company : ''}` : 'the opportunity';
      return `Hi ${first},\n\nThank you for taking the time to speak with me. I am still very interested in ${job} and would be glad to answer any questions or send anything else you need.\n\nDo you have an update on timing?\n\nKind regards,\n${s.master.basics.name || ''}`.trim();
    }

    // ---------- interviews ----------
    const I = { iid: '', adding: false, q: 0, thanks: '' };
    const interviews = () => arrIn(ctx.store(), 'interviews');
    function upcoming(s) {
      const now = new Date().toISOString().slice(0, 16);
      return arrIn(s, 'interviews').filter(i => i.when && i.when >= now.slice(0, 10)).sort((a, b) => a.when.localeCompare(b.when));
    }
    function interviewsPage() {
      const s = ctx.store(), all = interviews().slice().sort((a, b) => (a.when || '').localeCompare(b.when || ''));
      const up = upcoming(s);
      const cur = all.find(i => i.iid === I.iid) || up[0] || all[all.length - 1] || null;
      const apps = s.applications;
      const addForm = `<section class="pg-card" aria-labelledby="aiT"><div class="pg-card-top"><h2 id="aiT">Add an interview</h2><button class="btn btn-sm btn-ghost" data-action="pg-iv-add">Cancel</button></div>
        <form id="pgIvForm" class="stack">
          <label class="field">For which job?<select name="aid"><option value="">Not in my tracker</option>${apps.map(a => `<option value="${esc(a.aid)}"${a.status === 'Interview' ? ' selected' : ''}>${esc(a.role)} · ${esc(a.company)}</option>`).join('')}</select></label>
          <div class="grid-2"><label class="field">Role<input type="text" name="role" maxlength="140"></label><label class="field">Company<input type="text" name="company" maxlength="100"></label></div>
          <div class="grid-3"><label class="field">Date and time<input type="datetime-local" name="when" required></label><label class="field">How<select name="kind"><option>In person</option><option>Phone</option><option>Video</option></select></label><label class="field">Place or link<input type="text" name="place" maxlength="120"></label></div>
          <div class="row"><button class="btn btn-primary" type="submit">Add interview</button></div></form></section>`;
      if (!all.length || I.adding) return `<header class="pg-head"><div><h1>Interviews</h1><p class="pg-sub">Be ready before the day.</p></div>${all.length ? '' : ''}</header>${I.adding ? addForm : '<section class="pg-card pg-empty"><h2>No interviews yet</h2><p class="pg-sub">When you get one, add it here. You get a checklist for the days before, and a place to practise your answers.</p><button class="btn btn-primary" data-action="pg-iv-add">+ Add an interview</button></section>'}${practice(null)}`;
      const days = cur.when ? Math.ceil((new Date(cur.when.slice(0, 10) + 'T00:00') - new Date(today() + 'T00:00')) / 864e5) : null;
      const isNext = up.length && up[0].iid === cur.iid;
      const done = cur.done || {}, nDone = PREP.filter((_, i) => done[i]).length;
      const past = days != null && days < 0;
      return `
        <header class="pg-head"><div><h1>Interviews</h1><p class="pg-sub">Be ready before the day.</p></div><div class="pg-actions"><button class="btn btn-primary" data-action="pg-iv-add">+ Add an interview</button></div></header>
        ${all.length > 1 ? `<div class="pg-tabs">${all.map(i => `<button class="pg-tab${i.iid === cur.iid ? ' is-on' : ''}" data-action="pg-iv-open" data-iid="${esc(i.iid)}">${esc(cap((i.role || 'Interview') + (i.company ? ', ' + i.company : ''), 34))}</button>`).join('')}</div>` : ''}
        <section class="pg-hero" aria-label="${isNext ? 'Next interview' : 'Interview'}">
          <div><span class="pg-pill">${isNext ? 'Next interview' : past ? 'Past interview' : 'Interview'}</span>
            <h2>${esc((cur.role || 'Interview') + (cur.company ? ', ' + cur.company : ''))}</h2>
            <p>${cur.when ? esc(new Date(cur.when).toLocaleString(undefined, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })) : ''}${cur.kind ? ' · ' + esc(cur.kind) : ''}${cur.place ? ' · ' + esc(cur.place) : ''}</p></div>
          ${days != null && !past ? `<div class="pg-count"><b>${days}</b><span>${days === 1 ? 'day to go' : days === 0 ? 'today' : 'days to go'}</span></div>` : ''}
          <button class="btn btn-sm pg-hero-del" data-action="pg-iv-del" data-iid="${esc(cur.iid)}">Delete</button>
        </section>
        <div class="pg-cols">
          <section class="pg-card" aria-labelledby="grT">
            <div class="pg-card-top"><h2 id="grT">Get ready</h2><span>${nDone} of ${PREP.length} done</span></div>
            ${PREP.map((t, i) => `<label class="pg-check ${done[i] ? 'done' : ''}"><input type="checkbox" data-pg="iv-prep" data-iid="${esc(cur.iid)}" data-i="${i}"${done[i] ? ' checked' : ''}><span class="pg-tick" aria-hidden="true">${done[i] ? '✓' : ''}</span><span class="pg-check-t">${esc(t)}</span></label>`).join('')}
            ${past ? `<div class="pg-thanks"><button class="btn btn-primary" data-action="pg-thanks" data-iid="${esc(cur.iid)}">Write a thank-you note</button></div>${I.thanks ? `<label class="field" style="margin-top:12px">Your note<textarea rows="7" id="pgThanks">${esc(I.thanks)}</textarea></label><div class="row" style="margin-top:8px"><button class="btn btn-sm" data-action="pg-copy-thanks">Copy text</button></div>` : ''}` : '<p class="hint" style="margin-top:12px">After the interview we will offer you a thank-you note to send.</p>'}
          </section>
          ${practice(cur)}
        </div>`;
    }
    function practice(cur) {
      const s = ctx.store(), bank = (s.answers = s.answers && typeof s.answers === 'object' ? s.answers : {});
      const q = QUESTIONS[I.q % QUESTIONS.length], a = bank[q] || {};
      const fld = (label, key, ph) => `<label class="field"><b>${label}</b><textarea rows="2" data-pg="ans" data-k="${key}" placeholder="${ph}">${esc(a[key] || '')}</textarea></label>`;
      return `<section class="pg-card" aria-labelledby="prT">
        <div class="pg-card-top"><h2 id="prT">Practise an answer</h2><span>Question ${I.q % QUESTIONS.length + 1} of ${QUESTIONS.length}</span></div>
        <p class="pg-q">${esc(q)}</p>
        <div class="stack">${fld('Situation', 's', 'Where were you, and what was happening?')}${fld('What you did', 'a', 'What did you do, step by step?')}${fld('Result', 'r', 'What changed afterwards? Numbers help.')}</div>
        <div class="pg-btns" style="margin-top:16px"><button class="btn" data-action="pg-q-prev">← Previous</button><button class="btn" data-action="pg-q-next">Next question →</button></div>
        <p class="hint" style="margin-top:8px">Saved as you type, in this browser. Your answers are reused for any interview.</p></section>`;
    }

    // ---------- resources ----------
    function resources() {
      const card = (href, kicker, title, body) => `<a class="pg-res" href="${href}"><span class="pg-kick">${kicker}</span><b>${title}</b><span>${body}</span></a>`;
      return `
        <header class="pg-head"><div><h1>Resources</h1><p class="pg-sub">Short guides for job seekers in Ireland and the UK.</p></div></header>
        <h2 class="pg-h2">Write a better CV</h2>
        <div class="pg-grid">
          ${card('blog/cv-ireland.html', 'GUIDE', 'How to write a CV for Irish employers', 'Length, what to leave out, Irish spelling and what to put first.')}
          ${card('blog/not-getting-interviews.html', 'GUIDE', 'Not getting interviews? 7 things wrong with most CVs', 'The problems recruiters point out most often, with a fix for each.')}
          ${card('blog/cv-words-to-avoid.html', 'GUIDE', '15 CV words to avoid, and what to write instead', 'Why buzzwords do not work and what reads better.')}
        </div>
        <h2 class="pg-h2">Tools and answers</h2>
        <div class="pg-grid">
          ${card('cv-checker.html', 'TOOL', 'CV checker', 'Mark what a recruiter would notice on a CV, with a fix for each one.')}
          ${card('faq.html', 'FAQ', 'Questions people ask', 'What we check, how your data is handled and what employers ask first.')}
          ${card('blog/beta-builder.html', 'NOTES', 'What works today in the beta', 'Everything you can use right now, and the rough edges.')}
        </div>`;
    }

    // ---------- events ----------
    function click(btn, a) {
      const s = ctx.store();
      switch (a) {
        case 'pg-sort': F.sort = btn.dataset.s; ctx.rerender(); break;
        case 'pg-job': F.sel = btn.dataset.jid; F.paste.sel = false; ctx.rerender(); { const d = document.querySelector('.pg-detail'); if (d && matchMedia('(max-width: 900px)').matches) d.scrollIntoView({ block: 'start', behavior: 'smooth' }); } break;
        case 'pg-job-save': { const j = currentJob(); if (j) saveJob(j); break; }
        case 'pg-job-tailor': { const j = currentJob(); if (j) tailor(j); break; }
        case 'pg-paste-toggle': F.paste.open = !F.paste.open; ctx.rerender(); break;
        case 'pg-paste-check': {
          const P = F.paste;
          if ((P.text || '').trim().length < 60) { ctx.toast('Paste the advert text first.', true); return; }
          P.job = { id: 'paste', title: (P.role || '').trim() || 'Pasted advert', company: (P.company || '').trim(), location: '', snippet: cap(P.text.trim(), 20000), salary: '', date: '', url: '', source: 'your paste' };
          P.sel = true; F.sel = ''; ctx.rerender(); { const d = document.querySelector('.pg-detail'); if (d) d.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
          break;
        }
        case 'pg-letter': C.lid = btn.dataset.lid; C.adding = false; ctx.rerender(); break;
        case 'pg-letter-add': C.adding = true; ctx.rerender(); break;
        case 'pg-letter-cancel': C.adding = false; ctx.rerender(); break;
        case 'pg-letter-new': { const app = s.applications.find(x => x.aid === btn.dataset.aid); newLetter(app || null); ctx.rerender(); break; }
        case 'pg-letter-copy': { const L = curLetter(); if (L) ctx.copy(letterPlain(L), 'Letter copied'); break; }
        case 'pg-letter-pdf': { const L = curLetter(); if (L) letterPdf(L); break; }
        case 'pg-letter-reset': { const L = curLetter(); if (!L) break; L.opening = defOpening(L.role, L.company); L.closing = DEF_CLOSE; L.ev = evidence(L).slice(0, 2); L.auto = true; ctx.persist(); ctx.rerender(); break; }
        case 'pg-letter-del': { const L = curLetter(); if (!L) break; ctx.armed(btn, 'Click again to delete', () => { s.coverLetters = s.coverLetters.filter(x => x.lid !== L.lid); C.lid = ''; ctx.persist(); ctx.rerender(); }); break; }
        case 'pg-contact-add': K.adding = !K.adding; ctx.rerender(); break;
        case 'pg-contact-open': K.cid = btn.dataset.cid; K.adding = false; K.draft = ''; if (ctx.tab() !== 'contacts') ctx.go('contacts'); else ctx.rerender(); break;
        case 'pg-cfilter': K.filter = btn.dataset.f; ctx.rerender(); break;
        case 'pg-follow': { const c = contacts().find(x => x.cid === btn.dataset.cid); if (c) { K.draft = followUpDraft(c); K.draftFor = c.cid; ctx.rerender(); const t = document.getElementById('pgDraft'); if (t) t.focus(); } break; }
        case 'pg-copy-draft': { const t = document.getElementById('pgDraft'); if (t) ctx.copy(t.value, 'Note copied'); break; }
        case 'pg-contacted': { const c = contacts().find(x => x.cid === btn.dataset.cid); if (c) { c.lastSpoke = today(); c.followUp = ''; ctx.persist(); ctx.rerender(); ctx.toast('Marked as contacted today.'); } break; }
        case 'pg-contact-del': { const c = contacts().find(x => x.cid === btn.dataset.cid); if (!c) break; ctx.armed(btn, 'Click again to delete', () => { s.contacts = s.contacts.filter(x => x.cid !== c.cid); K.cid = ''; K.draft = ''; ctx.persist(); ctx.rerender(); }); break; }
        case 'pg-iv-add': I.adding = !I.adding; ctx.rerender(); break;
        case 'pg-iv-open': I.iid = btn.dataset.iid; I.thanks = ''; ctx.rerender(); break;
        case 'pg-iv-del': { const i = interviews().find(x => x.iid === btn.dataset.iid); if (!i) break; ctx.armed(btn, 'Click again', () => { s.interviews = s.interviews.filter(x => x.iid !== i.iid); I.iid = ''; ctx.persist(); ctx.rerender(); }); break; }
        case 'pg-q-next': I.q = (I.q + 1) % QUESTIONS.length; ctx.rerender(); break;
        case 'pg-q-prev': I.q = (I.q + QUESTIONS.length - 1) % QUESTIONS.length; ctx.rerender(); break;
        case 'pg-thanks': {
          const i = interviews().find(x => x.iid === btn.dataset.iid); if (!i) break;
          const app = s.applications.find(x => x.aid === i.aid), first = (app && app.contact || '').trim().split(/\s+/)[0] || 'there';
          I.thanks = `Hi ${first},\n\nThank you for meeting me${i.when ? ' on ' + dateFmt(i.when, { weekday: 'long' }) : ''} about the ${i.role || 'role'}${i.company ? ' at ' + i.company : ''}. I enjoyed learning more about the team and I am even more interested in the job.\n\nIf there is anything else I can send you, just let me know.\n\nKind regards,\n${s.master.basics.name || ''}`.trim();
          ctx.rerender(); break;
        }
        case 'pg-copy-thanks': { const t = document.getElementById('pgThanks'); if (t) ctx.copy(t.value, 'Note copied'); break; }
      }
    }
    function field(e) { // inputs and selects marked data-pg; returns true when handled
      const t = e.target, d = t.dataset;
      if (!d || !d.pg) return false;
      const s = ctx.store(), kind = d.pg, isText = e.type === 'input';
      const textLike = t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && !['checkbox', 'radio'].includes(t.type) && t.type !== 'date' && t.type !== 'datetime-local');
      if ((isText && !textLike) || (!isText && textLike)) return true; // text waits for 'input', the rest for 'change'
      switch (kind) {
        case 'find-what': F.what = t.value; break;
        case 'find-where': F.where = t.value; break;
        case 'find-country': F.country = t.value; break;
        case 'paste-role': F.paste.role = t.value; break;
        case 'paste-company': F.paste.company = t.value; break;
        case 'paste-text': F.paste.text = t.value; break;
        case 'cv-job': {
          const L = curLetter(); if (!L) break;
          const app = s.applications.find(x => x.aid === t.value);
          L.aid = t.value; if (app) { L.role = app.role; L.company = app.company; }
          if (L.auto) L.opening = defOpening(L.role, L.company);
          ctx.persist(); ctx.rerender(); break;
        }
        case 'cv-role': case 'cv-company': { const L = curLetter(); if (!L) break; L[kind === 'cv-role' ? 'role' : 'company'] = t.value; if (L.auto) { L.opening = defOpening(L.role, L.company); const o = document.querySelector('[data-pg="cv-opening"]'); if (o) o.value = L.opening; } ctx.save(); refreshPaper(); break; }
        case 'cv-to': { const L = curLetter(); if (L) { L.to = t.value; ctx.save(); refreshPaper(); } break; }
        case 'cv-opening': { const L = curLetter(); if (L) { L.opening = t.value; L.auto = false; ctx.save(); refreshPaper(); } break; }
        case 'cv-closing': { const L = curLetter(); if (L) { L.closing = t.value; ctx.save(); refreshPaper(); } break; }
        case 'cv-ev': {
          const L = curLetter(); if (!L) break;
          const txt = evidence(L)[+d.i]; if (txt == null) break;
          L.ev = (L.ev || []).filter(x => x !== txt); if (t.checked) L.ev.push(txt);
          ctx.save(); refreshPaper(); break;
        }
        case 'ans': { const q = QUESTIONS[I.q % QUESTIONS.length]; s.answers = s.answers || {}; (s.answers[q] = s.answers[q] || {})[d.k] = cap(t.value, 2000); ctx.save(); break; }
        case 'iv-prep': { const i = interviews().find(x => x.iid === d.iid); if (i) { i.done = i.done || {}; i.done[d.i] = t.checked; ctx.save(); ctx.rerender(); } break; }
        default:
          if (kind.startsWith('ct-')) {
            const c = contacts().find(x => x.cid === d.cid); if (!c) break;
            c[kind.slice(3)] = cap(t.value, kind === 'ct-notes' ? 4000 : 120); ctx.save();
            if (kind === 'ct-followUp' || kind === 'ct-type' || kind === 'ct-aid') ctx.rerender();
          }
      }
      return true;
    }
    function submit(e) {
      const f = e.target, s = ctx.store();
      if (f.id === 'pgFindForm') { e.preventDefault(); const fd = new FormData(f); F.what = String(fd.get('what') || ''); F.where = String(fd.get('where') || ''); F.country = String(fd.get('country') || 'ie'); runSearch(); return true; }
      if (f.id === 'pgContactForm') {
        e.preventDefault(); const fd = new FormData(f), name = cap(fd.get('name'), 80).trim(); if (!name) return true;
        const c = { cid: ctx.uid('c'), name, type: cap(fd.get('type'), 40), role: cap(fd.get('role'), 80), org: cap(fd.get('org'), 80), how: '', followUp: '', lastSpoke: '', aid: '', notes: '' };
        contacts().push(c); K.cid = c.cid; K.adding = false; K.filter = 'all'; ctx.persist(); ctx.rerender(); ctx.toast('Contact added'); return true;
      }
      if (f.id === 'pgIvForm') {
        e.preventDefault(); const fd = new FormData(f), app = s.applications.find(a => a.aid === fd.get('aid'));
        const when = String(fd.get('when') || ''); if (!when) return true;
        const iv = { iid: ctx.uid('i'), aid: app ? app.aid : '', role: cap(fd.get('role') || (app && app.role) || '', 140), company: cap(fd.get('company') || (app && app.company) || '', 100), when, kind: cap(fd.get('kind'), 20), place: cap(fd.get('place'), 120), done: {} };
        interviews().push(iv); I.iid = iv.iid; I.adding = false; if (app && app.status !== 'Interview' && app.status !== 'Offer') app.status = 'Interview';
        ctx.persist(); ctx.rerender(); ctx.toast('Interview added'); return true;
      }
      return false;
    }

    return { NAV, PAGES, side, render: { home, resumes, find, cover, contacts: contactsPage, interviews: interviewsPage, resources }, click, field, submit, after: tab => { if (tab === 'find' && SEARCH_MODE === 'widget') mountWidget(); } };
  };
})();
