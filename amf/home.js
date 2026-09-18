/* ============================================================
   AMF COMMERCE INTELLIGENCE ENGINE — '사람 먼저' 홈 + 4탭 내비게이션

   캔버스 시안(https://claude.ai/artifact/7gWBgrwFnuhvuLckG2dM7Z)을 앱에 옮긴 레이어.
     · 홈(추천): 한 줄 AI 브리프 + 조건 칩 → 열자마자 추천 5인 카드 · 이번 주 쇼 티커 · 예산 · 선별 근거
     · 내비게이션: 레일 11개 → 상단 탭 4개(추천 · 크리에이터 · 캐스팅 · 인사이트) + 하위 탭 줄
     · 모바일: 하단 탭 4개
   점수 · 순위 · 편성은 index.html 의 엔진(readBrief · evaluate)이 그대로 계산한다.
   홈의 추천은 무료 미리보기이고, 산출 로그 · 민감도 · 내보내기가 있는 '상세 매칭'은 기존대로 크레딧을 쓴다.
   ============================================================ */
(function(){
'use strict';
if(typeof evaluate!=='function' || typeof readBrief!=='function' || typeof VIEWS==='undefined'){ console.warn('[home] CIE 엔진을 찾지 못했습니다'); return; }
const APP_MODE=(function(){
  let embed=false; try{ const fe=window.frameElement; embed=!!(fe && fe.id==='pmFrame'); }catch(e){}
  let n=0; try{ let w=window; while(w!==w.parent && n<8){ w=w.parent; n++; } }catch(e){ n++; }
  return /[?&]app=1/.test(location.search) || embed || n>=3;
})();
if(!APP_MODE) return;

/* ───────── 0. 문자열 ───────── */
Object.assign(DICT,{
  '추천':'Recommend','크리에이터':'Creators','캐스팅':'Casting','인사이트':'Insights','추천 홈':'Home',
  '상세 매칭 · 산출 로그':'Detailed match · audit log',
  'CAMPAIGN BRIEF · 한 줄이면 됩니다':'CAMPAIGN BRIEF · one line is enough',
  '어떤 캠페인인가요?':'What is the campaign?',
  '예) 우즈베키스탄 20대 여성 스킨케어 런칭, 인스타그램 5명, 예산 5천만':'e.g. Skincare launch for women in their 20s in Uzbekistan, 5 creators on Instagram, budget 50M KRW',
  '추천 받기':'Recommend','고급 조건 +':'Advanced +','카테고리':'Category','권역':'Region','연령':'Age','성별':'Gender','채널':'Channel','예산':'Budget',
  '추천 크리에이터':'Recommended creators','적합도순':'by fit score','전체 보기 →':'View all →',
  '오늘의 추천':'TODAY\'S PICKS','최고 적합도':'Top fit','순 도달':'Net reach','예산 소진':'Budget used',
  '이번 주 쇼 · 행사':'This week\'s shows','전체 일정 →':'Full calendar →','진행 중':'Live','기준':'as of',
  '예산 포트폴리오':'Budget portfolio','선별 근거':'Selection funnel','산식 · 감사 추적 →':'Formula · audit →',
  '보드 담기':'Add to board','담김 ✓':'On board ✓','프로필 열기':'Open profile','팔로워':'Followers','단가':'Rate','적합도':'fit',
  '오디언스 중복':'Overlap','1인 평균 단가':'Avg. rate','편성':'placed','인':'',
  'AI 미연결 — 조건 칩으로 추천합니다':'AI not connected — recommending from the condition chips',
  '조건에 맞는 크리에이터가 없습니다. 조건을 넓혀 보세요.':'No creators match. Loosen the conditions.',
  '순위와 점수는 결정론 엔진이 계산합니다':'Rankings and scores are computed by the deterministic engine',
  '구독 · 요금제':'Plans & Billing','AI 연결 설정':'AI connection','군':' tier',
  '홈의 추천은 무료 미리보기입니다. 산출 로그 · 민감도 분석 · 내보내기는 상세 매칭에서 크레딧을 사용합니다.':'Home recommendations are a free preview. Audit log, sensitivity analysis and exports use credits in Detailed match.'
});

/* ───────── 1. 스타일 ───────── */
const CSS=`
/* 레일 숨김 · 상단 탭 */
.rail{display:none!important}
.shell{grid-template-columns:216px 1fr;grid-template-areas:"brandbar topbar" "main main"}
.tb-tabs{display:flex;gap:4px;margin-left:6px;min-width:0}
.tb-tabs button{padding:7px 13px;border-radius:999px;font-size:12.5px;font-weight:600;color:#C9D2CC;white-space:nowrap;cursor:pointer;background:none;border:0;font-family:inherit}
.tb-tabs button:hover{background:rgba(255,255,255,.08);color:#fff}
.tb-tabs button.on{background:rgba(255,255,255,.14);color:#fff;font-weight:750}
.tbtitle,.tbpath{display:none}
.subtabs{display:flex;align-items:center;gap:6px;margin:-4px 0 14px;flex-wrap:wrap}
.subtabs button{padding:6px 12px;border-radius:999px;font-size:11.5px;font-weight:650;border:1px solid var(--line2);background:var(--surface);color:var(--ink2);cursor:pointer;font-family:inherit}
.subtabs button.on{background:var(--ink);border-color:var(--ink);color:var(--surface)}
.subtabs .sp{flex:1}
.subtabs a{font-size:11.5px;font-weight:750;color:var(--ink2);text-decoration:none;cursor:pointer}
.subtabs a:hover{color:var(--brand)}
@media(max-width:860px){
  .shell{grid-template-columns:1fr;grid-template-areas:"brandbar" "topbar" "main";grid-template-rows:auto auto 1fr}
  .tb-tabs{display:none}
  .tbtitle{display:block}
}
/* 홈 */
#v_home{--hm-r:var(--r2)}
.hm-hero{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:20px;align-items:stretch;margin-bottom:22px}
.hm-brief{display:flex;flex-direction:column;gap:12px;justify-content:center;min-width:0}
.hm-kick{font-size:10px;font-weight:800;letter-spacing:1.8px;color:var(--brand)}
.hm-brief h1{font-size:34px;font-weight:900;letter-spacing:-1.2px;line-height:1.1;margin:0}
.hm-ai{display:flex;align-items:center;gap:10px;height:60px;padding:0 8px 0 16px;background:var(--surface);border:2px solid var(--ink);border-radius:16px}
.hm-ai svg{width:18px;height:18px;flex:none;fill:var(--ink)}
.hm-ai input{flex:1;min-width:0;border:0;outline:none;background:transparent;font:inherit;font-size:14px;font-weight:500;color:var(--ink)}
.hm-ai input::placeholder{color:var(--ink3)}
.hm-ai .btn{height:42px;padding:0 18px;font-size:13px;font-weight:800;border-radius:11px;white-space:nowrap}
.hm-chips{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.hm-chip{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 6px 0 12px;border:1px solid var(--line2);border-radius:999px;background:var(--surface);font-size:12px;font-weight:700;color:var(--ink);cursor:pointer}
.hm-chip .k{font-size:10px;color:var(--ink3);font-weight:700;letter-spacing:.3px}
.hm-chip select{border:0;background:transparent;font:inherit;font-size:12px;font-weight:700;color:var(--ink);outline:none;cursor:pointer;max-width:170px}
.hm-chip.more{border-style:dashed;color:var(--ink2);padding:0 12px}
.hm-black{position:relative;overflow:hidden;padding:20px 22px;border-radius:20px;background:var(--navy);color:#fff;display:flex;flex-direction:column;gap:12px}
.hm-black .deco{position:absolute;right:-34px;top:-34px;width:120px;height:120px;border-radius:26px;background:var(--brand);transform:rotate(18deg)}
.hm-black .k{font-size:10px;font-weight:800;letter-spacing:2px;color:#9AA69E;position:relative}
.hm-black .big{display:flex;align-items:baseline;gap:4px;position:relative}
.hm-black .big b{font-size:48px;font-weight:900;letter-spacing:-2.4px;line-height:1}
.hm-black .big span{font-size:15px;font-weight:700}
.hm-black .kv{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;position:relative}
.hm-black .kv .l{font-size:9px;letter-spacing:1.2px;color:#9AA69E;font-weight:700}
.hm-black .kv .v{font-size:19px;font-weight:900;margin-top:2px}
.hm-black .note{font-size:11px;color:#C9D2CC;line-height:1.5;position:relative;background:none;border:0;padding:0}
.hm-sec{display:flex;align-items:center;gap:12px;margin:0 0 12px}
.hm-sec .no{font-family:var(--mono);font-size:12px;font-weight:700;color:var(--brand)}
.hm-sec h2{margin:0;font-size:17px;font-weight:900;letter-spacing:-.4px;white-space:nowrap}
.hm-sec .lead{flex:1;height:0;border-top:2px dotted var(--line3)}
.hm-sec .sub{font-size:11.5px;font-weight:700;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.hm-sec a{white-space:nowrap}
.hm-sec a{font-size:12px;font-weight:800;color:var(--ink);text-decoration:none;cursor:pointer}
.hm-cards{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px;margin-bottom:22px}
.hm-card{display:flex;flex-direction:column;gap:11px;padding:16px;background:var(--surface);border-radius:var(--hm-r);box-shadow:var(--sh2);border:1px solid var(--line)}
.hm-card .ch{display:flex;align-items:center;gap:10px;min-width:0}
.hm-av{position:relative;width:48px;height:48px;flex:none}
.hm-av img,.hm-av .ini{width:48px;height:48px;border-radius:50%;object-fit:cover;object-position:top;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:var(--ink);box-sizing:border-box;border:2px solid var(--line2);background:var(--surface3)}
.hm-av.S img,.hm-av.S .ini{border-color:var(--brand)} .hm-av.A img,.hm-av.A .ini{border-color:var(--ink)}
.hm-av .rk{position:absolute;right:-6px;bottom:-4px;height:20px;padding:0 6px;border-radius:999px;background:var(--ink);color:var(--surface);font-size:10px;font-weight:900;display:flex;align-items:center}
.hm-card .nm{font-size:15px;font-weight:900;letter-spacing:-.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hm-card .ct{font-size:11px;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hm-card .arch{align-self:flex-start;height:22px;padding:0 8px;border-radius:6px;background:var(--surface3);font-size:10.5px;font-weight:700;display:inline-flex;align-items:center;color:var(--ink)}
.hm-card .sc{display:flex;align-items:flex-end;justify-content:space-between}
.hm-card .sc b{font-size:32px;font-weight:900;letter-spacing:-1.6px;line-height:1;color:var(--brand)}
.hm-card .sc small{font-size:10px;font-weight:700;color:var(--ink2);margin-left:5px}
.hm-bars{display:flex;align-items:flex-end;gap:3px;height:30px}
.hm-bars i{width:10px;border-radius:3px 3px 0 0;background:var(--line2)}
.hm-bars i.hi{background:var(--brand)}
.hm-card .kv{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;padding-top:10px;border-top:1px solid var(--line)}
.hm-card .kv .l{font-size:9px;letter-spacing:1px;color:var(--ink2);font-weight:700}
.hm-card .kv .v{font-size:13px;font-weight:900;margin-top:1px}
.hm-card .act{display:flex;gap:6px}
.hm-card .act .btn{height:38px;border-radius:10px;font-weight:800;font-size:12px;justify-content:center;display:inline-flex;align-items:center}
.hm-card .act .btn.pri{flex:1}
.hm-card .act .btn.on{background:var(--possoft);border-color:var(--pos);color:var(--pos)}
.hm-card .act .ico{width:38px;padding:0}
.hm-empty{grid-column:1/-1;padding:28px;text-align:center;color:var(--ink2);background:var(--surface);border-radius:var(--hm-r);border:1px dashed var(--line2)}
/* 티커 */
.hm-ticker{display:flex;align-items:stretch;height:52px;border-radius:14px;background:var(--navy);color:#fff;overflow:hidden;margin-bottom:22px}
.hm-ticker .lab{display:flex;align-items:center;gap:9px;padding:0 16px;background:var(--brand);flex:none;color:#fff}
.hm-ticker .lab .no{font-family:var(--mono);font-size:11px;font-weight:700;opacity:.85}
.hm-ticker .lab b{font-size:12.5px;font-weight:900;white-space:nowrap}
.hm-ticker .dot{width:7px;height:7px;border-radius:50%;background:#fff;animation:hmBlink 1.2s ease-in-out infinite}
.hm-ticker .win{flex:1;min-width:0;overflow:hidden;display:flex;align-items:center}
.hm-ticker .track{display:flex;align-items:center;width:max-content;animation:hmTicker 48s linear infinite}
.hm-ticker .track:hover{animation-play-state:paused}
.hm-ticker .it{display:flex;align-items:center;gap:9px;height:52px;padding:0 20px;border-right:1px solid rgba(255,255,255,.14);color:#fff;text-decoration:none;white-space:nowrap;cursor:pointer;background:none;border-top:0;border-bottom:0;border-left:0;font-family:inherit}
.hm-ticker .dd{height:22px;padding:0 8px;border-radius:999px;background:var(--goldsoft);color:var(--noteink);font-size:10.5px;font-weight:900;display:flex;align-items:center}
.hm-ticker .dd.live{background:var(--brand);color:#fff}
.hm-ticker .nm{font-size:12.5px;font-weight:900}
.hm-ticker .mt{font-size:11px;color:#C9D2CC}
.hm-ticker .tr{height:20px;padding:0 7px;border-radius:6px;font-size:10px;font-weight:900;display:flex;align-items:center;background:rgba(255,255,255,.16)}
.hm-ticker .tr.t1{background:var(--brand)} .hm-ticker .tr.t2{background:#fff;color:var(--navy)}
.hm-ticker .all{display:flex;align-items:center;padding:0 16px;flex:none;font-size:12px;font-weight:900;color:#fff;border-left:1px solid rgba(255,255,255,.14);cursor:pointer;background:none;border-top:0;border-right:0;border-bottom:0;font-family:inherit}
@keyframes hmTicker{from{transform:translateX(-50%)}to{transform:translateX(0)}}
@keyframes hmBlink{0%,100%{opacity:1}50%{opacity:.2}}
@media(prefers-reduced-motion:reduce){.hm-ticker .track,.hm-ticker .dot{animation:none}}
/* 03 · 04 */
.hm-grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px;margin-bottom:8px}
.hm-box{padding:18px 20px;background:var(--surface);border-radius:var(--hm-r);border:1px solid var(--line);display:flex;flex-direction:column;gap:12px}
.hm-box .amt{display:flex;align-items:baseline;gap:8px}
.hm-box .amt b{font-size:26px;font-weight:900;letter-spacing:-1.2px}
.hm-box .amt span{font-size:12px;font-weight:700;color:var(--ink2)}
.hm-bar{height:10px;border-radius:999px;background:var(--surface3);overflow:hidden}
.hm-bar i{display:block;height:100%;border-radius:999px;background:var(--brand)}
.hm-box .kv{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.hm-box .kv .l{font-size:9px;letter-spacing:1.2px;color:var(--ink2);font-weight:700}
.hm-box .kv .v{font-size:18px;font-weight:900;margin-top:2px}
.hm-funnel{display:flex;gap:6px;flex-wrap:wrap}
.hm-funnel .f{display:flex;flex-direction:column;align-items:center;gap:3px;min-width:62px;padding:8px 6px;border-radius:12px;background:var(--surface3);color:var(--ink)}
.hm-funnel .f.mid{background:var(--brandsoft)} .hm-funnel .f.fin{background:var(--brand);color:#fff}
.hm-funnel .f b{font-size:18px;font-weight:900;line-height:1}
.hm-funnel .f span{font-size:9.5px;font-weight:700;text-align:center;line-height:1.2}
.hm-foot{font-size:10.5px;color:var(--ink3);line-height:1.6}
@media(max-width:1180px){ .hm-cards{grid-template-columns:repeat(3,minmax(0,1fr))} .hm-hero{grid-template-columns:1fr} .hm-black{display:none} }
@media(max-width:860px){
  .hm-brief h1{font-size:26px}
  .hm-sec{gap:8px} .hm-sec h2{font-size:15px} .hm-sec .sub{display:none}
  .subtabs a[data-ai]{display:none}
  .hm-ai{height:54px;padding:0 6px 0 12px} .hm-ai .btn{padding:0 14px}
  .hm-chips{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding-bottom:2px} .hm-chips::-webkit-scrollbar{display:none} .hm-chip{flex:none}
  .hm-cards{grid-template-columns:1fr;gap:8px}
  .hm-card{flex-direction:row;align-items:center;gap:12px;padding:10px 12px}
  .hm-card .ch{flex:1} .hm-card .arch,.hm-card .kv,.hm-bars{display:none}
  .hm-card .sc{flex-direction:column;align-items:flex-end;gap:0} .hm-card .sc b{font-size:22px} .hm-card .sc small{margin:0}
  .hm-card .act .btn.pri{display:none} .hm-card .act .ico{width:44px;height:44px}
  .hm-av,.hm-av img,.hm-av .ini{width:44px;height:44px}
  .hm-ticker{height:44px} .hm-ticker .it{height:44px;padding:0 14px} .hm-ticker .lab{padding:0 12px} .hm-ticker .all{padding:0 12px}
  .hm-grid2{grid-template-columns:1fr}
}
`;
const st=document.createElement('style'); st.textContent=CSS; document.head.appendChild(st);

/* ───────── 2. 뷰 등록 ───────── */
VIEWS.home=['추천','Platform / Recommend / Home'];
VIEW_KEYS.unshift('home');
if(typeof MORE_ICON!=='undefined') MORE_ICON.home='✦';
const wrap=document.querySelector('.main .wrap');
const sec=document.createElement('section'); sec.id='v_home'; sec.className='hidden';
sec.innerHTML=`
  <div class="hm-hero">
    <div class="hm-brief">
      <span class="hm-kick">CAMPAIGN BRIEF · 한 줄이면 됩니다</span>
      <h1>어떤 캠페인인가요?</h1>
      <form class="hm-ai" id="hmForm">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.4l1.5 3.9 3.9 1.5-3.9 1.5L8 12.2 6.5 8.3 2.6 6.8l3.9-1.5z"/></svg>
        <label class="sr-only" for="hmText">캠페인 설명</label>
        <input id="hmText" type="text" placeholder="예) 우즈베키스탄 20대 여성 스킨케어 런칭, 인스타그램 5명, 예산 5천만" autocomplete="off">
        <button class="btn pri" type="submit" id="hmGo">추천 받기</button>
      </form>
      <div class="hm-chips" id="hmChips"></div>
    </div>
    <div class="hm-black" id="hmSummary"></div>
  </div>
  <div class="hm-sec"><span class="no">01</span><h2>추천 크리에이터</h2><div class="lead"></div><span class="sub" id="hmSub"></span><a id="hmAll">전체 보기 →</a></div>
  <div class="hm-cards" id="hmCards"></div>
  <div class="hm-ticker" id="hmTicker"></div>
  <div class="hm-grid2">
    <div class="hm-box" id="hmPort"></div>
    <div class="hm-box" id="hmFunnel"></div>
  </div>
  <div class="hm-foot">홈의 추천은 무료 미리보기입니다. 산출 로그 · 민감도 분석 · 내보내기는 상세 매칭에서 크레딧을 사용합니다.</div>`;
wrap.insertBefore(sec, wrap.firstChild);
const q=id=>document.getElementById(id);
const en=()=>LANG==='en';
const esc=t=>String(t==null?'':t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ───────── 3. 조건 칩 (기존 폼 select 를 그대로 조종한다) ───────── */
const BUDGETS=[10,20,30,50,80,100,150,200,300];
function chipsHTML(){
  const sel=(src,label,trans)=>{
    const s=window[src]; if(!s) return '';
    const opts=Array.from(s.options).map((o,i)=>`<option value="${i}" ${o.selected?'selected':''}>${esc(trans?trans(o.value):o.text)}</option>`).join('');
    return `<label class="hm-chip"><span class="k">${T(label)}</span><select data-src="${src}" aria-label="${T(label)}">${opts}</select></label>`;
  };
  const m=+f_bud.value;
  const bud=`<label class="hm-chip"><span class="k">${T('예산')}</span><select data-src="f_bud" aria-label="${T('예산')}">${
    (BUDGETS.indexOf(m)<0?BUDGETS.concat([m]).sort((a,b)=>a-b):BUDGETS).map(v=>`<option value="${v}" ${v===m?'selected':''}>${MAN(v*1e6)}</option>`).join('')}</select></label>`;
  return sel('f_cat','카테고리')+sel('f_reg','권역',tReg)+sel('f_age','연령')+sel('f_sex','성별',tSex)+sel('f_plt','채널',tPlat)+bud+
    `<button type="button" class="hm-chip more" id="hmMore">${T('고급 조건 +')}</button>`;
}
function bindChips(){
  q('hmChips').innerHTML=chipsHTML();
  q('hmChips').querySelectorAll('select').forEach(s=>s.onchange=()=>{
    const src=s.dataset.src;
    if(src==='f_bud'){ f_bud.value=+s.value; }
    else { window[src].selectedIndex=+s.value; }
    try{ updateBudget(); }catch(e){}
    renderResults();
  });
  q('hmMore').onclick=()=>window.showView('match');
}

/* ───────── 4. 렌더링 ───────── */
let CUR=null;   // {brief,res}
function compute(){
  const brief=readBrief();
  const res=evaluate(brief);
  CUR={brief,res};
  try{ setLast({brief,res,snap:formSnapshot()}, 'home_'+Date.now().toString(36).toUpperCase()); }catch(e){}
  return CUR;
}
function initials(c){ return c.initials||String(c.name||'?').slice(0,2).toUpperCase(); }
function bars(ax){
  return '<div class="hm-bars" aria-hidden="true">'+AXES.map(([k])=>`<i class="${ax[k]>=80?'hi':''}" title="${k} ${ax[k]}" style="height:${Math.round(6+ax[k]/100*24)}px"></i>`).join('')+'</div>';
}
function card(s,i){
  const c=s.c, on=onBoard(c.idx);
  return `<div class="hm-card">
    <div class="ch">
      <div class="hm-av ${c.tier}">${c.photo?`<img src="${c.photo}" alt="">`:`<div class="ini" style="background:${c.color}22">${esc(initials(c))}</div>`}<span class="rk">#${i+1}</span></div>
      <div style="min-width:0"><div class="nm">${esc(c.name)}</div><div class="ct">${esc(tCtry(c.country))} · Tier ${c.tier}</div></div>
    </div>
    <span class="arch">${esc(tArch(c.archName))}</span>
    <div class="sc"><div><b>${s.score}</b><small>${T('적합도')}</small></div>${bars(s.ax)}</div>
    <div class="kv">
      <div><div class="l">${T('팔로워')}</div><div class="v num">${KM(c.followers)}</div></div>
      <div><div class="l">ER</div><div class="v num">${c.er}%</div></div>
      <div><div class="l">${T('단가')}</div><div class="v num">${MAN(c.rate)}</div></div>
    </div>
    <div class="act">
      <button type="button" class="btn pri ${on?'on':''}" data-board="${c.idx}">${on?T('담김 ✓'):T('보드 담기')}</button>
      <button type="button" class="btn ico" data-open="${c.idx}" aria-label="${T('프로필 열기')}" title="${T('프로필 열기')}">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="8" cy="5.5" r="2.6"/><path d="M2.8 13.5c0-2.6 2.3-4 5.2-4s5.2 1.4 5.2 4"/></svg>
      </button>
    </div>
  </div>`;
}
function renderCards(){
  if(!CUR) return;
  const {brief,res}=CUR;
  const top=res.top.slice(0,Math.max(5,brief.topN));
  q('hmSub').textContent=en()?`by fit score · ${res.top.length} of ${ROSTER.length}`:`적합도순 · ${ROSTER.length}인 중 ${res.top.length}인`;
  q('hmCards').innerHTML=top.length?top.map(card).join(''):
    `<div class="hm-empty">${T('조건에 맞는 크리에이터가 없습니다. 조건을 넓혀 보세요.')}</div>`;
  q('hmCards').querySelectorAll('[data-board]').forEach(b=>b.onclick=()=>{ boardToggle(+b.dataset.board); renderCards(); });
  q('hmCards').querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openDrawer(+b.dataset.open));
}
function renderSummary(){
  const {brief,res}=CUR;
  q('hmSummary').innerHTML=`<div class="deco" aria-hidden="true"></div>
    <span class="k">${T('오늘의 추천')}</span>
    <div class="big"><b class="num">${res.top.length}</b><span>${en()?' picks':'인'} · ${esc(brief.catName)} · ${esc(tReg(brief.region))}</span></div>
    <div class="kv">
      <div><div class="l">${T('최고 적합도')}</div><div class="v num">${res.top[0]?res.top[0].score:'–'}</div></div>
      <div><div class="l">${T('순 도달')}</div><div class="v num">${KM(res.reachStat.net)}</div></div>
      <div><div class="l">${T('예산 소진')}</div><div class="v num">${pct(res.spent,brief.budget)}</div></div>
    </div>
    <div class="note">${en()?`${res.ranked.length} of ${ROSTER.length} passed the filters · top ${res.top.length} placed.`:`${ROSTER.length}인 중 조건 통과 ${res.ranked.length}인 · 적합도 상위 ${res.top.length}인 편성.`} ${T('순위와 점수는 결정론 엔진이 계산합니다')}.</div>`;
}
function renderPort(){
  const {brief,res}=CUR;
  const avg=res.port.length?res.spent/res.port.length:0;
  q('hmPort').innerHTML=`<div class="hm-sec" style="margin:0"><span class="no">03</span><h2 style="font-size:15px">${T('예산 포트폴리오')}</h2><div class="lead"></div><span class="sub">${en()?`${res.port.length} placed`:`${res.port.length}인 편성`}</span></div>
    <div class="amt"><b class="num">${KRW(res.spent)}</b><span>/ ${MAN(brief.budget)} (${pct(res.spent,brief.budget)})</span></div>
    <div class="hm-bar"><i style="width:${Math.min(100,brief.budget?res.spent/brief.budget*100:0).toFixed(1)}%"></i></div>
    <div class="kv">
      <div><div class="l">${T('순 도달')}</div><div class="v num">${KM(res.reachStat.net)}</div></div>
      <div><div class="l">${T('오디언스 중복')}</div><div class="v num">${res.reachStat.dup}%</div></div>
      <div><div class="l">${T('1인 평균 단가')}</div><div class="v num">${avg?MAN(avg):'–'}</div></div>
    </div>`;
  q('hmFunnel').innerHTML=`<div class="hm-sec" style="margin:0"><span class="no">04</span><h2 style="font-size:15px">${T('선별 근거')}</h2><div class="lead"></div><a data-go="gov">${T('산식 · 감사 추적 →')}</a></div>
    <div class="hm-funnel">${res.stages.map((s,i)=>`<div class="f ${s.final?'fin':i>=3?'mid':''}"><b class="num">${s.n}</b><span>${esc(s.k)}</span></div>`).join('')}</div>
    <div class="hm-foot" style="margin:0">${esc(AXES.map(a=>a[1]).join(' · '))} · ${T('순위와 점수는 결정론 엔진이 계산합니다')}.</div>`;
  q('hmFunnel').querySelector('[data-go]').onclick=()=>window.showView('gov');
}
function renderTicker(){
  const list=(typeof SHOWS!=='undefined'?SHOWS:[]).slice().sort((a,b)=>a.dday-b.dday).slice(0,12);
  const it=s=>{
    const live=s.dday<=0;
    const dd=live?T('진행 중'):s.dday===0?'D-Day':'D-'+s.dday;
    return `<button type="button" class="it" data-show="${s.id}">
      <span class="dd ${live?'live':''}">${dd}</span><span class="nm">${esc(s.name)}</span>
      <span class="mt">${esc(tCity(s.city))} · ${s.start.slice(5).replace('-','/')}${s.days>1?'–'+s.end.slice(5).replace('-','/'):''}</span>
      ${s.tier?`<span class="tr t${s.tier}">${s.tier}${T('군')}</span>`:''}</button>`;
  };
  const asof=window.AMF_SHOWS_ASOF||'';
  q('hmTicker').innerHTML=`<div class="lab"><span class="no">02</span><b>${T('이번 주 쇼 · 행사')}</b><span class="dot" aria-hidden="true"></span></div>
    <div class="win"><div class="track">${list.map(it).join('')}${list.map(it).join('')}</div></div>
    <button type="button" class="all" data-go="shows">${en()?`All ${SHOWS.length} →`:`전체 ${SHOWS.length}건 →`}</button>`;
  q('hmTicker').querySelectorAll('[data-show],[data-go]').forEach(b=>b.onclick=()=>window.showView('shows'));
}
function renderResults(){ compute(); renderSummary(); renderCards(); renderPort(); }
function renderHome(){ bindChips(); renderResults(); renderTicker(); i18nSweep(sec); }

/* ───────── 5. 추천 받기 (AI 한 줄 → 폼 → 재계산) ───────── */
q('hmForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const text=q('hmText').value.trim();
  const btn=q('hmGo'); btn.disabled=true;
  try{
    if(text){
      if(typeof gemOn==='function' && gemOn()){
        const ta=q('aiText'); if(ta) ta.value=text;
        try{ await aiParseBrief(); }catch(err){ console.warn(err); }
      } else toast(T('AI 미연결 — 조건 칩으로 추천합니다'));
    }
    bindChips(); renderResults();
    q('hmCards').scrollIntoView({behavior:SB, block:'start'});
  }finally{ btn.disabled=false; }
});
q('hmAll').onclick=()=>window.showView('roster');

/* ───────── 6. 4탭 내비게이션 ───────── */
const TABS=[
  {k:'home',     n:'추천',       views:['home','match']},
  {k:'creators', n:'크리에이터', views:['roster','growth']},
  {k:'casting',  n:'캐스팅',     views:['board','shows']},
  {k:'insights', n:'인사이트',   views:['dash','trends','cases','gov','alerts']}
];
const tabOf=v=>TABS.find(t=>t.views.indexOf(v)>=0);
const subLabel=v=> v==='home'?T('추천 홈') : v==='match'?T('상세 매칭 · 산출 로그') : T(VIEWS[v]?VIEWS[v][0]:v);
/* 상단 탭 */
const topbar=document.querySelector('.topbar'), tbleft=topbar&&topbar.querySelector('.tbleft');
const tabs=document.createElement('nav'); tabs.className='tb-tabs'; tabs.setAttribute('aria-label','주 메뉴');
if(tbleft) tbleft.insertAdjacentElement('afterend',tabs);
/* 하위 탭 줄 */
const subs=document.createElement('div'); subs.className='subtabs'; wrap.insertBefore(subs, sec);
function renderNav(v){
  const t=tabOf(v);
  tabs.innerHTML=TABS.map(x=>`<button type="button" class="${t&&t.k===x.k?'on':''}" data-tab="${x.k}">${T(x.n)}</button>`).join('');
  tabs.querySelectorAll('button').forEach(b=>b.onclick=()=>window.showView(TABS.find(x=>x.k===b.dataset.tab).views[0]));
  const inner = t ? t.views.map(x=>`<button type="button" class="${x===v?'on':''}" data-v="${x}">${subLabel(x)}</button>`).join('') : `<button type="button" class="on">${T(VIEWS[v]?VIEWS[v][0]:v)}</button>`;
  subs.innerHTML=inner+`<span class="sp"></span><a data-v="plans">${T('구독 · 요금제')}</a><a data-ai="1">${T('AI 연결 설정')}</a>`;
  subs.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>window.showView(b.dataset.v));
  const ai=subs.querySelector('[data-ai]'); if(ai) ai.onclick=()=>{ try{ aiModalOpen(); }catch(e){} };
  /* 모바일 하단 탭 */
  document.querySelectorAll('#mtab button[data-tab]').forEach(b=>b.classList.toggle('on', !!t && t.k===b.dataset.tab));
}
/* 모바일 하단 탭 4개로 교체 */
const mtab=document.getElementById('mtab');
if(mtab){
  const ICON={
    home:'<svg viewBox="0 0 16 16"><path d="M8 1.6l1.6 4.1 4.1 1.6-4.1 1.6L8 13l-1.6-4.1L2.3 7.3l4.1-1.6z"/></svg>',
    creators:'<svg viewBox="0 0 16 16"><circle cx="8" cy="5" r="2.6"/><path d="M2.8 13c0-2.6 2.3-4 5.2-4s5.2 1.4 5.2 4"/></svg>',
    casting:'<svg viewBox="0 0 16 16"><rect x="2" y="2.5" width="4" height="11" rx="1"/><rect x="7" y="2.5" width="4" height="7" rx="1"/><path d="M13 5v6M10 8h6"/></svg>',
    insights:'<svg viewBox="0 0 16 16"><path d="M2 11.5l3.5-4 2.5 2.5L13.5 4"/><path d="M10.5 4h3v3"/></svg>'
  };
  mtab.innerHTML=TABS.map(t=>`<button type="button" data-tab="${t.k}">${ICON[t.k]}${T(t.n)}</button>`).join('');
  mtab.style.gridTemplateColumns='repeat(4,1fr)';
  mtab.querySelectorAll('button').forEach(b=>b.onclick=()=>window.showView(TABS.find(x=>x.k===b.dataset.tab).views[0]));
}
/* showView 감싸기: 홈 렌더 + 탭 동기화 */
const _sv=window.showView;
window.showView=function(v){
  if(!VIEWS[v]) v='home';
  const r=_sv.apply(this,arguments);
  document.body.dataset.view=v;
  if(v==='home') renderHome();
  renderNav(v);
  return r;
};
window.AMF_VIEW=()=>document.body.dataset.view||'home';
const _al=window.applyLang;
if(typeof _al==='function') window.applyLang=function(){ const r=_al.apply(this,arguments); const v=document.body.dataset.view||'home'; renderNav(v); if(!sec.classList.contains('hidden')) renderHome(); return r; };
const _bc=window.boardChanged;
if(typeof _bc==='function') window.boardChanged=function(){ const r=_bc.apply(this,arguments); if(!sec.classList.contains('hidden')) renderCards(); return r; };
/* 어시스턴트가 홈에서도 결과를 읽도록 노출 */
window.AMF_HOME={ render:renderHome, current:()=>CUR };

/* 첫 화면 = 홈. 기본 브리프는 시안처럼 상위 5인 · 5,000만원으로 시작한다 */
try{ const i5=Array.from(f_topn.options).findIndex(o=>o.value==='5'); if(i5>=0) f_topn.selectedIndex=i5; if(+f_bud.value<50){ f_bud.value=50; updateBudget(); } }catch(e){}
window.showView('home');
})();
