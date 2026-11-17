/* AMF Commerce Intelligence Engine — 04-engine
   자동 분리: tools/split_monolith.py · 클래식 스크립트(전역 스코프 공유), 로드 순서 유지 */
/* ───────── 4. SCORING ENGINE ───────── */
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));

function axisScores(c, brief){
  /* A · Audience Fit — 연령 버킷 일치 + 성별 일치 + 권역 일치 */
  let A;
  if(!brief.ageBucket){
    // 전 연령 타깃 → 분포의 고른 정도(엔트로피)를 평가
    const H=-AGEB.reduce((s,b)=>{const p=c.audience.ageDist[b]||1e-6;return s+p*Math.log(p)},0);
    A = clamp(38 + (H/Math.log(AGEB.length))*62);
  }else{
    const share=c.audience.ageDist[brief.ageBucket]||0;
    A = clamp(22 + (share/0.40)*78);
  }
  const f=c.audience.female;
  const gfit = brief.sex==='여성' ? f : brief.sex==='남성' ? (1-f) : (1-Math.abs(f-0.5)*1.6);
  A = clamp(A*0.70 + gfit*100*0.30);
  if(brief.region!=='전 권역') A = clamp(A + (c.region===brief.region ? 7 : -13));

  /* C · Category Fit */
  const C = c.cats[brief.catKey];

  /* E · Engagement — 참여율을 '실제 도달 가능 팔로워' 규모로 보정.
     가짜·비활성 팔로워는 반응하지 않으므로 진성 팔로워 기준으로 계산한다. */
  const reachW = Math.min(1.25, 0.62 + Math.log10(Math.max(1000,c.realFollowers))/12);
  const erUse = brief.platform!=='채널 무관' ? c.platEr[brief.platform] : c.er;
  let E = clamp((erUse/8.2)*100*reachW*(0.72+c.reachable/100*0.4));
  if(brief.platform!=='채널 무관'){
    const sh=c.platforms[brief.platform]/c.followers;
    E = clamp(E*(0.78+sh*0.5));
  }

  /* Q · Quality — 콘텐츠 품질 + 브랜드 세이프티 + 오디언스 진정성(AQS) */
  const garmAdj = {low:6, medium:0, high:-9, floor:-22}[c.garm] || 0;
  const Q = clamp(c.quality*0.40 + c.safety*0.24 + c.aqs*0.36 + garmAdj);

  /* M · Commerce Fit — 전체 평균이 아니라 '해당 카테고리 · 해당 연령대' 실적으로 산출.
     같은 크리에이터도 상품군과 타깃 연령이 바뀌면 커머스 적합도가 달라진다. */
  const cp = c.catPerf[brief.catKey];
  const ageMul = brief.ageBucket ? c.agePerf[brief.ageBucket]
               : (AGEB.reduce((t,b)=>t+c.agePerf[b],0)/AGEB.length);
  const M = clamp(
      (Math.min(cp.cvr*ageMul,7)/7)*38 +
      (Math.min(cp.roas,8)/8)*34 +
      (Math.min(cp.camp,40)/40)*18 +
      (1-Math.min(c.commerce.ret,25)/25)*10 );

  /* G · Growth */
  const G = clamp(48 + c.growth.f90*0.72 + c.growth.etrend*0.95);

  return {A:Math.round(A),C:Math.round(C),E:Math.round(E),Q:Math.round(Q),
          M:Math.round(M),G:Math.round(G)};
}

function scoreCreator(c, brief){
  const ax = axisScores(c, brief);
  const w  = brief.obj.w;
  let raw = 0; for(const k in w) raw += ax[k]*w[k];
  const penalty = c.risk*0.35;

  /* 예산 효율 보정 — 1인당 배분 예산(slot) 대비 단가
     배분 예산 이하면 가성비 가산(최대 +3), 초과하면 예산 압박 페널티(최대 −6).
     '싸다'는 것은 벌점 사유가 아니므로 하방 페널티를 두지 않는다. */
  const slot   = brief.budget/Math.max(1,brief.topN);
  const ratio  = c.rate/slot;
  const budAdj = +(ratio<=1 ? Math.min(3,(1-ratio)*3.6)
                            : -Math.min(6,(ratio-1)*6)).toFixed(1);
  const bfit   = Math.round(Math.min(999, ratio*100));   // 배분 예산 대비 단가 비율(%)

  const score = +clamp(raw - penalty + budAdj).toFixed(1);
  return {ax, score, penalty:+penalty.toFixed(1), raw:+raw.toFixed(1),
          budAdj, bfit, slot};
}

