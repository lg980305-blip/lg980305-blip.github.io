/* ============================================================
   AMF COMMERCE INTELLIGENCE ENGINE — 구독 · 요금제 (SaaS Transition)

   사업계획서 27p "SaaS 전환 · 제품화 경로" 슬라이드의 요금 구조를 그대로 옮긴 화면.
     Lite  월 30만원  · Year 2 목표 5계정 · 신규 영업 · 파트너 추천
     Pro   월 90만원  · Year 2 목표 2계정 · Y1 실계약 브랜드 우선 전환
     Ent.  월 250만원~ · Year 2 목표 1계정 · 기존 제휴사 · 파트너 확장
     합계 월 580만원 × 12개월 = 연 0.70억 (Year 2 총매출 7.60억 중 9%)

   ┌ 결제는 시연용이다. 실제 PG(토스페이먼츠 · 스트라이프 등)는 붙어 있지 않다.
   │ 실결제로 바꿀 때는 아래 checkout() 의 "// PG 연동 지점" 한 곳에서
   │ 결제창을 호출하고, 승인 콜백에서 activate() 를 부르면 된다.
   └ 구독 상태는 브라우저(localStorage)에만 저장된다.
   ============================================================ */
(function(){
'use strict';
if(typeof VIEWS==='undefined' || typeof showView!=='function'){ console.warn('[plans] CIE 엔진을 찾지 못했습니다'); return; }

const APP_MODE=(function(){
  let embed=false; try{ const fe=window.frameElement; embed=!!(fe && fe.id==='pmFrame'); }catch(e){}
  let n=0; try{ let w=window; while(w!==w.parent && n<8){ w=w.parent; n++; } }catch(e){ n++; }
  return /[?&]app=1/.test(location.search) || embed || n>=3;
})();
if(!APP_MODE) return;   /* 소개 껍데기에서는 아무것도 하지 않는다 (랜딩 목록의 06 항목은 iframe 으로 신호만 보낸다) */

/* ───────── 1. 요금제 정의 ───────── */
const PLANS=[
  { k:'lite', n:'Lite', price:300000, from:false, target:5, credits:100, seats:1,
    who:'신규 영업 · 파트너 추천', whoEn:'New sales · partner referrals',
    tag:'브랜드 마케터 1인', tagEn:'Solo brand marketer',
    feats:['캠페인 매칭 월 30회','크리에이터 DB 98인 열람','캐스팅 보드 1개','포트폴리오 CSV 내보내기','이메일 지원'],
    featsEn:['30 campaign matches / month','Creator registry (98)','1 casting board','Portfolio CSV export','Email support'] },
  { k:'pro', n:'Pro', price:900000, from:false, target:2, credits:500, seats:3, hot:true,
    who:'Y1 실계약 브랜드 우선 전환', whoEn:'Convert Year-1 contracted brands first',
    tag:'브랜드 · 에이전시 팀', tagEn:'Brand & agency teams',
    feats:['캠페인 매칭 무제한','AI 어시스턴트 · 가정 분석(What-if)','캐스팅 보드 무제한 · 좌석 3','트렌드 브리핑 · 성장 리포트','결과 JSON 내보내기','우선 지원'],
    featsEn:['Unlimited campaign matches','AI assistant & what-if analysis','Unlimited boards · 3 seats','Trend briefing & growth report','Result JSON export','Priority support'] },
  { k:'ent', n:'Enterprise', price:2500000, from:true, target:1, credits:Infinity, seats:10,
    who:'기존 제휴사 · 파트너 확장', whoEn:'Existing partners · expansion',
    tag:'에이전시 · 해외 파트너', tagEn:'Agencies & overseas partners',
    feats:['좌석 10+ · SSO · 감사 추적','전용 로스터 온보딩 (실 데이터 연동)','에이전시 · 해외 API 개방 (05 단계)','전담 매니저 · SLA','협의 계약 · 세금계산서'],
    featsEn:['10+ seats · SSO · audit trail','Dedicated roster onboarding (live data)','Agency & overseas API (step 05)','Dedicated manager · SLA','Custom contract · tax invoice'] }
];
const PLAN=Object.fromEntries(PLANS.map(p=>[p.k,p]));
const Y2={ saas:0.70, total:7.60, share:9, rest:6.90 };
const STEPS=[
  ['캠페인 · 성과 데이터 표준 스키마 축적','Standard schema for campaign & performance data'],
  ['반복 운영 프로세스 템플릿 표준화','Templatise recurring operations'],
  ['브랜드 계정 대시보드 제공','Brand-account dashboards'],
  ['운영 대행 → 월 구독 전환','Managed service → monthly subscription'],
  ['에이전시 · 해외 API 개방','Agency & overseas API']
];

/* ───────── 2. 영문 사전 (기존 DICT 에 얹는다) ───────── */
Object.assign(DICT,{
  '구독 · 요금제':'Plans & Billing', 'BILLING':'BILLING',
  '구독 · 요금제 — Lite/Pro/Enterprise, 시연용 결제 흐름':'Plans & billing — Lite/Pro/Enterprise, demo checkout',
  '운영으로 데이터를 쌓고, 데이터로 제품을 만듭니다':'Operations build the data. The data builds the product.',
  'Year 1 운영에서 축적한 데이터와 표준화된 프로세스를 Year 2 구독 제품으로 전환합니다.':'Data and standardised processes from Year-1 operations become the Year-2 subscription product.',
  '시연용 결제 —':'Demo checkout —',
  '이 화면의 결제는 실제로 청구되지 않습니다. 결제 대행사(PG) 연동 전 흐름 확인용이며, 구독 상태는 이 브라우저에만 저장됩니다.':'Nothing is charged here. This is the pre-PG flow check; the subscription state lives only in this browser.',
  '월 요금':'Monthly', '연 환산':'per year', '부터':'from', '월 크레딧':'credits / mo', '무제한':'Unlimited',
  '구독 결제하기':'Subscribe', '도입 문의':'Contact sales', '현재 이용 중':'Current plan', '추천':'Recommended',
  'Year 2 목표':'Year-2 target', '계정':'accounts', '확보 경로':'Acquisition',
  '내 구독':'My subscription', '다음 결제일':'Next billing', '좌석':'Seats', '결제 수단':'Payment method', '구독 해지':'Cancel subscription',
  '플랜 변경':'Change plan', '크레딧 잔액':'Credit balance',
  'Year 2 SaaS 매출':'Year-2 SaaS revenue', 'Year 2 총매출 중':'of Year-2 total', '나머지 = 계약 · 운영 · 파일럿 · 교육':'Rest = contracts · ops · pilots · training',
  '가격 · Year 2 목표':'Pricing & Year-2 target', '등급':'Tier', '합계':'Total', '개월':'months',
  '제품화 경로':'Productisation path', '구독 없이 이용 중':'No subscription',
  '카드':'Card', '계좌이체':'Bank transfer', '세금계산서':'Tax invoice',
  '약관 및 자동 갱신에 동의합니다':'I agree to the terms and auto-renewal', '결제하기':'Pay now', '취소':'Cancel', '닫기':'Close',
  '결제 처리 중…':'Processing…', '구독이 시작되었습니다':'Subscription started', '구독을 해지했습니다':'Subscription cancelled',
  '정말 해지하시겠습니까?':'Cancel this subscription?', '남은 기간까지는 계속 이용할 수 있습니다.':'You keep access until the end of the period.',
  '해지':'Cancel plan', '유지':'Keep', '약관에 동의해 주세요':'Please accept the terms',
  '도입 문의를 접수했습니다 — 영업일 1일 내 회신합니다 (시연)':'Enquiry received — we reply within one business day (demo)',
  '구독 · 요금제 화면으로 이동':'Go to plans & billing'
});

/* ───────── 3. 스타일 ───────── */
const CSS=`
.pl-hero{display:grid;grid-template-columns:1fr auto;gap:18px;align-items:end;margin-bottom:14px}
.pl-hero .kick{font-size:9.5px;letter-spacing:1.8px;font-weight:800;color:var(--brand);text-transform:uppercase}
.pl-hero h2{font-size:18px;font-weight:800;letter-spacing:-.3px;margin:6px 0 4px}
.pl-hero h2 em{font-style:normal;color:var(--brand2)}
.pl-hero p{font-size:11.5px;color:var(--ink2);max-width:640px}
.pl-steps{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:16px}
.pl-step{background:var(--surface);border:1px solid var(--line);border-radius:var(--r2);padding:12px 10px;text-align:center;font-size:10.5px;line-height:1.5;color:var(--ink2)}
.pl-step .no{display:inline-block;font-family:var(--mono);font-size:10px;font-weight:700;color:var(--brand);background:var(--brandsoft);border-radius:6px;padding:2px 7px;margin-bottom:7px}
.pl-step.on{border-color:var(--brand);box-shadow:0 0 0 1px var(--brand) inset}
.pl-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:16px}
.pl-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r2);padding:20px 20px 18px;display:flex;flex-direction:column;position:relative;box-shadow:var(--sh1)}
.pl-card.hot{border-color:var(--brand);box-shadow:0 0 0 1px var(--brand) inset,var(--sh2)}
.pl-card.cur{border-color:var(--pos);box-shadow:0 0 0 1px var(--pos) inset}
.pl-card .ribbon{position:absolute;top:-9px;left:18px;font-size:9px;font-weight:800;letter-spacing:.8px;padding:3px 9px;border-radius:999px;background:var(--brand);color:#fff}
.pl-card.cur .ribbon{background:var(--pos)}
.pl-card .nm{font-size:15px;font-weight:800;letter-spacing:-.2px}
.pl-card .tg{font-size:10.5px;color:var(--ink3);margin-top:2px}
.pl-card .pr{margin:14px 0 2px;font-size:26px;font-weight:800;letter-spacing:-1px;line-height:1}
.pl-card .pr small{font-size:11px;font-weight:600;color:var(--ink3);letter-spacing:0;margin-left:3px}
.pl-card .yr{font-size:10.5px;color:var(--ink3);font-family:var(--mono)}
.pl-card ul{list-style:none;padding:0;margin:14px 0 16px;display:flex;flex-direction:column;gap:6px;flex:1}
.pl-card li{font-size:11.5px;color:var(--ink2);padding-left:18px;position:relative;line-height:1.5}
.pl-card li::before{content:'✓';position:absolute;left:0;color:var(--pos);font-weight:800}
.pl-card .meta{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.pl-card .meta span{font-size:10px;font-weight:700;padding:3px 8px;border-radius:999px;background:var(--surface3);color:var(--ink2);border:1px solid var(--line)}
.pl-card .btn{width:100%;justify-content:center;text-align:center}
.pl-split{display:grid;grid-template-columns:1fr 300px;gap:14px;margin-bottom:16px}
.pl-tbl{width:100%;border-collapse:collapse;font-size:12px}
.pl-tbl th{text-align:left;font-size:9.5px;letter-spacing:1px;color:var(--ink3);font-weight:700;padding:10px 14px;border-bottom:1px solid var(--line);text-transform:uppercase}
.pl-tbl td{padding:11px 14px;border-bottom:1px solid var(--line);color:var(--ink2)}
.pl-tbl tr.hot td{background:var(--brandsoft);color:var(--ink);font-weight:650}
.pl-tbl td.num{font-family:var(--mono)}
.pl-sum{padding:12px 14px;font-size:12.5px;font-weight:700;color:var(--ink)}
.pl-sum b{color:var(--brand2)}
.pl-y2{background:linear-gradient(160deg,var(--brandsoft),var(--surface));border:1px solid var(--line2);border-radius:var(--r2);padding:20px}
.pl-y2 .k{font-size:9.5px;letter-spacing:1.6px;font-weight:800;color:var(--ink3)}
.pl-y2 .v{font-size:40px;font-weight:800;letter-spacing:-2px;color:var(--brand2);line-height:1.05;margin:8px 0 6px}
.pl-y2 .d{font-size:10.5px;color:var(--ink3);line-height:1.6}
.pl-me{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.pl-me .kv .k{font-size:9.5px;letter-spacing:1px;color:var(--ink3);font-weight:700}
.pl-me .kv .v{font-size:14px;font-weight:750;margin-top:4px}
#plmodal{position:fixed;inset:0;z-index:950;background:rgba(6,15,31,.55);display:none;align-items:center;justify-content:center;padding:20px}
#plmodal.on{display:flex}
#plmodal .cr-box{text-align:left}
#plmodal h3{text-align:center}
.pl-f{margin-bottom:11px}
.pl-f label{display:block;font-size:10px;font-weight:700;color:var(--ink2);margin-bottom:5px}
.pl-f select,.pl-f input[type=number]{width:100%;padding:9px 11px;font-size:12.5px;border-radius:var(--r);border:1px solid var(--line2);background:var(--surface2);color:var(--ink)}
.pl-f .radios{display:flex;gap:6px;flex-wrap:wrap}
.pl-f .radios label{flex:1;display:flex;align-items:center;gap:6px;padding:8px 10px;border:1px solid var(--line2);border-radius:var(--r);font-size:11.5px;font-weight:600;margin:0;cursor:pointer;color:var(--ink)}
.pl-f .radios label:has(input:checked){border-color:var(--brand);background:var(--brandsoft)}
.pl-tot{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);margin:6px 0 12px;font-size:12.5px}
.pl-tot b{font-size:18px;letter-spacing:-.5px;color:var(--brand2)}
.pl-agree{display:flex;gap:8px;align-items:flex-start;font-size:11px;color:var(--ink2);margin-bottom:12px;line-height:1.5}
.pl-agree input{margin-top:2px}
#planChip{cursor:pointer}
/* jade 스킨 모바일 규칙(.pagehd > div:last-child 를 가로 스크롤 버튼 줄로 취급)이 제목 블록에 걸리지 않게 */
#v_plans .pagehd > div:first-child{display:block;overflow:visible}
@media(max-width:1180px){ .pl-grid{grid-template-columns:1fr 1fr} .pl-steps{grid-template-columns:repeat(3,1fr)} .pl-split{grid-template-columns:1fr} }
@media(max-width:860px){ .pl-grid{grid-template-columns:1fr} .pl-hero{grid-template-columns:1fr} .pl-steps{grid-template-columns:1fr 1fr} }
`;
const st=document.createElement('style'); st.textContent=CSS; document.head.appendChild(st);

/* ───────── 4. 상태 ───────── */
const PKEY='amf.cie.plan.v1';
let SUB=null;   // {k, seats, method, since, next}
try{ const r=JSON.parse(localStorage.getItem(PKEY)||'null'); if(r && PLAN[r.k]) SUB=r; }catch(e){}
const saveSub=()=>{ try{ SUB?localStorage.setItem(PKEY,JSON.stringify(SUB)):localStorage.removeItem(PKEY); }catch(e){} };
const en=()=>LANG==='en';
const won=n=>MAN(n);
const fmtD=iso=>{ const d=new Date(iso); return d.toISOString().slice(0,10); };
const esc=t=>String(t==null?'':t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const monthly=p=>p.price*(SUB&&SUB.k===p.k?SUB.seats:1);

/* ───────── 5. 뷰 등록 (VIEWS · 레일 · 더보기 · 컨테이너) ───────── */
VIEWS.plans=['구독 · 요금제','Platform / Billing / Plans'];
VIEW_KEYS.push('plans');
if(typeof MORE_ICON!=='undefined') MORE_ICON.plans='💳';

const rail=document.querySelector('.rail'), foot=rail&&rail.querySelector('.railfoot');
if(rail){
  const grp=document.createElement('div'); grp.className='rgrp'; grp.textContent='BILLING';
  const btn=document.createElement('button'); btn.className='rlink'; btn.dataset.view='plans';
  btn.innerHTML='<svg class="ic" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1.8" y="3.2" width="12.4" height="9.6" rx="1.4"/><path d="M1.8 6.4h12.4M4.4 10h3"/></svg>구독 · 요금제 <span class="bdg" id="railPlan"></span>';
  btn.onclick=()=>window.showView('plans');
  if(foot){ rail.insertBefore(grp,foot); rail.insertBefore(btn,foot); } else { rail.appendChild(grp); rail.appendChild(btn); }
}
const wrap=document.querySelector('.main .wrap');
const sec=document.createElement('section'); sec.id='v_plans'; sec.className='hidden';
wrap.appendChild(sec);

/* 상단바 플랜 칩 */
const crchip=document.getElementById('crchip');
const chip=document.createElement('span'); chip.className='chip gold'; chip.id='planChip'; chip.setAttribute('role','button'); chip.tabIndex=0;
chip.title='구독 · 요금제 화면으로 이동';
chip.onclick=()=>window.showView('plans'); chip.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); window.showView('plans'); } };
if(crchip) crchip.insertAdjacentElement('afterend',chip);

