/* Morning Grind — app logic (local-first PWA) */
'use strict';

const $ = (s, r=document) => r.querySelector(s);
const store = {
  get(k, d){ try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
};
const keyOf = (d=new Date()) => { const t=new Date(d); t.setMinutes(t.getMinutes()-t.getTimezoneOffset()); return t.toISOString().slice(0,10); };
const fmtDate = (d) => d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
const target = (e) => (Number.isInteger(+e.sets) && +e.sets>0) ? +e.sets : 1;
const demoURL = (name) => 'https://www.youtube.com/results?search_query=' + encodeURIComponent('how to ' + name + ' proper form');
const fmtLoad = (l) => /^\+?\d+(\.\d+)?$/.test(String(l)) ? l+' lb' : String(l);
const SPOTIFY_ICON = `<svg class="sp" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#1DB954"/><path fill="#fff" d="M17.6 10.8c-2.9-1.7-7.7-1.9-10.5-1.05-.45.14-.93-.12-1.06-.57-.14-.45.12-.93.57-1.06 3.2-.97 8.5-.78 11.83 1.2.4.24.53.76.29 1.16-.24.4-.76.53-1.13.32zm-.1 2.6c-.2.33-.63.44-.96.24-2.42-1.49-6.11-1.92-8.98-1.05-.37.11-.76-.1-.87-.47-.11-.37.1-.76.47-.87 3.28-1 7.35-.52 10.13 1.19.32.2.43.63.21.96zm-1.11 2.5c-.16.26-.5.35-.76.19-2.11-1.29-4.77-1.58-7.9-.87-.3.07-.6-.12-.67-.42-.07-.3.12-.6.42-.67 3.42-.78 6.37-.44 8.74 1 .27.16.35.5.17.77z"/></svg>`;

const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function avatarEl(prof, cls){ const sz={prof:52, fc:44, disc:38, hero:78}[cls]||40;
  if(prof && prof.avatar) return `<img class="av" src="${prof.avatar}" alt="" style="width:${sz}px;height:${sz}px" />`;
  return `<span class="${cls}-emoji">${(prof&&prof.emoji)||'💪'}</span>`; }
function resizeImage(file, size, cb){
  const img=new Image(), url=URL.createObjectURL(file);
  img.onload=()=>{ const c=document.createElement('canvas'); c.width=c.height=size; const ctx=c.getContext('2d');
    const s=Math.min(img.width,img.height), sx=(img.width-s)/2, sy=(img.height-s)/2;
    ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size); URL.revokeObjectURL(url);
    try{ cb(c.toDataURL('image/jpeg',0.82)); }catch(e){ cb(null); } };
  img.onerror=()=>{ URL.revokeObjectURL(url); cb(null); };
  img.src=url; }

let LOGS = store.get('mg_logs', {});
let WEIGHTS = store.get('mg_weights', []);
let PRS = store.get('mg_prs', []);
let TAB = 'today';
let FEEDSUB = 'feed';
let WEATHER = null;

const today = new Date();
const todayKey = keyOf(today);
let session = SPLIT[today.getDay()]; // recomputed each render (honors a chosen override)

function sessionFor(k){
  const l = LOGS[k];
  if(l && l.sessionOverride==='__ai__' && l.customSession) return l.customSession;
  const ov = l && l.sessionOverride;
  if(ov && typeof SESSIONS!=='undefined' && SESSIONS[ov]) return SESSIONS[ov];
  return SPLIT[new Date(k+'T12:00').getDay()];
}
function ensureLog(k){
  if(!LOGS[k]) LOGS[k] = { done:false, sets:[] };
  if(!LOGS[k].sets) LOGS[k].sets = [];
  if(!LOGS[k].swaps) LOGS[k].swaps = {};
  const n = sessionFor(k).ex.length + ((LOGS[k].addedEx&&LOGS[k].addedEx.length)||0);
  while(LOGS[k].sets.length < n) LOGS[k].sets.push(0);
  return LOGS[k];
}
// Resolve the effective exercise for slot i (applies any swap chosen today)
function addedFor(k){ return (LOGS[k] && LOGS[k].addedEx) || []; }
function effList(){ return session.ex.concat(addedFor(todayKey)); }
function isRemoved(i){ return !!(LOGS[todayKey] && LOGS[todayKey].removedEx && LOGS[todayKey].removedEx[i]); }
function workoutName(){ return (LOGS[todayKey] && LOGS[todayKey].customName) || session.title; }
function resolvedEx(i){
  const base = session.ex;
  if(i >= base.length){
    const a = addedFor(todayKey)[i-base.length] || {name:'Exercise',sets:1,reps:'',load:'',rpe:'-'};
    return Object.assign({}, a, { g:'', rpe:a.rpe||'-', _added:true, _swapped:false, _nopts:1 });
  }
  const e = base[i];
  const cust = LOGS[todayKey].customEx && LOGS[todayKey].customEx[i];
  if(cust){ return Object.assign({}, e, { name:cust.name, sets:cust.sets, reps:cust.reps, load:cust.load, rpe:cust.rpe||'-', g:'', _custom:true, _swapped:false, _nopts:1 }); }
  const opts = optionsFor(e);
  const idx = (LOGS[todayKey].swaps && LOGS[todayKey].swaps[i]) || 0;
  const pick = opts[Math.min(idx, opts.length-1)] || {name:e.name, load:e.load};
  return Object.assign({}, e, { name:pick.name, load:pick.load, _swapped: idx>0, _nopts: opts.length });
}
function save(){ store.set('mg_logs', LOGS); store.set('mg_weights', WEIGHTS); store.set('mg_prs', PRS); if(window.MGSync) window.MGSync.onLocalChange(); }

/* ---------- stats ---------- */
function streak(){
  let s = 0;
  for(let i=0;i<400;i++){
    const d = new Date(today); d.setDate(d.getDate()-i);
    const k = keyOf(d);
    if(i===0 && !(LOGS[k] && LOGS[k].done)) continue;
    if(LOGS[k] && LOGS[k].done) s++; else break;
  }
  return s;
}
function monthCount(){ const ym=todayKey.slice(0,7); return Object.keys(LOGS).filter(k=>k.startsWith(ym)&&LOGS[k].done).length; }
function weekDone(){ let n=0; for(let i=0;i<7;i++){ const d=new Date(today); d.setDate(d.getDate()-i); const k=keyOf(d); if(LOGS[k]&&LOGS[k].done) n++; } return n; }
function streakFromDates(dates){ const set=new Set(dates); let s=0;
  for(let i=0;i<400;i++){ const d=new Date(today); d.setDate(d.getDate()-i); const k=keyOf(d);
    if(i===0 && !set.has(k)) continue; if(set.has(k)) s++; else break; } return s; }
function latestWeight(){ return WEIGHTS.length ? WEIGHTS[WEIGHTS.length-1].w : null; }
function avg7(){
  const cut=new Date(today); cut.setDate(cut.getDate()-7);
  const r=WEIGHTS.filter(x=>new Date(x.date)>=cut);
  return r.length ? r.reduce((a,b)=>a+b.w,0)/r.length : null;
}

/* ---------- theme (light / dark) ---------- */
function applyThemeIcon(){ const b=document.getElementById('themeToggle'); if(b) b.textContent = document.documentElement.getAttribute('data-theme')==='light' ? '☀️' : '🌙'; }
function toggleTheme(){
  const light = document.documentElement.getAttribute('data-theme')==='light';
  if(light) document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme','light');
  try{ localStorage.setItem('mg_theme', light ? 'dark' : 'light'); }catch{}
  const m=document.querySelector('meta[name=theme-color]'); if(m) m.setAttribute('content', light ? '#0a0d14' : '#eef2f9');
  applyThemeIcon();
}

/* ---------- rendering ---------- */
function render(){
  session = sessionFor(todayKey);
  const _h=new Date().getHours(), _g=_h<12?'Good morning':_h<18?'Good afternoon':'Good evening';
  const _raw=(window.MGSync&&MGSync.displayName)?MGSync.displayName():'';
  const _nm=_raw?_raw.trim().split(/\s+/)[0].replace(/^\w/,c=>c.toUpperCase()):'';
  $('#hdrDate').textContent = 'MORNING GRIND';
  $('#hdrTitle').textContent = TAB==='today' ? (_g+(_nm?(', '+_nm):'')) : (TAB==='progress' ? 'Progress' : 'Friends');
  $('#hdrStreak').textContent = '🔥 ' + streak();
  applyThemeIcon();
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===TAB));
  $('#view').innerHTML = TAB==='today' ? viewToday() : TAB==='progress' ? viewProgress() : viewFeed();
  if(TAB==='today'){ wireToday(); paintWeather(); } else if(TAB==='progress'){ wireProgress(); } else { wireFeed(); }
}

