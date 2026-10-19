/* Universal CV ID — job search proxy (Cloudflare Worker).
   The site is static, so API keys cannot live in it. This Worker holds them, asks the job
   providers for results, and hands back one simple list.

   What it receives from the browser: the keywords and place typed into Find jobs.
   What it passes on: those two words, plus the visitor's IP address and browser string,
   which Careerjet requires with every search. Nothing else (no CV, no name, no account).
   Nothing is stored here and results are not cached: each search is a live request, and the apply links
   in the results are the providers' own tracked links, passed through untouched (that is how clicks are credited). */

const ALLOWED_ORIGINS = ['https://cvid.app', 'https://www.cvid.app'];
const MAX_LEN = 80;

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const okOrigin = ALLOWED_ORIGINS.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin);
    const cors = {
      'Access-Control-Allow-Origin': okOrigin ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin'
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'GET') return json({ error: 'Use GET.' }, 405, cors);
    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true, providers: providers(env) }, 200, cors); // open on purpose: shows only which sources have a key
    if (!okOrigin) return json({ error: 'This search only works from cvid.app.' }, 403, cors);
    if (url.pathname !== '/search') return json({ error: 'Not found.' }, 404, cors);

    const what = clean(url.searchParams.get('what'));
    const where = clean(url.searchParams.get('where'));
    const page = Math.min(Math.max(parseInt(url.searchParams.get('page') || '1', 10) || 1, 1), 10);
    const country = (url.searchParams.get('country') || 'ie').toLowerCase() === 'gb' ? 'gb' : 'ie';
    if (!what && !where) return json({ error: 'Type a job title or a place.' }, 400, cors);

    const ip = request.headers.get('CF-Connecting-IP') || '';
    const ua = request.headers.get('User-Agent') || '';
    const list = providers(env);
    if (!list.length) return json({ error: 'Job search is not switched on yet.', setup: true }, 503, cors);

    const settled = await Promise.allSettled(list.map(p => ADAPTERS[p](env, { what, where, page, country, ip, ua })));
    let jobs = [];
    const used = [], failed = [], why = [];
    settled.forEach((r, i) => {
      if (r.status === 'fulfilled') { jobs = jobs.concat(r.value); used.push(list[i]); }
      else { failed.push(list[i]); why.push(list[i] + ': ' + String((r.reason && r.reason.message) || r.reason).slice(0, 300)); }
    });
    if (!used.length) return json({ error: 'The job sources did not answer. Try again in a moment.', why }, 502, cors);

    jobs = dedupe(jobs);
    return json({ jobs, page, sources: used, failed }, 200, Object.assign({ 'Cache-Control': 'no-store' }, cors));
  }
};

const enc = encodeURIComponent;
const clean = s => (s || '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, MAX_LEN);
const json = (o, status, headers) => new Response(JSON.stringify(o), { status, headers: Object.assign({ 'Content-Type': 'application/json' }, headers) });
function providers(env) { return [env.CAREERJET_KEY && 'careerjet', env.JOOBLE_KEY && 'jooble'].filter(Boolean); }
const strip = h => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#?\w+;/g, ' ').replace(/\s+/g, ' ').trim();
const isHttp = u => /^https?:\/\//i.test(u || '');

function dedupe(jobs) {
  const seen = new Set();
  return jobs.filter(j => {
    const k = (j.title + '|' + j.company).toLowerCase().replace(/[^a-z0-9|]/g, '');
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
}

const ADAPTERS = {
  // Careerjet API v4. Key goes in as the Basic-auth user name. Needs the visitor's IP and browser string.
  async careerjet(env, q) {
    const p = new URLSearchParams({ locale_code: q.country === 'gb' ? 'en_GB' : 'en_IE', keywords: q.what, location: q.where, user_ip: q.ip || '0.0.0.0', user_agent: q.ua || 'Mozilla/5.0', page_size: '20', offset: String((q.page - 1) * 20), sort: 'relevance' });
    const r = await fetch('https://search.api.careerjet.net/v4/query?' + p, { headers: { Authorization: 'Basic ' + btoa(env.CAREERJET_KEY + ':'), Referer: 'https://cvid.app/app.html' } });
    if (!r.ok) throw new Error('careerjet ' + r.status + ' ' + (await r.text()).slice(0, 200));
    const d = await r.json();
    return (d.jobs || []).filter(j => isHttp(j.url)).map(j => ({
      id: 'cj:' + (j.url || '').slice(-40), title: strip(j.title), company: strip(j.company), location: strip(j.locations || j.location),
      snippet: strip(j.description), salary: strip(j.salary), date: j.date || '', url: j.url, source: 'Careerjet'
    }));
  },
  // Jooble: key is part of the path, search is a POST.
  async jooble(env, q) {
    const r = await fetch('https://jooble.org/api/' + enc(env.JOOBLE_KEY), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keywords: q.what, location: q.where || (q.country === 'gb' ? 'United Kingdom' : 'Ireland'), page: String(q.page) }) });
    if (!r.ok) throw new Error('jooble ' + r.status);
    const d = await r.json();
    return (d.jobs || []).filter(j => isHttp(j.link)).map(j => ({
      id: 'jb:' + (j.id || j.link.slice(-40)), title: strip(j.title), company: strip(j.company), location: strip(j.location),
      snippet: strip(j.snippet), salary: strip(j.salary), date: j.updated || '', url: j.link, source: 'Jooble'
    }));
  }
};