/* 모달 */
const modal=document.createElement('div'); modal.id='plmodal'; modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true');
modal.innerHTML='<div class="cr-box wide" id="plbox"></div>';
document.body.appendChild(modal);
let MRET=null;
function mOpen(html){ MRET=document.activeElement; document.getElementById('plbox').innerHTML=html; modal.classList.add('on'); i18nSweep(modal); }
function mClose(){ modal.classList.remove('on'); if(MRET&&document.contains(MRET)){ try{ MRET.focus({preventScroll:true}); }catch(e){} } MRET=null; }
modal.addEventListener('click',e=>{ if(e.target===modal) mClose(); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape' && modal.classList.contains('on')) mClose(); });

/* ───────── 6. 렌더링 ───────── */
function syncChip(){
  const cur=SUB?PLAN[SUB.k]:null;
  chip.textContent = cur ? cur.n.toUpperCase()+(SUB.seats>1?' ×'+SUB.seats:'') : T('구독 없이 이용 중');
  chip.classList.toggle('gold',!!cur); chip.classList.toggle('mono',!cur);
  const rb=document.getElementById('railPlan'); if(rb) rb.textContent=cur?cur.n:'';
}
function planCard(p){
  const cur=SUB&&SUB.k===p.k;
  const feats=en()?p.featsEn:p.feats;
  return `<div class="pl-card ${p.hot?'hot':''} ${cur?'cur':''}" data-plan="${p.k}">
    ${cur?`<span class="ribbon">${T('현재 이용 중')}</span>`:p.hot?`<span class="ribbon">${T('추천')}</span>`:''}
    <div class="nm">${p.n}</div><div class="tg">${esc(en()?p.tagEn:p.tag)}</div>
    <div class="pr num">${won(p.price)}<small>/ ${T('월 요금').replace('월 요금',en()?'mo':'월')}${p.from?' '+T('부터'):''}</small></div>
    <div class="yr">${T('연 환산')} ${won(p.price*12)}${p.from?'~':''}</div>
    <div class="meta" style="margin-top:12px"><span>${T('좌석')} ${p.seats}${p.k==='ent'?'+':''}</span>
      <span>${p.credits===Infinity?T('무제한'):p.credits} ${T('월 크레딧')}</span>
      <span>${T('Year 2 목표')} ${p.target} ${T('계정')}</span></div>
    <ul>${feats.map(f=>'<li>'+esc(f)+'</li>').join('')}</ul>
    ${cur
      ? `<button type="button" class="btn sm" data-act="cancel">${T('구독 해지')}</button>`
      : p.k==='ent'
        ? `<button type="button" class="btn sm" data-act="contact" data-plan="${p.k}">${T('도입 문의')}</button>`
        : `<button type="button" class="btn pri sm" data-act="buy" data-plan="${p.k}">${SUB?T('플랜 변경'):T('구독 결제하기')}</button>`}
  </div>`;
}
function render(){
  const total=PLANS.reduce((t,p)=>t+p.price*p.target,0);   // 월 580만원
  const cur=SUB?PLAN[SUB.k]:null;
  const bal=(window.amfCredits&&window.amfCredits.balance)?window.amfCredits.balance():null;
  sec.innerHTML=`
    <div class="pagehd"><div>
      <h1>구독 · 요금제</h1>
      <p>운영으로 데이터를 쌓고, 데이터로 제품을 만듭니다. Year 1 운영에서 축적한 데이터와 표준화된 프로세스를 Year 2 구독 제품으로 전환합니다.</p>
    </div></div>
    <div class="note" style="margin-bottom:14px"><b>시연용 결제 —</b> 이 화면의 결제는 실제로 청구되지 않습니다. 결제 대행사(PG) 연동 전 흐름 확인용이며, 구독 상태는 이 브라우저에만 저장됩니다.</div>

    ${cur?`<div class="card" style="margin-bottom:16px"><div class="chd"><h3>내 구독</h3><span class="sub mono">${esc(SUB.since)} ~</span></div>
      <div class="cbd"><div class="pl-me">
        <div class="kv"><div class="k">PLAN</div><div class="v">${cur.n} <span class="tag">${SUB.seats} ${T('좌석')}</span></div></div>
        <div class="kv"><div class="k">${T('월 요금')}</div><div class="v num">${won(cur.price*SUB.seats)}</div></div>
        <div class="kv"><div class="k">${T('다음 결제일')}</div><div class="v num">${esc(SUB.next)}</div></div>
        <div class="kv"><div class="k">${T('결제 수단')}</div><div class="v">${T(SUB.method)}</div></div>
        <div class="kv"><div class="k">${T('크레딧 잔액')}</div><div class="v num">${bal==null?'–':bal}</div></div>
      </div></div></div>`:''}

    <div class="sec" style="margin-bottom:8px">SAAS TRANSITION · ${T('제품화 경로')}</div>
    <div class="pl-steps">${STEPS.map((s,i)=>`<div class="pl-step ${i===4?'on':''}"><span class="no">0${i+1}</span><br>${esc(en()?s[1]:s[0])}</div>`).join('')}</div>

    <div class="pl-grid">${PLANS.map(planCard).join('')}</div>

    <div class="sec" style="margin-bottom:8px">PRICING &amp; YEAR 2 TARGET · ${T('가격 · Year 2 목표')}</div>
    <div class="pl-split">
      <div class="card"><div class="tblwrap"><table class="pl-tbl">
        <thead><tr><th>${T('등급')}</th><th>${T('월 요금')}</th><th>${T('계정')}</th><th>${T('확보 경로')}</th></tr></thead>
        <tbody>${PLANS.map(p=>`<tr class="${p.hot?'hot':''}"><td>${p.n}</td><td class="num">${won(p.price)}${p.from?' ~':''}</td><td class="num">${p.target}</td><td>${esc(en()?p.whoEn:p.who)}</td></tr>`).join('')}</tbody>
      </table></div>
      <div class="pl-sum">${T('합계')} ${T('월 요금').replace('월 요금',en()?'':'월')} ${won(total)} × 12 ${T('개월')} = <b>${en()?'':'연'} ${Y2.saas.toFixed(2)}${en()?' × 10⁸ KRW / yr':'억원'}</b></div></div>
      <div class="pl-y2"><div class="k">YEAR 2 SAAS ${en()?'REVENUE':'매출'}</div>
        <div class="v num">${Y2.saas.toFixed(2)} ${en()?'×10⁸':'억'}</div>
        <div class="d">Year 2 ${en()?'total':'총매출'} ${Y2.total.toFixed(2)}${en()?'×10⁸':'억'} ${T('Year 2 총매출 중')} ${Y2.share}%<br>${en()?'Rest':'나머지'} ${Y2.rest.toFixed(2)}${en()?'×10⁸':'억'} = ${en()?'contracts · ops · pilots · training':'계약 · 운영 · 파일럿 · 교육'}</div></div>
    </div>`;
  sec.querySelectorAll('[data-act]').forEach(b=>{
    const a=b.dataset.act;
    if(a==='buy') b.onclick=()=>checkout(b.dataset.plan);
    if(a==='contact') b.onclick=()=>contact();
    if(a==='cancel') b.onclick=()=>cancel();
  });
  i18nSweep(sec);
  syncChip();
}

/* ───────── 7. 결제 흐름 (시연) ───────── */
function checkout(k){
  const p=PLAN[k]; if(!p) return;
  const user=(window.amfCredits&&window.amfCredits.user&&window.amfCredits.user())||{};
  mOpen(`
    <div class="emo" aria-hidden="true">💳</div>
    <h3>${p.n} · ${T('구독 결제하기')}</h3>
    <p style="text-align:center">${esc(user.name||'')}${user.mail?' · '+esc(user.mail):''}</p>
    <div class="pl-f"><label for="plSeats">${T('좌석')}</label>
      <input type="number" id="plSeats" min="1" max="${p.k==='ent'?50:p.seats}" value="1"></div>
    <div class="pl-f"><label>${T('결제 수단')}</label><div class="radios">
      <label><input type="radio" name="plM" value="카드" checked>${T('카드')}</label>
      <label><input type="radio" name="plM" value="계좌이체">${T('계좌이체')}</label>
      <label><input type="radio" name="plM" value="세금계산서">${T('세금계산서')}</label></div></div>
    <div class="pl-tot"><span>${T('월 요금')} × <span id="plN">1</span></span><b class="num" id="plTot">${won(p.price)}</b></div>
    <label class="pl-agree"><input type="checkbox" id="plAgree"> ${T('약관 및 자동 갱신에 동의합니다')}</label>
    <div id="plMsg"></div>
    <button class="ok" type="button" id="plPay">${T('결제하기')}</button>
    <button class="no" type="button" id="plX">${T('취소')}</button>`);
  const seats=document.getElementById('plSeats');
  const upd=()=>{ const n=Math.max(1,Math.min(+seats.max,+seats.value||1)); seats.value=n;
    document.getElementById('plN').textContent=n; document.getElementById('plTot').textContent=won(p.price*n); };
  seats.oninput=upd;
  document.getElementById('plX').onclick=mClose;
  document.getElementById('plPay').onclick=()=>{
    if(!document.getElementById('plAgree').checked){ document.getElementById('plMsg').innerHTML='<div class="aiwarn">'+T('약관에 동의해 주세요')+'</div>'; return; }
    const n=+seats.value||1, method=(document.querySelector('input[name=plM]:checked')||{}).value||'카드';
    const btn=document.getElementById('plPay'); btn.disabled=true; btn.textContent=T('결제 처리 중…');
    /* ── PG 연동 지점 ──
       실결제 시 여기서 결제창을 호출하고, 승인 콜백에서 activate(k,n,method) 를 부른다.
       예) tossPayments.requestPayment('카드',{amount:p.price*n, orderId, orderName:p.n, successUrl, failUrl}) */
    setTimeout(()=>{ activate(k,n,method); mClose(); }, 900);
  };
  setTimeout(()=>{ try{ seats.focus({preventScroll:true}); }catch(e){} },0);
}
function activate(k,n,method){
  const p=PLAN[k];
  const now=new Date(); const next=new Date(now); next.setMonth(next.getMonth()+1);
  const changed=SUB&&SUB.k!==k;
  SUB={k, seats:n, method, since:fmtD(now), next:fmtD(next)};
  saveSub();
  if(window.amfCredits && p.credits!==Infinity) window.amfCredits.earn(p.credits*n, p.n+' '+T('월 크레딧'));
  else if(window.amfCredits) window.amfCredits.earn(9999, p.n+' '+T('무제한'));
  render();
  toast(T('구독이 시작되었습니다')+' · '+p.n+(changed?' ('+T('플랜 변경')+')':''));
}
function cancel(){
  mOpen(`<div class="emo" aria-hidden="true">🗓</div><h3>${T('정말 해지하시겠습니까?')}</h3>
    <p style="text-align:center">${T('남은 기간까지는 계속 이용할 수 있습니다.')}<br><span class="mono">${esc(SUB.next)}</span></p>
    <button class="ok" type="button" id="plYes">${T('해지')}</button>
    <button class="no" type="button" id="plNo">${T('유지')}</button>`);
  document.getElementById('plNo').onclick=mClose;
  document.getElementById('plYes').onclick=()=>{ SUB=null; saveSub(); mClose(); render(); toast(T('구독을 해지했습니다')); };
}
function contact(){
  toast(T('도입 문의를 접수했습니다 — 영업일 1일 내 회신합니다 (시연)'));
}

/* ───────── 8. 결선 ───────── */
const _sv=window.showView;
window.showView=function(v){ const r=_sv.apply(this,arguments); if(v==='plans') render(); return r; };
const _al=window.applyLang;
if(typeof _al==='function') window.applyLang=function(){ const r=_al.apply(this,arguments); syncChip(); if(!sec.classList.contains('hidden')) render(); return r; };
/* 다른 스크립트(어시스턴트)에서 읽는 요약 */
window.AMF_PLANS={
  list:()=>PLANS.map(p=>({k:p.k,n:p.n,월요금:p.price,월요금_표시:won(p.price)+(p.from?'~':''),좌석:p.seats,월크레딧:p.credits===Infinity?'무제한':p.credits,Year2목표계정:p.target,확보경로:p.who,기능:p.feats})),
  current:()=>SUB?{plan:PLAN[SUB.k].n,좌석:SUB.seats,월요금:won(PLAN[SUB.k].price*SUB.seats),다음결제일:SUB.next,결제수단:SUB.method}:null,
  year2:{SaaS매출:'0.70억',총매출:'7.60억',비중:'9%',나머지:'6.90억 = 계약·운영·파일럿·교육',합계:'월 580만원 × 12 = 연 0.70억'},
  open:()=>window.showView('plans'), checkout
};
syncChip();
if(LANG==='en') i18nSweep(rail||document.body);
})();