function viewToday(){
  const log = ensureLog(todayKey);
  const o = openerFor(today);
  let totT=0, totD=0;
  const removedList=[];
  const rows = effList().map((_,i)=>{
    if(isRemoved(i)){ removedList.push({i, name:resolvedEx(i).name}); return ''; }
    const e = resolvedEx(i);
    const tg=target(e), done=Math.min(log.sets[i]||0,tg); totT+=tg; totD+=done;
    const dots = Array.from({length:tg},(_,j)=>`<span class="dot ${j<done?'on':''}" data-ex="${i}" data-dot="${j}"></span>`).join('');
    const scheme = Number.isInteger(+e.reps) ? `${e.sets} sets × ${e.reps} reps` : `${e.reps}`;
    return `
    <div class="ex ${done>=tg?'ex-done':''}">
      <div class="ex-main">
        <div class="ex-name">${e.name}${e._added?' <span class="swapped">added</span>':(e._custom?' <span class="swapped">custom</span>':(e._swapped?' <span class="swapped">swapped</span>':''))}</div>
        <div class="ex-meta">${scheme}${e.rpe && e.rpe!=='-' ? ' · RPE '+e.rpe : ''} · <a class="demo" href="${demoURL(e.name)}" target="_blank" rel="noopener">▶ how-to</a></div>
        <div class="dots">${dots}</div>
      </div>
      <div class="ex-right">
        <div class="ex-load-wrap"><span class="ex-load-cap">LOAD</span><span class="ex-load">${fmtLoad(e.load)}</span></div>
        <div class="ex-btns">
          ${e._nopts>1?`<button class="ex-swap" data-swap="${i}" title="Swap for a similar exercise">🔀</button>`:''}
          <button class="ex-edit" data-edit="${i}" title="Customize this exercise">✏️</button>
          <button class="ex-del" data-remove="${i}" title="Remove this exercise">🗑️</button>
          <button class="ex-timer" data-timer title="Rest timer">⏱️</button>
        </div>
      </div>
    </div>`;
  }).join('');
  const pct = totT ? Math.round(100*totD/totT) : 0;
  const st=streak(), wd=weekDone(), ovC = pct>=100?'#28d98a':'#4f83ff';
  const ov = `
    <div class="card ov">
      <div class="ov-title">Overview</div>
      <div class="ov-rings">
        <div class="ov-ring ov-sm" style="--p:${Math.min(st,7)/7*100}; --c:#f59e0b">
          <div class="ov-ctr"><b>${st}</b><small>🔥 STREAK</small></div>
        </div>
        <div class="ov-ring ov-big" style="--p:${pct}; --c:${ovC}">
          <div class="ov-ctr"><b>${pct}<i>%</i></b><small>TODAY</small></div>
        </div>
        <div class="ov-ring ov-sm" style="--p:${wd/7*100}; --c:#28d98a">
          <div class="ov-ctr"><b>${wd}<i>/7</i></b><small>THIS WK</small></div>
        </div>
      </div>
    </div>`;
  const w=latestWeight(), a=avg7();
  const wLine = w!=null ? `⚖️ ${w} lb${a!=null?` · 7-day avg ${a.toFixed(1)}`:''} · target 158`
                        : 'No weight logged yet — add tonight’s below to start your chart.';
  return `
    ${ov}
    <div class="card">
      <div class="verse">${o.verse}<span class="ref">— ${o.ref}</span></div>
      <div class="why">💭 <b>Why this matters:</b> ${o.why}</div>
      <div class="song">${SPOTIFY_ICON} <b>Song of the day:</b> <a href="${spotifySearch(o)}" target="_blank" rel="noopener">${o.song} — ${o.artist}</a></div>
    </div>
    <div class="card weather-card" id="weatherCard"><span class="hint">Loading weather…</span></div>
    <div class="card">
      <div class="wk-head">
        <div style="flex:1; min-width:0">
          <div class="wk-title" id="wkTitle" title="Tap to rename">${esc(workoutName())} <span class="wk-rename">✏️</span></div>
          ${(LOGS[todayKey]&&(LOGS[todayKey].sessionOverride||LOGS[todayKey].customName))?`<div class="wk-sub">${LOGS[todayKey].sessionOverride?'<span class="wk-swapped">'+(LOGS[todayKey].sessionOverride==='__ai__'?'🤖 AI':'changed')+'</span>':''}${LOGS[todayKey].customName?'<span class="wk-swapped">renamed</span>':''}</div>`:''}
        </div>
        <span class="wk-count">${totD}/${totT} sets</span>
      </div>
      ${session.aiNote?`<div class="ai-note">🤖 <b>Coach:</b> ${session.aiNote}</div>`:''}
      <div class="cbum">🏆 <b>Inspired by Chris Bumstead</b> — “CBum,” the 6× Classic Physique Mr. Olympia (2019–2024) and the most decorated champion the division has ever had. Every session borrows his golden-era approach: controlled tempo, full-range reps, and balanced, aesthetic development over ego lifting.</div>
      <button class="wk-change" id="changeWk">🔄 Change today’s workout</button>
      <div class="progress-wrap"><div class="progress-bar" style="width:${pct}%"></div></div>
      ${rows}
      <button class="wk-add" id="addEx">＋ Add an exercise</button>
      ${removedList.length?`<div class="removed-note">🗑️ Removed: ${removedList.map(r=>`<button data-restore="${r.i}">${esc(r.name)} ↩︎</button>`).join('')}</div>`:''}
    </div>
    <button class="btn btn-primary ${log.done?'done':''}" id="completeBtn">${log.done?'✅ Completed · shared to your feed':'Finish & post to feed'}</button>
    ${log.done?debriefCardHTML(log):''}
    <div class="card" style="margin-top:14px">
      <div class="section-title">⚖️ Tonight’s Weight</div>
      <div class="qlog">
        <input id="wInput" type="number" inputmode="decimal" step="0.1" placeholder="e.g. 158.4" />
        <button id="wSave">Log</button>
      </div>
      <div class="hint">${wLine}</div>
    </div>
    ${marketsCard()}`;
}

function wireToday(){
  const log = ensureLog(todayKey);
  document.querySelectorAll('.dot').forEach(dot=>{
    dot.onclick = ()=>{ const i=+dot.dataset.ex, j=+dot.dataset.dot;
      log.sets[i] = (j+1===log.sets[i]) ? j : j+1;
      log.done = effList().every((e,k)=> isRemoved(k) || (log.sets[k]||0) >= target(resolvedEx(k)));
      save(); render(); };
  });
  document.querySelectorAll('[data-swap]').forEach(b=> b.onclick=()=>{
    const i=+b.dataset.swap; const opts=optionsFor(session.ex[i]);
    if(opts.length<2) return toast('No alternatives for this one');
    const cur=log.swaps[i]||0; let next=cur; let guard=0;
    while(next===cur && guard++<20) next=Math.floor(Math.random()*opts.length);
    log.swaps[i]=next; save(); render(); toast('🔀 '+opts[next].name);
  });
  document.querySelectorAll('[data-timer]').forEach(b=> b.onclick=()=>startRest(90));
  document.querySelectorAll('[data-edit]').forEach(b=> b.onclick=()=>openExEdit(+b.dataset.edit));
  document.querySelectorAll('[data-remove]').forEach(b=> b.onclick=()=>{
    const i=+b.dataset.remove, baseLen=session.ex.length;
    if(i>=baseLen){ if(log.addedEx) log.addedEx.splice(i-baseLen,1); if(log.sets) log.sets.splice(i,1); }
    else { if(!log.removedEx) log.removedEx={}; log.removedEx[i]=1; }
    save(); render(); toast('🗑️ Removed'); });
  { const ae=$('#addEx'); if(ae) ae.onclick=openExAdd; }
  { const wt=$('#wkTitle'); if(wt) wt.onclick=openRename; }
  document.querySelectorAll('[data-restore]').forEach(b=> b.onclick=()=>{ const i=+b.dataset.restore;
    if(log.removedEx) delete log.removedEx[i]; save(); render(); toast('↩︎ Restored'); });
  $('#completeBtn').onclick = ()=>{
    if(!log.done){ log.done=true; log.sets = effList().map((e,k)=> isRemoved(k) ? (log.sets[k]||0) : target(resolvedEx(k))); save(); render(); openDebrief(); }
    else { log.done=false; save(); render(); toast('Marked incomplete'); }
  };
  const de = $('#dbEdit') || $('#dbAdd'); if(de) de.onclick = openDebrief;
  const cw = $('#changeWk'); if(cw) cw.onclick = openWorkoutPicker;
  const mkGo=$('#mkGo'); if(mkGo){ mkGo.onclick=lookupTicker; const ti=$('#mkTicker'); if(ti) ti.onkeydown=e=>{ if(e.key==='Enter') lookupTicker(); }; }
  loadMarkets();
  $('#wSave').onclick = ()=>{
    const v=parseFloat($('#wInput').value); if(!v||v<80||v>400) return toast('Enter a valid weight');
    WEIGHTS=WEIGHTS.filter(x=>x.date!==todayKey); WEIGHTS.push({date:todayKey,w:v});
    WEIGHTS.sort((a,b)=>a.date.localeCompare(b.date)); save(); toast('Weight logged 📈'); render();
  };
}

