#!/usr/bin/env python3
"""AMF Commerce Intelligence Engine 목업의 합성 로스터를 amf-models/models.json 의 실제 인물로 교체.

사용법: python3 tools/patch_mockup_roster.py <원본 목업.html> <출력.html>
- 인물(이름·국가·성별·사진·신체 치수)은 models.json 을 쓰고, 사진은 base64 로 내장한다.
- 팔로워·성과·리스크 등 엔진 지표는 목업 원래의 시뮬레이션 로직을 그대로 유지한다.
"""
import base64, json, os, re, sys

SRC, OUT = sys.argv[1], sys.argv[2]
ROOT = os.path.join(os.path.dirname(__file__), '..', 'amf-models')
rows = json.load(open(os.path.join(ROOT, 'models.json'), encoding='utf-8'))
s = open(SRC, encoding='utf-8').read()

# ── 국가 매핑 (목업 COUNTRIES 에 없는 국가는 추가) ──
CMAP = {  # models.json 표기 -> (목업 표기, 코드, 권역, 도시, 언어)
 '한국': ('대한민국', 'KR', None, None, None),
 '투바': ('투바(러시아)', 'RUTY', '러시아', ['키질'], ['투바어', '러시아어']),
 '투바(러시아)': ('투바(러시아)', 'RUTY', '러시아', ['키질'], ['투바어', '러시아어']),
 '하바롭스크(러시아)': ('하바롭스크(러시아)', 'RUKH', '러시아', ['하바롭스크'], ['러시아어']),
 '바시코르토스탄(러시아)': ('바시코르토스탄(러시아)', 'RUBA', '러시아', ['우파'], ['바시키르어', '러시아어']),
 '스리랑카': ('스리랑카', 'LK', '남아시아', ['콜롬보'], ['싱할라어', '영어']),
 '방글라데시': ('방글라데시', 'BD', '남아시아', ['다카'], ['벵골어']),
 '라오스': ('라오스', 'LA', '동남아시아', ['비엔티안'], ['라오어']),
 '캄보디아': ('캄보디아', 'KH', '동남아시아', ['프놈펜'], ['크메르어']),
 '중국': ('중국', 'CN', '동북아시아', ['베이징', '상하이'], ['중국어']),
 '일본': ('일본', 'JP', '동북아시아', ['도쿄'], ['일본어']),
 '홍콩': ('홍콩', 'HK', '동북아시아', ['홍콩'], ['광둥어', '영어']),
}
existing = set(re.findall(r"\{n:'([^']+)',\s*c:'", s))
new_countries, new_langs = [], []
for k, (n, c, r, cities, langs) in CMAP.items():
    if r and n not in existing and not any(x[0] == n for x in new_countries):
        new_countries.append((n, c, r, cities, langs))
ins = ''.join(f" {{n:'{n}', c:'{c}', r:'{r}', w:0, cities:{json.dumps(cities, ensure_ascii=False)}}},\n" for n, c, r, cities, _ in new_countries)
s = s.replace("const COUNTRIES=[\n", "const COUNTRIES=[\n" + ins, 1)
lang_ins = ''.join(f"LANGS.{c}={json.dumps(l, ensure_ascii=False)};" for _, c, _, _, l in new_countries)
s = s.replace("const AGEB=[", lang_ins + "\nconst AGEB=[", 1)
# 권역 필터에 '러시아' 추가
s = s.replace("<option>남아시아</option></select></div>", "<option>남아시아</option><option>러시아</option></select></div>", 1)

# ── 실제 인물 배열 ──
people = []
for r in rows:
    cn = CMAP.get(r['country'], (r['country'],))[0]
    photo = 'data:image/webp;base64,' + base64.b64encode(open(os.path.join(ROOT, r['photo']), 'rb').read()).decode()
    people.append({
        'no': r['no'], 'name': r['name'], 'country': cn,
        'gender': {'여': 'F', '남': 'M'}.get(r.get('sex') or '', ''),
        'cat': r['cat'], 'year': r.get('year') or '', 'note': r.get('note') or '', 'photo': photo,
        'body': {'height': r['height_cm'], 'weight': r['weight_kg'], 'bust': r['chest_cm'],
                 'waist': r['waist_cm'], 'hip': r['hip_cm'], 'shoe': r['shoe_mm']},
    })
