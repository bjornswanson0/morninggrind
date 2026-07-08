/* Morning Grind — cloud sync + social (Supabase). Local-first; syncs when signed in. */
(function(){
  if(!window.supabase || typeof SUPABASE_URL==='undefined'){ return; }
  const SB = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
  });
  let USER = null, pushT = null, PROFILE = null;
  const uid = ()=> USER && USER.id;
  async function loadProfile(){ if(!USER){ PROFILE=null; return; } try{ const { data }=await SB.from('profiles').select('*').eq('id',uid()).maybeSingle(); PROFILE=data||null; }catch{} }
  const mergeSets = (a,b)=>{ a=a||[]; b=b||[]; const n=Math.max(a.length,b.length), o=[]; for(let i=0;i<n;i++) o.push(Math.max(a[i]||0,b[i]||0)); return o; };
  const titleFor = k => (typeof sessionFor==='function' ? sessionFor(k).title : '');
  const tagFor   = k => (typeof sessionFor==='function' ? sessionFor(k).tag   : '');

  /* ---- status bar under the header ---- */
  function bar(){
    let el=document.getElementById('authBar');
    if(!el){ el=document.createElement('div'); el.id='authBar'; const v=document.getElementById('view'); v.parentNode.insertBefore(el, v); }
    if(USER){ el.className='authbar in';
      el.innerHTML=`<span>☁️ Synced · ${USER.email}</span><button id="signOut">Sign out</button>`;
      el.querySelector('#signOut').onclick=async()=>{ await SB.auth.signOut(); toast&&toast('Signed out'); };
    } else { el.className='authbar out';
      el.innerHTML=`<span>⚠️ Not syncing (local only)</span><button id="signInBtn">Sign in to sync</button>`;
      el.querySelector('#signInBtn').onclick=openAuth; }
  }
  function openAuth(){
    const wrap=document.createElement('div'); wrap.className='sheet-backdrop';
    wrap.innerHTML=`<div class="sheet"><div class="sheet-handle"></div>
      <div class="sheet-title">Sync your account ☁️</div>
      <div class="hint" style="margin-bottom:4px">Use the same email + password on every device to keep them in sync.</div>
      <input id="auEmail" type="email" placeholder="email" autocomplete="username" />
      <input id="auPw" type="password" placeholder="password (8+ characters)" autocomplete="current-password" />
      <div id="auMsg" class="hint"></div>
      <button class="btn btn-primary" id="auSignIn">Sign in</button>
      <button class="btn btn-ghost" id="auSignUp" style="margin-top:8px">Create account</button>
      <button class="sheet-skip" id="auCancel">Cancel</button></div>`;
    document.body.appendChild(wrap); requestAnimationFrame(()=>wrap.classList.add('show'));
    const close=()=>{ wrap.classList.remove('show'); setTimeout(()=>wrap.remove(),220); };
    const msg=t=>wrap.querySelector('#auMsg').textContent=t;
    const creds=()=>({ email:wrap.querySelector('#auEmail').value.trim(), password:wrap.querySelector('#auPw').value });
    wrap.querySelector('#auCancel').onclick=close; wrap.onclick=e=>{ if(e.target===wrap) close(); };
    wrap.querySelector('#auSignIn').onclick=async()=>{ const c=creds();
      if(!c.email || !c.password) return msg('Enter your email and password.');
      msg('Signing in…');
      const { error }=await SB.auth.signInWithPassword(c);
      if(error) msg(/invalid/i.test(error.message) ? '⚠️ Wrong email/password — new here? Tap “Create account”.' : '⚠️ '+error.message);
      else close(); };
    wrap.querySelector('#auSignUp').onclick=async()=>{ const c=creds();
      if(!c.email) return msg('Enter an email first.');
      if(c.password.length<8) return msg('Password must be 8+ characters.');
      msg('Creating account…'); const { data, error }=await SB.auth.signUp(c);
      if(error) msg('⚠️ '+error.message);
      else if(data.session) { toast&&toast('Welcome! ☁️'); close(); }
      else msg('✅ Account created — check your email to confirm, then tap “Sign in”.'); };
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
          customSession: cur.customSession || (r.plan&&r.plan.custom) || undefined }; });
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
        plan:{ title:titleFor(d), tag:tagFor(d), override:v.sessionOverride||null, custom:v.customSession||null }, updated_at:new Date().toISOString() }));
      if(dayRows.length) await SB.from('days').upsert(dayRows,{ onConflict:'user_id,d' });
      const wRows=WEIGHTS.map(w=>({ user_id:u, d:w.date, lb:w.w }));
      if(wRows.length) await SB.from('weights').upsert(wRows,{ onConflict:'user_id,d' });
      const newPRs=PRS.filter(p=>!p._s);
      if(newPRs.length){ const { error }=await SB.from('prs').insert(newPRs.map(p=>({ user_id:u, d:p.date, lift:p.lift, lb:p.w })));
        if(!error){ newPRs.forEach(p=>p._s=true); store.set('mg_prs',PRS); } }
    }catch(e){ console.warn('push failed', e); }
  }
  function queuePush(){ if(!USER) return; clearTimeout(pushT); pushT=setTimeout(pushAll,1200); }

  /* ---- social ---- */
  async function ensureProfile(){
    if(!USER) return;
    try{ await SB.from('profiles').upsert({ id:uid(), display_name:(USER.email||'').split('@')[0], emoji:'💪' }, { onConflict:'id', ignoreDuplicates:true }); }catch(e){ console.warn('ensureProfile', e); }
  }
  const social = {
    async myProfile(){ const { data }=await SB.from('profiles').select('*').eq('id',uid()).maybeSingle(); return data; },
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
      const ids=(fl||[]).map(x=>x.followee); if(!ids.length) return { items:[], profiles:{} };
      const [{ data:days }, { data:pf }]=await Promise.all([
        SB.from('days').select('*').in('user_id',ids).eq('completed',true).order('d',{ascending:false}).limit(40),
        SB.from('profiles').select('*').in('id',ids) ]);
      const profiles={}; (pf||[]).forEach(p=>profiles[p.id]=p); return { items:days||[], profiles }; }
  };

  window.MGSync = Object.assign({ onLocalChange:queuePush, signedIn:()=>!!USER,
    displayName:()=> (PROFILE&&PROFILE.display_name) || (USER&&USER.email ? USER.email.split('@')[0] : ''),
    reloadProfile:async()=>{ await loadProfile(); if(typeof render==='function') render(); } }, social);

  async function init(){
    try{ const { data }=await SB.auth.getSession(); USER=data.session?.user||null; }catch{}
    bar();
    SB.auth.onAuthStateChange(async (_e,s)=>{ USER=s?.user||null; bar(); if(USER){ toast&&toast('Syncing ☁️'); await loadProfile(); await pull(true); } else { PROFILE=null; if(typeof render==='function') render(); } });
    if(USER){ await loadProfile(); await pull(true); }
  }
  // Re-sync from the cloud whenever the app comes back into view (catches edits made on another device)
  const refresh = ()=>{ if(USER && !document.hidden) pull(false); };
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('focus', refresh);
  init();
})();
