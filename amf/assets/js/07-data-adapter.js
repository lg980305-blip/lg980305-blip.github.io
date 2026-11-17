/* AMF Commerce Intelligence Engine — 07-data-adapter
   자동 분리: tools/split_monolith.py · 클래식 스크립트(전역 스코프 공유), 로드 순서 유지 */
/* ═══════════════════════════════════════════════════════════════════════
   데이터 소스 어댑터
   ─────────────────────────────────────────────────────────────────────
   합성 로스터를 실제 로스터로 갈아끼우는 통로다.
   설계 원칙 —
     · 엔진은 레코드의 '형태'만 본다. 어디서 왔는지는 모른다.
       그래서 이 레이어만 바꾸면 스코어링·필터·포트폴리오는 손대지 않아도 된다.
     · 부분 입력을 허용한다. 실무 데이터에 모든 필드가 있는 경우는 없다.
       빠진 필드는 합성 기본값으로 채우되, '무엇을 채웠는지' 반드시 보고한다.
       조용히 채우면 미검증 값이 실측치인 척하게 된다 — 이 제품에서 가장 피해야 할 일.
     · 검증 실패는 거부한다. 잘못된 데이터로 그럴듯한 결과를 내는 것보다 낫다.
   ═══════════════════════════════════════════════════════════════════════ */

const DSKEY='amf.cie.datasource.v1';
let DATA_SOURCE={ kind:'synthetic', name:null, at:null, count:ROSTER.length, report:null };
try{
  const r=JSON.parse(localStorage.getItem(DSKEY)||'null');
  if(r && r.kind) DATA_SOURCE=Object.assign(DATA_SOURCE,r);
}catch(e){}

/* ── 스키마 ──
   required: 없으면 레코드를 버린다.  filled: 없으면 합성값으로 채운다. */
const SCHEMA=[
 {k:'id',        t:'string', req:true,  d:'크리에이터 고유 식별자'},
 {k:'name',      t:'string', req:true,  d:'활동명'},
 {k:'country',   t:'string', req:true,  d:'국가 (한국어 표기)', enumOf:()=>COUNTRIES.map(c=>c.n)},
 {k:'tier',      t:'enum',   req:true,  d:'등급', values:['S','A','B','C']},
 {k:'followers', t:'int',    req:true,  d:'전 채널 합산 팔로워', min:100},
 {k:'er',        t:'float',  req:true,  d:'평균 참여율 (%)', min:0.1, max:40},
 {k:'rate',      t:'int',    req:true,  d:'패키지 단가 (KRW)', min:10000},
 {k:'city',      t:'string', req:false, d:'활동 도시'},
 {k:'gender',    t:'enum',   req:false, d:'성별', values:['F','M']},
 {k:'age',       t:'int',    req:false, d:'만 나이', min:13, max:80},
 {k:'mainPlat',  t:'enum',   req:false, d:'주력 채널', values:['Instagram','TikTok','YouTube']},
 {k:'aqs',       t:'int',    req:false, d:'오디언스 진정성 (0-100)', min:0, max:100},
 {k:'fakeRate',  t:'float',  req:false, d:'가짜·비활성 팔로워 추정 (%)', min:0, max:100},
 {k:'reachable', t:'float',  req:false, d:'도달 가능률 (%)', min:0, max:100},
 {k:'quality',   t:'int',    req:false, d:'콘텐츠 품질 (0-100)', min:0, max:100},
 {k:'safety',    t:'int',    req:false, d:'브랜드 세이프티 (0-100)', min:0, max:100},
 {k:'risk',      t:'int',    req:false, d:'리스크 지표 (0-48)', min:0, max:48},
 {k:'garm',      t:'enum',   req:false, d:'GARM 등급', values:['low','medium','high','floor']},
 {k:'disclosure',t:'int',    req:false, d:'광고 표시 준수율 (%)', min:0, max:100},
 {k:'roas',      t:'float',  req:false, d:'과거 평균 ROAS', min:0, max:30},
 {k:'cvr',       t:'float',  req:false, d:'과거 평균 구매전환율 (%)', min:0, max:30},
 {k:'aov',       t:'int',    req:false, d:'평균 객단가 (KRW)', min:1000},
 {k:'campaigns', t:'int',    req:false, d:'누적 캠페인 수', min:0},
 {k:'height',    t:'int',    req:false, d:'키 (cm)', min:120, max:220},
 {k:'topKR',     t:'string', req:false, d:'상의 사이즈 (국내 표기)'},
 {k:'cats',      t:'object', req:false, d:'카테고리 적합도 벡터 {키:0-100}'},
 {k:'growth90',  t:'float',  req:false, d:'90일 팔로워 증감률 (%)', min:-90, max:300}
];
const SCHEMA_MAP=Object.fromEntries(SCHEMA.map(f=>[f.k,f]));