/* ───────── 5. PIPELINE ───────── */
/* 브리프 읽기.
   ov 로 개별 항목을 덮어쓸 수 있다 — 민감도 분석이 실제 폼을 건드렸다가 되돌리는
   부작용(복원 실패·중간 렌더 깜빡임)을 없애기 위한 것. */
function readBrief(ov){
  const o = ov || {};
  const pick=(k,v)=> (k in o) ? o[k] : v;
  const catIdx=pick('catIdx',f_cat.selectedIndex),
        ageIdx=pick('ageIdx',f_age.selectedIndex),
        objIdx=pick('objIdx',f_obj.selectedIndex);
  return {
    catKey:CATS[catIdx].k, catIdx, ageIdx, objIdx,
    get catName(){ return N(CATS[catIdx]); },
    ageBucket:AGEOPT[ageIdx].b,
    get ageName(){ return N(AGEOPT[ageIdx]); },
    sex:pick('sex',f_sex.value), obj:OBJS[objIdx],
    region:pick('region',f_reg.value), country:pick('country',f_ctry.value), platform:pick('platform',f_plt.value),
    minTier:pick('minTier',f_tier.value),
    topN:pick('topN',+f_topn.value.replace(/\D/g,'')),
    bodyReq:pick('bodyReq',f_body.value), minAqs:pick('minAqs',+f_aqs.value),
    budget:pick('budgetM',+f_bud.value)*1_000_000
  };
}
const TIERRANK={S:4,A:3,B:2,C:1};
/* 캠페인 목표의 짧은 이름 — 한국어는 괄호 안, 영어는 괄호 안 */
const objShort = o => { const m=String(N(o)).match(/\(([^)]+)\)/); return m?m[1]:N(o); };
function bodyPass(c,req){
  if(req==='제한 없음') return true;
  if(req==='키 168cm 이상') return c.body.height>=168;
  if(req==='키 172cm 이상') return c.body.height>=172;
  if(req==='키 178cm 이상') return c.body.height>=178;
  if(req==='여성 55 이하 사이즈') return c.gender==='F' && ['44','55'].includes(c.body.topKR);
  if(req==='남성 100 이하 사이즈') return c.gender==='M' && ['95','100'].includes(c.body.topKR);
  return true;
}
function tierPass(c,minTier){
  if(minTier==='제한 없음')return true;
  if(minTier==='S 전용')return c.tier==='S';
  return TIERRANK[c.tier] >= TIERRANK[minTier[0]];
}

/* opts.skipPortfolio — 민감도 분석처럼 ranked/top 만 필요한 호출은
   가장 비싼 그리디 편성(최대 60회 × 후보 전수 × 중복 계산)을 건너뛴다. */