/* ---------- post-workout debrief ---------- */
const FEELS = [['😣','Grind',1],['😮‍💨','Tough',2],['🙂','Solid',3],['💪','Strong',4],['🔥','On fire',5]];
const FEEL_LABEL = {1:'😣 Grind',2:'😮‍💨 Tough',3:'🙂 Solid',4:'💪 Strong',5:'🔥 On fire'};

function debriefCardHTML(log){
  const d = log.debrief;
  if(d){
    const bits = [d.rating?FEEL_LABEL[d.rating]:'', d.effort, d.energy?d.energy+' energy':''].filter(Boolean).join(' · ');
    return `<div class="card"><div class="section-title">📝 Session Debrief</div>
      <div class="db-sum">${bits||'Logged'}</div>
      ${d.notes?`<div class="db-notes">“${d.notes}”</div>`:''}
      <button class="btn btn-ghost" id="dbEdit">Edit debrief</button></div>`;
  }
  return `<div class="card"><div class="section-title">📝 Session Debrief</div>
    <div class="hint">How did it go? Log a quick debrief.</div>
    <button class="btn btn-ghost" id="dbAdd">＋ Add debrief</button></div>`;
}

function openDebrief(k){
  k = k || todayKey;
  const log = ensureLog(k);
  const d = Object.assign({rating:0,effort:'',energy:'',notes:''}, log.debrief||{});
  const chip=(g,v,cur)=>`<button class="chip ${cur===v?'sel':''}" data-g="${g}" data-v="${v}">${v}</button>`;
  const wrap=document.createElement('div'); wrap.className='sheet-backdrop';
  wrap.innerHTML=`<div class="sheet">
    <div class="sheet-handle"></div>
    <div class="sheet-title">Nice work — quick debrief 💪</div>
    <div class="sheet-label">How’d it feel?</div>
    <div class="feels">${FEELS.map(f=>`<button class="feel ${d.rating===f[2]?'sel':''}" data-rating="${f[2]}"><span>${f[0]}</span><small>${f[1]}</small></button>`).join('')}</div>
    <div class="sheet-label">Effort</div>
    <div class="chips">${['Easy','Just right','Brutal'].map(v=>chip('effort',v,d.effort)).join('')}</div>
    <div class="sheet-label">Energy</div>
    <div class="chips">${['Low','Medium','High'].map(v=>chip('energy',v,d.energy)).join('')}</div>
    <div class="sheet-label">Debrief notes</div>
    <textarea id="dbNotes" class="sheet-notes" placeholder="What went well? Anything to tweak? Any tweaks or pain to note?">${d.notes||''}</textarea>
    <button class="btn btn-primary" id="dbSave">Save debrief</button>
    <button class="sheet-skip" id="dbSkip">Skip for now</button>
  </div>`;
  document.body.appendChild(wrap);
  requestAnimationFrame(()=>wrap.classList.add('show'));
  wrap.querySelectorAll('.feel').forEach(b=> b.onclick=()=>{ d.rating=+b.dataset.rating; wrap.querySelectorAll('.feel').forEach(x=>x.classList.toggle('sel', x===b)); });
  wrap.querySelectorAll('.chip').forEach(b=> b.onclick=()=>{ const g=b.dataset.g; d[g]=b.dataset.v; wrap.querySelectorAll(`.chip[data-g="${g}"]`).forEach(x=>x.classList.toggle('sel', x===b)); });
  const close=()=>{ wrap.classList.remove('show'); setTimeout(()=>wrap.remove(),220); };
  wrap.querySelector('#dbSkip').onclick=close;
  wrap.onclick=(e)=>{ if(e.target===wrap) close(); };
  wrap.querySelector('#dbSave').onclick=()=>{ d.notes=wrap.querySelector('#dbNotes').value.trim(); d.at=k; log.debrief=d; save(); close(); render(); toast('Debrief saved 📝'); };
}

/* ---------- customize a single exercise ---------- */
function openExEdit(i){
  const e=resolvedEx(i);
  const baseLen = session.ex.length, isAdded = i >= baseLen;
  const showRemove = isAdded || e._custom || e._swapped;
  const removeLabel = isAdded ? '🗑️ Remove exercise' : '↩︎ Reset to planned';
  const wrap=document.createElement('div'); wrap.className='sheet-backdrop';
  wrap.innerHTML=`<div class="sheet"><div class="sheet-handle"></div>
    <div class="sheet-title">${isAdded?'Edit exercise':'Customize exercise'}</div>
    <div class="hint" style="margin-bottom:4px">Put in any movement you want — your own sets, reps and load.</div>
    <div class="sheet-label">Exercise</div><input id="exName" value="${esc(e.name)}" placeholder="e.g. Hammer Curl" />
    <div class="ex-edit-grid">
      <div><div class="sheet-label">Sets</div><input id="exSets" type="number" inputmode="numeric" min="1" value="${esc(String(e.sets))}" /></div>
      <div><div class="sheet-label">Reps</div><input id="exReps" value="${esc(String(e.reps))}" placeholder="e.g. 12" /></div>
    </div>
    <div class="ex-edit-grid">
      <div><div class="sheet-label">Load</div><input id="exLoad" value="${esc(String(e.load))}" placeholder="e.g. 35 or BW" /></div>
      <div><div class="sheet-label">RPE</div><input id="exRpe" value="${esc(String(e.rpe||'-'))}" placeholder="9 or -" /></div>
    </div>
    <button class="btn btn-primary" id="exSave" style="margin-top:16px">Save exercise</button>
    ${(!isAdded && (e._custom||e._swapped))?`<button class="btn btn-ghost" id="exReset" style="margin-top:8px">↩︎ Reset to planned</button>`:''}
    <button class="sheet-skip" id="exCancel">Cancel</button></div>`;
  document.body.appendChild(wrap); requestAnimationFrame(()=>wrap.classList.add('show'));
  const close=()=>{ wrap.classList.remove('show'); setTimeout(()=>wrap.remove(),220); };
  const q=s=>wrap.querySelector(s);
  q('#exCancel').onclick=close; wrap.onclick=ev=>{ if(ev.target===wrap) close(); };
  q('#exSave').onclick=()=>{
    const name=q('#exName').value.trim(); if(!name){ q('#exName').focus(); return; }
    const vals={ name, sets:Math.max(1,parseInt(q('#exSets').value,10)||1), reps:q('#exReps').value.trim()||String(e.reps), load:q('#exLoad').value.trim()||String(e.load), rpe:q('#exRpe').value.trim()||'-' };
    const log=ensureLog(todayKey);
    if(isAdded){ if(!log.addedEx) log.addedEx=[]; log.addedEx[i-baseLen]=vals; }
    else { if(!log.customEx) log.customEx={}; log.customEx[i]=vals; if(log.swaps) delete log.swaps[i]; }
    save(); render(); close(); toast('✏️ '+name); };
  const rs=q('#exReset'); if(rs) rs.onclick=()=>{ const log=ensureLog(todayKey);
    if(log.customEx) delete log.customEx[i]; if(log.swaps) delete log.swaps[i];
    save(); render(); close(); toast('↩︎ Reset to planned'); };
}

function openExAdd(){
  const wrap=document.createElement('div'); wrap.className='sheet-backdrop';
  wrap.innerHTML=`<div class="sheet"><div class="sheet-handle"></div>
    <div class="sheet-title">Add an exercise</div>
    <div class="hint" style="margin-bottom:4px">Tack on a finisher or anything extra — it goes at the end of today’s workout.</div>
    <div class="sheet-label">Exercise</div><input id="axName" placeholder="e.g. Hammer Curl" />
    <div class="ex-edit-grid">
      <div><div class="sheet-label">Sets</div><input id="axSets" type="number" inputmode="numeric" min="1" value="3" /></div>
      <div><div class="sheet-label">Reps</div><input id="axReps" value="12" placeholder="e.g. 12" /></div>
    </div>
    <div class="ex-edit-grid">
      <div><div class="sheet-label">Load</div><input id="axLoad" placeholder="e.g. 35 or BW" /></div>
      <div><div class="sheet-label">RPE</div><input id="axRpe" value="9" placeholder="9 or -" /></div>
    </div>
    <button class="btn btn-primary" id="axSave" style="margin-top:16px">Add exercise</button>
    <button class="sheet-skip" id="axCancel">Cancel</button></div>`;
  document.body.appendChild(wrap); requestAnimationFrame(()=>wrap.classList.add('show'));
  const close=()=>{ wrap.classList.remove('show'); setTimeout(()=>wrap.remove(),220); };
  const q=s=>wrap.querySelector(s);
  q('#axCancel').onclick=close; wrap.onclick=ev=>{ if(ev.target===wrap) close(); };
  q('#axSave').onclick=()=>{
    const name=q('#axName').value.trim(); if(!name){ q('#axName').focus(); return; }
    const log=ensureLog(todayKey); if(!log.addedEx) log.addedEx=[];
    log.addedEx.push({ name, sets:Math.max(1,parseInt(q('#axSets').value,10)||1), reps:q('#axReps').value.trim()||'12', load:q('#axLoad').value.trim()||'', rpe:q('#axRpe').value.trim()||'-' });
    save(); render(); close(); toast('＋ '+name+' added'); };
}

