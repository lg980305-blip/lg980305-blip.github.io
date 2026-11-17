/* AMF Commerce Intelligence Engine — 03-dataset
   자동 분리: tools/split_monolith.py · 클래식 스크립트(전역 스코프 공유), 로드 순서 유지 */
/* ───────── 3. DATASET ───────── */
/* 크리에이터 아키타입 — 축 간 상관을 끊어 '한 명이 모든 축 1등'인 구조를 방지한다.
   등급(tier)은 도달 규모·단가만 결정하고, 어떤 축에서 강한지는 아키타입이 결정한다. */
/* 콘텐츠 포맷 정규값 — 표시할 때 T() 로 번역한다 */
const FORMATS=['라이브 커머스','릴스 · 숏폼','피드 · 캐러셀','유튜브 리뷰'];
const ARCH=[
 {k:'commerce', n:'커머스 특화', en:'Commerce-led', share:.22,
  m:{er:0.86, cvr:1.42, roas:1.34, ret:0.72, camp:1.25, quality:-7, safety:-2, g90:-5, etrend:-1.5}},
 {k:'reach',    n:'도달 특화',   en:'Reach-led', share:.22,
  m:{er:1.52, cvr:0.62, roas:0.72, ret:1.15, camp:0.75, quality:-3, safety:0,  g90:+4, etrend:+1.5}},
 {k:'quality',  n:'브랜드 세이프티 특화', en:'Brand-safety-led', share:.20,
  m:{er:0.94, cvr:0.88, roas:0.95, ret:0.85, camp:0.95, quality:+12, safety:+9, g90:-3, etrend:0}},
 {k:'growth',   n:'성장 특화',   en:'Growth-led', share:.18,
  m:{er:1.18, cvr:0.82, roas:0.88, ret:1.05, camp:0.45, quality:-2, safety:+1, g90:+22, etrend:+6}},
 {k:'balanced', n:'밸런스형',    en:'Balanced', share:.18,
  m:{er:1.0, cvr:1.0, roas:1.0, ret:1.0, camp:1.0, quality:0, safety:0, g90:0, etrend:0}}
];

const TIERS=[
 {t:'S',min:8_000_000,max:16_000_000,share:.08},
 {t:'A',min:4_000_000,max:8_000_000, share:.22},
 {t:'B',min:1_800_000,max:4_000_000, share:.40},
 {t:'C',min:700_000, max:1_800_000, share:.30}
];
const AVCOL=['#0B3A6F','#12294D','#9E7B24','#0E7C5A','#1256A0','#5A3E86','#8A5A2B','#2E5E7E'];

/* 슬라브계 성씨 성별 어미 정합 (Osmonov → Osmonova) */
const SLAVIC=new Set(['UZ','KZ','KG','TJ']);
function genderSurname(cc,s,g){
  if(!SLAVIC.has(cc)) return s;
  if(g==='F') return /(ov|ev|av|in)$/.test(s) ? s+'a' : s;
  return /(ova|eva|ava|ina)$/.test(s) ? s.slice(0,-1) : s;
}

/* ───────── 실제 인물 (AMF 로스터 · amf-models/models.json) ───────── */
const COUNTRY_BY_NAME=Object.fromEntries(COUNTRIES.map(c=>[c.n,c]));