function evaluate(brief, opts){
  const skipPort = !!(opts && opts.skipPortfolio);
  const stages=[];
  let pool = ROSTER.slice();
  stages.push({k:T('전체 Creator 풀'),      d:T('네트워크 등록 인원 전수'),            n:pool.length});

  pool = pool.filter(c=>tierPass(c,brief.minTier) &&
                        (brief.region==='전 권역'||c.region===brief.region) &&
                        (!brief.country||brief.country==='국가 무관'||c.country===brief.country) &&
                        (brief.platform==='채널 무관'||c.platforms[brief.platform]/c.followers>=0.28) &&
                        bodyPass(c,brief.bodyReq));
  stages.push({k:T('기본 조건 통과'),
    d:(brief.country&&brief.country!=='국가 무관'?T('등급 · 권역 · 국가 · 주력 채널')+' ('+tCtry(brief.country)+')':T('등급 · 권역 · 주력 채널'))+(brief.bodyReq!=='제한 없음'?' · '+brief.bodyReq:''),
    n:pool.length});

  pool = pool.filter(c=>c.cats[brief.catKey] >= 68);
  stages.push({k:T('카테고리 적합'),        d:brief.catName+T(' 적합도 68점 이상'),    n:pool.length});

  const scored = pool.map(c=>({c, ...scoreCreator(c,brief)}));
  const tPool  = scored.filter(s=>s.ax.A >= 55);
  stages.push({k:T('타깃 오디언스 조건'),   d:brief.ageName+' · '+tSex(brief.sex)+T(' 일치도 55점 이상'), n:tPool.length});

  /* 예산 제약 — 1인이 총예산의 55%를 초과하면 포트폴리오 구성이 불가하므로 제외 */
  const cap = brief.budget*0.55;
  const bPool = tPool.filter(s=>s.c.rate <= cap);
  stages.push({k:T('예산 이내'),            d:T('1인 단가 ≤ 총예산의 55% (')+MAN(cap)+')', n:bPool.length});

  /* 오디언스 진정성 — 가짜 팔로워가 과다하거나 브랜드 세이프티 미달이면 제외 */
  const aPool = bPool.filter(s=>s.c.aqs >= brief.minAqs && s.c.garm !== 'floor');
  stages.push({k:T('오디언스 진정성 검증'),
    d:L`AQS ${brief.minAqs} 이상 · GARM Floor 등급 제외`, n:aPool.length});

  const rPool = aPool.filter(s=>s.c.risk < 25);
  stages.push({k:T('리스크 통과'),          d:T('리스크 지표 25 미만'),                n:rPool.length});

  rPool.sort((a,b)=>b.score-a.score);
  const top = rPool.slice(0, brief.topN);
  stages.push({k:T('최종 추천'),            d:T('적합도 상위 ')+brief.topN+'',        n:top.length, final:true});

  if(skipPort) return {stages, ranked:rPool, top, port:[], spent:0,
    bind:'pool', capN:brief.topN, reachStat:{net:0,gross:0,dup:0}, allScored:scored,
    partial:true};

  /* 예산 포트폴리오 — 점수/단가 효율 기준 그리디 */
  const port=[]; let spent=0;
  const chosen=new Set();
  for(const s of top){
    if(spent+s.c.rate<=brief.budget){ port.push(s); chosen.add(s); spent+=s.c.rate; } }

  /* 1회 캠페인 편성 정원은 60인 상한만 두고, 예산 또는 후보가 소진될 때까지 채운다. */
  const capN = Math.min(60, Math.max(brief.topN, rPool.length));

  /* 남은 예산은 '한계 순 도달 효율' 기준으로 배분한다.
     점수/단가만 보고 담으면 같은 니치·지역에 몰려 오디언스가 중복되고,
     돈은 썼는데 순 도달은 늘지 않는다. 그래서 이미 편성된 인원과의 중복을 제거한
     '추가로 늘어나는 도달'을 단가로 나눈 값에 적합도를 가중해 선택한다. */
  while(port.length < capN && spent < brief.budget*0.94){
    let best=null, bestV=0;
    const picked = port.map(x=>x.c);
    for(const s of rPool){
      if(chosen.has(s)) continue;
      if(spent + s.c.rate > brief.budget) continue;
      const v = (incReach(s.c, picked) / s.c.rate) * (0.55 + s.score/100 * 0.9);
      if(v > bestV){ bestV=v; best=s; }
    }
    if(!best) break;
    port.push(best); chosen.add(best); spent += best.c.rate;
  }
  /* 예산이 남은 이유를 구분: 후보 소진 vs 정원 도달 vs 예산 소진 */
  const bind = spent>=brief.budget*0.94 ? 'budget'
             : port.length>=capN        ? 'cap'
             : 'pool';
  port.sort((a,b)=>b.score-a.score);

  const reachStat = netReach(port);
  return {stages, ranked:rPool, top, port, spent, bind, capN, reachStat, allScored:scored};
}