function coerce(field, raw){
  if(raw===undefined||raw===null||raw==='') return {ok:false, empty:true};
  let v=raw;
  if(field.t==='int'||field.t==='float'){
    if(typeof v==='string') v=v.replace(/[,\s₩%]/g,'');
    v=Number(v);
    if(!Number.isFinite(v)) return {ok:false, msg:'숫자가 아닙니다'};
    if(field.t==='int') v=Math.round(v);
    if(field.min!==undefined && v<field.min) return {ok:false, msg:'최솟값 '+field.min+' 미만'};
    if(field.max!==undefined && v>field.max) return {ok:false, msg:'최댓값 '+field.max+' 초과'};
  }else if(field.t==='enum'){
    v=String(v).trim();
    if(field.values.indexOf(v)<0) return {ok:false, msg:'허용값: '+field.values.join(' / ')};
  }else if(field.t==='object'){
    if(typeof v==='string'){ try{ v=JSON.parse(v); }catch(e){ return {ok:false,msg:'JSON 형식 오류'}; } }
    if(typeof v!=='object') return {ok:false, msg:'객체가 아닙니다'};
  }else{
    /* 보안: 업로드 파일의 자유 텍스트에서 HTML 특수문자를 제거한다 (DOM XSS 방지) */
    v=String(v).replace(/[<>"'`]/g,'').trim();
    if(!v) return {ok:false, empty:true};
    if(field.enumOf){
      const allowed=field.enumOf();
      if(allowed.indexOf(v)<0) return {ok:false, msg:'허용값: '+allowed.slice(0,5).join(' / ')+' …'};
    }
  }
  return {ok:true, v};
}

/* 부분 레코드를 엔진이 요구하는 완전한 형태로 만든다.
   합성으로 채운 필드는 filled 에 기록해 화면에 그대로 노출한다. */
function hydrate(rec, template, filled){
  const out=JSON.parse(JSON.stringify(template));   // 합성 레코드를 바탕으로 덮어쓴다
  const mark=k=>{ filled[k]=(filled[k]||0)+1; };

  out.id=rec.id; out.name=rec.name; out.tier=rec.tier;
  out.followers=rec.followers; out.er=rec.er; out.rate=rec.rate;

  const co=COUNTRIES.find(c=>c.n===rec.country);
  out.country=rec.country; out.cc=co?co.c:'??'; out.countryEn=co?co.en:rec.country;
  out.region=co?co.r:'전 권역';
  out.city = rec.city || (co?co.cities[0]:'—'); if(!rec.city) mark('city');
  out.langs = co?LANGS[co.c]:['—'];

  const put=(k,val,apply)=>{ if(val===undefined){ mark(k); } else apply(val); };
  put('gender',   rec.gender,   v=>out.gender=v);
  put('age',      rec.age,      v=>out.age=v);
  put('mainPlat', rec.mainPlat, v=>out.mainPlat=v);
  put('aqs',      rec.aqs,      v=>out.aqs=v);
  put('fakeRate', rec.fakeRate, v=>out.fakeRate=v);
  put('reachable',rec.reachable,v=>out.reachable=v);
  put('quality',  rec.quality,  v=>out.quality=v);
  put('safety',   rec.safety,   v=>out.safety=v);
  put('risk',     rec.risk,     v=>out.risk=v);
  put('disclosure',rec.disclosure,v=>out.disclosure=v);
  put('campaigns',rec.campaigns,v=>out.commerce.campaigns=v);
  put('roas',     rec.roas,     v=>out.commerce.roas=v);
  put('cvr',      rec.cvr,      v=>out.commerce.cvr=v);
  put('aov',      rec.aov,      v=>out.commerce.aov=v);
  put('height',   rec.height,   v=>out.body.height=v);
  put('topKR',    rec.topKR,    v=>out.body.topKR=v);
  put('growth90', rec.growth90, v=>out.growth.f90=v);

  if(rec.garm!==undefined){
    out.garm=rec.garm;
    const g=GARM.find(x=>x.k===rec.garm);
    out.garmName=g?g.n:rec.garm; out.garmDesc=g?g.d:'';
  } else mark('garm');

  /* 카테고리 벡터 — 실무에서 가장 자주 빠지는 필드다.
     빠지면 합성 벡터를 그대로 쓰되 반드시 보고한다(매칭 결과를 좌우하므로). */
  if(rec.cats && typeof rec.cats==='object'){
    CATS.forEach(c=>{ const v=Number(rec.cats[c.k]);
      if(Number.isFinite(v)) out.cats[c.k]=Math.max(0,Math.min(100,Math.round(v))); });
    out.mains=CATS.map(c=>c.k).sort((a,b)=>out.cats[b]-out.cats[a]).slice(0,3);
  } else mark('cats');

  /* 파생값 재계산 — 원본이 바뀌었으므로 반드시 다시 구한다 */
  out.realFollowers=Math.round(out.followers*(1-out.fakeRate/100));
  out.platforms={Instagram:0,TikTok:0,YouTube:0};
  out.platforms[out.mainPlat]=Math.round(out.followers*0.62);
  ['Instagram','TikTok','YouTube'].forEach(p=>{
    if(p!==out.mainPlat) out.platforms[p]=Math.round(out.followers*0.19); });
  out.platEr={Instagram:out.er, TikTok:+(out.er*1.18).toFixed(1), YouTube:+(out.er*0.74).toFixed(1)};
  out.initials=(out.name||'?').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();
  out.fp={co:out.cc, rg:out.region, cat:out.mains[0], age:out.audience.peak, plat:out.mainPlat};
  CATS.forEach(c=>{ if(!out.catPerf[c.k]) out.catPerf[c.k]={cvr:out.commerce.cvr,roas:out.commerce.roas,camp:1}; });
  return out;
}

/* ── 파서 ── */
function parseCSVText(text){
  const rows=[]; let cur=[], val='', q=false;
  const t=text.replace(/^﻿/,'');
  for(let i=0;i<t.length;i++){
    const ch=t[i];
    if(q){
      if(ch==='"'){ if(t[i+1]==='"'){ val+='"'; i++; } else q=false; }
      else val+=ch;
    }else{
      if(ch==='"') q=true;
      else if(ch===','){ cur.push(val); val=''; }
      else if(ch==='\n'){ cur.push(val); rows.push(cur); cur=[]; val=''; }
      else if(ch!=='\r') val+=ch;
    }
  }
  if(val!==''||cur.length){ cur.push(val); rows.push(cur); }
  const clean=rows.filter(r=>r.length && !(r.length===1&&!r[0].trim()) && !/^\s*#/.test(r[0]));
  if(clean.length<2) throw new Error('헤더와 데이터 행이 필요합니다');
  const head=clean[0].map(h=>h.trim());
  return clean.slice(1).map(r=>{
    const o={}; head.forEach((h,i)=>{ if(h) o[h]=r[i]; }); return o;
  });
}
function parseRecords(text, filename){
  const trimmed=text.trim();
  if(trimmed.startsWith('[')||trimmed.startsWith('{')){
    const j=JSON.parse(trimmed);
    const arr=Array.isArray(j)?j:(Array.isArray(j.creators)?j.creators:(Array.isArray(j.records)?j.records:null));
    if(!arr) throw new Error('배열 또는 {creators:[...]} 형태여야 합니다');
    return arr;
  }
  return parseCSVText(text);
}

/* ── 적재 ── */
function loadRoster(text, filename){
  const raw=parseRecords(text, filename);
  const report={file:filename, total:raw.length, accepted:0, rejected:[], filled:{}, unknown:[]};
  const known=new Set(SCHEMA.map(f=>f.k));
  Object.keys(raw[0]||{}).forEach(k=>{ if(!known.has(k)) report.unknown.push(k); });

  const seen=new Set();
  const out=[];
  raw.forEach((rec,i)=>{
    const clean={}; const errs=[];
    SCHEMA.forEach(f=>{
      const r=coerce(f, rec[f.k]);
      if(r.ok) clean[f.k]=r.v;
      else if(f.req) errs.push(f.k+(r.msg?': '+r.msg:'가 비었습니다'));
    });
    if(errs.length){ report.rejected.push({row:i+2, id:rec.id||'—', why:errs.join(' · ')}); return; }
    if(seen.has(clean.id)){ report.rejected.push({row:i+2, id:clean.id, why:'ID 중복'}); return; }
    seen.add(clean.id);
    const tmpl=ROSTER[out.length % ROSTER.length];
    const rec2=hydrate(clean, tmpl, report.filled);
    rec2.idx=out.length;
    out.push(rec2);
  });
  report.accepted=out.length;
  if(!out.length) throw new Error('유효한 레코드가 하나도 없습니다 — 헤더 이름을 확인하세요');
  return {roster:out, report};
}

function applyRoster(roster, report, meta){
  ROSTER.length=0; roster.forEach(r=>ROSTER.push(r));
  DATA_SOURCE={kind:'real', name:meta.name, at:new Date().toISOString(),
               count:ROSTER.length, report};
  try{ localStorage.setItem(DSKEY, JSON.stringify(DATA_SOURCE)); }catch(e){}
  afterDataChange();
}
function resetRoster(){
  const fresh=buildRosterFresh();
  ROSTER.length=0; fresh.forEach(r=>ROSTER.push(r));
  DATA_SOURCE={kind:'synthetic', name:null, at:null, count:ROSTER.length, report:null};
  try{ localStorage.removeItem(DSKEY); }catch(e){}
  afterDataChange();
  toast(T('AMF 로스터로 되돌렸습니다'));
}
/* 데이터가 바뀌면 파생 상태를 전부 다시 만든다 */
function afterDataChange(){
  fillCountryOpts();
  rebuildWeekly();
  BOARD=BOARD.filter(i=>i<ROSTER.length); boardSave();
  LAST=null; window.LAST=null;
  rebuildAlerts();
  rebuildShows();          /* 참여 확정 모델이 로스터를 참조하므로 함께 다시 만든다 */
  const rs2=$('railShows'); if(rs2) rs2.textContent=SHOWS.filter(x=>x.castingOpen).length;
  $('railCount').textContent=ROSTER.length;
  $('briefHint').textContent=L`네트워크 ${ROSTER.length}인 · ${new Set(ROSTER.map(c=>c.country)).size}개국 대상 전수 연산`;
  try{ resetMatch(); }catch(e){}
  updateBudget(); boardSync();
  const cur=document.querySelector('.rlink.on');
  const v=cur?cur.dataset.view:'match';
  if(v==='dash') renderDash(); if(v==='roster') renderRoster(1);
  if(v==='gov') renderGov(); if(v==='board') renderBoard();
  if(v==='trends') renderTrends(); if(v==='growth') renderGrowth();
  if(v==='alerts') renderAlerts();
  if(v==='cue'){ renderCue(); renderCueClaims(); }
  renderDataPanel();
}

/* 스키마 템플릿 CSV — 이 파일에 실제 값을 채워 올리면 된다 */
function downloadTemplate(){
  const cols=SCHEMA.map(f=>f.k);
  const head=[
    '# AMF Commerce Intelligence Engine — creator roster template',
    '# 필수: '+SCHEMA.filter(f=>f.req).map(f=>f.k).join(', '),
    '# 선택 항목을 비우면 합성 기본값으로 채우고, 무엇을 채웠는지 화면에 보고합니다.',
    '# cats 는 JSON 문자열로 넣습니다. 예: "{""beauty_skin"":92,""fashion_cas"":71}"',
    cols.join(',')];
  const sample=ROSTER.slice(0,3).map((c,i)=>cols.map(k=>{
    const m={id:c.id,name:c.name,country:c.country,tier:c.tier,followers:c.followers,er:c.er,
      rate:c.rate,city:c.city,gender:c.gender,age:c.age,mainPlat:c.mainPlat,aqs:c.aqs,
      fakeRate:c.fakeRate,reachable:c.reachable,quality:c.quality,safety:c.safety,risk:c.risk,
      garm:c.garm,disclosure:c.disclosure,roas:c.commerce.roas,cvr:c.commerce.cvr,
      aov:c.commerce.aov,campaigns:c.commerce.campaigns,height:c.body.height,topKR:c.body.topKR,
      cats:JSON.stringify(c.cats),growth90:c.growth.f90};
    return CSVQ(m[k]);
  }).join(','));
  saveFile('AMF_roster_template.csv','﻿'+head.concat(sample).join('\r\n'),
    'text/csv;charset=utf-8','CSV');
}

/* ── 거버넌스 화면의 데이터 소스 패널 ── */
function renderDataPanel(){
  const el=$('dataPanel'); if(!el) return;
  const ds=DATA_SOURCE;
  const rep=ds.report;
  const badge = ds.kind==='real'
    ? `<span class="tag g">${T('실 데이터')}</span>`
    : `<span class="tag y">AMF 로스터</span>`;
  const fills = rep && rep.filled ? Object.entries(rep.filled).sort((a,b)=>b[1]-a[1]) : [];
  el.innerHTML=`
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">
      ${badge}
      <b style="font-size:13px">${ds.kind==='real'? (escH(ds.name)||T('업로드된 로스터')) : T('AMF 로스터 (98인)')}</b>
      <span style="font-size:11px;color:var(--ink3)">${L`${ds.count}인`}${
        ds.at?' · '+ds.at.slice(0,16).replace('T',' '):''}</span>
    </div>
    ${ds.kind==='real'? `
      <div class="gstat" style="margin-bottom:12px">
        <div><div class="k">${T('적재')}</div><div class="v">${rep.accepted}</div></div>
        <div><div class="k">${T('거부')}</div>
          <div class="v" style="${rep.rejected.length?'color:var(--neg)':''}">${rep.rejected.length}</div></div>
        <div><div class="k">${T('합성으로 채운 필드')}</div><div class="v">${fills.length}</div></div>
        <div><div class="k">${T('알 수 없는 열')}</div><div class="v">${rep.unknown.length}</div></div>
      </div>
      ${fills.length?`<div class="note" style="margin-bottom:12px">
        <b>${T('합성으로 채운 필드 —')}</b> ${T('아래 항목은 업로드 파일에 없어 합성 기본값을 사용합니다. 실측치가 아니므로 결과 해석 시 감안하십시오.')}<br>
        ${fills.map(([k,n])=>`<span class="mono">${k}</span>(${n})`).join(' · ')}</div>`:''}
      ${rep.unknown.length?`<div style="font-size:10.5px;color:var(--ink3);margin-bottom:10px">
        ${T('스키마에 없어 무시한 열')}: <span class="mono">${rep.unknown.map(escH).join(', ')}</span></div>`:''}
      ${rep.rejected.length?`<div class="sec" style="margin:12px 0 7px">${T('거부된 행')}</div>
        <div class="tblwrap" style="max-height:180px;overflow-y:auto"><table>
        <thead><tr><th>${T('행')}</th><th>ID</th><th>${T('사유')}</th></tr></thead>
        <tbody>${rep.rejected.slice(0,50).map(r=>`<tr><td class="mono">${r.row}</td>
          <td class="mono">${escH(r.id)}</td><td style="white-space:normal">${escH(r.why)}</td></tr>`).join('')}
        </tbody></table></div>`:''}
    ` : `<div style="font-size:11.5px;color:var(--ink2);line-height:1.8;margin-bottom:12px">
        ${T('현재 화면의 크리에이터는 AMF 로스터 98인이며 성과 지표는 시뮬레이션입니다. 실제 로스터 파일(CSV 또는 JSON)을 올리면 엔진·UI는 그대로 두고 데이터만 교체됩니다.')}</div>`}
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <input type="file" id="dsFile" accept=".csv,.json,.txt" class="sr-only">
      <button class="btn pri sm" type="button" id="dsPick">${T('로스터 파일 올리기')}</button>
      <button class="btn sm" type="button" id="dsTmpl">${T('스키마 템플릿 CSV')}</button>
      ${ds.kind==='real'?`<button class="btn sm" type="button" id="dsReset">${T('AMF 로스터로 되돌리기')}</button>`:''}
      <span class="fhint">${T('파일은 브라우저 안에서만 처리되며 서버로 전송되지 않습니다.')}</span>
    </div>
    <div id="dsMsg" style="margin-top:10px"></div>`;

  const f=$('dsFile');
  $('dsPick').onclick=()=>f.click();
  $('dsTmpl').onclick=downloadTemplate;
  const rs=document.getElementById('dsReset'); if(rs) rs.onclick=resetRoster;
  f.onchange=()=>{
    const file=f.files&&f.files[0]; if(!file) return;
    const msg=$('dsMsg');
    msg.innerHTML=`<span class="aibusy">${T('파일을 읽는 중…')}</span>`;
    const rd=new FileReader();
    rd.onload=()=>{
      try{
        const {roster,report}=loadRoster(String(rd.result), file.name);
        applyRoster(roster, report, {name:file.name});
        toast(L`${report.accepted}인을 적재했습니다`);
      }catch(e){
        msg.innerHTML=`<div class="aiwarn"><b>${T('적재 실패')}</b> — ${mdLite(e.message)}<br>
          ${T('스키마 템플릿 CSV 를 내려받아 열 이름을 맞춰 주세요.')}</div>`;
      }
      f.value='';
    };
    rd.onerror=()=>{ msg.innerHTML=`<div class="aiwarn">${T('파일을 읽을 수 없습니다')}</div>`; };
    rd.readAsText(file,'utf-8');
  };
}

/* 데이터 사전 화면에 스키마를 그대로 노출 */
function renderSchemaTable(){
  const el=$('schemaTbl'); if(!el) return;
  el.innerHTML=`
   <thead><tr><th>${T('필드')}</th><th class="c">${T('필수')}</th><th>${T('형식')}</th>
     <th>${T('설명')}</th></tr></thead>
   <tbody>${SCHEMA.map(f=>`<tr>
     <td class="mono" style="font-size:11px">${f.k}</td>
     <td class="c">${f.req?`<span class="tag r">${T('필수')}</span>`:`<span class="tag n">${T('선택')}</span>`}</td>
     <td style="font-size:11px;color:var(--ink2)">${f.t}${
       f.values?' · '+f.values.join('/'):''}${
       f.min!==undefined?' · '+f.min+'~'+(f.max!==undefined?f.max:'∞'):''}</td>
     <td style="white-space:normal;font-size:11.5px">${T(f.d)}</td></tr>`).join('')}</tbody>`;
}