/* ---------- rename today's workout ---------- */
function openRename(){
  const cur=(LOGS[todayKey] && LOGS[todayKey].customName) || '';
  const wrap=document.createElement('div'); wrap.className='sheet-backdrop';
  wrap.innerHTML=`<div class="sheet"><div class="sheet-handle"></div>
    <div class="sheet-title">Name today’s workout</div>
    <div class="hint" style="margin-bottom:2px">Give today a name — e.g. “Arm Day Pump” or “Leg Destroyer.” Leave blank to use the default.</div>
    <input id="rnName" value="${esc(cur)}" placeholder="${esc(session.title)}" />
    <button class="btn btn-primary" id="rnSave" style="margin-top:16px">Save name</button>
    ${cur?`<button class="btn btn-ghost" id="rnReset" style="margin-top:8px">↩︎ Use default name</button>`:''}
    <button class="sheet-skip" id="rnCancel">Cancel</button></div>`;
  document.body.appendChild(wrap); requestAnimationFrame(()=>wrap.classList.add('show'));
  const close=()=>{ wrap.classList.remove('show'); setTimeout(()=>wrap.remove(),220); };
  const q=s=>wrap.querySelector(s);
  q('#rnCancel').onclick=close; wrap.onclick=ev=>{ if(ev.target===wrap) close(); };
  q('#rnSave').onclick=()=>{ const v=q('#rnName').value.trim(); const log=ensureLog(todayKey);
    if(v && v!==session.title) log.customName=v.slice(0,60); else delete log.customName;
    save(); render(); close(); toast(log.customName?('✏️ '+log.customName):'↩︎ Default name'); };
  const rr=q('#rnReset'); if(rr) rr.onclick=()=>{ const log=ensureLog(todayKey); delete log.customName;
    save(); render(); close(); toast('↩︎ Default name'); };
}

/* ---------- change today's whole workout ---------- */
function openWorkoutPicker(){
  const log = ensureLog(todayKey);
  const plannedTag = SPLIT[today.getDay()].tag;
  const curKey = log.sessionOverride || plannedTag;
  const opt = o => `<button class="pick ${curKey===o.key?'sel':''}" data-key="${o.key}">${o.emoji}<span>${o.label}</span></button>`;
  const wrap=document.createElement('div'); wrap.className='sheet-backdrop';
  wrap.innerHTML=`<div class="sheet">
    <div class="sheet-handle"></div>
    <div class="sheet-title">Choose today’s workout</div>
    <div class="hint" style="margin-bottom:8px">Not feeling the plan? Pick a different session. (Your set progress resets for the new one.)</div>
    <div class="pick-grid">${SESSION_PICKER.map(opt).join('')}</div>
    <button class="btn btn-ai" id="pkAI" style="margin-top:14px">✨ Describe your own (AI)</button>
    <button class="btn btn-ghost" id="pkReset" style="margin-top:8px">↩︎ Back to today’s planned workout</button>
    <button class="sheet-skip" id="pkCancel">Cancel</button>
  </div>`;
  document.body.appendChild(wrap); requestAnimationFrame(()=>wrap.classList.add('show'));
  const close=()=>{ wrap.classList.remove('show'); setTimeout(()=>wrap.remove(),220); };
  wrap.querySelectorAll('.pick').forEach(b=> b.onclick=()=>{ chooseSession(b.dataset.key); close(); });
  wrap.querySelector('#pkAI').onclick=()=>{ close(); setTimeout(openAICustom,240); };
  wrap.querySelector('#pkReset').onclick=()=>{ chooseSession('reset'); close(); };
  wrap.querySelector('#pkCancel').onclick=close; wrap.onclick=e=>{ if(e.target===wrap) close(); };
}
function chooseSession(key){
  const log = ensureLog(todayKey);
  const plannedTag = SPLIT[today.getDay()].tag;
  const effective = (key==='reset' || key===plannedTag) ? null : key;
  const cur = log.sessionOverride || null;
  if(effective===cur){ return; }
  delete log.customSession; // any explicit pick replaces an AI-generated workout
  if(effective) log.sessionOverride = effective; else delete log.sessionOverride;
  log.sets=[]; log.swaps={}; log.done=false; // fresh start for the new session
  save(); render();
  toast(effective ? '🔄 Switched to '+(SESSIONS[effective]?SESSIONS[effective].title:effective) : '↩︎ Back to your plan');
}

/* ---------- AI: describe your own workout ---------- */
function openAICustom(){
  const wrap=document.createElement('div'); wrap.className='sheet-backdrop';
  wrap.innerHTML=`<div class="sheet">
    <div class="sheet-handle"></div>
    <div class="sheet-title">Describe your workout ✨</div>
    <div class="hint" style="margin-bottom:8px">Tell the coach what you want and it’ll program a full session with weights — tuned to your maxes and goals.</div>
    <textarea id="aiPrompt" rows="3" placeholder="e.g. 45-min push day, shoulders are sore so go easy on pressing, finish with a quick treadmill burn"></textarea>
    <div class="ai-examples" id="aiEx">
      <button data-ex="Quick 30-minute full-body pump, dumbbells only">30-min DB pump</button>
      <button data-ex="Leg day focused on quads and glutes, no barbell back squat">Legs, no back squat</button>
      <button data-ex="Light active-recovery day: mobility, core, and an easy pool swim">Recovery day</button>
    </div>
    <div id="aiMsg" class="hint"></div>
    <button class="btn btn-ai" id="aiGo">✨ Generate my workout</button>
    <button class="sheet-skip" id="aiCancel">Cancel</button>
  </div>`;
  document.body.appendChild(wrap); requestAnimationFrame(()=>wrap.classList.add('show'));
  const close=()=>{ wrap.classList.remove('show'); setTimeout(()=>wrap.remove(),220); };
  const msg=t=>wrap.querySelector('#aiMsg').textContent=t;
  const ta=wrap.querySelector('#aiPrompt');
  wrap.querySelectorAll('#aiEx button').forEach(b=> b.onclick=()=>{ ta.value=b.dataset.ex; ta.focus(); });
  wrap.querySelector('#aiCancel').onclick=close; wrap.onclick=e=>{ if(e.target===wrap) close(); };
  wrap.querySelector('#aiGo').onclick=async()=>{
    const prompt=ta.value.trim();
    if(!prompt) return msg('Type a few words about the workout you want.');
    if(location.protocol==='file:') return msg('AI workouts run on the live site (morninggrind.netlify.app), not this local file preview.');
    const btn=wrap.querySelector('#aiGo'); btn.disabled=true; const label=btn.textContent; btn.textContent='Programming your session… 💪';
    try{
      const maxes = (typeof getMaxes==='function') ? getMaxes() : {};
      const res=await fetch('/.netlify/functions/workout',{ method:'POST', headers:{'content-type':'application/json'},
        body:JSON.stringify({ prompt, maxes }) });
      const data=await res.json().catch(()=>({error:'Unexpected response.'}));
      if(!res.ok || data.error){ btn.disabled=false; btn.textContent=label; return msg('⚠️ '+(data.error||'Could not generate — try again.')); }
      applyAIWorkout(data); close();
    }catch(e){ btn.disabled=false; btn.textContent=label; msg('⚠️ Couldn’t reach the coach — check your connection and try again.'); }
  };
}
function applyAIWorkout(w){
  const exs=(Array.isArray(w.exercises)?w.exercises:[]).slice(0,10).map(e=>
    ex(String(e.name||'Exercise'), parseInt(e.sets,10)||1, String(e.reps||''), String(e.load||''),
       (e.rpe==null||e.rpe==='')?'-':String(e.rpe), String(e.group||'')));
  if(!exs.length){ toast('The coach returned an empty workout — try again'); return; }
  const sess={ title:String(w.title||'Custom Workout'), tag:'custom', outdoor:false,
    playlist:PL('Beast Mode'), ex:exs, aiNote:String(w.note||''), aiFocus:String(w.focus||'') };
  const log=ensureLog(todayKey);
  log.sessionOverride='__ai__'; log.customSession=sess;
  log.sets=[]; log.swaps={}; log.done=false;
  save(); render();
  toast('🤖 Custom workout ready');
}

