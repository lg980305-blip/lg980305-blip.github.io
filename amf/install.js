/* ============================================================
   AMF COMMERCE INTELLIGENCE ENGINE — 홈 화면에 추가 (PWA 설치)

   링크를 받은 사람이 휴대폰 홈 화면(배경화면)에 앱 아이콘으로 놓을 수 있게 한다.
     · Android Chrome · Edge · 삼성 인터넷: beforeinstallprompt 를 받아 두고 버튼 한 번으로 설치
     · iPhone Safari: 시스템이 프롬프트를 주지 않으므로 '공유 → 홈 화면에 추가' 안내 시트
     · 이미 설치돼 열린 경우(standalone): 아무것도 띄우지 않는다
   서비스 워커(sw.js)도 여기서 등록한다 — 설치 조건 충족 + 오프라인 재실행.
   앱 모드(?app=1 · 폰 프레임 안)에서만 동작한다. index.html 의 APP_MODE 판정과 같다.
   ============================================================ */
(function(){
'use strict';
const APP_MODE=(function(){
  let embed=false; try{ const fe=window.frameElement; embed=!!(fe && fe.id==='pmFrame'); }catch(e){}
  let n=0; try{ let w=window; while(w!==w.parent && n<8){ w=w.parent; n++; } }catch(e){ n++; }
  return /[?&]app=1/.test(location.search) || embed || n>=3;
})();
if(!APP_MODE) return;
if(!/^https?:$/.test(location.protocol)) return;          // file:// 에서는 설치 개념이 없다

/* ── 0. 서비스 워커 ── */
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{ navigator.serviceWorker.register('sw.js',{scope:'./'}).catch(()=>{}); });
}

