/* Universal CV ID: the CV check (beta).
   Reads a CV in the browser (nothing is uploaded), runs plain rules that most recruiters agree on,
   and marks the problems on the person's own page. Rules and the evidence behind them are in the rules doc. */
(function () {
'use strict';
const SAMPLE_AD = `Medical Receptionist – Waterford
We're a busy GP practice looking for a Medical Receptionist to join our front desk team.
You'll need a full driving licence, experience with Socrates or similar practice software, strong customer service skills, Microsoft Excel and the right to work in Ireland.
QQI Level 5 in Medical Secretarial Studies is an advantage.`;


/* ---------- groups ---------- */
const GROUPS = [
  {k:'missing', title:'Missing', sub:'Things employers expect to see', c:'--g-missing'},
  {k:'result',  title:'No result shown', sub:'Says the job, not what got better', c:'--g-result'},
  {k:'vague',   title:'Too vague', sub:'Hides what you actually did', c:'--g-vague'},
  {k:'words',   title:'Overused words', sub:'On almost every CV', c:'--g-words'},
  {k:'read',    title:'Hard to read', sub:'Layout, length and dates', c:'--g-read'},
  {k:'spell',   title:'Spelling', sub:'Typos recruiters notice', c:'--g-spell'},
  {k:'job',     title:'This job', sub:'What the advert asks for', c:'--g-job'}
];
const GI = Object.fromEntries(GROUPS.map((g,i)=>[g.k,i]));

/* ---------- word lists ---------- */
const MISSPELL = {recieve:'receive',recieved:'received',recieving:'receiving',acheive:'achieve',acheived:'achieved',managment:'management',responsable:'responsible',seperate:'separate',occured:'occurred',definately:'definitely',untill:'until',begining:'beginning',enviroment:'environment',experiance:'experience',sucessful:'successful',succesful:'successful',sucess:'success',comunication:'communication',adress:'address',buisness:'business',calender:'calendar',commited:'committed',accomodate:'accommodate',liase:'liaise',liason:'liaison',independant:'independent',maintainance:'maintenance',maintenence:'maintenance',recomend:'recommend',reccomend:'recommend',refered:'referred',relevent:'relevant',wich:'which',thier:'their',teh:'the',goverment:'government',knowlege:'knowledge',neccessary:'necessary',occassion:'occasion',oppurtunity:'opportunity',oppertunity:'opportunity',persue:'pursue',prefered:'preferred',proffesional:'professional',profesional:'professional',publically:'publicly',responsability:'responsibility',suport:'support',truely:'truly',writting:'writing',organisaton:'organisation',coordinater:'coordinator',adminstration:'administration',administator:'administrator',assistent:'assistant',costumer:'customer',custmer:'customer',excelent:'excellent',excellant:'excellent',efficent:'efficient',finacial:'financial',genral:'general',inventry:'inventory',langauge:'language',payed:'paid',procedue:'procedure',reciept:'receipt',schedual:'schedule',supervisior:'supervisor',technicial:'technical',trainning:'training',managed2:'managed'};
const CLICHES = ['hard-working','hard working','hardworking','team player','results-driven','results driven','dynamic','detail-oriented','detail oriented','go-getter','self-starter','self starter','motivated','passionate','excellent communication skills','good communication skills','good communication','strong communication skills','think outside the box','proven track record','fast learner','quick learner','highly organised','highly organized','works well under pressure','work well under pressure','people person','reliable','enthusiastic','flexible','synergy','go the extra mile','best of breed','value add','team-oriented','can-do attitude','results-oriented','outgoing personality','punctual'];
const PLACES = ['carlow','cavan','clare','cork','donegal','dublin','galway','kerry','kildare','kilkenny','laois','leitrim','limerick','longford','louth','mayo','meath','monaghan','offaly','roscommon','sligo','tipperary','waterford','westmeath','wexford','wicklow','antrim','armagh','down','fermanagh','derry','londonderry','tyrone','belfast','drogheda','dundalk','swords','navan','ennis','tralee','athlone','letterkenny','bray','naas','ireland','london','manchester','birmingham','glasgow','edinburgh','leeds','liverpool','bristol','cardiff','uk','united kingdom'];
const SKILLS = ['customer service','microsoft office','microsoft excel','excel','word','outlook','powerpoint','data entry','bookkeeping','payroll','sage','xero','quickbooks','socrates','healthone','helix practice manager','medical terminology','first aid','manual handling','haccp','food safety','forklift','safepass','cash handling','stock control','inventory','merchandising','sales','scheduling','reception','switchboard','typing','audio typing','gdpr','social media','canva','photoshop','sql','python','javascript','project management','team leadership','training','phlebotomy','cpr','patient care','driving','irish','french','german','spanish','polish'];
const PRESENT_VERBS = ['manage','lead','run','handle','answer','train','support','process','deliver','coordinate','organise','organize','prepare','maintain','oversee','help','assist','serve','book','schedule','supervise','work','deal','create','build','develop','plan'];
const EVERYDAY_TOOLS = ['email','e-mail','internet','microsoft word','ms word','word','google','google search','windows','vs code','vscode','jira','confluence','npm','zoom','microsoft teams','teams','whatsapp','facebook','typing'];
const AI_PHRASES = ['spearheaded','spearheading','leveraged','leveraging','leverage','utilised','utilized','utilising','utilizing','utilise','utilize','synergy','synergies','synergistic','cutting-edge','cutting edge','fostering a culture','fostered a culture','drive business outcomes','drove business outcomes','results-driven professional','seamlessly','robust','orchestrated','pivotal role','instrumental in','proactively','streamlined operations','in today\'s fast-paced','fast-paced environment','passionate about leveraging','demonstrated ability','proven ability','meticulous','adept at','navigating complex','holistic','a testament to','delve','championed'];
const US_SPELL = {organize:'organise',organized:'organised',organizing:'organising',organization:'organisation',organizations:'organisations',optimize:'optimise',optimized:'optimised',optimizing:'optimising',analyze:'analyse',analyzed:'analysed',analyzing:'analysing',prioritize:'prioritise',prioritized:'prioritised',specialize:'specialise',specialized:'specialised',realize:'realise',realized:'realised',recognize:'recognise',recognized:'recognised',minimize:'minimise',minimized:'minimised',maximize:'maximise',maximized:'maximised',standardize:'standardise',standardized:'standardised',customize:'customise',customized:'customised',color:'colour',colors:'colours',center:'centre',centers:'centres',favorite:'favourite',behavior:'behaviour',labor:'labour',catalog:'catalogue',traveled:'travelled',traveling:'travelling',canceled:'cancelled',modeled:'modelled',modeling:'modelling',labeled:'labelled',fulfill:'fulfil',enrollment:'enrolment',defense:'defence',license_noun:'licence',gpa:'grades',program_x:'programme'};
const STOPW = ['with','skills','management','systems','tools','advanced','development','support','delivery','body','team','based','strategy','engagement','skill','general','basic','good','strong','excellent'];
const COMMON_ACR = ['GPU','CPU','ISO','SFI','IDA','LEO','SME','SMES','HPC','IOT','PLC','CNC','OEM','NDA','EMEA','APAC','LLM','NASA','FDA','HPRA','EPA','ESB','CEO','CV','IT','HR','UK','USA','US','EU','PDF','CEO','CFO','COO','GP','QQI','CPR','HACCP','SQL','MBA','BSC','MSC','PHD','PPS','ATS','CRM','ERP','NHS','HSE','AWS','API','HTML','CSS','PHP','IOS','LLC','LTD','DBS','GDPR','TV','UCD','DCU','TCD','NUI','SETU','ATU','NCAD','RTE','CAD','FAQ','PA','AM','PM','OK','HGV','QA','UX','UI','AI','PE','SEO','BA','MA','KPIS'];
const MONTH = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*';

/* ---------- parsing ---------- */
const HEAD = {
  summary:/^(profile|summary|personal (profile|statement|summary)|about( me)?|career (summary|objective|profile)|objective|professional (summary|profile)|executive (summary|profile))\s*:?$/i,
  exp:/^(experience|work experience|employment( history| experience)?|work history|career (history|experience)|professional (experience|background)|relevant experience|experience (and|&) employment)\s*:?$/i,
  edu:/^(education|education (and|&) (training|qualifications)|academic qualifications|qualifications|training)\s*:?$/i,
  skills:/^(skills|key skills|core skills|skills (and|&) (abilities|competencies|expertise)|(core |key )?competencies|technical skills|areas of expertise|expertise)\s*:?$/i,
  other:/^(interests|hobbies|references|(key )?achievements|languages|certifications?( (and|&) (memberships|training|licen[cs]es))?|memberships|awards|publications|projects|volunteering|professional development|additional information)\s*:?$/i
};
const BULLET = /^\s*([•\-*–·▪●◦]|\d+[.)])\s+/;
function unspace(t){ return /^([A-Z&] ?){4,}$/.test(t.trim()) && /^[A-Z&]( [A-Z&]{1,2})+$/.test(t.trim()) ? t.replace(/ /g,'') : t; }
function headKind(t){ t=unspace(t); for(const k in HEAD){ if(HEAD[k].test(t.trim())) return k; } return null; }
function capsHeading(t){ t=t.trim(); return t.length<=48 && /[A-Z]{3}/.test(t) && t===t.toUpperCase() && !/\d|@/.test(t) && t.split(/\s+/).length<=6; }

function parseCV(text){
  const raw = text.replace(/\r/g,'').split('\n');
  const lines = []; let section = 'top', seenName = false;
  raw.forEach(r=>{
    const t = r.replace(/\s+$/,'');
    if(!t.trim()){ lines.push({text:'',kind:'blank',section}); return; }
    let hk = headKind(t); if(!hk && seenName && capsHeading(t)) hk='other';
    if(hk){ section = hk; lines.push({text:t.trim(),kind:'heading',section,hk}); return; }
    if(section==='top'){
      if(!seenName){ seenName = true; lines.push({text:t.trim(),kind:'name',section}); return; }
      const looksContact = /@|\d{3}|linkedin|·|\||,/.test(t) || t.trim().split(/\s+/).length<=6;
      lines.push({text:t.trim(),kind: looksContact?'contact':'para',section}); return;
    }
    if(BULLET.test(t)){ lines.push({text:t.trim(),kind:'bullet',section,body:t.replace(BULLET,'').trim()}); return; }
    if(section==='exp' && (years(t).length || t.trim().split(/\s+/).length<=18)){ lines.push({text:t.trim(),kind:'job',section}); return; }
    lines.push({text:t.trim(),kind:'para',section});
  });
  // group jobs
  const jobs=[]; let cur=null;
  lines.forEach((l,i)=>{
    if(l.section!=='exp'){ cur=null; return; }
    if(l.kind==='job'){
      // A title line and a company line belong to one job, e.g. "Engineer, 2018 - 2023" then "SEAM, Waterford".
      if(cur && !cur.bullets.length && !cur.paras.length && cur.sub.length<2 && (!years(cur.ht).length || !years(l.text).length)){ cur.sub.push(i); cur.ht += ' ' + l.text; l.kind='jobsub'; return; }
      cur={head:i,sub:[],ht:l.text,bullets:[],paras:[]}; jobs.push(cur); }
    else if(l.kind==='bullet' && cur) cur.bullets.push(i);
    else if(l.kind==='para'){ if(cur) cur.paras.push(i); }
  });
  return {lines,jobs};
}
function words(s){ return (s.match(/[A-Za-zÀ-ÿ'’-]+|\d+/g)||[]).length; }
function years(s){ return (s.match(/\b(19|20)\d{2}\b/g)||[]).map(Number); }
function isCurrent(s){ return /present|current|now|to date|ongoing/i.test(s); }

/* ---------- the checks ---------- */
function analyze(text, advert, ans, meta){
  const P = parseCV(text), L = P.lines, F = [];
  const RETIRED = new Set(['W5','R12','R6','R11','S2','R13']);
  const add = (rule,group,level,line,title,msg,need,better,span,insert)=>RETIRED.has(rule)?0:F.push({id:rule+'-'+line+'-'+F.length,rule,group,level,line,title,msg,need,better,span:span||null,insert:insert||null});
  const all = text.toLowerCase();
  const nameIdx = L.findIndex(l=>l.kind==='name');
  const topIdx = L.map((l,i)=>[l,i]).filter(([l])=>l.section==='top' && l.kind!=='blank').map(([,i])=>i);
  const contactAnchor = topIdx.length>1 ? topIdx[topIdx.length-1] : (nameIdx>=0?nameIdx:0);
  const topText = topIdx.map(i=>L[i].text).join(' ');
  const totalWords = words(text);

  // L1 unreadable
  if(text.replace(/\s/g,'').length < 200){
    add('L1','read','fix',-1,'Words can\'t be read','We could only read a few words from your file. Screening software probably can\'t read it either.','Is it a scan or a picture? Save it from Word or Google Docs as a PDF instead.');
    return {P,F};
  }
  // C1 / C2 email
  const em = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  if(!em) add('C1','missing','fix',contactAnchor,'No email','Add your email. Employers can\'t reply without it.','Your email address',null,null,'+ email');
  else {
    const local = em[0].split('@')[0].toLowerCase();
    if(/(babe|sexy|lol|princess|cutie|hottie|baby|angel|crazy|killer|gamer|xx|lil|boo|swag|queen|king)/.test(local)){
      const li = L.findIndex(l=>l.text.includes(em[0]));
      add('C2','missing','fix',li,'Unprofessional email','Use an email with your name in it. Most recruiters mark this down.','A new email like firstname.lastname@…',null,[L[li].text.indexOf(em[0]),L[li].text.indexOf(em[0])+em[0].length]);
    }
  }
  // C3 phone
  if(!/(\+?\d[\d\s().-]{7,}\d)/.test(topText) && !/(\+?\d[\d\s().-]{8,}\d)/.test(text))
    add('C3','missing','fix',contactAnchor,'No phone number','Add a phone number. Many employers call first.','Your phone number',null,null,'+ phone');
  // C4 town
  const topLow = topText.toLowerCase();
  if(!ans.town && !PLACES.some(p=>new RegExp('\\b'+p+'\\b').test(topLow)))
    add('C4','missing','tip',contactAnchor,'No town or county','Add your town. Some jobs check location first.','Where you live',null,null,'+ town');
  // C5 personal details
  L.forEach((l,i)=>{ const m=l.text.match(/date of birth|\bd\.?o\.?b\b|marital status|\bpps( number| no\.?)?\b|nationality|religion/i);
    if(m) add('C5','missing','tip',i,'Details you don\'t need','You don\'t need this on a CV. Leaving it out is safer.',null,null,[m.index,m.index+m[0].length]); });

  // Sections
  const hasExp = L.some(l=>l.hk==='exp'), hasSkills = L.some(l=>l.hk==='skills');
  const sumLines = L.map((l,i)=>[l,i]).filter(([l])=>(l.section==='summary'||(l.section==='top'&&l.kind==='para')) && l.kind!=='heading' && l.kind!=='blank');
  if(!hasExp) add('L2','read','fix',-1,'No Experience heading','We couldn\'t find your Experience section. Add a clear "Experience" heading so readers find it fast.',null);
  if(!hasSkills) add('S3','missing','fix',-1,'No skills section','Add a Skills section. It\'s one of the first things recruiters look at.','Which tools, systems or tasks are you good at?');
  if(!sumLines.length) add('S6','missing','tip',nameIdx,'No intro','Add 2–3 lines at the top saying who you are and what you do.','What job do you do? What are you best at?');

  // Length
  if(totalWords>1100) add('S1','read','tip',-1,'Over two pages','Most recruiters prefer two pages or less. Cut older jobs down to one line each.',null);
  if(totalWords<150) add('S2','read','tip',-1,'Very short','Your CV looks short. There\'s room to show more of what you\'ve done.',null);
  const sumWords = sumLines.reduce((a,[l])=>a+words(l.text),0);
  if(sumWords>70) add('S5','read','tip',sumLines[0][1],'Long intro','Keep your intro to 2–3 lines.',null);
  // W3 intro about wants
  sumLines.forEach(([l,i])=>{ const m=l.text.match(/\b(looking for|seeking|to obtain|to secure|i am looking)\b[^.]*/i);
    if(m) add('W3','words','fix',i,'Intro is about what you want','Say what you offer, not what you want.','What job do you do? What are you best at?','Medical receptionist with 4 years running a busy clinic front desk.',[m.index,m.index+m[0].length]); });
  // S4 too many skills
  const skillLines = L.filter(l=>l.section==='skills' && l.kind!=='heading' && l.kind!=='blank');
  const skillCount = skillLines.reduce((a,l)=>a+l.text.split(/[,·•|;]/).filter(s=>s.trim()).length,0);
  if(skillCount>20) add('S4','read','tip',L.findIndex(l=>l.hk==='skills'),'Too many skills','Keep the 10–15 that matter most for the jobs you want.',null);

  // Dates style (L4)
  const styles = new Set();
  P.jobs.forEach(j=>{ const t=j.ht.toLowerCase();
    if(new RegExp(MONTH+'\\.?\\s+(19|20)\\d{2}').test(t)) styles.add('month');
    if(/\b\d{1,2}\/(19|20)\d{2}\b/.test(t)) styles.add('numeric');
    const yrs = years(t).length, rich = (t.match(new RegExp(MONTH+'\\.?\\s+(19|20)\\d{2}','g'))||[]).length + (t.match(/\b\d{1,2}\/(19|20)\d{2}/g)||[]).length;
    if(yrs>rich) styles.add('year'); });
  if(styles.size>1){ const j=P.jobs.find(j=>/(19|20)\d{2}/.test(j.ht)); add('L4','read','fix',j?j.head:-1,'Mixed date styles','Pick one date style and use it everywhere, like "Mar 2021 – Present".','The month you started and finished each job'); }

  // Jobs
  let prevLatest = null, orderFlagged = false; const curJobs = P.jobs.filter(j=>isCurrent(j.ht)).length;
  P.jobs.forEach((j,ji)=>{
    const h = j.ht, ys = years(h);
    if(!ys.length) add('E5','missing','fix',j.head,'Job with no dates','Add the month and year you started and finished.','Start and end dates',null,null,'+ dates');
    const latest = isCurrent(h) ? 9999 : (ys.length?Math.max(...ys):null);
    if(!orderFlagged && prevLatest!==null && latest!==null && latest>prevLatest){ add('E6','read',curJobs>=2?'tip':'fix',j.head,'Latest job not first',curJobs>=2?'You list two current jobs. Check the order matches what you want read first.':'Put your latest job first. Recruiters read top down.',null); orderFlagged=true; }
    if(latest!==null) prevLatest = latest;
    // E2 no numbers
    if(j.bullets.length>=2 && !j.bullets.some(b=>/\d/.test(L[b].body))) add('E2','result','tip',j.head,'No numbers in this job','None of these lines has a number. A rough figure is fine: how many people, customers, orders or hours?','How many people, how much money or time?');
    // E7 same opening word
    const firsts = {}; j.bullets.forEach(b=>{ const w=(L[b].body.split(/\s+/)[0]||'').toLowerCase(); if(w) (firsts[w]=firsts[w]||[]).push(b); });
    Object.values(firsts).forEach(arr=>{ if(arr.length>=3) add('E7','words','tip',arr[2],'Same opening word','Try starting these lines with different words.',null); });
    // W5 tense
    const cur = isCurrent(h); let tenseDone=false;
    j.bullets.forEach(b=>{ if(tenseDone) return; const w=(L[b].body.split(/\s+/)[0]||'').toLowerCase().replace(/[^a-z]/g,'');
      if(cur && /ed$/.test(w) && w.length>3) { add('W5','words','tip',b,'Tense','Use present tense for your current job: "manage", not "managed".',null,null,[L[b].text.indexOf(L[b].body.split(/\s+/)[0]), L[b].text.indexOf(L[b].body.split(/\s+/)[0])+L[b].body.split(/\s+/)[0].length]); tenseDone=true; }
      else if(!cur && PRESENT_VERBS.includes(w)){ add('W5','words','tip',b,'Tense','Use past tense for old jobs: "managed", not "manage".',null); tenseDone=true; }
    });
    // L6 wall of text
    j.paras.forEach(p=>{ if(words(L[p].text)>=60 && !j.bullets.length) add('L6','read','fix',p,'Wall of text','Break this into short bullet points.',null); });
  });

  // Line checks on bullets
  L.forEach((l,i)=>{
    if(l.kind!=='bullet' && !(l.section==='exp' && l.kind==='para')) return;
    const body = l.body||l.text, off = l.text.indexOf(body);
    let m;
    if((m = body.match(/^(responsible for|duties (included|include|were)|in charge of|tasked with|my role (was|is)|duties:)/i)))
      add('E1','result','fix',i,'Says your job, not what you achieved','This says what your job was, not what got better because of you.','What got better? Roughly how much?','Ran bookings for 4 doctors and cut missed appointments by about a third.');
    else if((m = body.match(/^(helped (with|to|out)?|assisted( with| in)?|involved in|worked on|participated in|contributed to|supported with)\b/i)))
      add('E3','vague','fix',i,'Too vague',`"${m[0].trim()}" hides what you actually did.`,'What exactly did you do? How many?','Trained 3 new receptionists on the booking system and phones.',[off+m.index, off+m.index+m[0].length]);
    else if((m = body.match(/(dealt with customers|general admin(istration)?( duties)?|various (tasks|duties)|other duties|day[- ]to[- ]day (tasks|duties|running)|general duties)/i)))
      add('E4','vague','fix',i,'Says nothing yet','Every job like this does that. What did you do well?','What were you good at? Any praise or numbers?','Handled returns and complaints, and was asked to train weekend staff.');
    if(/^(i|my)\b/i.test(body) || /\bmy\b/i.test(body)) add('W4','words','tip',i,'"I" and "my"','Drop "I" and "my". Start the line with what you did.',null);
    if(words(body)>35) add('L5','read','fix',i,'Long line','Cut this to one or two lines. Recruiters skim.',null);
  });

  // Clichés and spelling, anywhere
  L.forEach((l,i)=>{
    if(l.kind==='blank'||l.kind==='heading') return;
    const low = l.text.toLowerCase(), taken = [], found = [];
    CLICHES.slice().sort((a,b)=>b.length-a.length).forEach(c=>{
      const re = new RegExp('(^|[^a-z])('+c.replace(/[-]/g,'[- ]?')+')(?![a-z])','g'); let m;
      while((m=re.exec(low))){ const s=m.index+m[1].length, e=s+m[2].length; if(taken.some(([a,b])=>s<b&&e>a)) continue; taken.push([s,e]); found.push(l.text.slice(s,e)); }
    });
    if(taken.length){ taken.sort((a,b)=>a[0]-b[0]); const q=found.map(x=>'"'+x+'"');
      add('W2','words','fix',i,'Overused words',`${q.length>1?q.slice(0,-1).join(', ')+' and '+q[q.length-1]+' are':q[0]+' is'} on almost every CV, so ${q.length>1?'they tell':'it tells'} an employer nothing.`,'When did you show this? Give one real example.',null,taken); }
    const re = /[A-Za-z]+/g; let m;
    while((m=re.exec(l.text))){ const w=m[0].toLowerCase(); if(MISSPELL[w] && w!=='managed2'){ const fix=MISSPELL[w]; const cap = m[0][0]===m[0][0].toUpperCase() ? fix[0].toUpperCase()+fix.slice(1) : fix;
      add('W1','spell','fix',i,'Spelling',`"${m[0]}" looks misspelled. Did you mean "${cap}"?`,null,null,[m.index,m.index+m[0].length]); } }
  });

  /* ---- rules from Reddit reviewers (R1–R14) ---- */
  const region = meta.region||'IE';
  const isEx = l=>l.section==='exp'||l.section==='edu';
  const expText = L.filter(l=>isEx(l) || l.section==='summary').map(l=>l.text.toLowerCase()).join(' \n ');
  const skillIdx = L.map((l,i)=>i).filter(i=>L[i].section==='skills' && L[i].kind!=='heading' && L[i].kind!=='blank');
  // R2 everyday tools, R1 skills with no example
  const unbacked = [];
  skillIdx.forEach(i=>{
    const t = L[i].text.replace(/\(([^)]*)\)/g,(x)=>x.replace(/[,;]/g,' ')); const parts=[]; let re=/[^,·•|;]+/g, m;
    const lab = t.match(/^([A-Za-z][A-Za-z &/]{1,28}):\s*/); const skipR1 = lab && /industr|language|interest|hobb|sector/i.test(lab[1]);
    if(lab) re.lastIndex = lab[0].length;
    while((m=re.exec(t))){ const raw=m[0]; const v=raw.trim(); if(!v) continue; const s0=m.index+raw.indexOf(v); parts.push([v,s0,s0+v.length]); }
    const tools = parts.filter(([v])=>EVERYDAY_TOOLS.includes(v.toLowerCase()));
    if(tools.length) add('R2','vague','tip',i,'Everyday tool',`${tools.map(x=>'"'+x[0]+'"').join(', ')}: everyone uses ${tools.length>1?'these':'this'}, so ${tools.length>1?'they don\'t':'it doesn\'t'} need listing.`,null,null,tools.map(x=>[x[1],x[2]]));
    if(!skipR1) parts.forEach(([v,a,b])=>{ const low=v.toLowerCase();
      if(EVERYDAY_TOOLS.includes(low) || CLICHES.some(c=>low.includes(c)) || low.length<3) return;
      const key = low.replace(/^(microsoft|ms)\s+/,'');
      const sig = key.split(/[^a-z0-9+#]+/).filter(w=>w.length>=3 && !STOPW.includes(w));
      const backed = expText.includes(low) || expText.includes(key) || sig.some(w=>new RegExp('\\b'+w.slice(0,w.length>=4?4:w.length).replace(/[+#]/g,'\\$&')).test(expText));
      if(!backed) unbacked.push([v,i,a,b]); });
  });
  if(unbacked.length){ const byLine={}; unbacked.forEach(u=>{(byLine[u[1]]=byLine[u[1]]||[]).push(u);});
    Object.entries(byLine).forEach(([li,us])=>{ const q=us.map(u=>'"'+u[0]+'"'); const list=q.length>1?q.slice(0,-1).join(', ')+' and '+q[q.length-1]:q[0];
      const shown = us.length>4 ? us.slice(0,4).map(u=>'"'+u[0]+'"').join(', ')+` and ${us.length-4} more` : list;
      add('R1','vague','fix',+li,'Skill with no example',`If you used ${shown} at work, show where. A skill with no example can read like padding.`,`Which job did you use ${us.length>1?'them':'it'} in, and for what?`,'Booked 60+ appointments a day in Microsoft Outlook and kept rotas in Excel.',us.map(u=>[u[2],u[3]])); }); }
  L.forEach((l,i)=>{
    if(l.kind==='blank'||l.kind==='heading'||l.kind==='name') return;
    const low=l.text.toLowerCase();
    // R3 AI-sounding words
    const sp=[], fw=[];
    AI_PHRASES.slice().sort((a,b)=>b.length-a.length).forEach(p=>{ const re=new RegExp('(^|[^a-z])('+p.replace(/[-]/g,'[- ]?').replace(/'/g,"['’]")+')(?![a-z])','g'); let m;
      while((m=re.exec(low))){ const s0=m.index+m[1].length,e0=s0+m[2].length; if(sp.some(([a,b])=>s0<b&&e0>a)) continue; sp.push([s0,e0]); fw.push(l.text.slice(s0,e0)); } });
    if(sp.length) add('R3','words',sp.length>=2?'fix':'tip',i,'Sounds AI-written',`Recruiters say words like ${fw.map(x=>'"'+x+'"').join(', ')} sound AI-written. Say it the way you would out loud.`,'What did you actually do, in plain words?',null,sp.sort((a,b)=>a[0]-b[0]));
    // R4 American spelling (Ireland and UK only)
    if(region==='IE'||region==='UK'){ const us=[], uw=[]; let m; const re=/[A-Za-z]+/g;
      while((m=re.exec(l.text))){ const w=m[0].toLowerCase(); if(US_SPELL[w]){ us.push([m.index,m.index+m[0].length]); uw.push(`"${m[0]}" → "${US_SPELL[w]}"`); } }
      if(us.length) add('R4','spell','tip',i,'American spelling',`Use ${region==='IE'?'Irish':'UK'} spelling: ${uw.join(', ')}.`,null,null,us); }
    // R12 short forms
    if((l.kind==='bullet'||l.kind==='para') && l.section!=='skills'){ const ac=[], an=[]; let m; const re=/\b[A-Z]{3,5}s?\b/g;
      while((m=re.exec(l.text))){ const a=m[0].replace(/s$/,''); if(COMMON_ACR.includes(a)||COMMON_ACR.includes(m[0])) continue;
        if(/[|/]/.test(l.text[m.index-1]||'') || /[|/]/.test(l.text[m.index+m[0].length]||'')) continue;
        const count=(text.match(new RegExp('\\b'+a+'s?\\b','g'))||[]).length; const spelled=new RegExp('\\(\\s*'+a+'s?\\s*\\)').test(text);
        if(count===1 && !spelled && !an.includes(a)){ ac.push([m.index,m.index+m[0].length]); an.push(a); } }
      if(ac.length) add('R12','vague','tip',i,'Unexplained short form',`Spell out ${an.map(a=>'"'+a+'"').join(', ')} the first time. Not every reader knows ${an.length>1?'them':'it'}.`,null,null,ac); }
    // R14 references line
    if(/available (up)?on request|references (are )?available|references on request/i.test(l.text))
      add('R14','read','fix',i,'References line','You can drop this line. Employers ask for references when they need them.',null);
  });
  // R5 bullets per job, R6 weak openings, R7 numbers, R11 punctuation
  P.jobs.forEach((j,ji)=>{
    if(j.bullets.length>=7) add('R5','read','tip',j.head,'Too many lines',`This job has ${j.bullets.length} lines. Aim for 3 to 5 and keep your strongest.`,null);
    else if(ji===0 && j.bullets.length===1) add('R5','read','tip',j.head,'Only one line','Your latest job has one line. Aim for 3 to 5.','What else did you do or improve there?');
  });
  L.forEach((l,i)=>{
    if(l.kind!=='bullet') return; const b=l.body||l.text, off=l.text.indexOf(b);
    const w=(b.match(/^[A-Za-z]+/)||[''])[0];
    if(/^(worked|made|did|fixed|went|got|was|were|had|done)$/i.test(w) && !F.some(f=>f.line===i&&(f.rule==='E1'||f.rule==='E3'||f.rule==='E4')))
      add('R6','vague','tip',i,'Weak opening word',`"${w}" says little. Start with a word that says what you did, like "Built", "Ran" or "Trained".`,null,null,[off,off+w.length]);
    let m; const re=/(\d+(?:\.\d+)?)\s?%/g;
    while((m=re.exec(b))){ const v=parseFloat(m[1]); const ctx=/\b(from|to|over|within|in \d|per|a year|a month|each|weekly|monthly|yearly|annual|quarter)\b/i.test(b);
      const claim=/\b(increas|improv|reduc|cut|grew|grow|boost|rais|lower|decreas|sav|accelerat|faster|higher)/i.test(b);
      if(v>100 || (claim && !ctx)){ add('R7','result','tip',i,'Number needs context',v>100?`${m[0]} is hard to believe without context. Say what it was before and after.`:`Say what it was before, or over what time, so ${m[0]} is believable.`,'What was it before, and over what time?',null,[off+m.index,off+m.index+m[0].length]); break; } }
  });
  const bl=L.map((l,i)=>[l,i]).filter(([l])=>l.kind==='bullet');
  if(bl.length>=4){ const dot=bl.filter(([l])=>/\.\s*$/.test(l.text)), no=bl.filter(([l])=>!/\.\s*$/.test(l.text));
    if(dot.length && no.length){ const minority = dot.length<no.length?dot:no; add('R11','read','tip',minority[0][1],'Mixed punctuation',`${dot.length} ${dot.length===1?'line ends':'lines end'} with a full stop and ${no.length} ${no.length===1?'doesn\'t':'don\'t'}. End every line the same way.`,null); } }
  // R8 school details after work (never when it's the only education)
  const eduCount = L.filter(l=>l.section==='edu' && l.kind!=='heading' && l.kind!=='blank').length;
  const jy = P.jobs.flatMap(j=>{ const h=j.ht; const y=years(h); if(isCurrent(h)) y.push(new Date().getFullYear()); return y; });
  if(jy.length && Math.max(...jy)-Math.min(...jy)>=2){
    L.forEach((l,i)=>{ const m=l.text.match(/leaving cert(ificate)?( applied)?( results)?|junior cert|a[- ]levels?|gcses?|\bgpa\b|\d{3} points|grades:/i);
      if(m && l.kind!=='heading' && eduCount>1) add('R8','read','tip',i,'School details',`You can drop "${m[0]}" now. Your jobs say more.`,null,null,[m.index,m.index+m[0].length]); });
  }
  // R9 full home address
  topIdx.forEach(i=>{ const t=L[i].text; const m=t.match(/\b[ACDEFHKNPRTVWXY]\d{2}\s?[0-9ACDEFHKNPRTVWXY]{4}\b|\b[A-Z]{1,2}\d[A-Z\d]?\s\d[A-Z]{2}\b|\b\d+[a-z]?,?\s+[A-Za-z' ]+\s(road|street|avenue|lane|drive|park|close|court|crescent|terrace|grove|rd|st|ave)\b/i);
    if(m) add('R9','missing','tip',i,'Full home address','Your town is enough. Leave out your street and postcode.',null,null,[m.index,m.index+m[0].length]); });
  // R10 photo, by region
  if(meta.photo){
    if(region==='IE'||region==='UK') add('R10','read','fix',nameIdx,'Photo',`${region==='IE'?'Irish':'UK'} employers don't expect a photo, and most recruiters prefer none. Review whether to keep it.`,'Take the photo out, unless the advert asks for one.',null,null,'photo');
    else add('R10','read','tip',nameIdx,'Photo','Photos are normal in some countries and frowned on in others. Check what\'s usual where you\'re applying.',null,null,null,'photo');
  }

  // L3 columns (PDF only)
  if(meta.cols) add('L3','read','tip',-1,'Two columns','Some systems read two columns in the wrong order. One column is safer.',null);

  // Job advert checks
  const ad = (advert||'').trim();
  if(ad){
    const adLow = ad.toLowerCase(), keyLine = keyDetails(ans).toLowerCase(), cvAll = all+' '+keyLine;
    const req = [
      {re:/driving licen[cs]e|full (clean )?licen[cs]e|full irish licen[cs]e/, have:/driv|licen[cs]e/, name:'a full driving licence', ok:ans.licence==='full'},
      {re:/right to work|eligible to work|work permit|stamp 4|eu citizen|permission to work/, have:/eligible to work|right to work|stamp 4|work permit|eu citizen/, name:'the right to work here', ok:ans.work==='yes'},
      {re:/\b(degree|bachelor|honours|level [5-9]|qqi)\b/, have:/degree|bachelor|honours|level [5-9]|qqi|certificate|diploma/, name:'the qualification it lists', ok:false},
      {re:/\bgarda vett|police check|dbs check|access ?ni\b/, have:/vett|police check|dbs|access ?ni/, name:'vetting', ok:false}
    ];
    req.forEach(r=>{ if(r.re.test(adLow) && !r.have.test(cvAll) && !r.ok)
      add('J1','job','fix',-1,'Must-have not mentioned',`This job asks for ${r.name}. If you have it, say so on your CV.`,'Do you have it? Answer below or add a line.'); });
    let want = SKILLS.filter(s=>s!=='driving' && new RegExp('\\b'+s+'\\b').test(adLow) && !new RegExp('\\b'+s+'\\b').test(cvAll));
    want = want.filter(s=>!want.some(o=>o!==s && o.includes(s)));
    if(want.length){ const q=want.map(x=>'"'+x+'"'); const list = q.length>1?q.slice(0,-1).join(', ')+' and '+q[q.length-1]:q[0];
      add('J2','job','fix',-1,'Skills asked for, not shown',`The advert asks for ${list}. If you've done ${want.length>1?'these':'this'}, add where.`,'Where did you use each one?'); }
    const title = ad.split('\n')[0].split(/[–\-|,]/)[0].trim();
    if(title && words(title)<=5){ const intro = sumLines.map(([l])=>l.text).join(' ').toLowerCase();
      if(!intro.includes(title.toLowerCase())) add('J3','job','tip',sumLines.length?sumLines[0][1]:nameIdx,'Different job title',`If it's accurate, use their words in your intro: "${title}".`,null); }
    SKILLS.forEach(s=>{ const n=(all.match(new RegExp('\\b'+s+'\\b','g'))||[]).length; if(n>=3 && adLow.includes(s)) add('J4','job','tip',-1,'Too many advert words',`"${s}" appears ${n} times. Use it once, naturally.`,null); });
    // R13 weak match
    const asked = req.filter(r=>r.re.test(adLow)).map(r=>r.have.test(cvAll)||r.ok);
    let askedSk = SKILLS.filter(s=>s!=='driving' && new RegExp('\\b'+s+'\\b').test(adLow)); askedSk = askedSk.filter(s=>!askedSk.some(o=>o!==s && o.includes(s)));
    askedSk.forEach(s=>asked.push(new RegExp('\\b'+s+'\\b').test(cvAll)));
    const have = asked.filter(Boolean).length;
    if(asked.length>=5 && have/asked.length<0.6) add('R13','job','tip',-1,'Weak match to this job',`You show about ${have} of the ${asked.length} things this job asks for. If you have the rest, say so on your CV.`,'Which of the missing things have you done?');
  }
  return {P,F};
}

/* ---------- key details from the quick questions ---------- */
function keyDetails(a){
  const parts=[];
  if(a.work==='yes') parts.push('Eligible to work in '+a.country);
  if(a.licence==='full') parts.push('Full driving licence');
  if(a.town) parts.push('Based in '+a.town+(a.relocate?', open to relocating':''));
  if(a.start==='now') parts.push('Available now'); else if(a.start==='2w') parts.push('Available in 2 weeks'); else if(a.start==='1m') parts.push('Available in 1 month');
  return parts.join(' · ');
}

/* ---------- reading a PDF: keep every word's position so we can mark the real page ---------- */
const DOT = /^[•\-*·▪◦●○■➢►✓\uf0b7\uf0a7]$/;
async function readPdf(data){
  const pdf = await pdfjsLib.getDocument({data, isEvalSupported:false}).promise;
  const pages = [], lines = []; let colRows = 0, photo = false;
  const yr = t=>/\b(19|20)\d{2}\b/.test(t);
  for(let p=1;p<=pdf.numPages;p++){
    const page = await pdf.getPage(p), vp = page.getViewport({scale:1}), tc = await page.getTextContent();
    pages.push({page, w:vp.width, h:vp.height});
    if(p===1){ try{ const ops = await page.getOperatorList(), O = pdfjsLib.OPS; photo = ops.fnArray.some(f=>f===O.paintImageXObject||f===O.paintJpegXObject||f===O.paintInlineImageXObject); }catch(e){} }
    const items = tc.items.filter(it=>it.str!=='').map(it=>{ const [x,y]=vp.convertToViewportPoint(it.transform[4],it.transform[5]); return {s:it.str,x,y,w:it.width||0,h:Math.hypot(it.transform[2],it.transform[3])||it.height||10}; });
    const rows = [];
    items.forEach(it=>{ let r=rows.find(r=>Math.abs(r.y-it.y)<2.5); if(!r){ r={y:it.y,items:[]}; rows.push(r); } r.items.push(it); });
    rows.sort((a,b)=>a.y-b.y).forEach(r=>r.items.sort((a,b)=>a.x-b.x));
    const solid = rows.flatMap(r=>r.items.filter(i=>i.s.trim()));
    if(!solid.length) continue;
    const base = Math.min(...solid.map(i=>i.x)), right = Math.max(...solid.map(i=>i.x+i.w));
    if(lines.length) lines.push({text:'',segs:[]});
    let L = null;
    rows.forEach(r=>{
      let its = r.items.slice(); while(its.length && !its[0].s.trim()) its.shift(); if(!its.length) return;
      let bullet = false;
      if(DOT.test(its[0].s.trim()) && its.length>1){ bullet = true; its.shift(); while(its.length && !its[0].s.trim()) its.shift(); if(!its.length) return; }
      let txt='', segs=[], lastEnd=null, h=0, lastSolid=null;
      const solidIts = its.filter(i=>i.s.trim()), spaced = solidIts.length>=4 && solidIts.filter(i=>i.s.trim().length===1).length/solidIts.length>0.7;
      its.forEach(it=>{
        h=Math.max(h,it.h);
        if(!it.s.trim()){ if(txt && !/\s$/.test(txt) && (!spaced || it.w>it.h*0.45)) txt+=' '; lastEnd=it.x+it.w; return; }
        if(lastSolid && it.x-(lastSolid.x+lastSolid.w) > (right-base)*0.25) colRows++;
        if(lastEnd!==null && txt && !/\s$/.test(txt) && it.x-lastEnd > it.h*(spaced?0.6:0.22)) txt+=' ';
        segs.push({p:p-1,x:it.x,y:it.y,w:it.w,h:it.h,s:txt.length,e:txt.length+it.s.length}); txt+=it.s; lastEnd=it.x+it.w; lastSolid=it;
      });
      txt = txt.replace(/\s+$/,'');
      const x0 = its[0].x, end = lastEnd, heading = !bullet && (capsHeading(txt) || !!headKind(txt));
      const near = L && L.p===p-1 && (r.y - L.y) < h*1.9;
      let sep = null;
      if(L && !bullet && !heading && !L.heading && near && Math.abs(x0-L.tx)<6){
        const ranToEdge = L.end > right - Math.max(24,(right-base)*0.09);
        if((ranToEdge || /^[a-z(]/.test(txt)) && !/[.!?:]$/.test(L.text)) sep = /[A-Za-z]-$/.test(L.text) && /^[A-Za-z]/.test(txt) ? '' : ' ';
        else if(!L.bullet && !yr(L.text) && yr(txt)) sep = ' | ';
      }
      if(sep!==null){
        const off = L.text.length + sep.length; L.text += sep + txt; L.segs.push(...segs.map(g=>({...g,s:g.s+off,e:g.e+off}))); L.y=r.y; L.end=end;
        return;
      }
      const pre = bullet ? '• ' : '';
      L = {text:pre+txt, segs:segs.map(g=>({...g,s:g.s+pre.length,e:g.e+pre.length})), p:p-1, y:r.y, end, tx:x0, bullet, heading};
      lines.push(L);
    });
  }
  return {pdf, pages, lines, text: lines.map(l=>l.text).join('\n'), cols: colRows>5, photo};
}

/* ---------- page state ---------- */
const S = { mode:'text', pdf:null, text:'', advert:'', file:'', cols:false, photo:false, region:'IE',
  ans:{work:'',country:'Ireland',licence:'',town:'',relocate:false,start:''},
  dismissed:new Set(), open:null, sel:null, showTips:false };
let R = null;
const $ = s=>document.querySelector(s);
const esc = s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const gvar = k=>'var('+GROUPS[GI[k]].c+')';
const keyOf = f=>f.rule+'|'+f.line+'|'+f.msg;
const active = ()=>R.F.filter(f=>!S.dismissed.has(keyOf(f)) && (f.level==='fix' || S.showTips));
const fixes = ()=>R.F.filter(f=>f.level==='fix' && !S.dismissed.has(keyOf(f)));
const tips = ()=>R.F.filter(f=>f.level==='tip' && !S.dismissed.has(keyOf(f)));
const LIB = { pdf:'assets/vendor/pdf.min.js', worker:'assets/vendor/pdf.worker.min.js', mammoth:'assets/vendor/mammoth.browser.min.js' };
function loadScript(url){ return new Promise((ok,fail)=>{ if(document.querySelector(`script[src="${url}"]`)) return ok(); const s=document.createElement('script'); s.src=url; s.onload=ok; s.onerror=()=>fail(new Error('Could not load a tool this needs. Check your connection and try again.')); document.head.appendChild(s); }); }
async function pdfLib(){ await loadScript(LIB.pdf); window.pdfjsLib.GlobalWorkerOptions.workerSrc = LIB.worker; return window.pdfjsLib; }

function run(){ R = analyze(S.text, S.advert, S.ans, {cols:S.cols, photo:S.photo, region:S.region}); render(); }

/* ---------- drawing the real PDF pages ---------- */
async function drawPdf(){
  const box = $('#ckPaper'); box.className='ck-paper ck-pdf'; box.innerHTML='<div id="ckKey"></div>';
  const W = Math.min(box.clientWidth || 700, 760), dpr = Math.min(window.devicePixelRatio||1, 2);
  for(const [i,pg] of S.pdf.pages.entries()){
    const div=document.createElement('div'); div.className='ck-pg';
    const c=document.createElement('canvas'); const vp=pg.page.getViewport({scale:W/pg.w*dpr});
    c.width=Math.floor(vp.width); c.height=Math.floor(vp.height); c.setAttribute('role','img'); c.setAttribute('aria-label','Page '+(i+1)+' of your CV');
    const ov=document.createElement('div'); ov.className='ck-ov';
    div.append(c,ov); box.appendChild(div);
    await pg.page.render({canvasContext:c.getContext('2d'), viewport:vp}).promise;
  }
}
function rectsFor(line,a,b){
  const out=[]; (S.pdf.lines[line]?.segs||[]).forEach(g=>{ const s=Math.max(a,g.s), e=Math.min(b,g.e); if(e<=s) return;
    const n=g.e-g.s||1; out.push({p:g.p, x:g.x+g.w*(s-g.s)/n, w:g.w*(e-s)/n, y:g.y, h:g.h}); });
  return out;
}
function renderOverlay(){
  const A=active(), ovs=[...document.querySelectorAll('#ckPaper .ck-ov')]; if(!ovs.length) return;
  const parts=ovs.map(()=>[]), pg=S.pdf.pages;
  const pct=(p,v,d)=>(v/(d==='w'?pg[p].w:pg[p].h)*100).toFixed(3)+'%';
  const box=(r,cls,f)=>`<span class="${cls}" data-f="${f.id}" style="--g:${gvar(f.group)};left:${pct(r.p,r.x,'w')};top:${pct(r.p,r.y-r.h*0.92,'h')};width:${pct(r.p,r.w,'w')};height:${pct(r.p,r.h*1.25,'h')}"></span>`;
  const byLine={};
  A.forEach(f=>{ if(f.line<0) return; (byLine[f.line]=byLine[f.line]||[]).push(f);
    const L=S.pdf.lines[f.line]; if(!L||!L.segs.length||f.insert) return;
    const ranges=f.span?(Array.isArray(f.span[0])?f.span:[f.span]):[[0,L.text.length]];
    ranges.forEach(([a,b])=>rectsFor(f.line,a,b).forEach(r=>parts[r.p].push(box(r,'ck-r'+(S.sel===f.id?' sel':''),f)))); });
  Object.entries(byLine).forEach(([li,fs])=>{
    const L=S.pdf.lines[li]; if(!L||!L.segs.length) return; const last=L.segs[L.segs.length-1]; let x=last.x+last.w+3;
    [...new Set(fs.filter(f=>!f.insert).map(f=>f.group))].sort((a,b)=>GI[a]-GI[b]).forEach(g=>{ parts[last.p].push(`<span class="ck-b" style="--g:${gvar(g)};left:${pct(last.p,x,'w')};top:${pct(last.p,last.y-last.h*0.6,'h')}">${GI[g]+1}</span>`); x+=13; });
    fs.filter(f=>f.insert).forEach(f=>{ parts[last.p].push(`<button type="button" class="ck-ins${S.sel===f.id?' sel':''}" data-f="${f.id}" style="--g:${gvar(f.group)};left:${pct(last.p,x+4,'w')};top:${pct(last.p,last.y-last.h*0.95,'h')}">${esc(f.insert)}</button>`); x+=60; });
  });
  ovs.forEach((ov,i)=>ov.innerHTML=parts[i].join(''));
  const key=keyDetails(S.ans), k=$('#ckKey');
  if(k){ k.className=key?'ck-keynote':''; k.innerHTML=key?`<b>Add this under your contact details:</b> <span id="ckKeyText">${esc(key)}</span> <button type="button" id="ckCopy">Copy</button>`:'';
    const cb=$('#ckCopy'); if(cb) cb.onclick=()=>{ navigator.clipboard.writeText(key).then(()=>cb.textContent='Copied',()=>{ const r=document.createRange(); r.selectNodeContents($('#ckKeyText')); const s=getSelection(); s.removeAllRanges(); s.addRange(r); cb.textContent='Selected'; }); }; }
}

/* ---------- plain-text view (Word, text, pasted) ---------- */
function renderText(){
  const box=$('#ckPaper'); box.className='ck-paper ck-txt';
  const A=active(), by={}; A.forEach(f=>{ if(f.line>=0) (by[f.line]=by[f.line]||[]).push(f); });
  const L=R.P.lines; let html='', lastTop=-1; L.forEach((l,i)=>{ if(l.section==='top'&&l.kind!=='blank') lastTop=i; });
  const key=keyDetails(S.ans);
  L.forEach((l,i)=>{
    if(l.kind==='blank'){ html+='<div class="ck-ln k-blank"></div>'; return; }
    const fs=by[i]||[], spans=[];
    fs.filter(f=>f.span).forEach(f=>(Array.isArray(f.span[0])?f.span:[f.span]).forEach(sp=>spans.push({f,sp})));
    spans.sort((a,b)=>a.sp[0]-b.sp[0]);
    const whole=fs.filter(f=>!f.span&&!f.insert); let body='', pos=0;
    spans.forEach(({f,sp})=>{ const [s,e]=sp; if(s<pos) return; body+=esc(l.text.slice(pos,s))+`<mark class="ck-ph${S.sel===f.id?' sel':''}" style="--g:${gvar(f.group)}" data-f="${f.id}">${esc(l.text.slice(s,e))}</mark>`; pos=e; });
    body+=esc(l.text.slice(pos));
    if(whole.length){ const w=whole[0]; body=`<span class="ck-hl${whole.some(f=>f.id===S.sel)?' sel':''}" style="--g:${gvar(w.group)}" data-f="${w.id}">${body}</span>`; }
    body+=[...new Set(fs.filter(f=>!f.insert).map(f=>f.group))].sort((a,b)=>GI[a]-GI[b]).map(g=>`<sup class="ck-tag" style="--g:${gvar(g)}">${GI[g]+1}</sup>`).join('');
    body+=fs.filter(f=>f.insert).map(f=>`<button type="button" class="ck-ins ck-ins-inline${S.sel===f.id?' sel':''}" style="--g:${gvar(f.group)}" data-f="${f.id}">${esc(f.insert)}</button>`).join('');
    html+=`<div class="ck-ln k-${l.kind}">${body}</div>`;
    if(i===lastTop && key) html+=`<div class="ck-added"><span>${esc(key)}</span><small>Added from your answers</small></div>`;
  });
  box.innerHTML=html;
}

/* ---------- side panel ---------- */
function latestJobRange(){ const J=R.P.jobs, j0=J[0]; if(!j0) return [-1,-1]; return [j0.head, J[1]?J[1].head:Math.max(j0.head,...j0.bullets,...j0.paras)+1]; }
function fixOrder(){ const [a,b]=latestJobRange(); const pri=f=>(f.line>=a&&f.line<b)?-1:(f.line<0?1e6:f.line); return fixes().slice().sort((x,y)=>pri(x)-pri(y)); }
function renderSummary(){
  const n=fixes().length, t=tips().length, order=fixOrder(), idx=order.findIndex(f=>f.id===S.sel);
  const [a,b]=latestJobRange(), latest=order.some(f=>f.line>=a&&f.line<b);
  let label='Start fixing'; if(idx>=0) label= idx===order.length-1 ? 'Back to the first fix' : `Next fix (${idx+2} of ${order.length})`;
  $('#ckSummary').innerHTML = n ? `<h2 class="ck-count">${n} quick ${n===1?'fix':'fixes'}</h2>
      <p>Most take under a minute.${latest?' We start with your latest job, because recruiters look there first.':''}${t?` Then look at ${t} ${t===1?'tip':'tips'}.`:''}</p>
      <button type="button" class="btn btn-primary ck-go" id="ckGo">${label}</button>`
    : `<h2 class="ck-count">No fixes needed</h2><p>Nice work.${t?` There ${t===1?'is':'are'} ${t} optional ${t===1?'tip':'tips'} below.`:''}</p>`;
  const go=$('#ckGo'); if(go) go.onclick=()=>select(order[(idx+1)%order.length].id);
}
function renderGroups(){
  const A=active(), by={}; A.forEach(f=>(by[f.group]=by[f.group]||[]).push(f));
  const shown=GROUPS.filter(g=>by[g.k]);
  let html='<p class="ck-lab">What to fix</p>';
  if(!shown.length) html+='<p class="ck-empty">Everything we check looks good.</p>';
  shown.forEach(g=>{
    const list=by[g.k].sort((a,b)=>(a.line<0?1e6:a.line)-(b.line<0?1e6:b.line)), open=S.open===g.k;
    html+=`<div class="ck-grp${open?' open':''}" style="--g:var(${g.c})"><button type="button" data-g="${g.k}" aria-expanded="${open}"><span class="ck-chip">${GI[g.k]+1}</span><span class="ck-t"><b>${g.title}</b><span>${g.sub}</span></span><span class="ck-n">${list.length}</span></button>`;
    if(open) html+='<div class="ck-items">'+list.map(f=>{ const q=f.line>=0?R.P.lines[f.line].text:(f.group==='job'?'From the job advert':'Whole CV');
      return `<div class="ck-it${S.sel===f.id?' on':''}" id="ck-it-${f.id}"><button type="button" class="ck-q" data-f="${f.id}">${esc(q.length>90?q.slice(0,88)+'…':q)}</button>${f.level==='tip'?'<span class="ck-lvl">Tip</span>':''}<span class="ck-msg">${esc(f.msg)}</span>${f.need?`<span class="ck-need"><b>We need to know:</b> ${esc(f.need)}</span>`:''}${f.better?`<span class="ck-better"><b>Better:</b> ${esc(f.better)}</span>`:''}<button type="button" class="ck-dis" data-d="${esc(keyOf(f))}">This doesn't apply to me</button></div>`; }).join('')+'</div>';
    html+='</div>';
  });
  const t=tips().length;
  if(t) html+=`<div class="ck-row"><span>${S.showTips?`Showing ${t} optional ${t===1?'tip':'tips'}`:`${t} optional ${t===1?'tip':'tips'} hidden`}</span><button type="button" id="ckTips">${S.showTips?'Hide tips':'Show tips'}</button></div>`;
  if(S.dismissed.size) html+=`<div class="ck-row"><span>${S.dismissed.size} dismissed</span><button type="button" id="ckUndo">Bring back</button></div>`;
  const box=$('#ckGroups'); box.innerHTML=html;
  box.querySelectorAll('.ck-grp>button').forEach(b=>b.onclick=()=>{ S.open=S.open===b.dataset.g?null:b.dataset.g; S.sel=null; render(); });
  box.querySelectorAll('.ck-q').forEach(b=>b.onclick=()=>select(b.dataset.f));
  box.querySelectorAll('.ck-dis').forEach(b=>b.onclick=()=>{ S.dismissed.add(b.dataset.d); S.sel=null; render(); });
  const tb=$('#ckTips'); if(tb) tb.onclick=()=>{ S.showTips=!S.showTips; render(); };
  const ub=$('#ckUndo'); if(ub) ub.onclick=()=>{ S.dismissed.clear(); render(); };
}
function seg(name,opts){ return '<div class="ck-seg" role="group">'+opts.map(([v,l])=>`<button type="button" data-a="${name}" data-v="${v}" aria-pressed="${S.ans[name]===v}">${l}</button>`).join('')+'</div>'; }
function renderElig(){
  const a=S.ans, done=[a.work,a.licence,a.town,a.start].filter(Boolean).length;
  const topL=(R&&R.P)?R.P.lines.filter(l=>l.section==='top').map(l=>l.text).join(' ').toLowerCase():'';
  const onCv=PLACES.find(p=>new RegExp('\\b'+p+'\\b').test(topL));
  const townQ=onCv?`<div class="ck-q2"><span>Where are you based?</span><span class="ck-oncv">${esc(onCv.charAt(0).toUpperCase()+onCv.slice(1))} is already on your CV.</span></div>`:`<div class="ck-q2"><span>Where are you based?</span><div class="ck-inl"><input type="text" id="ckTown" placeholder="Town or county" value="${esc(a.town)}" aria-label="Town or county"><label class="ck-inl"><input type="checkbox" id="ckReloc"${a.relocate?' checked':''}> Open to relocating</label></div></div>`;
  $('#ckElig').innerHTML=`<h2>Employers ask these first</h2>
    <p>Many job sites ask yes or no questions before anyone reads your CV. Put the answers on your CV too, so nobody has to guess.</p>
    <div class="ck-q2"><span>Can you work in <select id="ckCountry" aria-label="Country">${['Ireland','the UK','the EU'].map(c=>`<option${a.country===c?' selected':''}>${c}</option>`).join('')}</select> without a visa?</span>${seg('work',[['yes','Yes'],['visa',"I'll need a visa"],['skip','Skip']])}</div>
    <div class="ck-q2"><span>Do you have a driving licence?</span>${seg('licence',[['full','Full licence'],['learner','Learner permit'],['none','No']])}</div>
    ${townQ}
    <div class="ck-q2"><span>When can you start?</span>${seg('start',[['now','Now'],['2w','2 weeks'],['1m','1 month']])}</div>
    <p class="ck-ok">${done?`${done} of 4 answered. We only add the answers that help you.`:'We only add answers that help you. Nothing negative goes on your CV.'}</p>`;
  $('#ckElig').querySelectorAll('.ck-seg button').forEach(b=>b.onclick=()=>{ S.ans[b.dataset.a]=S.ans[b.dataset.a]===b.dataset.v?'':b.dataset.v; run(); });
  $('#ckCountry').onchange=e=>{ S.ans.country=e.target.value; run(); };
  const rl=$('#ckReloc'); if(rl) rl.onchange=e=>{ S.ans.relocate=e.target.checked; run(); };
  const tn=$('#ckTown'); if(tn) tn.onchange=e=>{ S.ans.town=e.target.value.trim(); run(); };
}
function render(){
  if(S.mode==='pdf'&&S.pdf) renderOverlay(); else renderText();
  renderSummary(); renderGroups(); renderElig();
  $('#ckPaper').querySelectorAll('[data-f]').forEach(el=>el.onclick=e=>{ e.stopPropagation(); select(el.dataset.f); });
}
function select(id){
  const f=R.F.find(x=>x.id===id); if(!f) return;
  S.sel=id; S.open=f.group; if(f.level==='tip') S.showTips=true; render();
  const smooth=matchMedia('(prefers-reduced-motion: no-preference)').matches?'smooth':'auto';
  const el=$('#ckPaper').querySelector(`[data-f="${id}"]`);
  if(el) el.scrollIntoView({block:'center',behavior:smooth});
  else { const it=document.getElementById('ck-it-'+id); if(it) it.scrollIntoView({block:'nearest',behavior:smooth}); }
}

/* ---------- loading a CV ---------- */
function showReport(name){
  $('#ckReport').hidden=false; $('#ckFile').textContent=name; S.dismissed.clear(); S.sel=null; S.open=null;
}
async function openPdf(data,name){
  showReport(name); $('#ckPaper').className='ck-paper'; $('#ckPaper').innerHTML='<p class="ck-loading">Reading your CV…</p>';
  const lib=await pdfLib(); const r=await readPdf(data);
  if(r.text.replace(/\s/g,'').length<200){ S.mode='text'; S.pdf=null; } else { S.mode='pdf'; S.pdf=r; }
  S.text=r.text; S.cols=r.cols; S.photo=r.photo; $('#ckHasPhoto').checked=r.photo;
  if(S.mode==='pdf') await drawPdf();
  run();
}
function openText(text,name,photo){ showReport(name); S.mode='text'; S.pdf=null; S.text=text; S.cols=false; S.photo=!!photo; run(); }
async function readFile(file){
  const note=$('#ckNote'); note.textContent='Reading '+file.name+'…';
  try{
    if($('#ckAd').value===SAMPLE_AD) $('#ckAd').value=''; S.advert=$('#ckAd').value;
    if(/\.pdf$/i.test(file.name)){ await openPdf(new Uint8Array(await file.arrayBuffer()), file.name); }
    else if(/\.docx$/i.test(file.name)){
      await loadScript(LIB.mammoth); const buf=await file.arrayBuffer();
      const text=(await mammoth.extractRawText({arrayBuffer:buf})).value; let photo=false;
      try{ photo=/<img/i.test((await mammoth.convertToHtml({arrayBuffer:buf})).value); }catch(e){}
      openText(text,file.name,photo); $('#ckHasPhoto').checked=photo;
      note.textContent='Word files show as a simple copy. For an exact view of your layout, upload a PDF.';
    } else if(/\.doc$/i.test(file.name)){ throw new Error('Old .doc files can\'t be read. Save it as .docx or PDF and try again.'); }
    else { openText(await file.text(), file.name, false); }
    if(!/Word files/.test(note.textContent)) note.textContent='';
    $('#ckReport').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(err){ note.textContent=err.message||'We couldn\'t read that file. Try a PDF, or paste the text.'; }
}
async function openSample(){
  $('#ckAd').value=SAMPLE_AD; S.advert=SAMPLE_AD; $('#ckNote').textContent='';
  try{ const r=await fetch('assets/sample-cv.pdf'); await openPdf(new Uint8Array(await r.arrayBuffer()),'Example CV: Sarah Byrne'); }
  catch(e){ $('#ckNote').textContent='The example could not load. Please try again.'; return; }
  $('#ckReport').scrollIntoView({behavior:'smooth',block:'start'});
}

/* ---------- wiring ---------- */
function init(){
  const drop=$('#ckDrop'); if(!drop) return;
  $('#ckFileInput').onchange=e=>{ const f=e.target.files[0]; if(f) readFile(f); e.target.value=''; };
  ['dragover','dragenter'].forEach(t=>drop.addEventListener(t,e=>{ e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave','drop'].forEach(t=>drop.addEventListener(t,e=>{ e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop',e=>{ const f=e.dataTransfer.files[0]; if(f) readFile(f); });
  $('#ckSample').onclick=openSample;
  $('#ckPasteForm').addEventListener('submit',e=>{ e.preventDefault(); const t=$('#ckText').value.trim(); S.advert=$('#ckAd').value; S.photo=$('#ckHasPhoto').checked;
    if(S.mode==='pdf' && S.pdf && !t){ run(); return; }
    if(!t){ $('#ckNote').textContent='Paste your CV text first, or drop a file above.'; return; }
    openText(t,'Your CV (pasted)',S.photo); $('#ckReport').scrollIntoView({behavior:'smooth',block:'start'}); });
  $('#ckAgain').onclick=()=>{ window.scrollTo({top:0,behavior:'smooth'}); };
  $('#ckRegion').onchange=e=>{ S.region=e.target.value; const c={IE:'Ireland',UK:'the UK',EU:'the EU'}[S.region]; if(c) S.ans.country=c; S.sel=null; if(R) run(); };
  if(location.hash==='#example') openSample();
}
window.UCVCheck = { analyze, parseCV, keyDetails };
init();
})();