/* ---------- markets (Finnhub if key present, else Google Finance links) ---------- */
const hasFin = () => (typeof FINNHUB_KEY!=='undefined' && FINNHUB_KEY);
const FIN = sym => `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${FINNHUB_KEY}`;
const gfLink = sym => `https://www.google.com/search?q=${encodeURIComponent(sym+' stock')}`;
function marketsCard(){
  return `<div class="card" id="marketsCard">
    <div class="section-title mk-title"><span>📈 Markets</span>
      <a href="https://www.google.com/finance/markets/indexes" target="_blank" rel="noopener" class="mk-gf">Google Finance ↗</a></div>
    <div id="mkIndices"><span class="hint">Loading markets…</span></div>
    <div class="qlog" style="margin-top:10px">
      <input id="mkTicker" placeholder="Look up a ticker (e.g. AAPL)" style="text-transform:uppercase" />
      <button id="mkGo">Quote</button>
    </div>
    <div id="mkResult" class="hint"></div>
  </div>`;
}
function quoteRow(label, q, sym){
  const up=q.dp>=0, cls=up?'up':'down', arrow=up?'▲':'▼';
  const link = sym?` <a class="mk-ext" href="${gfLink(sym)}" target="_blank" rel="noopener">↗</a>`:'';
  return `<div class="mk-row"><span class="mk-name">${label}${link}</span>
    <span class="mk-price">$${q.c.toFixed(2)}</span>
    <span class="mk-chg ${cls}">${arrow} ${Math.abs(q.dp).toFixed(2)}%</span></div>`;
}
async function loadMarkets(){
  const el=$('#mkIndices'); if(!el) return;
  if(!hasFin()){ el.innerHTML=`<div class="hint">📊 <a href="https://www.google.com/finance/markets/indexes" target="_blank" rel="noopener">S&amp;P · Nasdaq · Dow on Google Finance ↗</a><br>Add a free <b>Finnhub</b> key in <code>config.js</code> to see live prices right here.</div>`; return; }
  try{
    const idx=[['S&P 500','SPY'],['Nasdaq','QQQ'],['Dow','DIA']];
    const qs=await Promise.all(idx.map(([_,s])=>fetch(FIN(s)).then(r=>r.json())));
    el.innerHTML=idx.map(([label,s],i)=> qs[i]&&qs[i].c ? quoteRow(label,qs[i],s) : '').join('')
      + `<div class="hint" style="margin-top:6px">Index proxies (SPY/QQQ/DIA) · % change tracks the market.</div>`;
  }catch{ el.innerHTML='<span class="hint">Markets unavailable right now.</span>'; }
}
async function lookupTicker(){
  const inp=$('#mkTicker'), res=$('#mkResult'); if(!inp) return;
  const sym=inp.value.trim().toUpperCase(); if(!sym) return;
  if(!hasFin()){ window.open(gfLink(sym),'_blank'); return; }
  res.textContent='Fetching '+sym+'…';
  try{ const q=await fetch(FIN(sym)).then(r=>r.json());
    if(!q || !q.c){ res.textContent='No data for '+sym+' — check the symbol.'; return; }
    const up=q.dp>=0;
    res.innerHTML=`<div class="mk-row"><span class="mk-name">${sym} <a class="mk-ext" href="${gfLink(sym)}" target="_blank" rel="noopener">↗</a></span>
      <span class="mk-price">$${q.c.toFixed(2)}</span>
      <span class="mk-chg ${up?'up':'down'}">${up?'▲':'▼'} ${Math.abs(q.d).toFixed(2)} (${Math.abs(q.dp).toFixed(2)}%)</span></div>`;
  }catch{ res.textContent='Lookup failed — try again.'; }
}

/* ---------- weather (Open-Meteo, no key) ---------- */
// Resolve device location (with permission); fall back to last-known, then East Village
function getLocation(){
  return new Promise(resolve=>{
    let cached=null; try{ cached=JSON.parse(localStorage.getItem('mg_geo')||'null'); }catch{}
    const fallback = cached || {lat:GEO.lat, lon:GEO.lon, place:GEO.place, src:'default'};
    if(!navigator.geolocation) return resolve(fallback);
    navigator.geolocation.getCurrentPosition(async pos=>{
      const lat=+pos.coords.latitude.toFixed(4), lon=+pos.coords.longitude.toFixed(4);
      let place='Your location';
      try{ const g=await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
        const j=await g.json(); place=j.city||j.locality||j.principalSubdivision||place; }catch{}
      const loc={lat,lon,place,src:'gps'}; try{ localStorage.setItem('mg_geo',JSON.stringify(loc)); }catch{}
      resolve(loc);
    }, ()=>resolve(fallback), {timeout:8000, maximumAge:600000});
  });
}
async function paintWeather(){
  const el=$('#weatherCard'); if(!el) return;
  if(WEATHER){ el.innerHTML=weatherHTML(WEATHER.current, WEATHER.place)+hourlyHTML(WEATHER.hourly); return; }
  try{
    const loc = await getLocation();
    const u=`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}`+
      `&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m`+
      `&hourly=temperature_2m,weather_code,precipitation_probability&forecast_days=2`+
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;
    const r=await fetch(u); const j=await r.json(); WEATHER={current:j.current, hourly:j.hourly, place:loc.place};
    el.innerHTML=weatherHTML(WEATHER.current, WEATHER.place)+hourlyHTML(WEATHER.hourly);
  }catch{ el.innerHTML='<span class="hint">🌤️ Weather unavailable offline — reopen with a connection.</span>'; }
}
function hourlyHTML(h){
  if(!h||!h.time||!h.time.length) return '';
  const p=n=>String(n).padStart(2,'0'); const d=new Date();
  const cur=`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}`;
  let s=h.time.findIndex(t=>t.slice(0,13)>=cur); if(s<0) s=0;
  const cells=[];
  for(let i=s;i<Math.min(s+12,h.time.length);i++){
    const hr=+h.time[i].slice(11,13);
    const lbl = i===s ? 'Now' : ((hr%12)||12)+(hr<12?'AM':'PM');
    const [emo]=WMO[h.weather_code[i]]||['🌡️'];
    const pop=h.precipitation_probability?h.precipitation_probability[i]:0;
    cells.push(`<div class="hour"><div class="hh">${lbl}</div><div class="he">${emo}</div>`+
      `<div class="ht">${Math.round(h.temperature_2m[i])}°</div>`+
      `${pop>=20?`<div class="hp">${pop}%</div>`:'<div class="hp">&nbsp;</div>'}</div>`);
  }
  return `<div class="hourly">${cells.join('')}</div>`;
}
function weatherHTML(c, place){
  const [emo,desc]=WMO[c.weather_code]||['🌡️','—'];
  const temp=Math.round(c.temperature_2m), feels=Math.round(c.apparent_temperature);
  const wet=c.precipitation>0 || (c.weather_code>=51);
  const cold=temp<=32, hot=temp>=92;
  let rec;
  if(session.outdoor){
    rec = (wet||cold||hot)
      ? `↪︎ Rough out there — take the run to the <b>treadmill</b> (or hit the <b>pool</b>).`
      : `✅ Great conditions — do the <b>outdoor run</b>.`;
  } else {
    rec = wet ? `Grab a layer if you’re commuting to the gym.` : `Clear commute to the gym.`;
  }
  return `<div class="wx"><span class="wx-emo">${emo}</span>
      <div><div class="wx-t">${temp}°F <span class="hint">feels ${feels}° · ${desc} · 📍 ${place||GEO.place}</span></div>
      <div class="wx-rec">${rec}</div></div></div>`;
}

