/* ============================================================
   AMF CIE — 쇼 · 행사 일정 (2026-09-18 기준, 2027년 9월까지 37건)

   status  '확정' = 주최 측 공식 발표 · '예상' = 관례상 예측 시기 (공식 발표 전)
   tier    1 = 초대 자체가 커리어 · 2 = 브랜드 협업 기회 多 · 3 = 진입 장벽 낮음 · 콘텐츠 효율 高
   type    runway · couture · awards · event · expo
   start/end 는 ISO 날짜. '예상' 항목의 날짜는 관례상 시기의 대표 날짜이며, 공식 발표 시 갱신한다.
   캐스팅 마감(due)은 주최 측 발표가 아니라 앱 규칙(국제 행사 시작 28일 전)으로 계산되는 '예상 마감'이다.

   갱신 방법: 이 배열만 고치면 홈 티커 · 캐스팅 일정 · D-day 가 모두 따라간다.
   ============================================================ */
window.AMF_SHOWS = [
  /* ── 2026 하반기 ── */
  { name:'London Fashion Week SS27',            city:'런던',       country:'영국',       region:'유럽',     start:'2026-09-17', end:'2026-09-21', type:'runway',  status:'확정', tier:2, note:'스트리트 스타일 · 신진 브랜드' },
  { name:'Vogue World: Milano',                 city:'밀라노',     country:'이탈리아',   region:'유럽',     start:'2026-09-22', end:'2026-09-22', type:'event',   status:'확정', tier:1, note:'갈레리아 비토리오 에마누엘레 2세' },
  { name:'Milano Moda Donna SS27',              city:'밀라노',     country:'이탈리아',   region:'유럽',     start:'2026-09-22', end:'2026-09-28', type:'runway',  status:'확정', tier:2, note:'Prada 개막 · Gucci · Fendi · Armani' },
  { name:'Paris Fashion Week SS27',             city:'파리',       country:'프랑스',     region:'유럽',     start:'2026-09-28', end:'2026-10-06', type:'runway',  status:'확정', tier:1, note:'Dior · Chanel · LV · Saint Laurent · Balenciaga' },
  { name:'Shanghai Fashion Week',               city:'상하이',     country:'중국',       region:'동북아시아', start:'2026-10-08', end:'2026-10-16', type:'runway',  status:'확정', tier:3 },
  { name:'Riyadh Fashion Week',                 city:'리야드',     country:'사우디아라비아', region:'중동',  start:'2026-10-05', end:'2026-10-09', type:'runway',  status:'예상', tier:3, note:'10월 초 예상' },
  { name:'Dallas Fashion Week',                 city:'댈러스',     country:'미국',       region:'북미',     start:'2026-10-13', end:'2026-10-15', type:'runway',  status:'확정', tier:3 },
  { name:'Miami Fashion Week',                  city:'마이애미',   country:'미국',       region:'북미',     start:'2026-10-13', end:'2026-10-17', type:'runway',  status:'확정', tier:3 },
  { name:'Taipei Fashion Week',                 city:'타이베이',   country:'대만',       region:'동북아시아', start:'2026-10-15', end:'2026-10-18', type:'runway',  status:'확정', tier:3 },
  { name:'LA Fashion Week (The Bureau)',        city:'LA',         country:'미국',       region:'북미',     start:'2026-10-16', end:'2026-10-18', type:'runway',  status:'확정', tier:3 },
  { name:'CFDA Fashion Awards',                 city:'뉴욕',       country:'미국',       region:'북미',     start:'2026-11-02', end:'2026-11-02', type:'awards',  status:'확정', tier:2, note:'미국자연사박물관 · 호스트 Keke Palmer' },
  { name:'The Fashion Awards 2026',             city:'런던',       country:'영국',       region:'유럽',     start:'2026-11-30', end:'2026-11-30', type:'awards',  status:'확정', tier:2, note:'로열 앨버트 홀' },
  /* ── 2027 상반기 · FW27/28 ── */
  { name:'Pitti Immagine Uomo / Milano Moda Uomo', city:'피렌체 · 밀라노', country:'이탈리아', region:'유럽', start:'2027-01-12', end:'2027-01-19', type:'runway',  status:'예상', tier:2, note:'1월 중순 예상' },
  { name:'Paris Men\'s Fashion Week FW27/28',   city:'파리',       country:'프랑스',     region:'유럽',     start:'2027-01-19', end:'2027-01-24', type:'runway',  status:'확정', tier:2 },
  { name:'Paris Haute Couture SS27',            city:'파리',       country:'프랑스',     region:'유럽',     start:'2027-01-25', end:'2027-01-28', type:'couture', status:'확정', tier:1 },
  { name:'Berlin Fashion Week',                 city:'베를린',     country:'독일',       region:'유럽',     start:'2027-01-30', end:'2027-02-02', type:'runway',  status:'예상', tier:3, note:'1월 말 ~ 2월 초 예상' },
  { name:'Copenhagen Fashion Week AW27',        city:'코펜하겐',   country:'덴마크',     region:'유럽',     start:'2027-02-01', end:'2027-02-05', type:'runway',  status:'확정', tier:3, note:'스트리트 스타일 성지' },
  { name:'Dubai / Arab Fashion Week',           city:'두바이',     country:'UAE',        region:'중동',     start:'2027-02-08', end:'2027-02-11', type:'runway',  status:'예상', tier:3, note:'2월 초 예상' },
  { name:'New York Fashion Week FW27',          city:'뉴욕',       country:'미국',       region:'북미',     start:'2027-02-11', end:'2027-02-16', type:'runway',  status:'예상', tier:2 },
  { name:'London Fashion Week FW27',            city:'런던',       country:'영국',       region:'유럽',     start:'2027-02-19', end:'2027-02-23', type:'runway',  status:'예상', tier:2, note:'2월 하순 예상' },
  { name:'Milano Moda Donna FW27/28',           city:'밀라노',     country:'이탈리아',   region:'유럽',     start:'2027-02-24', end:'2027-03-01', type:'runway',  status:'예상', tier:2, note:'2월 말 ~ 3월 초 예상' },
  { name:'Paris Fashion Week FW27/28',          city:'파리',       country:'프랑스',     region:'유럽',     start:'2027-03-01', end:'2027-03-09', type:'runway',  status:'확정', tier:1 },
  { name:'Seoul Fashion Week',                  city:'서울',       country:'대한민국',   region:'동북아시아', start:'2027-03-16', end:'2027-03-20', type:'runway',  status:'예상', tier:3, note:'DDP + 롯데월드타워 등 확장 · 3월 중순 예상' },
  { name:'Rakuten Fashion Week Tokyo',          city:'도쿄',       country:'일본',       region:'동북아시아', start:'2027-03-15', end:'2027-03-20', type:'runway',  status:'예상', tier:3, note:'3월 중순 예상' },
  { name:'Shanghai Fashion Week AW27 / India Fashion Week', city:'상하이 · 델리', country:'중국', region:'동북아시아', start:'2027-03-25', end:'2027-04-01', type:'runway', status:'예상', tier:3, note:'3월 하순 예상' },
  { name:'São Paulo Fashion Week',              city:'상파울루',   country:'브라질',     region:'남미',     start:'2027-04-14', end:'2027-04-18', type:'runway',  status:'예상', tier:3, note:'4월 예상' },
  { name:'Met Gala 2027',                       city:'뉴욕',       country:'미국',       region:'북미',     start:'2027-05-03', end:'2027-05-03', type:'event',   status:'확정', tier:1, note:"'John Galliano: Horizons' 전시 취소로 새 테마 미정" },
  { name:'Australian Fashion Week (Resort 28)', city:'시드니',     country:'호주',       region:'오세아니아', start:'2027-05-10', end:'2027-05-14', type:'runway',  status:'예상', tier:3, note:'5월 중순 예상' },
  /* ── 2027 하반기 · SS28 ── */
  { name:'London Fashion Week Men\'s SS28',     city:'런던',       country:'영국',       region:'유럽',     start:'2027-06-11', end:'2027-06-14', type:'runway',  status:'예상', tier:2 },
  { name:'Milano Moda Uomo SS28',               city:'밀라노',     country:'이탈리아',   region:'유럽',     start:'2027-06-19', end:'2027-06-23', type:'runway',  status:'예상', tier:2 },
  { name:'Paris Men\'s Fashion Week SS28',      city:'파리',       country:'프랑스',     region:'유럽',     start:'2027-06-22', end:'2027-06-27', type:'runway',  status:'확정', tier:2 },
  { name:'Paris Haute Couture FW27/28',         city:'파리',       country:'프랑스',     region:'유럽',     start:'2027-07-05', end:'2027-07-08', type:'couture', status:'확정', tier:1 },
  { name:'Copenhagen Fashion Week SS28',        city:'코펜하겐',   country:'덴마크',     region:'유럽',     start:'2027-08-03', end:'2027-08-06', type:'runway',  status:'예상', tier:3, note:'8월 초 예상' },
  { name:'Rakuten Fashion Week Tokyo / Seoul Fashion Week', city:'도쿄 · 서울', country:'대한민국', region:'동북아시아', start:'2027-08-30', end:'2027-09-04', type:'runway', status:'예상', tier:3, note:'8월 말 ~ 9월 초 예상' },
  { name:'New York → London Fashion Week SS28', city:'뉴욕 · 런던', country:'미국',      region:'북미',     start:'2027-09-09', end:'2027-09-21', type:'runway',  status:'예상', tier:2, note:'9월 중순 예상' },
  { name:'Milano Moda Donna SS28',              city:'밀라노',     country:'이탈리아',   region:'유럽',     start:'2027-09-21', end:'2027-09-27', type:'runway',  status:'예상', tier:2, note:'9월 하순 예상' },
  { name:'Paris Fashion Week SS28',             city:'파리',       country:'프랑스',     region:'유럽',     start:'2027-09-27', end:'2027-10-05', type:'runway',  status:'확정', tier:1 }
];
window.AMF_SHOWS_ASOF = '2026-09-18';