function buildRoster(PEOPLE){
  const N=PEOPLE.length;
  const pool=[]; COUNTRIES.forEach(c=>{for(let i=0;i<c.w;i++)pool.push(c)});
  const used=new Set(); const out=[];
  for(let i=0;i<N;i++){
    const P=PEOPLE[i];
    const co=COUNTRY_BY_NAME[P.country]||pool[Math.floor(rnd()*pool.length)];
    const gender = P.gender || (rnd()<.72 ? 'F':'M');   /* 미상이면 매칭용 추정값. 화면에는 '성별 미상' */
    const genderKnown = !!P.gender;
    const full=P.name, first=P.name.split(' ')[0];
    used.add(full);

    // 등급 배정
    const rr=rnd(); let acc=0,tier=TIERS[3];
    for(const t of TIERS){acc+=t.share; if(rr<acc){tier=t;break}}

    // 아키타입 배정 — 등급과 독립
    const ar=rnd(); let aacc=0, arch=ARCH[4];
    for(const a of ARCH){aacc+=a.share; if(ar<aacc){arch=a;break}}
    const AM=arch.m;

    // 팔로워: 등급별 스케일 (등급은 도달 규모와 단가만 결정)
    const base={S:[380000,1400000],A:[140000,420000],B:[42000,150000],C:[9000,48000]}[tier.t];
    const followers=Math.round(RN((base[0]+base[1])/2,(base[1]-base[0])/4,base[0],base[1])/100)*100;
    // 참여율: 팔로워가 클수록 낮아지고, 아키타입이 크게 좌우
    const er=+(Math.max(1.2,Math.min(14.5,
      RN(6.4-Math.log10(followers)*0.62,0.9,1.4,11.8)*AM.er))).toFixed(1);

    // 채널 분해
    const pmix=rnd();
    const plat = pmix<.42?'Instagram':pmix<.76?'TikTok':'YouTube';
    const platforms={
      Instagram:Math.round(followers*(plat==='Instagram'?RF(.52,.72,2):RF(.10,.30,2))),
      TikTok   :Math.round(followers*(plat==='TikTok'   ?RF(.52,.72,2):RF(.10,.30,2))),
      YouTube  :Math.round(followers*(plat==='YouTube'  ?RF(.48,.68,2):RF(.05,.22,2)))
    };

    // 오디언스 연령 분포 (한 버킷에 집중 + 인접 확산)
    const peak=RI(0,AGEB.length-1);
    const raw=AGEB.map((_,j)=>Math.exp(-Math.pow(j-peak,2)/RF(.7,2.2,2))*RF(.85,1.15,2)+0.02);
    const sum=raw.reduce((a,b)=>a+b,0);
    const ageDist=Object.fromEntries(AGEB.map((b,j)=>[b,+(raw[j]/sum).toFixed(3)]));
    const audF=+(RN(gender==='F'?0.72:0.38,0.14,0.08,0.95)).toFixed(2);

    // 카테고리 적합도 벡터 (2~3개 주력)
    const cv={}; CATS.forEach(c=>cv[c.k]=Math.round(RN(48,11,22,72)));
    const mainCnt=RI(2,3); const mains=[];
    for(let m=0;m<mainCnt;m++){
      const c=PICKR(CATS); if(mains.includes(c.k)){m--;continue}
      mains.push(c.k); cv[c.k]=Math.round(RN(m===0?90:82,5,68,99));
    }

    // 커머스 실적 — 경험치는 등급, 전환 성과는 아키타입이 결정
    const camp=Math.max(1,Math.round(
      RI(tier.t==='S'?24:tier.t==='A'?12:tier.t==='B'?5:1,
         tier.t==='S'?86:tier.t==='A'?46:tier.t==='B'?24:11)*AM.camp));
    const cvr=+(Math.max(0.5,Math.min(11,RN(3.5,1.0,1.2,7.5)*AM.cvr))).toFixed(2);
    const roas=+(Math.max(0.9,Math.min(11,RN(3.7,1.1,1.4,8.2)*AM.roas))).toFixed(2);
    const aov=Math.round(RN(58000,19000,28000,120000)/1000)*1000;   // 객단가
    const gmv=Math.round(camp*(followers*RF(.05,.13,3))*(cvr/100)*aov);
    const live=RI(0,Math.round(camp*1.4));
    const ret=+(Math.max(1.8,Math.min(28,RN(9.5,3.4,2.1,24)*AM.ret))).toFixed(1);

    // 품질 / 성장 — 등급 의존도를 낮추고 아키타입 가산을 적용
    const quality=Math.round(Math.max(48,Math.min(99,
      RN(77,9,55,95) + (tier.t==='S'?5:tier.t==='A'?3:tier.t==='C'?-3:0) + AM.quality)));
    const safety=Math.round(Math.max(52,Math.min(100, RN(85,9,58,100) + AM.safety)));
    const g90=+(Math.max(-14,Math.min(52, RN(tier.t==='C'?9.5:5.2,6.5,-11,42)+AM.g90))).toFixed(1);
    const etrend=+(Math.max(-11,Math.min(18, RN(1.6,4.2,-9,15)+AM.etrend))).toFixed(1);

    // 리스크
    const flags=[]; let risk=RI(4,13);
    const fN=rnd()<.42?RI(1,2):0;
    for(let f=0;f<fN;f++){const x=PICKR(RISKFLAGS); if(!flags.includes(x[0])){flags.push(x[0]);risk+=x[1]}}
    risk=Math.min(48,risk);

    const rate=Math.round(RN((tier.min+tier.max)/2,(tier.max-tier.min)/4.2,tier.min,tier.max)/100000)*100000;

    /* ── 12개월 추이 (팔로워 · 참여율) ── */
    const series=[]; let fw=followers/(1+g90/100);
    for(let m=0;m<12;m++){
      const step=Math.pow(1+g90/100,1/12)*(1+RF(-.012,.012,4));
      fw*=step;
      series.push({m:m+1, f:Math.round(fw), e:+(er*(1+etrend/100*(m/11))+RF(-.35,.35,2)).toFixed(2)});
    }
    series[11].f=followers;

    /* ── 최근 캠페인 이력 ── */
    const histN=Math.min(8,Math.max(1,Math.round(camp*0.28)));
    const history=[];
    for(let h=0;h<histN;h++){
      const hc=PICKR(mains);
      const hcvr=+(RN(cvr,0.8,0.5,10)).toFixed(2);
      const hroas=+(RN(roas,0.9,0.8,11)).toFixed(2);
      const hreach=Math.round(followers*RF(.05,.13,3));
      history.push({brand:PICKR(BRANDS), cat:hc,        /* 카테고리 '키'를 저장 — 표시 시점에 번역 */
        ym:'202'+RI(4,6)+'-'+String(RI(1,12)).padStart(2,'0'),
        fmt:PICKR(FORMATS),                              /* 정규값 저장 — 표시 시점에 번역 */
        reach:hreach, cvr:hcvr, roas:hroas,
        gmv:Math.round(hreach*(hcvr/100)*aov)});
    }
    history.sort((x,y)=>y.ym.localeCompare(x.ym));

    /* ── 콘텐츠 포맷별 성과 ── */
    const formats=[T('피드 · 캐러셀'),T('릴스 · 숏폼'),T('라이브 커머스'),T('스토리')].map(fn=>({
      n:fn,
      share:0,
      reach:Math.round(followers*RF(.08,.46,3)),
      er:+(RN(er*(fn===T('라이브 커머스')?1.7:fn===T('릴스 · 숏폼')?1.25:fn===T('스토리')?0.55:1),0.7,0.5,18)).toFixed(1),
      cvr:+(RN(cvr*(fn===T('라이브 커머스')?1.55:fn===T('스토리')?0.6:1),0.6,0.3,11)).toFixed(2)
    }));
    const fsum=formats.reduce((t,x)=>t+x.reach,0);
    formats.forEach(x=>x.share=+(x.reach/fsum*100).toFixed(1));

    /* ── 오디언스 지역 분포 ── */
    const geoPool=COUNTRIES.filter(x=>x.r===co.r&&x.n!==co.n);
    const gShares=[RF(.42,.68,3)]; gShares.push(RF(.08,.22,3)); gShares.push(RF(.04,.14,3));
    const geo=[{n:co.n,v:gShares[0]},
               {n:geoPool.length?PICKR(geoPool).n:T('기타'),v:gShares[1]},
               {n:PICKR(COUNTRIES).n,v:gShares[2]}];
    const gTot=geo.reduce((t,x)=>t+x.v,0);
    geo.push({n:T('기타'),v:Math.max(0.02,1-gTot)});
    geo.forEach(x=>x.v=+(x.v*100).toFixed(1));

    /* ── 카테고리별 커머스 실적 ──
       같은 크리에이터라도 뷰티에서는 잘 팔고 가전에서는 못 판다.
       카테고리 적합도가 높을수록 성과가 좋되, 독립 변동(±35%)을 준다. */
    const catPerf={};
    CATS.forEach(x=>{
      const fitW = 0.55 + (cv[x.k]/100)*0.75;          // 적합도 연동
      const noise= RF(0.66,1.38,3);                     // 카테고리별 독립 변동
      catPerf[x.k]={
        cvr :+Math.max(0.4,Math.min(12, cvr *fitW*noise)).toFixed(2),
        roas:+Math.max(0.7,Math.min(12, roas*fitW*RF(0.72,1.32,3))).toFixed(2),
        camp: Math.max(0, Math.round(camp*(cv[x.k]/100)*RF(0.5,1.5,2)))
      };
    });

    /* ── 연령대별 전환 친화도 ──
       오디언스가 몰린 연령대에서 전환이 가장 잘 나온다. */
    const agePerf={};
    AGEB.forEach((bk,j)=>{
      const share=ageDist[bk];
      agePerf[bk]=+Math.max(0.45,Math.min(1.55,
        0.72 + (share/0.30)*0.55 + RF(-0.14,0.14,3))).toFixed(3);
    });

    /* ── 채널별 참여율 ──
       주력 채널에서 반응이 가장 좋고, 부차 채널은 떨어진다. */
    const platEr={};
    ['Instagram','TikTok','YouTube'].forEach(pn=>{
      const sh=platforms[pn]/followers;
      platEr[pn]=+Math.max(0.6,Math.min(19,
        er*(0.58+sh*1.15)*RF(0.82,1.24,3))).toFixed(2);
    });

    /* ── 오디언스 진정성 (Audience Quality Score) ──
       팔로워 중 봇·비활성·구매 계정 비중을 추정하고, 실제 도달 가능 규모를 산출한다.
       팔로워가 급증했거나 ER이 규모 대비 비정상이면 가짜 비중이 올라간다. */
    const fraudF=[]; let fakeBase=RN(11,6,2,34);
    if(g90>26) fakeBase+=RF(4,11,1);                 // 비정상 급성장
    if(er>9.5) fakeBase+=RF(3,9,1);                  // 규모 대비 과도한 참여
    if(arch.k==='reach') fakeBase-=RF(1,4,1);        // 도달 특화는 실제 활성도 높음
    const fN2 = rnd()<.34 ? RI(1,2) : 0;
    for(let f=0;f<fN2;f++){
      const x=PICKR(FRAUDFLAGS);
      if(!fraudF.includes(x[0])){ fraudF.push(x[0]); fakeBase+=x[1]*0.55; }
    }
    const fakeRate = +Math.max(1.5, Math.min(52, fakeBase)).toFixed(1);
    const reachable= +Math.max(18, Math.min(88, RN(62,9,40,82) - fakeRate*0.45)).toFixed(1);
    // AQS: 진성 팔로워 비중 + 도달 가능성 + 참여 정상성
    const aqsRaw = (100-fakeRate)*0.52 + reachable*0.30
                 + Math.min(100,(er/6.5)*100)*0.18 - fraudF.length*4;
    /* 원점수는 65~78 구간에 몰려 변별력이 없다. 중앙값 70을 기준으로 분산을 확대해
       실제 검증 도구가 보여주는 20~95 범위에 맞춘다. */
    const aqs = Math.round(Math.max(21, Math.min(97, 70 + (aqsRaw-70)*1.85 )));
    const realFollowers = Math.round(followers*(1-fakeRate/100));

    /* ── GARM 브랜드 적합성 등급 ── */
    const gr=rnd(); let gacc=0, garm=GARM[0];
    for(const g of GARM){ gacc+=g.w; if(gr<gacc){garm=g;break} }
    // 품질 특화 아키타입은 상향 보정
    if(arch.k==='quality' && (garm.k==='high'||garm.k==='floor')) garm=GARM[1];

    /* ── 공정위 표시광고법 준수 이력 (유료광고 표시) ── */
    const disclosure = Math.round(RN(93,7,58,100));

    /* ── 오디언스 중복도 산출용 지문 ──
       같은 국가·카테고리·연령대·채널을 공유할수록 팔로워가 겹친다. */
    const fp = {co:co.c, rg:co.r, cat:mains[0], age:AGEB[peak], plat};

    /* ── 신체 정보 (모델 컴카드) ── */
    const isF = gender==='F';
    /* 공개본에는 키·신발 원값과 사이즈 라벨만 싣는다(체중·3사이즈는 싣지 않음). */
    const height = P.body.height, shoe = P.body.shoe;
    const topKR  = isF ? P.body.kF : P.body.kM;
    const topUS  = isF ? P.body.uF : P.body.uM;
    const hair   = PICKR([T('블랙'),T('다크브라운'),T('브라운'),T('애쉬브라운'),T('라이트브라운'),T('블론드')]);
    const eyes   = PICKR([T('블랙'),T('다크브라운'),T('브라운'),T('헤이즐'),T('그린'),T('그레이')]);
    /* hair·eyes·exp·tattoo·piercing 은 난수 생성값이라 화면에 표시하지 않는다.
       난수 호출 순서는 그대로 두어 다른 시뮬레이션 지표가 바뀌지 않게 한다. */
    const body   = {height, shoe, topKR, topUS, hair, eyes,
      exp:[T('런웨이'),T('에디토리얼'),T('커머셜'),T('뷰티 클로즈업'),T('피팅'),T('라이브 커머스')]
            .filter(()=>rnd()<.5),
      tattoo: rnd()<.18, piercing: rnd()<.26
    };
    if(!body.exp.length) body.exp=[T('커머셜')];

    /* ── 운영 지표 ── */
    const activity={
      upload:Math.round(RN(tier.t==='S'?21:tier.t==='A'?16:12,5,4,38)),
      respond:Math.round(RN(88,9,52,100)),
      lead:Math.round(RN(9,3.5,3,22)),
      renew:Math.round(RN(64,15,18,96))
    };

    out.push({
      idx:i, id:'AMF-CR-'+String(1001+i), name:full, genderKnown,
      initials:(full.split(' ').length>1 ? full.split(' ')[0][0]+full.split(' ')[1][0] : full.slice(0,2)).toUpperCase(),
      color:AVCOL[i%AVCOL.length], photo:P.photo, rosterCat:P.cat, rosterYear:P.year, rosterNote:P.note,
      country:co.n, cc:co.c, countryEn:co.en, region:co.r, city:PICKR(co.cities),
      gender, age:RI(19,38), tier:tier.t, langs:LANGS[co.c],
      followers, er, mainPlat:plat, platforms,
      audience:{ageDist, peak:AGEB[peak], female:audF},
      cats:cv, mains,
      commerce:{campaigns:camp, cvr, roas, gmv, live, ret, aov},
      quality, safety, growth:{f90:g90, etrend},
      risk, flags, rate, series, history, formats, geo, activity, body,
      arch:arch.k, archName:arch.n,
      catPerf, agePerf, platEr,
      aqs, fakeRate, reachable, realFollowers, fraudF,
      garm:garm.k, garmName:garm.n, garmDesc:garm.d, disclosure, fp,
      joined:'20'+RI(19,25)+'-'+String(RI(1,12)).padStart(2,'0'),
      verified: rnd()<.63
    });
  }
  return out;
}
const ROSTER = buildRoster(REAL_PEOPLE);
/* 진출 국가 선택지 — 현재 로스터에 실제로 있는 국가만, COUNTRIES 순서로 */
/* 브리프의 지역 표시 — 국가를 골랐으면 국가, 아니면 권역 */
const geoName=b=> (b.country&&b.country!=='국가 무관') ? tCtry(b.country) : tReg(b.region);
function fillCountryOpts(){
  const keep=f_ctry.value||'국가 무관';
  const have=new Set(ROSTER.map(c=>c.country));
  const list=['국가 무관'].concat(COUNTRIES.filter(c=>have.has(c.n)).map(c=>c.n));
  f_ctry.innerHTML='';
  list.forEach(v=>f_ctry.add(new Option(v==='국가 무관'?T(v):tCtry(v), v)));
  f_ctry.value = list.indexOf(keep)>=0 ? keep : '국가 무관';
}
/* 국가와 권역을 서로 맞춘다 — 국가를 고르면 그 권역으로, 다른 권역을 고르면 국가는 해제 */
function syncCountryRegion(changed){
  const co=COUNTRY_BY_NAME[f_ctry.value];
  if(changed==='country'){ if(co && Array.from(f_reg.options).some(o=>o.value===co.r)) f_reg.value=co.r; }
  else if(co && f_reg.value!==co.r) f_ctry.value='국가 무관';
}
fillCountryOpts();
f_ctry.addEventListener('change',()=>syncCountryRegion('country'));
f_reg.addEventListener('change',()=>syncCountryRegion('region'));
function AV(c,st){return c.photo?`<img loading="lazy" decoding="async" class="mono-av" src="${c.photo}" alt="" style="object-fit:cover;${st||''}">`
  :`<span class="mono-av" style="display:inline-grid;place-items:center;background:${c.color||'#2A3550'};color:#fff;font-weight:700;${st||''}">${c.initials||'?'}</span>`}