/* ---------- progress tab ---------- */
function viewProgress(){
  const w=latestWeight(), a=avg7();
  const prRows = PRS.slice().reverse().slice(0,8).map(p=>`
    <div class="pr-item"><span>${p.lift}</span><b>${p.w} lb</b><span style="color:var(--muted)">${p.date.slice(5)}</span></div>`).join('')
    || '<div class="hint">No PRs yet — log your bests below.</div>';
  return `
    <div class="stat-row">
      <div class="stat"><div class="n">${streak()}</div><div class="l">🔥 day streak</div></div>
      <div class="stat"><div class="n">${monthCount()}</div><div class="l">this month</div></div>
      <div class="stat"><div class="n">${w!=null?w:'—'}</div><div class="l">latest lb</div></div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="section-title">⚖️ Weight ${a!=null?`· 7-day avg ${a.toFixed(1)}`:''}</div>
      <canvas id="wChart" width="600" height="180"></canvas>
      <div class="hint">Target 158 lb (dashed). Log nightly to fill the trend.</div>
    </div>
    <div class="card">
      <div class="section-title">📅 Consistency</div>
      <div class="cal-months" id="calMonths"></div>
      <div class="cal" id="cal"></div>
      <div class="hint" style="text-align:center;margin-top:8px">Tap a day to see that workout + debrief</div>
    </div>
    <div class="card">
      <div class="section-title">🏋️ Personal Records</div>
      ${prRows}
      <div class="qlog" style="margin-top:10px">
        <input id="prLift" placeholder="Lift (e.g. Bench)" />
        <input id="prW" type="number" inputmode="decimal" placeholder="lb" style="max-width:90px" />
        <button id="prSave">PR</button>
      </div>
    </div>`;
}
function wireProgress(){
  drawChart(); drawCalendar();
  $('#prSave').onclick=()=>{ const lift=$('#prLift').value.trim(), v=parseFloat($('#prW').value);
    if(!lift||!v) return toast('Enter lift + weight');
    PRS.push({date:todayKey,lift,w:v}); save(); toast('PR logged! 🎉'); render(); };
}
function drawChart(){
  const c=$('#wChart'); if(!c) return; const ctx=c.getContext('2d'); const W=c.width,H=c.height,pad=24;
  ctx.clearRect(0,0,W,H); const data=WEIGHTS.slice(-30); const vals=data.map(d=>d.w).concat([158]);
  const min=Math.min(...vals)-1, max=Math.max(...vals)+1;
  const x=i=>pad+(W-2*pad)*(data.length<=1?0.5:i/(data.length-1));
  const y=v=>H-pad-(H-2*pad)*((v-min)/(max-min||1));
  ctx.strokeStyle='#c7d2fe'; ctx.setLineDash([5,5]); ctx.beginPath(); ctx.moveTo(pad,y(158)); ctx.lineTo(W-pad,y(158)); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle='#94a3b8'; ctx.font='11px sans-serif'; ctx.fillText('158', W-pad-22, y(158)-4);
  if(!data.length){ ctx.fillStyle='#94a3b8'; ctx.fillText('Log a weight to start the chart', pad, H/2); return; }
  ctx.strokeStyle='#2563eb'; ctx.lineWidth=2.5; ctx.beginPath();
  data.forEach((d,i)=>{ i?ctx.lineTo(x(i),y(d.w)):ctx.moveTo(x(i),y(d.w)); }); ctx.stroke();
  ctx.fillStyle='#1e3a8a'; data.forEach((d,i)=>{ ctx.beginPath(); ctx.arc(x(i),y(d.w),3.5,0,7); ctx.fill(); });
}
function drawCalendar(){
  const cal=$('#cal'); if(!cal) return; const dows=['S','M','T','W','T','F','S'];
  const start=new Date(today); start.setDate(start.getDate()-34); start.setDate(start.getDate()-start.getDay());
  const mh=$('#calMonths');
  if(mh){ const mf=d=>d.toLocaleDateString('en-US',{month:'long'});
    mh.textContent = start.getMonth()===today.getMonth()
      ? `${mf(today)} ${today.getFullYear()}`
      : `${mf(start)} – ${mf(today)} ${today.getFullYear()}`; }
  let html=dows.map(d=>`<div class="d dow">${d}</div>`).join('');
  for(let i=0;i<42;i++){ const d=new Date(start); d.setDate(start.getDate()+i);
    if(d>today){ html+='<div class="d empty"></div>'; continue; }
    const k=keyOf(d), done=LOGS[k]&&LOGS[k].done;
    const m1 = d.getDate()===1 ? `<span class="cal-m">${d.toLocaleDateString('en-US',{month:'short'})}</span>` : '';
    html+=`<div class="d ${done?'done':''} ${k===todayKey?'today':''}" data-date="${k}">${m1}${d.getDate()}</div>`; }
  cal.innerHTML=html;
  cal.querySelectorAll('.d[data-date]').forEach(t=> t.onclick=()=>openDaySheet(t.dataset.date));
}

function openDaySheet(k){
  const log = LOGS[k] || {};
  const sess = sessionFor(k);
  const dObj = new Date(k+'T12:00');
  const dstr = dObj.toLocaleDateString('en-US',{weekday:'long', month:'long', day:'numeric'});
  const w = (WEIGHTS.find(x=>x.date===k)||{}).w;
  const rows = sess.ex.map((e,i)=>{
    const opts=optionsFor(e); const idx=(log.swaps&&log.swaps[i])||0; const pick=opts[Math.min(idx,opts.length-1)]||{name:e.name,load:e.load};
    const tg=target(e), done=Math.min((log.sets&&log.sets[i])||0,tg);
    return `<div class="ds-row"><span>${pick.name}</span><span class="ds-sets ${done>=tg&&done>0?'full':''}">${done}/${tg}</span></div>`;
  }).join('');
  const d=log.debrief;
  const feelMap={1:'😣 Grind',2:'😮‍💨 Tough',3:'🙂 Solid',4:'💪 Strong',5:'🔥 On fire'};
  const debriefHTML = d ? `<div class="sheet-label">📝 Debrief</div>
      <div class="ds-debrief">${[d.rating?feelMap[d.rating]:'',d.effort,d.energy?d.energy+' energy':''].filter(Boolean).join(' · ')||'Logged'}${d.notes?`<div class="ds-notes">“${d.notes}”</div>`:''}</div>` : '';
  const badge = log.done ? '<span class="ds-badge done">✅ Completed</span>'
    : (log.sets && log.sets.some(x=>x>0)) ? '<span class="ds-badge">Partial</span>'
    : '<span class="ds-badge">Not logged</span>';
  const wrap=document.createElement('div'); wrap.className='sheet-backdrop';
  wrap.innerHTML=`<div class="sheet">
    <div class="sheet-handle"></div>
    <div class="sheet-title">${dstr}</div>
    <div class="ds-meta">${sess.title} &nbsp; ${badge}${w!=null?` &nbsp; ⚖️ ${w} lb`:''}</div>
    <div class="sheet-label">Workout</div>
    ${rows}
    ${debriefHTML}
    <div class="ds-actions">
      <button class="btn ${log.done?'btn-ghost':'btn-primary'}" id="dsToggle">${log.done?'↩︎ Mark not completed':'✅ Mark completed'}</button>
      <button class="btn btn-ghost" id="dsDebrief">${log.debrief?'📝 Edit debrief':'📝 Add debrief'}</button>
    </div>
    <button class="sheet-skip" id="dsClose">Close</button>
  </div>`;
  document.body.appendChild(wrap); requestAnimationFrame(()=>wrap.classList.add('show'));
  const close=()=>{ wrap.classList.remove('show'); setTimeout(()=>wrap.remove(),220); };
  wrap.querySelector('#dsClose').onclick=close; wrap.onclick=e=>{ if(e.target===wrap) close(); };
  wrap.querySelector('#dsToggle').onclick=()=>{ const l=ensureLog(k); l.done=!l.done; if(l.done) l.sets=sess.ex.map(e=>target(e)); save(); close(); render(); toast(l.done?'Marked complete ✅':'Marked not complete'); };
  wrap.querySelector('#dsDebrief').onclick=()=>{ close(); openDebrief(k); };
}