/* ── 1. 상태 ── */
const STANDALONE=(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true;
if(STANDALONE) return;                                    // 이미 홈 화면에서 열었다
const UA=navigator.userAgent||'';
const IOS=/iPhone|iPad|iPod/.test(UA)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const SAFARI_IOS=IOS&&!/CriOS|FxiOS|EdgiOS/.test(UA);
const ANDROID=/Android/.test(UA);
const MOBILE=IOS||ANDROID||(navigator.maxTouchPoints>1&&window.innerWidth<900);
const EMBED=(function(){ try{ return window.frameElement&&window.frameElement.id==='pmFrame'; }catch(e){ return false; } })();
if(EMBED) return;                                         // 데스크톱 소개 페이지의 폰 프레임 안 — 설치 대상이 아니다
const KEY='amf.cie.install.dismissed';
let deferred=null;                                        // beforeinstallprompt 이벤트
const dismissed=(()=>{ try{ return !!localStorage.getItem(KEY); }catch(e){ return false; } })();

/* ── 2. 문자열 ── */
if(typeof DICT==='object') Object.assign(DICT,{
  '홈 화면에 앱으로 추가':'Add to home screen',
  '아이콘 하나로 바로 열립니다 · 로그인 · 설치 파일 없음':'Opens from one icon · no login, no download',
  '추가하기':'Add','방법 보기':'How to','닫기':'Close','나중에':'Later',
  '홈 화면에 추가하는 방법':'How to add to your home screen',
  'iPhone · Safari':'iPhone · Safari','Android · Chrome':'Android · Chrome','기타 브라우저':'Other browsers',
  '하단의 공유 버튼을 누릅니다':'Tap the Share button at the bottom',
  '목록에서 홈 화면에 추가를 선택합니다':'Choose Add to Home Screen',
  '오른쪽 위 추가를 누르면 끝입니다':'Tap Add in the top-right corner',
  '오른쪽 위 ⋮ 메뉴를 누릅니다':'Tap the ⋮ menu in the top-right corner',
  '홈 화면에 추가 또는 앱 설치를 선택합니다':'Choose Add to Home screen or Install app',
  '브라우저 메뉴에서 홈 화면에 추가 항목을 찾으세요':'Look for Add to Home screen in the browser menu',
  '이 페이지를 Safari 로 열면 홈 화면에 추가할 수 있습니다':'Open this page in Safari to add it to your home screen',
  '홈 화면에 추가되었습니다':'Added to your home screen'
});
const T_=s=>(typeof T==='function'?T(s):s);

/* ── 3. 스타일 ── */
const CSS=`
.ins-card{display:flex;align-items:center;gap:12px;padding:12px 12px 12px 14px;margin:-6px 0 18px;border-radius:14px;
  background:var(--navy);color:#fff;box-shadow:var(--sh2);position:relative;overflow:hidden}
.ins-card .deco{position:absolute;right:-28px;top:-30px;width:96px;height:96px;border-radius:22px;background:var(--brand);transform:rotate(18deg);opacity:.9}
.ins-ic{width:40px;height:40px;border-radius:11px;flex:none;background:linear-gradient(135deg,#DCB864,#9E7B24);display:flex;align-items:center;justify-content:center;color:#0A1A33;font-weight:900;font-size:12px;letter-spacing:-.3px;position:relative}
.ins-tx{flex:1;min-width:0;position:relative}
.ins-tx b{display:block;font-size:13.5px;font-weight:850;letter-spacing:-.2px}
.ins-tx span{display:block;font-size:11px;color:#C9D2CC;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ins-go{position:relative;flex:none;height:36px;padding:0 14px;border-radius:999px;border:0;background:#fff;color:var(--navy);font:inherit;font-size:12.5px;font-weight:850;cursor:pointer}
.ins-go:hover{background:#EAF1FA}
.ins-x{position:relative;flex:none;width:30px;height:30px;border-radius:50%;border:0;background:rgba(255,255,255,.12);color:#fff;font-size:14px;cursor:pointer;line-height:1}
.ins-x:hover{background:rgba(255,255,255,.22)}
.ins-bg{position:fixed;inset:0;z-index:950;background:rgba(6,12,24,.55);display:flex;align-items:flex-end;justify-content:center;padding:0 0 env(safe-area-inset-bottom)}
.ins-sheet{width:min(520px,100%);background:var(--sheet);color:var(--ink);border-radius:20px 20px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom));box-shadow:var(--sh3);max-height:85vh;overflow:auto}
@media(min-width:600px){ .ins-bg{align-items:center;padding:20px} .ins-sheet{border-radius:20px} }
.ins-sheet h3{margin:0 0 4px;font-size:17px;font-weight:900;letter-spacing:-.3px}
.ins-sheet .sub{font-size:12px;color:var(--ink2);margin-bottom:14px}
.ins-sheet h4{margin:14px 0 6px;font-size:12px;font-weight:800;color:var(--brand);letter-spacing:.3px}
.ins-sheet ol{margin:0;padding:0 0 0 2px;list-style:none;counter-reset:s}
.ins-sheet li{counter-increment:s;display:grid;grid-template-columns:24px 1fr;gap:8px;align-items:center;font-size:13.5px;line-height:1.5;padding:5px 0}
.ins-sheet li::before{content:counter(s);width:22px;height:22px;border-radius:50%;background:var(--surface3);color:var(--ink);font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center}
.ins-sheet .row{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}
.ins-sheet .row button{height:38px;padding:0 16px;border-radius:10px;font:inherit;font-size:13px;font-weight:800;cursor:pointer;border:1px solid var(--line2);background:var(--surface);color:var(--ink)}
.ins-sheet .row button.pri{background:var(--brand);border-color:var(--brand);color:#fff}
.ins-sheet .row button:disabled{opacity:.5;cursor:default}
`;
const st=document.createElement('style'); st.textContent=CSS; document.head.appendChild(st);

/* ── 4. 카드 (홈 상단, 브리프 아래) ── */
let card=null;
function mountCard(){
  if(card||dismissed) return;
  const home=document.getElementById('v_home'); if(!home) return;
  const hero=home.querySelector('.hm-hero'); if(!hero) return;
  card=document.createElement('div'); card.className='ins-card'; card.id='insCard';
  card.innerHTML=`<div class="deco" aria-hidden="true"></div>
    <div class="ins-ic" aria-hidden="true">AMF</div>
    <div class="ins-tx"><b>${T_('홈 화면에 앱으로 추가')}</b><span>${T_('아이콘 하나로 바로 열립니다 · 로그인 · 설치 파일 없음')}</span></div>
    <button type="button" class="ins-go" id="insGo">${T_(deferred?'추가하기':'방법 보기')}</button>
    <button type="button" class="ins-x" id="insX" aria-label="${T_('닫기')}">✕</button>`;
  hero.insertAdjacentElement('afterend',card);
  card.querySelector('#insGo').onclick=go;
  card.querySelector('#insX').onclick=()=>{ dismiss(); };
}
function dismiss(){ try{ localStorage.setItem(KEY,String(Date.now())); }catch(e){} if(card){ card.remove(); card=null; } }
function syncBtn(){ const b=card&&card.querySelector('#insGo'); if(b) b.textContent=T_(deferred?'추가하기':'방법 보기'); }

/* ── 5. 동작 ── */
async function go(){
  if(deferred){
    const ev=deferred; deferred=null;
    try{ ev.prompt(); const r=await ev.userChoice; if(r&&r.outcome==='accepted'){ dismiss(); return; } }catch(e){}
    deferred=ev; syncBtn(); return;
  }
  openSheet();
}
function openSheet(){
  const bg=document.createElement('div'); bg.className='ins-bg'; bg.setAttribute('role','dialog'); bg.setAttribute('aria-modal','true');
  const li=a=>a.map(x=>`<li>${T_(x)}</li>`).join('');
  const ios=`<h4>${T_('iPhone · Safari')}</h4><ol>${li(['하단의 공유 버튼을 누릅니다','목록에서 홈 화면에 추가를 선택합니다','오른쪽 위 추가를 누르면 끝입니다'])}</ol>`;
  const and=`<h4>${T_('Android · Chrome')}</h4><ol>${li(['오른쪽 위 ⋮ 메뉴를 누릅니다','홈 화면에 추가 또는 앱 설치를 선택합니다'])}</ol>`;
  const etc=`<h4>${T_('기타 브라우저')}</h4><ol>${li(['브라우저 메뉴에서 홈 화면에 추가 항목을 찾으세요'])}</ol>`;
  const note=(IOS&&!SAFARI_IOS)?`<p class="sub">${T_('이 페이지를 Safari 로 열면 홈 화면에 추가할 수 있습니다')}</p>`:'';
  const body=IOS?ios+note:(ANDROID?and+etc:ios+and+etc);
  bg.innerHTML=`<div class="ins-sheet"><h3>${T_('홈 화면에 추가하는 방법')}</h3><div class="sub">AMF Commerce Intelligence</div>${body}
    <div class="row"><button type="button" id="insLater">${T_('나중에')}</button><button type="button" class="pri" id="insOk">${T_('닫기')}</button></div></div>`;
  document.body.appendChild(bg);
  const close=()=>bg.remove();
  bg.querySelector('#insOk').onclick=close;
  bg.querySelector('#insLater').onclick=()=>{ close(); dismiss(); };
  bg.addEventListener('click',e=>{ if(e.target===bg) close(); });
  document.addEventListener('keydown',function esc(e){ if(e.key==='Escape'){ close(); document.removeEventListener('keydown',esc); } });
}

window.addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); deferred=e; mountCard(); syncBtn(); });
window.addEventListener('appinstalled',()=>{ dismiss(); if(typeof toast==='function') toast(T_('홈 화면에 추가되었습니다')); });

/* 프롬프트가 없는 환경(iPhone 등)에서도 휴대폰이면 안내 카드는 띄운다.
   데스크톱은 beforeinstallprompt 가 올 때만 띄운다 — 홈 화면 개념이 흐리다. */
if(MOBILE) mountCard();
/* 언어를 바꾸면 홈이 다시 그려지지 않으므로 카드 문구만 직접 갈아준다 */
document.addEventListener('click',e=>{ if(e.target.closest&&e.target.closest('#langBtn,[data-lang]')) setTimeout(()=>{ if(card){ card.remove(); card=null; mountCard(); } },0); });
})();
