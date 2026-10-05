/* Public profile page: shows a CV or contact card carried inside a shared link.
   A link can be written by anyone, so everything read from it is validated first. */
addEventListener('hashchange', () => location.reload());
(function () {
  const { esc } = UCV;
  const out = document.getElementById('out');
  const actions = document.getElementById('actions');
  const data = UCV.decode(location.hash.slice(1));
  const toast = (m) => { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.getElementById('toasts').appendChild(t); setTimeout(() => t.remove(), 2500); };

  if (!data || typeof data !== 'object' || !UCV.validId(data.id)) {
    out.innerHTML = '<div class="contact-card"><h1 style="font:700 24px/1.2 var(--display)">This link is incomplete</h1><p style="color:var(--ink-2)">Profile links are long. Ask the sender to copy the whole link again.</p><a class="btn btn-primary" href="app.html">Create your own CV ID</a></div>';
    return;
  }
  const id = data.id;
  const note = '<p class="public-note">Shared by its owner through a link. The details are self-declared and have not been verified.</p>';

  if (data.t === 'card') {
    const c = UCV.fromCard(data);
    document.title = (c.n || 'Contact') + ' · ' + id;
    const [l1, l2] = UCV.mrz(id, c.n, c.l);
    const initials = (c.n || '?').split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase();
    const web = UCV.safeUrl(c.u);
    const rows = [['Email', esc(c.e)], ['Phone', esc(c.p)], ['Location', esc(c.loc)], ['Web', web ? `<a href="${esc(web)}" target="_blank" rel="noopener noreferrer">${esc(c.u)}</a>` : esc(c.u)]].filter(r => r[1]);
    out.innerHTML = `
      <div class="contact-card">
        <div class="idcard">
          <div class="idcard-top"><span>Universal CV ID</span><span>Contact</span></div>
          <div class="idcard-body"><div class="idcard-photo" aria-hidden="true">${esc(initials)}</div>
            <div style="min-width:0"><div class="idcard-name">${esc(c.n)}</div><div class="idcard-label">${esc(c.l)}</div><div class="idcard-id">${esc(id)}</div></div></div>
          <div class="idcard-mrz" aria-hidden="true">${esc(l1)}\n${esc(l2)}</div>
        </div>
        <dl>${rows.map(r => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('')}</dl>
        ${c.e ? '<button class="btn btn-primary" id="copyEmail">Copy email address</button>' : ''}
        ${note}
      </div>`;
    const btn = document.getElementById('copyEmail');
    if (btn) btn.addEventListener('click', async () => { try { await navigator.clipboard.writeText(c.e); toast('Email copied'); } catch (e) { toast(c.e); } });
    return;
  }

  const res = UCV.fromShare(data);
  document.title = (res.cv.basics.name || 'Profile') + ' · ' + id;
  out.innerHTML = note + '<div class="paper-wrap" id="paperWrap" style="margin-top:12px"><div class="paper-scale" id="paper"></div></div>';
  const paper = document.getElementById('paper'), wrap = document.getElementById('paperWrap');
  actions.innerHTML = '<button class="btn btn-primary btn-sm" id="dl">Download PDF</button>';
  document.getElementById('dl').addEventListener('click', () => {
    let root = document.getElementById('printRoot');
    if (!root) { root = document.createElement('div'); root.id = 'printRoot'; document.body.appendChild(root); }
    root.innerHTML = paper.innerHTML;
    document.body.classList.add('printing');
    const done = () => { document.body.classList.remove('printing'); root.innerHTML = ''; removeEventListener('afterprint', done); };
    addEventListener('afterprint', done);
    print();
  });
  const draw = () => {
    UCV.paginate(paper, res, id);
    const s = Math.max(0.2, Math.min(1, (wrap.clientWidth - 36) / 794));
    paper.style.transform = `scale(${s})`; paper.style.width = '794px';
    paper.style.marginBottom = (paper.offsetHeight * (s - 1)) + 'px';
    paper.style.marginRight = (794 * (s - 1)) + 'px';
  };
  draw(); addEventListener('resize', draw);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
})();