/* ---------- Friends / Feed (Strava-style) ---------- */
const FEEL_MAP = {1:'😣 Grind',2:'😮‍💨 Tough',3:'🙂 Solid',4:'💪 Strong',5:'🔥 On fire'};
function viewFeed(){
  if(!(window.MGSync && window.MGSync.signedIn && window.MGSync.signedIn())){
    return `<div class="card"><div class="section-title">👥 Friends</div>
      <div class="hint">Sign in to share your training and follow friends — see their lifts and how they felt.</div>
      <button class="btn btn-primary" id="feedSignIn" style="margin-top:12px">Sign in to sync</button></div>`;
  }
  return `
    <div class="seg feed-seg">
      <button data-fs="feed" class="${FEEDSUB==='feed'?'on':''}">🏋️ Feed</button>
      <button data-fs="friends" class="${FEEDSUB==='friends'?'on':''}">👥 Friends</button>
    </div>
    <div id="feedPane"></div>`;
}
function wireFeed(){
  const si=$('#feedSignIn'); if(si){ si.onclick=()=>{ const b=$('#signInBtn'); if(b) b.click(); }; return; }
  document.querySelectorAll('.feed-seg button').forEach(b=> b.onclick=()=>{
    FEEDSUB=b.dataset.fs;
    document.querySelectorAll('.feed-seg button').forEach(x=>x.classList.toggle('on', x===b));
    paintFeedPane();
  });
  paintFeedPane();
}
function paintFeedPane(){
  const el=$('#feedPane'); if(!el) return;
  if(FEEDSUB==='friends'){
    el.innerHTML=`
      <div class="card" id="profileCard"><div class="hint">Loading your profile…</div></div>
      <div class="card">
        <div class="section-title">🔎 On Morning Grind</div>
        <div class="hint" style="margin:0 0 10px">Tap Follow to add anyone here — no handle needed.</div>
        <div id="discoverRows"><div class="hint">Loading people…</div></div>
      </div>
      <div class="card">
        <div class="section-title">➕ Add by handle</div>
        <div class="qlog"><input id="followHandle" placeholder="their @handle" autocapitalize="off" autocorrect="off" /><button id="followBtn">Follow</button></div>
        <div class="hint" id="followMsg">Know someone’s exact handle? Add them directly here.</div>
      </div>`;
    const fb=$('#followBtn'); if(fb) fb.onclick=async()=>{ const h=$('#followHandle').value; if(!h) return;
      $('#followMsg').textContent='Following…'; const err=await window.MGSync.follow(h);
      $('#followMsg').textContent = err ? ('⚠️ '+err) : '✅ Followed!';
      if(!err){ $('#followHandle').value=''; loadProfileCard(); loadDiscover(); } };
    loadProfileCard(); loadDiscover();
  } else {
    el.innerHTML=`<div id="feedList"><div class="card"><div class="hint">Loading feed…</div></div></div>`;
    loadFeed();
  }
}
async function loadDiscover(){
  const el=$('#discoverRows'); if(!el || !(window.MGSync && window.MGSync.discover)) return;
  let people=[], following=[];
  try{ [people, following]=await Promise.all([window.MGSync.discover(), window.MGSync.following()]); }
  catch{ el.innerHTML=`<div class="hint">Couldn’t load people right now — pull to refresh.</div>`; return; }
  const fset=new Set((following||[]).map(f=>f.id));
  if(!people.length){ el.innerHTML=`<div class="hint">No one else has joined yet. As friends sign up, they’ll appear here automatically.</div>`; return; }
  el.innerHTML=people.map(p=>{ const on=fset.has(p.id);
    return `<div class="disc-row">
      <div class="disc-tap" data-uid="${p.id}">${avatarEl(p,'disc')}
        <div class="disc-main"><div class="disc-name">${esc(p.display_name||('@'+(p.handle||'friend')))}</div><div class="disc-handle">${p.handle?('@'+esc(p.handle)):'on Morning Grind'}</div></div></div>
      <button class="disc-follow${on?' following':''}" data-uid="${p.id}" ${on?'disabled':''}>${on?'Following ✓':'Follow'}</button>
    </div>`; }).join('');
  el.querySelectorAll('.disc-tap[data-uid]').forEach(t=>{ t.onclick=()=>openProfile(t.dataset.uid); });
  el.querySelectorAll('.disc-follow:not(.following)').forEach(b=> b.onclick=async()=>{
    b.disabled=true; b.textContent='…';
    const err=await window.MGSync.followId(b.dataset.uid);
    if(err){ b.disabled=false; b.textContent='Follow'; toast('⚠️ '+err); }
    else { b.textContent='Following ✓'; b.classList.add('following'); loadProfileCard(); loadFeed(); } });
}
async function loadProfileCard(){
  const el=$('#profileCard'); if(!el) return;
  const p=(await window.MGSync.myProfile())||{}; const following=await window.MGSync.following();
  el.innerHTML=`<div class="prof">
      ${avatarEl(p,'prof')}
      <div class="prof-main"><div class="prof-name">${esc(p.display_name||'You')}</div>
        <div class="prof-handle">${p.handle?('@'+esc(p.handle)):'⚠️ set a handle so friends can add you'}</div></div>
      <button class="btn-ghost prof-edit" id="editProfile">Edit</button></div>
    ${p.goals?`<div class="pf-sec">🎯 <b>Goals</b> · ${esc(p.goals)}</div>`:''}
    ${p.quote?`<div class="pf-sec">❝ <b>Quote</b> · ${esc(p.quote)}</div>`:''}
    ${p.movie?`<div class="pf-sec">🎬 <b>Movie</b> · ${esc(p.movie)}</div>`:''}
    <div class="hint" style="margin-top:12px">Following ${following.length} ${following.length===1?'friend':'friends'}${following.length?': '+following.map(f=> f.handle?('@'+esc(f.handle)):esc(f.display_name||'friend')).join(', '):''}</div>`;
  $('#editProfile').onclick=openProfileEdit;
}
async function openProfileEdit(){
  const p=(await window.MGSync.myProfile())||{};
  let avatar = p.avatar || null;
  const wrap=document.createElement('div'); wrap.className='sheet-backdrop';
  wrap.innerHTML=`<div class="sheet"><div class="sheet-handle"></div>
    <div class="sheet-title">Your profile</div>
    <div class="pf-photo-row">
      <div class="pf-av" id="pfAvPreview">${avatar?`<img src="${avatar}" alt="" />`:esc(p.emoji||'💪')}</div>
      <div style="flex:1; min-width:0">
        <button class="btn-ghost pf-photo-btn" id="pfPickBtn" type="button">📷 ${avatar?'Change photo':'Add a photo'}</button>
        <button class="pf-photo-clear" id="pfClearBtn" type="button" style="${avatar?'':'display:none'}">Remove photo</button>
      </div>
    </div>
    <input type="file" accept="image/*" id="pfPhoto" style="display:none" />
    <div class="hint">A photo replaces your emoji everywhere. No photo? Your emoji is used instead.</div>
    <div class="sheet-label">Name</div><input id="pfName" value="${esc(p.display_name||'')}" placeholder="Your name" />
    <div class="sheet-label">Handle — friends add you by this</div><input id="pfHandle" value="${esc(p.handle||'')}" placeholder="e.g. bjorn" autocapitalize="off" autocorrect="off" />
    <div class="hint" style="margin-top:4px">3–20 letters, numbers, or _ (no spaces).</div>
    <div class="sheet-label">Emoji (fallback if no photo)</div><input id="pfEmoji" value="${esc(p.emoji||'💪')}" maxlength="8" placeholder="Any emoji 💪" />
    <div class="sheet-label">Workout goals</div><textarea id="pfGoals" placeholder="e.g. Stay ~158 lb, lean & nimble, classic-physique aesthetics">${esc(p.goals||'')}</textarea>
    <div class="sheet-label">Favorite quote</div><input id="pfQuote" value="${esc(p.quote||'')}" placeholder="Your favorite quote" />
    <div class="sheet-label">Favorite movie</div><input id="pfMovie" value="${esc(p.movie||'')}" placeholder="Your favorite movie" />
    <div id="pfMsg" class="hint"></div>
    <button class="btn btn-primary" id="pfSave">Save</button>
    <button class="sheet-skip" id="pfCancel">Cancel</button></div>`;
  document.body.appendChild(wrap); requestAnimationFrame(()=>wrap.classList.add('show'));
  const close=()=>{ wrap.classList.remove('show'); setTimeout(()=>wrap.remove(),220); };
  const q=s=>wrap.querySelector(s);
  q('#pfCancel').onclick=close; wrap.onclick=e=>{ if(e.target===wrap) close(); };
  const fileInput=q('#pfPhoto');
  q('#pfPickBtn').onclick=()=>fileInput.click();
  fileInput.onchange=()=>{ const f=fileInput.files&&fileInput.files[0]; if(!f) return;
    q('#pfMsg').textContent='Processing photo…';
    resizeImage(f, 256, (dataUrl)=>{ if(!dataUrl){ q('#pfMsg').textContent='⚠️ Could not read that image.'; return; }
      avatar=dataUrl; q('#pfAvPreview').innerHTML=`<img src="${dataUrl}" alt="" />`;
      q('#pfClearBtn').style.display=''; q('#pfPickBtn').textContent='📷 Change photo'; q('#pfMsg').textContent=''; }); };
  q('#pfClearBtn').onclick=()=>{ avatar=null; q('#pfAvPreview').innerHTML=esc(q('#pfEmoji').value||'💪');
    q('#pfClearBtn').style.display='none'; q('#pfPickBtn').textContent='📷 Add a photo'; };
  q('#pfSave').onclick=async()=>{
    q('#pfMsg').textContent='Saving…';
    const err=await window.MGSync.saveProfile({
      display_name:q('#pfName').value.trim(), handle:q('#pfHandle').value.trim(),
      emoji:q('#pfEmoji').value.trim()||'💪', avatar:avatar,
      goals:q('#pfGoals').value.trim(), quote:q('#pfQuote').value.trim(), movie:q('#pfMovie').value.trim() });
    if(err){ q('#pfMsg').textContent='⚠️ '+err; }
    else { close(); loadProfileCard(); if(window.MGSync.reloadProfile) window.MGSync.reloadProfile(); toast('Profile saved ✅'); } };
}
function liftsSummary(it){
  const swaps=it.swaps||{}, sets=it.sets||[], cust=(it.plan&&it.plan.ex)||{}, added=(it.plan&&it.plan.added)||[], removed=(it.plan&&it.plan.removed)||{};
  let base;
  if(it.plan && it.plan.custom && Array.isArray(it.plan.custom.ex)) base=it.plan.custom; // AI custom session
  else { const tag=it.plan&&it.plan.tag; base=(tag && typeof SESSIONS!=='undefined' && SESSIONS[tag]) ? SESSIONS[tag] : SPLIT[new Date(it.d+'T12:00').getDay()]; }
  const list = base.ex.concat(added), out=[];
  list.forEach((e,i)=>{
    const isBase = i < base.ex.length;
    if(isBase && removed[i]) return;
    if(isBase && cust[i]){ const c=cust[i]; const tg=(Number.isInteger(+c.sets)&&+c.sets>0)?+c.sets:1; out.push({ name:c.name, load:c.load, done:Math.min(sets[i]||0,tg), tg }); return; }
    if(isBase){ const opts=optionsFor(e); const idx=swaps[i]||0; const pick=opts[Math.min(idx,opts.length-1)]||{name:e.name,load:e.load};
      const tg=(Number.isInteger(+e.sets)&&+e.sets>0)?+e.sets:1; out.push({ name:pick.name, load:pick.load, done:Math.min(sets[i]||0,tg), tg }); return; }
    const tg=(Number.isInteger(+e.sets)&&+e.sets>0)?+e.sets:1; out.push({ name:e.name, load:e.load, done:Math.min(sets[i]||0,tg), tg });
  });
  return out;
}
function feedCard(it, prof){
  const dObj=new Date(it.d+'T12:00');
  const when=dObj.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
  const title=(it.plan&&it.plan.title)||'Workout';
  const d=it.debrief;
  const ls=liftsSummary(it);
  const doneSets=ls.reduce((a,l)=>a+l.done,0), totSets=ls.reduce((a,l)=>a+l.tg,0);
  const pct=totSets?Math.round(100*doneSets/totSets):0;
  const lifts=ls.filter(l=>l.done>0);
  const exCount=lifts.length || ls.length;
  const shown=lifts.slice(0,8);
  const liftHTML=shown.length?`<div class="fc-lifts">${shown.map(l=>`<span>${l.name} <b>${fmtLoad(l.load)}</b></span>`).join('')}${lifts.length>8?`<span class="fc-more">+${lifts.length-8} more</span>`:''}</div>`:'';
  const statHTML=`<div class="fc-stats"><span>🏋️ ${exCount} exercises</span><span>✅ ${doneSets}/${totSets} sets</span><span>🔥 ${pct}% complete</span></div>`;
  const debHTML=d?`<div class="fc-deb">${d.rating?FEEL_MAP[d.rating]:''}${d.effort?' · '+d.effort:''}${d.energy?' · '+d.energy+' energy':''}${d.notes?`<div class="fc-notes">“${d.notes}”</div>`:''}</div>`:`<div class="fc-nodeb">No debrief logged</div>`;
  return `<div class="card fc">
    <div class="fc-head" data-uid="${it.user_id}">${avatarEl(prof,'fc')}
      <div style="flex:1; min-width:0"><div class="fc-name">${esc(prof.display_name||('@'+(prof.handle||'friend')))}${(window.MGSync&&window.MGSync.myId&&window.MGSync.myId()===it.user_id)?' <span class="fc-you">You</span>':''}</div>
        <div class="fc-sub">${when} · ${title}</div></div>
      <span class="fc-pct">${pct}%</span></div>
    ${statHTML}${liftHTML}${debHTML}</div>`;
}
async function loadFeed(){
  const el=$('#feedList'); if(!el) return;
  if(window.MGSync && window.MGSync.flush){ try{ await window.MGSync.flush(); }catch{} }
  const { items, profiles }=await window.MGSync.feed();
  if(!items.length){ el.innerHTML=`<div class="card"><div class="hint">No completed workouts yet. Finish today’s session and it’ll show up here — and head to the <b>👥 Friends</b> tab to follow people and see theirs too.</div></div>`; return; }
  el.innerHTML=items.map(it=>feedCard(it, profiles[it.user_id]||{})).join('');
  el.querySelectorAll('.fc-head[data-uid]').forEach(h=>{ h.onclick=()=>openProfile(h.dataset.uid); });
}
function profileWorkoutCard(it){
  const when=new Date(it.d+'T12:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
  const title=(it.plan&&it.plan.title)||'Workout';
  const d=it.debrief;
  const ls=liftsSummary(it);
  const doneSets=ls.reduce((a,l)=>a+l.done,0), totSets=ls.reduce((a,l)=>a+l.tg,0);
  const pct=totSets?Math.round(100*doneSets/totSets):0;
  const lifts=ls.filter(l=>l.done>0), shown=lifts.slice(0,8);
  const liftHTML=shown.length?`<div class="fc-lifts">${shown.map(l=>`<span>${esc(l.name)} <b>${fmtLoad(l.load)}</b></span>`).join('')}${lifts.length>8?`<span class="fc-more">+${lifts.length-8} more</span>`:''}</div>`:'';
  const statHTML=`<div class="fc-stats"><span>🏋️ ${lifts.length||ls.length} exercises</span><span>✅ ${doneSets}/${totSets} sets</span><span>🔥 ${pct}%</span></div>`;
  const debHTML=d?`<div class="fc-deb">${d.rating?FEEL_MAP[d.rating]:''}${d.effort?' · '+d.effort:''}${d.energy?' · '+d.energy+' energy':''}${d.notes?`<div class="fc-notes">“${esc(d.notes)}”</div>`:''}</div>`:'';
  return `<div class="card pw">
    <div class="pw-head"><span class="pw-title">${esc(title)}</span><span class="fc-pct">${pct}%</span></div>
    <div class="pw-when">✅ ${when}</div>
    ${statHTML}${liftHTML}${debHTML}</div>`;
}
async function openProfile(id){
  if(!id || !(window.MGSync && window.MGSync.userProfile)) return;
  const wrap=document.createElement('div'); wrap.className='sheet-backdrop';
  wrap.innerHTML=`<div class="sheet"><div class="sheet-handle"></div><div id="pvBody"><div class="hint">Loading profile…</div></div>
    <button class="sheet-skip" id="pvClose">Close</button></div>`;
  document.body.appendChild(wrap); requestAnimationFrame(()=>wrap.classList.add('show'));
  const close=()=>{ wrap.classList.remove('show'); setTimeout(()=>wrap.remove(),220); };
  wrap.querySelector('#pvClose').onclick=close; wrap.onclick=e=>{ if(e.target===wrap) close(); };
  const meId = window.MGSync.myId ? window.MGSync.myId() : null;
  let p=null, days=[], following=[];
  try{ [p, days, following]=await Promise.all([ window.MGSync.userProfile(id), window.MGSync.userDays(id), window.MGSync.following() ]); }catch{}
  const body=wrap.querySelector('#pvBody'); if(!body) return;
  if(!p){ body.innerHTML=`<div class="hint">Couldn’t load this profile.</div>`; return; }
  const isMe = meId && id===meId;
  const amFollowing = (following||[]).some(f=>f.id===id);
  const dates=(days||[]).map(x=>x.d);
  const st=streakFromDates(dates);
  const cut=new Date(today); cut.setDate(cut.getDate()-6); cut.setHours(0,0,0,0);
  const wk=(days||[]).filter(x=>new Date(x.d+'T12:00')>=cut).length;
  const total=(days||[]).length;
  const followBtn = isMe ? '' : (amFollowing
    ? `<button class="btn btn-ghost" id="pvUnfollow" style="margin-bottom:14px">Following ✓ · tap to unfollow</button>`
    : `<button class="btn btn-primary" id="pvFollow" data-uid="${esc(id)}" style="margin-bottom:14px">Follow</button>`);
  body.innerHTML=`
    <div class="prof-hero">${avatarEl(p,'hero')}
      <div class="prof-hero-name">${esc(p.display_name||('@'+(p.handle||'friend')))}</div>
      ${p.handle?`<div class="prof-handle">@${esc(p.handle)}</div>`:''}</div>
    <div class="prof-stats">
      <div><b>${st}</b><small>🔥 STREAK</small></div>
      <div><b>${wk}</b><small>THIS WK</small></div>
      <div><b>${total}</b><small>WORKOUTS</small></div>
    </div>
    ${followBtn}
    ${p.goals?`<div class="pf-sec">🎯 <b>Goals</b> · ${esc(p.goals)}</div>`:''}
    ${p.quote?`<div class="pf-sec">❝ <b>Quote</b> · ${esc(p.quote)}</div>`:''}
    ${p.movie?`<div class="pf-sec">🎬 <b>Movie</b> · ${esc(p.movie)}</div>`:''}
    <div class="sheet-label">Recent workouts</div>
    ${ (days&&days.length) ? days.slice(0,20).map(profileWorkoutCard).join('') : `<div class="hint">${(isMe||amFollowing)?'No completed workouts yet.':'Follow to see their workouts.'}</div>` }`;
  const fb=wrap.querySelector('#pvFollow'); if(fb) fb.onclick=async()=>{ fb.disabled=true; fb.textContent='…';
    const err=await window.MGSync.followId(fb.dataset.uid);
    if(err){ fb.disabled=false; fb.textContent='Follow'; toast('⚠️ '+err); }
    else { close(); toast('✅ Followed'); if(TAB==='feed') paintFeedPane(); } };
  const ub=wrap.querySelector('#pvUnfollow'); if(ub) ub.onclick=async()=>{ ub.disabled=true;
    await window.MGSync.unfollow(id); close(); toast('Unfollowed'); if(TAB==='feed') paintFeedPane(); };
}

/* ---------- rest timer ---------- */
let restInt=null, restLeft=0;
function startRest(sec){ const box=$('#restTimer'); box.classList.remove('hidden'); restLeft=sec; paintRest();
  clearInterval(restInt);
  restInt=setInterval(()=>{ restLeft--; paintRest(); if(restLeft<=0){ clearInterval(restInt); if(navigator.vibrate)navigator.vibrate(300); toast('Rest done — go!'); box.classList.add('hidden'); } },1000); }
function paintRest(){ const m=Math.floor(restLeft/60), s=String(restLeft%60).padStart(2,'0'); $('#restCount').textContent=`${m}:${s}`; }
document.querySelectorAll('[data-rest]').forEach(b=> b.onclick=()=>startRest(+b.dataset.rest));
$('#restStop').onclick=()=>{ clearInterval(restInt); $('#restTimer').classList.add('hidden'); };

/* ---------- misc ---------- */
let toastT=null;
function toast(msg){ let t=$('.toast'); if(!t){ t=document.createElement('div'); t.className='toast'; document.body.appendChild(t);} t.textContent=msg; t.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),1800); }
document.querySelectorAll('.tab').forEach(t=> t.onclick=()=>{ TAB=t.dataset.tab; render(); });
if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').catch(()=>{}); }
render();