/* 성별: 원자료에 없으면 '성별 미상'으로 표시한다 */
function gTxt(c){ return c.genderKnown ? (c.gender==='F'?T('여성'):T('남성')) : T('성별 미상'); }
/* 합성 로스터를 처음 상태 그대로 다시 만든다 (PRNG 를 시드로 되감는다) */
function buildRosterFresh(){ rnd = mulberry32(SEED); return buildRoster(REAL_PEOPLE); }

/* ───────── 3-B. 오디언스 중복도 / 순 도달 ─────────
   업계 통설: 크리에이터 5인 × 10만 팔로워 = 50만 도달이 아니다.
   같은 니치·지역의 크리에이터는 팔로워가 상당 부분 겹치므로,
   중복을 제거한 '순 도달(Net Reach)'로 예산 효율을 판단해야 한다.
   도달 목표 캠페인은 중복도 20% 미만, 육성형은 30~40%까지 허용이 일반적이다. */
function overlap(a,b){
  let o=0.02;
  if(a.fp.co===b.fp.co)   o+=0.24; else if(a.fp.rg===b.fp.rg) o+=0.09;
  if(a.fp.cat===b.fp.cat) o+=0.18;
  if(a.fp.age===b.fp.age) o+=0.14;
  if(a.fp.plat===b.fp.plat) o+=0.07;
  // 결정론적 개인차 (±0.05)
  const n=((a.idx*31+b.idx*17)%100)/1000;
  return Math.min(0.66, o+n);
}
/* 누적 중복률 산출 — 포화(saturating) 모델.
   ┌ 왜 단순 곱셈(∏(1-o))을 쓰지 않는가
   │ 쌍별 중복을 서로 독립인 사건으로 보고 곱하면, 인원이 늘수록 고유 기여분이
   │ 기하급수적으로 0에 수렴한다. 최소 중복 2%만 잡아도 60인 편성의 마지막 한 명은
   │ 자기 오디언스의 30%(0.98^59)밖에 기여하지 못하고, 같은 니치라면 사실상 0이 된다.
   │ 실제 오디언스는 그렇게 움직이지 않는다 — 아무리 겹쳐도 고유 도달은 남는다.
   └ 대안
     ① 누적 중복은 최소한 '가장 크게 겹치는 단 한 명'과의 중복(omax) 이상이다.
     ② 나머지 인원이 만드는 잔여 중복은 점감(diminishing)하며 쌓인다.
     ③ 전체 중복률에 상한(DUP_CEIL)을 둬, 누구든 고유 도달을 일정 비율 남긴다. */