people_js = "/* ───────── 실제 인물 (AMF 로스터 · amf-models/models.json) ───────── */\nconst REAL_PEOPLE=" + json.dumps(people, ensure_ascii=False, separators=(',', ':')) + ";\nconst COUNTRY_BY_NAME=Object.fromEntries(COUNTRIES.map(c=>[c.n,c]));\n\n"
s = s.replace("function buildRoster(N){", people_js + "function buildRoster(PEOPLE){\n  const N=PEOPLE.length;", 1)

# ── 신원 블록 교체 ──
old_id = """    const co=pool[Math.floor(rnd()*pool.length)];
    const gender = rnd()<.72 ? 'F':'M';
    let first,full,guard=0;
    do{ first=PICKR(NAMES[co.c][gender==='F'?'f':'m']);
        full=first+' '+genderSurname(co.c,PICKR(SURN[co.c]),gender);
        guard++ }while(used.has(full)&&guard<40);
    used.add(full);
"""
new_id = """    const P=PEOPLE[i];
    const co=COUNTRY_BY_NAME[P.country]||pool[Math.floor(rnd()*pool.length)];
    const gender = P.gender || (rnd()<.72 ? 'F':'M');
    const full=P.name, first=P.name.split(' ')[0];
    used.add(full);
"""
assert old_id in s; s = s.replace(old_id, new_id, 1)

# ── 신체 치수: models.json 값 사용 ──
old_body = """    const height = Math.round(RN(isF?171:182, isF?4.2:4.8, isF?162:173, isF?182:194));
    const weight = Math.round(RN(isF?52:73, isF?4.0:5.5, isF?44:62, isF?63:88));
    const bust   = Math.round(RN(isF?83:97, isF?4.0:5.0, isF?76:94, isF?92:110));
    const waist  = Math.round(RN(isF?62:78, isF?3.4:4.6, isF?56:70, isF?70:90));
    const hip    = Math.round(RN(isF?89:96, isF?3.6:4.2, isF?83:88, isF?98:106));
    const shoe   = Math.round(RN(isF?242:272, isF?7:8, isF?225:255, isF?255:290)/5)*5;
"""
new_body = """    const height = P.body.height, weight = P.body.weight, bust = P.body.bust,
          waist = P.body.waist, hip = P.body.hip, shoe = P.body.shoe;
"""
assert old_body in s; s = s.replace(old_body, new_body, 1)

# ── 출력 객체: 이니셜·사진·구분 ──
old_out = """      idx:i, id:'AMF-CR-'+String(1001+i), name:full, initials:(first[0]+full.split(' ')[1][0]).toUpperCase(),
      color:AVCOL[i%AVCOL.length],"""
new_out = """      idx:i, id:'AMF-CR-'+String(1001+i), name:full,
      initials:(full.split(' ').length>1 ? full.split(' ')[0][0]+full.split(' ')[1][0] : full.slice(0,2)).toUpperCase(),
      color:AVCOL[i%AVCOL.length], photo:P.photo, rosterCat:P.cat, rosterYear:P.year, rosterNote:P.note,"""
assert old_out in s; s = s.replace(old_out, new_out, 1)
s = s.replace("const ROSTER = buildRoster(480);", "const ROSTER = buildRoster(REAL_PEOPLE);\nfunction AV(c,st){return c.photo?`<img class=\"mono-av\" src=\"${c.photo}\" alt=\"\" style=\"object-fit:cover;${st||''}\">`:`<div class=\"mono-av\" style=\"background:${c.color};${st||''}\">${c.initials}</div>`}", 1)

# ── 아바타 렌더링 6곳 → 사진 ──
pat = re.compile(r'<div class="mono-av" style="background:\$\{([a-z.]+)\.color\}(;?[^"]*)">\$\{\1\.initials\}</div>')
s, n_av = pat.subn(lambda m: '${AV(%s,%s)}' % (m.group(1), json.dumps(m.group(2).lstrip(';'))), s)
assert n_av >= 6, n_av

