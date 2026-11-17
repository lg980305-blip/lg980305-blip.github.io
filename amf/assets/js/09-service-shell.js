/* AMF Commerce Intelligence Engine — 09-service-shell
   자동 분리: tools/split_monolith.py · 클래식 스크립트(전역 스코프 공유), 로드 순서 유지 */
/* ═══════════ 서비스 셸: 로그인 · 크레딧 · 모바일 탭 ═══════════ */
(function(){
const KEY='amf.cie.v1';
let ST={user:null,coin:30,claimed:null,ledger:[],runs:0};
try{const raw=localStorage.getItem(KEY); if(raw) ST=Object.assign(ST,JSON.parse(raw));}catch(e){}
const saveST=()=>{try{localStorage.setItem(KEY,JSON.stringify(ST));}catch(e){}};
const E=id=>document.getElementById(id);
const PRICE={run:3, json:2, csv:2};

function crSync(){
  const n=E('crn'); if(n) n.textContent=ST.coin;
}
function who(){
  if(!ST.user) return;
  const wn=document.querySelector('.who .wn'), av=document.querySelector('.who .av');
  if(wn) wn.textContent=ST.user.name;
  if(av) av.textContent=(ST.user.name||'U').slice(0,2).toUpperCase();
}
let MODAL_RETURN=null;
function crModal(html){
  E('crbox').innerHTML=html;
  MODAL_RETURN=document.activeElement;
  E('crmodal').classList.add('on');
  const f=E('crbox').querySelector('button');
  if(f) setTimeout(()=>{ try{ f.focus({preventScroll:true}); }catch(e){} },0);
}
function crClose(){
  E('crmodal').classList.remove('on');
  if(MODAL_RETURN && document.contains(MODAL_RETURN)){
    try{ MODAL_RETURN.focus({preventScroll:true}); }catch(e){}
  }
  MODAL_RETURN=null;
}
E('crmodal').addEventListener('click',e=>{ if(e.target===E('crmodal')) crClose(); });

function earn(n,label){ ST.coin+=n; ST.ledger.push({t:label,n,at:Date.now()}); saveST(); crSync(); }
/* 구독 · 요금제(plans.js)가 월 크레딧을 적립하고 사용자 정보를 읽을 수 있게 최소한만 노출한다 */
window.amfCredits={ earn:(n,label)=>earn(n,label), spend:(kind,label)=>spend(kind,label), balance:()=>ST.coin, user:()=>ST.user };
function spend(kind,label){
  const c=PRICE[kind]||0;
  if(ST.coin<c){
    crModal(`<div class="emo">🪙</div><h3>${T('크레딧이 부족합니다')}</h3>
      <p>${T('이 작업에는')} <b>${c} 크레딧</b>${T('이 필요합니다.')}<br>현재 보유 ${ST.coin} 크레딧.</p>
      <button class="ok" id="cr-claim">${T('출석 보상 받기')}</button>
      <button class="no" id="cr-x">${T('닫기')}</button>`);
    E('cr-claim').onclick=()=>{ crClose(); if(!claimDaily()) alertToast(T('오늘 출석 보상은 이미 받았습니다')); };
    E('cr-x').onclick=crClose;
    return false;
  }
  ST.coin-=c; ST.ledger.push({t:label,n:-c,at:Date.now()}); saveST(); crSync(); return true;
}
function claimDaily(){
  const today=new Date().toISOString().slice(0,10);
  if(ST.claimed===today) return false;
  ST.claimed=today; earn(5,T('일일 출석 보상')); return true;
}
/* 토스트는 전역 구현 하나만 쓴다 (테마·접근성 속성이 거기 붙어 있다) */
const alertToast=(msg,label,fn)=>toast(msg,label,fn);
/* 크레딧 환불 — 실행이 실패했을 때만 되돌린다 */
function refund(kind,label){
  const c=PRICE[kind]||0; if(!c) return;
  ST.coin+=c; ST.ledger.push({t:label+T(' (환불)'),n:c,at:Date.now()}); saveST(); crSync();
}
function dailyPrompt(){
  const today=new Date().toISOString().slice(0,10);
  if(ST.claimed===today) return;
  crModal(`<div class="emo">🎁</div><h3>${T('일일 출석 보상')}</h3>
    <p>${T('오늘도 접속해 주셔서 감사합니다.')}<br>${T('크레딧')} <b>5</b>${T('를 드립니다.')}</p>
    <button class="ok" id="cr-ok">${T('크레딧 받기')}</button>
    <button class="no" id="cr-no">${T('다음에 받을게요')}</button>`);
  E('cr-ok').onclick=()=>{ claimDaily(); crClose(); alertToast(T('5 크레딧을 받았습니다')); };
  E('cr-no').onclick=crClose;
}

/* 크레딧 칩 → 내역 */
E('crchip').addEventListener('click',()=>{
  crModal(`<div class="emo">🪙</div><h3>크레딧 ${ST.coin}</h3>
    <p>${T('매칭 실행 3 · JSON 내보내기 2 · CSV 내보내기 2 크레딧이 차감됩니다.')}<br>
       매일 첫 접속 시 5 크레딧을 드립니다. 실행이 실패하면 자동 환불됩니다.</p>
    <div class="cr-led">${ST.ledger.length?ST.ledger.slice(-25).reverse().map(x=>
      `<div><span>${x.t}</span><b class="${x.n>0?'p':'m'}">${x.n>0?'+':''}${x.n}</b></div>`).join('')
      :T('<div><span>아직 내역이 없습니다</span><b></b></div>')}</div>
    <button class="ok" id="cr-claim2">${T('출석 보상 받기')}</button>
    <button class="no" id="cr-x2">${T('닫기')}</button>`);
  E('cr-claim2').onclick=()=>{ crClose(); if(!claimDaily()) alertToast(T('오늘 출석 보상은 이미 받았습니다')); else alertToast(T('5 크레딧을 받았습니다')); };
  E('cr-x2').onclick=crClose;
});

/* 원본 함수 래핑 — 로직 무손상, 크레딧만 얹는다.
   ┌ 규칙 1: 결과물이 나올 수 없는 호출은 차감 '전에' 막는다.
   │         (예전에는 매칭 전 JSON 버튼을 눌러도 2크레딧이 먼저 사라졌다)
   └ 규칙 2: 실행이 실패하면 환불한다. */
const _run=window.runPipeline, _json=window.exportJSON, _csv=window.exportCSV;

window.runPipeline=function(){
  if(!spend('run',T('매칭 실행'))) return false;
  ST.runs++; saveST();
  let ok;
  try{ ok=_run.apply(this,arguments); }
  catch(e){ console.error(e); ok=false; }
  if(ok===false){ refund('run',T('매칭 실행')); return false; }
  return ok;
};

function guardedExport(kind, label, fn, ctx, args){
  if(!window.LAST){ toast(T('먼저 매칭을 실행하세요')); return false; }   /* 차감 전에 확인 */
  if(!spend(kind, label)) return false;
  let ok;
  try{ ok=fn.apply(ctx, args); }
  catch(e){ console.error(e); ok=false; }
  if(ok===false){ refund(kind, label); return false; }
  return ok;
}
window.exportJSON=function(){ return guardedExport('json',T('결과 JSON 내보내기'),_json,this,arguments); };
window.exportCSV =function(){ return guardedExport('csv',T('포트폴리오 CSV 내보내기'),_csv,this,arguments); };

/* 모바일 하단 탭 ↔ showView 동기화 */
const _show=window.showView;
window.showView=function(v){
  document.querySelectorAll('#mtab button').forEach(b=>b.classList.toggle('on',b.dataset.mview===v));
  return _show.apply(this,arguments);
};
document.querySelectorAll('#mtab button[data-mview]').forEach(b=>b.onclick=()=>window.showView(b.dataset.mview));

/* 게이트 */
function enter(auto){
  E('gate').classList.add('off');
  who(); crSync();
  const m=document.getElementById('mainContent');
  if(m) try{ m.focus({preventScroll:true}); }catch(e){}
  /* 자동 진입일 때는 출석 모달을 띄우지 않는다. 크레딧 칩에서 언제든 받을 수 있다. */
  if(!auto) dailyPrompt();
}
function doLogin(kind){
  const mail = kind==='email' ? (E('gl-email').value.trim()||'analyst@amf.co')
             : 'demo@example.com';
  ST.user={name:mail.split('@')[0], mail}; saveST(); enter();
}
document.querySelectorAll('[data-glogin]').forEach(b=>b.addEventListener('click',e=>{
  if(b.type==='submit') return;          /* 폼 submit 핸들러가 처리한다 */
  doLogin(b.dataset.glogin);
}));
/* 이메일 입력 후 Enter 로도 로그인되게 한다 (예전에는 폼이 없어 Enter 가 먹지 않았다) */
const glForm=E('gl-form');
if(glForm) glForm.addEventListener('submit', e=>{ e.preventDefault(); doLogin('email'); });
crSync();
/* 데모 링크로 들어온 사람은 로그인 화면을 볼 이유가 없다 — 바로 콘솔로 들여보낸다.
   로그인 UI 자체를 보여줘야 할 때는 주소 끝에 #login 을 붙이면 된다. */
const wantLogin = /(^|[#&])login\b/.test(location.hash||'');
if(ST.user && !wantLogin){ enter(true); }   /* 자동 진입 — 출석 모달이 첫 화면을 막지 않는다 */
else if(!wantLogin){
  ST.user={name:'Kim, Analyst', mail:'analyst@amf.co', demo:true};
  saveST();
  enter(true);          /* true = 자동 진입. 출석 모달로 첫 화면을 막지 않는다 */
}
})();

/* ═══════════ PWA ═══════════
   Vercel 등 정적 호스팅에 올렸을 때만 동작한다.
   아티팩트 뷰어나 file:// 에서는 /sw.js 가 없어 조용히 실패하며, 앱 동작에는 영향이 없다. */
/* GitHub Pages 사본에서는 서비스워커를 등록하지 않는다.
   이 도메인 루트에 이미 다른 서비스워커가 있고, 그 activate 훅이 출처 전체의
   캐시를 지우기 때문에 둘이 서로의 캐시를 없앤다. 오프라인·설치 기능은
   전용 도메인(Vercel) 배포본에서만 켠다. */

/* ═══════════════════════════════════════════════════════════════════════
   소개 페이지 ↔ 앱 모드
   ─────────────────────────────────────────────────────────────────────
   한 파일이 두 가지로 뜬다.
     · 최상위 창에서 열면  → 왼쪽 설명 + 폰 목업 (소개)
     · iframe 안이거나 ?app=1 이면 → 앱 그대로 (폰 안의 내용물)
   iframe 판정을 먼저 두는 이유: 호스팅이 쿼리스트링을 떼어내도
   소개 페이지가 자기 안에 자기를 무한히 겹쳐 여는 사고를 막기 위해서다.
   ═══════════════════════════════════════════════════════════════════════ */
/* '우리가 만든 폰 iframe 안인가'만 본다.
   단순히 window.top!==window.self 로 보면, 이 파일 자체를 iframe 으로 띄우는
   호스팅(아티팩트 뷰어 등)에서 소개 페이지가 영영 안 나온다.
   같은 출처의 부모만 frameElement 를 읽을 수 있으므로, 다른 출처의 iframe 은
   '최상위'로 취급된다 — 그게 우리가 원하는 판정이다. */
const EMBED_SELF = (function(){
  try{ const fe=window.frameElement; return !!(fe && fe.id==='pmFrame'); }
  catch(e){ return false; }
})();
/* 최후의 안전장치: 쿼리스트링도 frameElement 도 막힌 환경에서 소개가 자기를
   무한히 겹쳐 여는 것을 3단계에서 끊는다. */
const NEST = (function(){ let n=0,w=window; try{ while(w!==w.parent && n<8){ w=w.parent; n++; } }catch(e){ n++; } return n; })();
const APP_MODE = /[?&]app=1/.test(location.search) || EMBED_SELF || NEST>=3;

if(APP_MODE){
  /* 폰 안(또는 전체 화면) — 소개 껍데기는 아예 띄우지 않는다 */
  const pr=document.getElementById('promo'); if(pr) pr.remove();
  /* 준비되면 바깥에 알린다. 소개 페이지는 이 신호로 폴백 여부를 판단한다.
     load 이벤트만 믿으면 파일이 무거울 때 아직 로딩 중인데 실패로 오판한다. */
  try{ if(window.parent && window.parent!==window)
        window.parent.postMessage({amf:'ready'}, '*'); }catch(e){}
  /* 바깥(소개 페이지)에서 보내는 화면 전환 요청 */
  window.addEventListener('message', e=>{
    const d=e.data;
    if(!d || d.amf!=='view' || typeof d.v!=='string') return;
    try{ showView(d.v); }catch(err){}
  });
}else{
  document.documentElement.classList.add('promo');
  const pr=document.getElementById('promo');
  if(pr) pr.hidden=false;
  document.title='AMF 커머스 인텔리전스 — 작동 목업';

  const frame=document.getElementById('pmFrame');
  const appURL=(()=>{ const u=new URL(location.href); u.searchParams.set('app','1');
    u.hash=''; return u.toString(); })();
  let ready=false;
  window.addEventListener('message', e=>{
    if(e.data && e.data.amf==='ready'){
      ready=true;
      const fb=document.getElementById('pmFallback'); if(fb) fb.hidden=true;
    }
  });
  if(frame){
    frame.addEventListener('load',()=>{ ready=true; });
    frame.src=appURL;
    /* 앱이 '준비됨'을 알리지 않으면(임베드 차단 등) 전체 화면 버튼만 남긴다 */
    setTimeout(()=>{ if(!ready){ const fb=document.getElementById('pmFallback');
      if(fb) fb.hidden=false; } }, 12000);
  }

  const list=document.getElementById('pmList');
  const go=v=>{
    if(!frame || !frame.contentWindow) return;
    frame.contentWindow.postMessage({amf:'view', v}, '*');
    list.querySelectorAll('li').forEach(li=>li.classList.toggle('on', li.dataset.view===v));
  };
  if(list){
    list.querySelectorAll('li').forEach(li=>{
      li.tabIndex=0;
      li.setAttribute('role','button');
      li.onclick=()=>go(li.dataset.view);
      li.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); go(li.dataset.view); } };
    });
    list.querySelector('li').classList.add('on');
  }
  const full=document.getElementById('pmFull');
  if(full) full.onclick=()=>{ location.href=appURL; };
  const reset=document.getElementById('pmReset');
  if(reset) reset.onclick=()=>{ if(frame) frame.src=appURL;
    if(list){ list.querySelectorAll('li').forEach(li=>li.classList.remove('on'));
      list.querySelector('li').classList.add('on'); } };
}

/* ═══════════ 언어 초기 적용 ═══════════
   Gemini 모듈의 const 가 모두 초기화된 뒤에 호출해야 gemSync() 가 TDZ 에 걸리지 않는다. */
(function(){
  const b=document.getElementById('langBtn');
  if(b) b.onclick=()=>setLang(LANG==='ko'?'en':'ko');
  document.documentElement.lang=LANG;
  applyLang();
})();