const DUP_TAU  = 4.5;    // 잔여 중복 누적 속도 (클수록 완만)
const DUP_CEIL = 0.82;   // 누적 중복률 상한 — 최소 18%는 고유 도달로 남는다
function dupRate(cand, existing){
  if(!existing.length) return 0;
  let omax=0, osum=0;
  for(const j of existing){ const o=overlap(cand,j); if(o>omax) omax=o; osum+=o; }
  const resid = 1 - Math.exp(-(osum-omax)/DUP_TAU);
  return Math.min(DUP_CEIL, omax + (1-omax)*resid);
}
/* 이미 편성된 인원 대비 '추가로 늘어나는 진성 도달' */
function incReach(cand, existing){
  return cand.realFollowers * (1 - dupRate(cand, existing));
}
/* 순차 중복 제거 — 팔로워가 큰 순으로 고유 기여분만 누적 */
function netReach(list){
  const sorted=list.slice().sort((x,y)=>y.c.realFollowers-x.c.realFollowers);
  let net=0; const added=[];
  sorted.forEach(s=>{ net+=incReach(s.c, added); added.push(s.c); });
  const gross=list.reduce((t,s)=>t+s.c.realFollowers,0);
  return {net:Math.round(net), gross,
          dup: gross? +((1-net/gross)*100).toFixed(1) : 0};
}

