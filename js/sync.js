/* Morning Grind — cloud sync + social (Supabase). Local-first; syncs when signed in. */
(function(){
  if(!window.supabase || typeof SUPABASE_URL==='undefined'){ return; }
  const SB = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
  });
  let USER = null, pushT = null, PROFILE = null;
  const uid = ()=> USER && USER.id;
  // PROFILE: null = signed out or not loaded yet; {} = loaded but no row saved
  async function loadProfile(){ if(!USER){ PROFILE=null; return; } try{ const { data }=await SB.from('profiles').select('*').eq('id',uid()).maybeSingle(); PROFILE=data||{}; }catch{} }
  const mergeSets = (a,b)=>{ a=a||[]; b=b||[]; const n=Math.max(a.length,b.length), o=[]; for(let i=0;i<n;i++) o.push(Math.max(a[i]||0,b[i]||0)); return o; };
  const titleFor = k => { const cn=LOGS[k]&&LOGS[k].customName; return cn || (typeof sessionFor==='function' ? sessionFor(k).title : ''); };
  const tagFor   = k => (typeof sessionFor==='function' ? sessionFor(k).tag   : '');

  /* ---- sync status as a header-ribbon icon (sits with the theme + streak controls) ---- */
  function syncBtn(){
    let b=document.getElementById('syncBtn');
    if(!b){ const hdr=document.querySelector('.app-header'), tt=document.getElementById('themeToggle');
      if(!hdr) return null;
      b=document.createElement('button'); b.id='syncBtn'; b.className='hdr-btn';
      hdr.insertBefore(b, tt || null); }
    return b;
  }
  function bar(){
    const b=syncBtn(); if(!b) return; const ic=(typeof icon==='function')?icon:(n=>'');
    if(USER){ b.className='hdr-btn synced'; b.setAttribute('aria-label','Synced — account options');
      b.title='Synced to the cloud'; b.innerHTML=ic('cloudCheck',18); b.onclick=openSyncSheet;
    } else { b.className='hdr-btn offline'; b.setAttribute('aria-label','Not syncing — sign in');
      b.title='Not syncing (local only)'; b.innerHTML=ic('cloudOff',18); b.onclick=openAuth; }
  }
  function openSyncSheet(){
    const ic=(typeof icon==='function')?icon:(n=>'');
    const wrap=document.createElement('div'); wrap.className='sheet-backdrop';
    wrap.innerHTML=`<div class="sheet"><div class="sheet-handle"></div>
      <div class="sheet-title">Cloud sync</div>
      <div class="hint" style="margin-bottom:14px">Your workouts, weights, and PRs are backed up and synced across every device you sign in on.</div>
      <div class="sync-acct">${ic('cloudCheck',18)} <span>Signed in as <b>${(USER&&USER.email)||''}</b></span></div>
      <button class="btn btn-ghost" id="syncSignOut" style="margin-top:16px">Sign out</button>
      <button class="sheet-skip" id="syncClose">Close</button></div>`;
    document.body.appendChild(wrap); requestAnimationFrame(()=>wrap.classList.add('show'));
    const close=()=>{ wrap.classList.remove('show'); setTimeout(()=>wrap.remove(),220); };
    wrap.querySelector('#syncClose').onclick=close; wrap.onclick=e=>{ if(e.target===wrap) close(); };
    wrap.querySelector('#syncSignOut').onclick=async()=>{ close(); await SB.auth.signOut(); toast&&toast('Signed out'); };
  }
  function openAuth(){
    let savedEmail=''; try{ savedEmail = localStorage.getItem('mg_email')||''; }catch{}
    let mode = savedEmail ? 'signin' : 'signup';
    const wrap=document.createElement('div'); wrap.className='sheet-backdrop';
    document.body.appendChild(wrap); requestAnimationFrame(()=>wrap.classList.add('show'));
    const close=()=>{ wrap.classList.remove('show'); setTimeout(()=>wrap.remove(),220); };
    wrap.onclick=e=>{ if(e.target===wrap) close(); };
    async function go(){
      const email=wrap.querySelector('#auEmail').value.trim(), password=wrap.querySelector('#auPw').value;
      const msg=t=>{ const m=wrap.querySelector('#auMsg'); if(m) m.textContent=t; };
      if(!email || !password) return msg('Enter your email and password.');
      if(mode==='signup' && password.length<8) return msg('Password must be 8+ characters.');
      msg(mode==='signin'?'Signing in…':'Creating account…');
      if(mode==='signin'){
        const { error }=await SB.auth.signInWithPassword({email,password});
        if(error){ msg(/invalid/i.test(error.message)?'⚠️ Wrong email or password. New here? Tap “Create an account”.':'⚠️ '+error.message); }
        else { try{ localStorage.setItem('mg_email', email); }catch{} close(); }
      } else {
        const { data, error }=await SB.auth.signUp({email,password});
        if(error) msg('⚠️ '+error.message);
        else if(data.session){ try{ localStorage.setItem('mg_email', email); }catch{} toast&&toast('Welcome! ☁️'); close(); }
        else msg('✅ Account created — check your email to confirm, then sign in.');
      }
    }
    async function resetPw(){
      const email=wrap.querySelector('#auEmail').value.trim();
      const msg=t=>{ const m=wrap.querySelector('#auMsg'); if(m) m.textContent=t; };
      if(!email) return msg('Type your email above first, then tap “Forgot password.”');
      msg('Sending reset link…');
      const { error }=await SB.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      if(error) msg('⚠️ '+error.message);
      else msg('✅ Check your email for a password-reset link (check spam too).');
    }
    function paint(){
      const signin = mode==='signin';
      wrap.innerHTML=`<div class="sheet"><div class="sheet-handle"></div>
        <div class="sheet-title">${signin?'Welcome back 👋':'Create your account ☁️'}</div>
        <div class="hint" style="margin-bottom:8px">${signin?'Sign in to sync your training across all your devices.':'One free account keeps your workouts synced on every device.'}</div>
        <form id="auForm">
          <input id="auEmail" type="email" inputmode="email" autocapitalize="off" autocorrect="off" placeholder="Email" autocomplete="username" value="${savedEmail.replace(/"/g,'&quot;')}" />
          <input id="auPw" type="password" placeholder="${signin?'Password':'Password (8+ characters)'}" autocomplete="${signin?'current-password':'new-password'}" />
          <div id="auMsg" class="hint"></div>
          <button type="submit" class="btn btn-primary" id="auGo">${signin?'Sign in':'Create account'}</button>
        </form>
        <button class="btn btn-ghost" id="auToggle" style="margin-top:8px">${signin?'New here? Create an account':'Already have an account? Sign in'}</button>
        ${signin?`<button class="au-forgot" id="auForgot" type="button">Forgot password?</button>`:''}
        <button class="sheet-skip" id="auCancel">Cancel</button></div>`;
      const f=wrap.querySelector('#auForm'); if(f) f.onsubmit=(e)=>{ e.preventDefault(); go(); };
      wrap.querySelector('#auToggle').onclick=()=>{ mode = signin?'signup':'signin'; paint(); };
      { const fp=wrap.querySelector('#auForgot'); if(fp) fp.onclick=resetPw; }
      wrap.querySelector('#auCancel').onclick=close;
      const focusEl = savedEmail ? wrap.querySelector('#auPw') : wrap.querySelector('#auEmail');
      if(focusEl) setTimeout(()=>{ try{ focusEl.focus(); }catch{} },260);
    }
    paint();
  }

  function openNewPassword(){
    const wrap=document.createElement('div'); wrap.className='sheet-backdrop';
    wrap.innerHTML=`<div class="sheet"><div class="sheet-handle"></div>
      <div class="sheet-title">Set a new password 🔑</div>
      <div class="hint" style="margin-bottom:6px">Enter a new password for your account.</div>
      <form id="npForm">
        <input id="npPw" type="password" placeholder="New password (8+ characters)" autocomplete="new-password" />
        <div id="npMsg" class="hint"></div>
        <button type="submit" class="btn btn-primary" id="npSave">Update password</button>
      </form></div>`;
    document.body.appendChild(wrap); requestAnimationFrame(()=>wrap.classList.add('show'));
    const close=()=>{ wrap.classList.remove('show'); setTimeout(()=>wrap.remove(),220); };
    const q=s=>wrap.querySelector(s);
    const go=async()=>{ const pw=q('#npPw').value; const msg=t=>{ const m=q('#npMsg'); if(m) m.textContent=t; };
      if(pw.length<8) return msg('Password must be 8+ characters.');
      msg('Updating…');
      const { error }=await SB.auth.updateUser({ password:pw });
      if(error) msg('⚠️ '+error.message);
      else { if(typeof toast==='function') toast('✅ Password updated'); close(); } };
    q('#npForm').onsubmit=(e)=>{ e.preventDefault(); go(); };
    setTimeout(()=>{ const p=q('#npPw'); if(p) p.focus(); },260);
  }

  /* ---- personal data sync ---- */
  async function pull(pushLocal){
    if(!USER) return; const u=uid();
    try{
      const [days,wts,prs] = await Promise.all([
        SB.from('days').select('*').eq('user_id',u),
        SB.from('weights').select('*').eq('user_id',u),
        SB.from('prs').select('*').eq('user_id',u),
      ]);
      (days.data||[]).forEach(r=>{ const cur=LOGS[r.d]||{};
        LOGS[r.d]={ done:!!(cur.done||r.completed), sets:mergeSets(cur.sets,r.sets),
          swaps:Object.assign({}, r.swaps||{}, cur.swaps||{}), debrief:cur.debrief||r.debrief||undefined,
          sessionOverride: cur.sessionOverride || (r.plan&&r.plan.override) || undefined,
          customSession: cur.customSession || (r.plan&&r.plan.custom) || undefined,
          customEx: cur.customEx || (r.plan&&r.plan.ex) || undefined,
          addedEx: cur.addedEx || (r.plan&&r.plan.added) || undefined,
          removedEx: cur.removedEx || (r.plan&&r.plan.removed) || undefined,
          customName: cur.customName || (r.plan&&r.plan.name) || undefined }; });
      const wmap={}; (wts.data||[]).forEach(r=>wmap[r.d]=Number(r.lb)); WEIGHTS.forEach(w=>wmap[w.date]=w.w);
      WEIGHTS=Object.entries(wmap).map(([date,w])=>({date,w})).sort((a,b)=>a.date.localeCompare(b.date));
      const seen=new Set(PRS.map(p=>p.date+'|'+p.lift+'|'+p.w));
      (prs.data||[]).forEach(r=>{ const key=r.d+'|'+r.lift+'|'+Number(r.lb); if(!seen.has(key)){ seen.add(key); PRS.push({date:r.d,lift:r.lift,w:Number(r.lb),_s:true}); } });
      store.set('mg_logs',LOGS); store.set('mg_weights',WEIGHTS); store.set('mg_prs',PRS);
      if(pushLocal){ await ensureProfile(); await pushAll(); }
      // don't yank the UI out from under an open sheet or a field being typed in
      const busy = document.querySelector('.sheet-backdrop') || (document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName));
      if(typeof render==='function' && !busy) render();
    }catch(e){ console.warn('pull failed', e); }
  }
  async function pushAll(){
    if(!USER) return; const u=uid();
    try{
      const dayRows=Object.entries(LOGS).map(([d,v])=>({ user_id:u, d, completed:!!v.done, sets:v.sets||[], swaps:v.swaps||{}, debrief:v.debrief||null,
        plan:{ title:titleFor(d), tag:tagFor(d), override:v.sessionOverride||null, custom:v.customSession||null, ex:v.customEx||null, added:v.addedEx||null, removed:v.removedEx||null, name:v.customName||null }, updated_at:new Date().toISOString() }));
      if(dayRows.length){ const { error }=await SB.from('days').upsert(dayRows,{ onConflict:'user_id,d' });
        if(error){ console.warn('days push failed', error); if(typeof toast==='function') toast('⚠️ Save failed: '+(error.message||error.code||'unknown — check column names')); } }
      const wRows=WEIGHTS.map(w=>({ user_id:u, d:w.date, lb:w.w }));
      if(wRows.length) await SB.from('weights').upsert(wRows,{ onConflict:'user_id,d' });
      const newPRs=PRS.filter(p=>!p._s);
      if(newPRs.length){ const { error }=await SB.from('prs').insert(newPRs.map(p=>({ user_id:u, d:p.date, lift:p.lift, lb:p.w })));
        if(!error){ newPRs.forEach(p=>p._s=true); store.set('mg_prs',PRS); } }
    }catch(e){ console.warn('push failed', e); }
  }
  function queuePush(){ if(!USER) return; clearTimeout(pushT); pushT=setTimeout(pushAll,1200); }
  async function flush(){ if(!USER) return; clearTimeout(pushT); try{ await pushAll(); }catch(e){ console.warn('flush', e); } }

  /* ---- social ---- */
  async function ensureProfile(){
    if(!USER) return;
    try{ await SB.from('profiles').upsert({ id:uid(), display_name:(USER.email||'').split('@')[0], emoji:'💪' }, { onConflict:'id', ignoreDuplicates:true }); }catch(e){ console.warn('ensureProfile', e); }
  }
  const social = {
    async myProfile(){ const { data }=await SB.from('profiles').select('*').eq('id',uid()).maybeSingle(); return data; },
    async userProfile(id){ const { data }=await SB.from('profiles').select('*').eq('id',id).maybeSingle(); return data; },
    // a single user's completed workouts (RLS: visible if you follow them, or it's you)
    async userDays(id){ const { data }=await SB.from('days').select('*').eq('user_id',id).eq('completed',true).order('d',{ascending:false}).limit(30); return data||[]; },
    // returns null on success, or a friendly error string
    async saveProfile(p){
      if(!uid()) return 'You’re not signed in yet — sign in first.';
      const row={ id:uid() };
      if(p.display_name!=null) row.display_name=p.display_name.slice(0,40);
      if(p.emoji) row.emoji=p.emoji.slice(0,8);
      if(p.avatar!==undefined){ if(p.avatar && p.avatar.length>500000) return 'Photo is too large — try a smaller image.'; row.avatar=p.avatar||null; }
      if(p.goals!=null) row.goals=p.goals.slice(0,280);
      if(p.quote!=null) row.quote=p.quote.slice(0,200);
      if(p.movie!=null) row.movie=p.movie.slice(0,120);
      if(p.handle!=null){
        const h=(p.handle||'').replace(/[^a-zA-Z0-9_]/g,'').toLowerCase();
        if(h && (h.length<3 || h.length>20)) return 'Handle must be 3–20 letters, numbers, or _.';
        row.handle = h || null;
      }
      const { error }=await SB.from('profiles').upsert(row, { onConflict:'id' });
      if(!error) return null;
      if(/duplicate|unique|23505/i.test(error.message||'')) return 'That handle is taken — try another.';
      return error.message || 'Could not save — try again.';
    },
    async follow(handle){ const h=String(handle||'').replace(/^@/,'').trim().toLowerCase();
      const { data }=await SB.from('profiles').select('id,handle').eq('handle',h).maybeSingle();
      if(!data) return 'No one found with @'+h;
      if(data.id===uid()) return 'That’s you 🙂';
      const { error }=await SB.from('follows').insert({ follower:uid(), followee:data.id });
      if(error && !/duplicate|unique/i.test(error.message)) return error.message; return null; },
    async unfollow(id){ await SB.from('follows').delete().eq('follower',uid()).eq('followee',id); },
    async following(){ const { data:fl }=await SB.from('follows').select('followee').eq('follower',uid());
      const ids=(fl||[]).map(x=>x.followee); if(!ids.length) return [];
      const { data:pf }=await SB.from('profiles').select('*').in('id',ids); return pf||[]; },
    // everyone on the app who has set a handle (so you can follow without knowing it)
    async discover(){ const { data }=await SB.from('profiles').select('*').not('handle','is',null).neq('id',uid()).order('display_name').limit(60); return data||[]; },
    async feed(){ const { data:fl }=await SB.from('follows').select('followee').eq('follower',uid());
      const ids=[...new Set([uid(), ...((fl||[]).map(x=>x.followee))])]; // you + everyone you follow
      const [{ data:days }, { data:pf }]=await Promise.all([
        SB.from('days').select('*').in('user_id',ids).eq('completed',true).order('d',{ascending:false}).limit(80),
        SB.from('profiles').select('*').in('id',ids) ]);
      const profiles={}; (pf||[]).forEach(p=>profiles[p.id]=p); return { items:days||[], profiles }; }
  };

  window.MGSync = Object.assign({ onLocalChange:queuePush, signedIn:()=>!!USER, myId:()=>uid(), flush,
    displayName:()=> (PROFILE&&PROFILE.display_name) || (USER&&USER.email ? USER.email.split('@')[0] : ''),
    profile:()=>PROFILE, openAuth,
    reloadProfile:async()=>{ await loadProfile(); if(typeof render==='function') render(); } }, social);

  async function init(){
    try{ const { data }=await SB.auth.getSession(); USER=data.session?.user||null; }catch{}
    bar();
    SB.auth.onAuthStateChange(async (ev,s)=>{ USER=s?.user||null; bar();
      if(ev==='PASSWORD_RECOVERY'){ openNewPassword(); }
      if(USER){ toast&&toast('Syncing ☁️'); await loadProfile(); await pull(true); } else { PROFILE=null; if(typeof render==='function') render(); } });
    if(USER){ await loadProfile(); await pull(true); }
  }
  // Re-sync from the cloud whenever the app comes back into view (catches edits made on another device)
  const refresh = ()=>{ if(USER && !document.hidden) pull(false); };
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('focus', refresh);
  init();
})();