# ── 인원·국가 수 문구 ──
N = len(people); NC = len({p['country'] for p in people})
NR = len(set(re.findall(r"r:'([^']+)'", s[s.index('const COUNTRIES=['):s.index('];', s.index('const COUNTRIES=['))])))
rep = [
 ("14개국 480인 네트워크", f"{NC}개국 {N}인 네트워크"),
 ('id="railCount">480<', f'id="railCount">{N}<'),
 ("dataset · r480", f"dataset · r{N}"),
 (f"네트워크 480인 · 14개국 대상 전수 연산", f"네트워크 {N}인 · {NC}개국 대상 전수 연산"),
 ("네트워크 480인을 살펴보는 중", f"네트워크 {N}인을 살펴보는 중"),
 ("네트워크 480인을 한 명씩 살펴보는 중…", f"네트워크 {N}인을 한 명씩 살펴보는 중…"),
 ("3. DATASET       크리에이터 480인 합성 프로필 생성", f"3. DATASET       AMF 로스터 {N}인 프로필 + 시뮬레이션 지표"),
 ("r480-c14 · synthetic", f"r{N}-c{NC} · amf-roster"),
 ("dataset r480-c14", f"dataset r{N}-c{NC}"),
 ("<dt>데이터 성격</dt><dd>가상 480인 / 실존 0인 (전량 합성)</dd>", f"<dt>데이터 성격</dt><dd>AMF 로스터 {N}인 (이름·국가·사진) · 성과 지표는 시뮬레이션</dd>"),
 ("<dd class=\"num\">480인 / 14개국 / 4개 권역</dd>", f"<dd class=\"num\">{N}인 / {NC}개국 / {NR}개 권역</dd>"),
 ("크리에이터 데이터 전량 합성 (가상 480인 / 실존 0인) ·", f"인물 {N}인은 AMF 로스터(이름·국가·사진) · 팔로워·성과·리스크 지표는 엔진 검증용 시뮬레이션 ·"),
 ("data_notice:'Synthetic dataset for engine validation. Not real creator performance.'", "data_notice:'People are from the AMF roster; follower, performance and risk figures are simulated for engine validation.'"),
 ("본 프로필은 엔진 검증용 <b>합성 데이터</b>이며 실존 인물의 실적이 아닙니다.", "인물 정보는 AMF 로스터 기준이며, 팔로워·성과·리스크 지표는 엔진 검증용 <b>시뮬레이션 값</b>입니다."),
]
for a, b in rep:
    assert a in s, a
    s = s.replace(a, b)
# 국가·권역 수는 실제 로스터 기준으로 계산
s = s.replace("${COUNTRIES.length}개국 · 4개 권역", "${new Set(ROSTER.map(c=>c.country)).size}개국 · ${new Set(ROSTER.map(c=>c.region)).size}개 권역")
s = s.replace("${COUNTRIES.length}개국", "${new Set(ROSTER.map(c=>c.country)).size}개국")
s = s.replace("creator_registry r240 ·", "creator_registry r${ROSTER.length} ·")
old_note = re.search(r'<b>데이터 고지 —</b>.*?그대로 동작합니다\.', s, re.S).group(0)
new_note = (f"<b>데이터 고지 —</b> 본 콘솔의 크리에이터 <b>{N}인</b>은 AMF 로스터(모델 {sum(1 for p in people if p['cat']=='모델')}인 · 역대 수상자 "
            f"{sum(1 for p in people if p['cat']!='모델')}인)의 실제 이름·국가·사진입니다. "
            "팔로워·참여율·성과 이력·리스크 지표는 <b>엔진 검증용 시뮬레이션 값</b>으로 고정 시드로 생성되어 언제 열어도 동일하게 재현되며, "
            "실 데이터 연동 시 이 레이어(<span class=\"mono\">buildRoster()</span>)만 교체하면 엔진·UI는 그대로 동작합니다.")
s = s.replace(old_note, new_note, 1)

open(OUT, 'w', encoding='utf-8').write(s)
print(f'wrote {OUT}: {N} people, {NC} countries, {NR} regions, {n_av} avatars, +{len(new_countries)} countries added, {len(s)/1e6:.2f} MB')
